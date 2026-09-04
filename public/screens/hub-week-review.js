'use strict';

/* ── Week in Review — the recap of a week that has finished ────────────────────
   For a FINISHED week it reads every section's real activity (counts taken, spot
   checks run, deliveries received, orders placed, hours and tips logged, logs
   filed) and lays out per section: what was DONE and what it turned up, both
   derived from records that exist. Monday-based weeks. Opened from the Week ▸
   Review rail row.

   ⛔⛔ THE THIRD BAND IS GONE (2026-09-04). Every section used to end with what it
   was leaving open, and the Hub's seven section cards hold that now: they answer
   "what needs you today" and this page answers "what happened that week". The
   seven items the band was the only home for were given a home on those cards
   FIRST; the four that were facts about the SELECTED WEEK rather than about today
   (cash never reconciled that week, walked tabs that week, that week unconfirmed,
   no bills for that month) have no honest place on a page of overall standing and
   went with it ([[lessons-paid-for]] #168 — a retirement's premise is a
   measurement, so what the dying surface COULD print gets enumerated off its own
   source and ticked off one at a time).

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
   ⚠ AND EVERY OPEN ITEM GATED ON A TICK HAD TO BE RE-DERIVED OR REMOVED, never
   simply un-gated: an item was only allowed on this page if a record could prove
   it. The band those items lived in left on 2026-09-04, but the rule it was
   written under still governs every figure and every sentence here.
   Pinned by verify-week-review-recap.js. */

S.WeekReview = {
  container: null,
  _wkStart: null,   // Monday (ymd) of the selected week; null = this week
  _openSec: 'inventory',   // which section row is expanded; null = every row closed. See `_prepare`.

  open() {
    /* ⛔ WAS `_hubBlocked()` — the MANAGEMENT-ONLY question, which only asks "is this person an
       admin". So every admin reached this page regardless of what the owner had granted them,
       while Close beside it had no gate at all and History was filed under Profit: three pages
       in one rail group, three different answers. They are the Week area now. */
    if (App._hubBlocked && App._hubBlocked('week-review')) return;
    // Landing on the page opens Inventory, whatever row was left open last time. See `_prepare`.
    this._prepare();
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
  /* ⭐ AUDIT FRESHNESS, ASKED AT THE WEEK'S END, NOT AGAINST THE WALL CLOCK. The cockpits' own
     `_auditState` measures days since the newest audit against `Date.now()`, so on a recap of a week
     in March it would print "153 days old" — a fact about today wearing a past week's heading. The
     honest question about a finished week is how fresh the read was WHEN THAT WEEK CLOSED, and the
     app's own bar for "due" is 7 days. Judged against the data's own dates, so it has no shelf life
     ([[the-loop]] #135). ONE helper, three callers, so Profit, Revenue and Cash cannot drift apart
     on it ([[the-loop]] #54). */
  /* ⭐ IT HANDS BACK THE RECORD NOW, NOT ONLY THE GAP (2026-08-25). The Run Audit card prints each
     audit's SCORE as it stood when the week closed, beside the line saying how stale that run was.
     Two walks of the same store to answer one question is how the cell and the warning end up
     describing different runs ([[the-loop]] #54); this is additive, so every existing caller reads
     exactly what it always did. */
  _auditGap(records) {
    const end = this._wkE();
    const inRange = (records || [])
      .map(a => ({ a: a, d: String((a && (a.date || a.generated_at)) || '').slice(0, 10) }))
      .filter(x => x.d && x.d <= end)
      .sort((p, q) => (p.d < q.d ? -1 : p.d > q.d ? 1 : 0));
    const last = inRange[inRange.length - 1];
    if (!last) return { ever: false, days: null, stale: true, rec: null, date: '' };
    const days = Math.round((new Date(end + 'T00:00:00').getTime() - new Date(last.d + 'T00:00:00').getTime()) / 86400000);
    return { ever: true, days: days, stale: days >= 7, rec: last.a, date: last.d };
  },
  /* Section shell: header (the section name, full-bleed divider) then inset-divided blocks.
     ⛔ NO STATUS CHIP AND NO FOOTER LINK. The chip counted manual ticks and the link opened one of
     the six cockpits being deleted — seven of the twenty-three remaining cockpit references in the
     whole app were this one line. A recap does not need eight doors on it. */
  /* ⛔⛔⛔ THE SECTIONS ARE ACCORDION ROWS NOW, ONE PER RAIL SECTION (Kyle, 2026-08-25: *"not two
     cards per row like it is now.. i'm thinking setup like close the week.. where each section can
     be opened and closed with the first inventory section always open by default when landing on
     the page"*). Same shell as Close The Week's step rows, same shared `*-step-head` chevron rules
     in style.css, so the glyph, its rotation and the gold hover come from one place rather than a
     second accordion being invented here ([[the-loop]] #95: grep for the mechanism before building
     one).
     ⚠ ONE DELIBERATE DIFFERENCE FROM CLOSE THE WEEK, AND IT IS THE POINT OF THE PAGE. Close numbers
     its rows because they are things still OWED; nothing on a recap is owed, so these rows carry no
     number at all.
     ⛔⛔ THE MARK USED TO BE A COUNT OF THE CARRYING BAND, and it left with the band on 2026-09-04.
     Kept, it would have put a number on the head with nothing on the page to open, and at zero it
     drew a green check, which is a confident all-clear about a list this page no longer keeps.
     ⚠ THE HEAD NOTE IS DERIVED, NEVER TYPED, and what it summarises now is ACTIVITY: how many things
     the section logged, or that it logged nothing. A section that did no work says so once and is
     not accused of anything ([[the-loop]] #61 — this page had its accusations removed and they must
     not come back in a summary line). */
  _sectionCard(key, name, blocks, meta) {
    const m = meta || {};
    const did = m.did || [];
    const isOpen = this._openSec === key;
    /* ⛔⛔⛔ THE CARRYING BAND CAME OFF THIS PAGE, AND WITH IT EVERYTHING THAT WAS DERIVED FROM IT
       (Kyle, 2026-09-04: *"i don't think the week in review needs the 'Carrying into next week'
       section.. those items should all be on the hub cards and the week in review does not have any
       of the carrying into next week rows.. because they will already be on the current week on the
       hub cards"*). The seven Hub section cards hold what is open NOW; a recap holds what HAPPENED.
       ⭐ IT WAS SAFE ONLY BECAUSE THE HUB WAS WIDENED FIRST. Measured before cutting: the band could
       print 28 items and ELEVEN had no Hub equivalent at all, four of them live on the demo that day
       including the safe-to-spend red. Seven were current facts and moved to `_sectionAlerts`; four
       were facts about the SELECTED WEEK (cash never reconciled THAT week, walked tabs THAT week,
       that week unconfirmed, no bills for THAT month) and have no honest home on a page whose rule
       is overall standing, so they went with the band ([[lessons-paid-for]] #168 — enumerate what
       the dying surface COULD print off its own source, and tick each one off).
       ⛔ THE MARK WENT WITH IT AND HAD TO. It was a count of the carrying list, with a green check at
       zero. Left behind it would have put a number on the head with nothing on the page to open, and
       at zero it would have printed a confident all-clear about a list this page no longer keeps.
       ⚠ SO THE NOTE SUMMARISES ACTIVITY NOW, which is the only thing left the head can honestly say
       about a section. "Nothing open" went for the same reason as the mark: it is a verdict on a
       list that is gone. A section that did no work says so once and is not accused of anything
       ([[the-loop]] #61 — this page had its accusations removed and they must not come back in a
       summary line).
       ⚠ AND IT STILL MUST NOT REPEAT THE BAND BELOW IT. `_didList` prints "Nothing logged this week."
       inside the card; the head says "No activity this week", which is a different sentence for a
       different job. The last time these two agreed byte for byte it made an existing assertion
       VACUOUS and only a mutation found it ([[the-loop]] integrity #32). */
    const note = m.note || (did.length
      ? did.length + ' logged this week'
      : 'No activity this week');
    const idiv = '<div class="wr-idiv"></div>';
    const body = blocks.map(b => '<div class="wr-block">' + this._eyebrow(b.label) + b.html + '</div>').join(idiv);
    /* ⚠ THE CLASS AND THE SELECTOR MOVE TOGETHER OR EVERY ROW IS DEAD ON CLICK. `wr-step-head` is
       what `render` binds to, and `verify-week-review-accordion` parses the class out of this markup
       and the selector out of that line and asserts the two against each other, because a node
       harness cannot click ([[the-loop]] integrity #11 — the defect that killed all six Close The
       Week rows under a green gate). */
    /* ⛔ THE SHELL IS CLOSE THE WEEK'S, BYTE FOR BYTE, AND IT IS DELIBERATELY NOT A `.card`. Its rows
       are a plain bordered box, so this inherits none of the `.card` / `.card.collapsed` padding
       contract — which is the contract Kyle already had to report once, when a collapsed card showed
       21px of the wrong colour below its band. Here the head IS the whole box when closed, by
       construction, so there is nothing that can sit under it ([[lessons-paid-for]] #106 — when a
       reference implementation exists, copy its RENDER, not just its mechanism). */
    const bg = isOpen ? 'var(--step-open)' : (did.length ? 'var(--surface)' : 'var(--input)');
    return '<div style="border:1px solid var(--b-edge);border-radius:var(--r);background:' + bg + ';overflow:hidden;margin-bottom:10px;">'
      + '<div class="wr-step-head' + (isOpen ? '' : ' collapsed') + '" data-sec="' + esc(key) + '"'
      +   ' style="display:flex;align-items:center;gap:13px;padding:14px 20px;cursor:pointer;">'
      +   '<div style="flex:1;min-width:0;">'
      +     '<div style="font-size:14px;font-weight:700;color:var(--t1);">' + esc(name) + '</div>'
      +     '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + esc(note) + '</div>'
      +   '</div>'
      +   '<span class="card-chevron" aria-hidden="true">&#9662;</span>'
      + '</div>'
      + (isOpen ? '<div class="wr-secbody">' + body + '</div>' : '')
      + '</div>';
  },

  /* ⭐⭐⭐ ONE ROW PER RAIL SECTION, IN THE GUIDE'S BUILD ORDER, UNDER THE GUIDE'S OWN THREE BEATS.
     The eight cards this replaced were the six modules and two hubs the app had in July; five of
     those eight are not sections any anymore. MEASURED off `SectionTabs.groupsFor` on the live build
     rather than remembered: the rail's parts are Inventory, The Week, Run Audit, The Floor, Menus,
     Events and Books, and `hub-help.js` — the Guide — states what each one is built on. Inventory is
     the foundation; The Floor and Events FEED the week; Run Audit, Menus and Books READ finished
     weeks. That dependency is the page's three bands.
     ⛔ THIS IS A DATA TABLE WEARING A METHOD, DELIBERATELY. Every slicer in the harness suite lifts
     METHODS by name, so a `SECTIONS:` sibling would be `undefined` inside every fixture and each
     lifted render would silently take the empty path — which is exactly what `_FEW: 3` did on this
     very file until it was turned into `_few()` ([[lessons-paid-for]] #26). The tell is writing
     `NAME:` at object level.
     ⛔⛔⛔ `build` HOLDS THE FUNCTION, NOT ITS NAME, AND THE FIRST VERSION HELD THE NAME. That version
     dispatched `this[r.build]()` off a string — and string dispatch is invisible to
     `verify-no-retired-code`, which counts QUALIFIED references. MEASURED on the first gate run: it
     reported EVERY member of this file as newly unreached, `_booksSection` included, because the
     seven builders read as dead and a member wrongly seeded as dead poisons everything it calls
     ([[lessons-paid-for]] #43). A wall of red that names nothing is the tell (#100).
     ⭐ THE FIX IS THE DESIGN, NOT AN EXEMPTION IN THE DETECTOR. A real reference is visible to the
     ratchet AND fails loudly: a mistyped name here is a TypeError on the next render, where the
     string version silently dropped a whole section off the page and looked fine
     ([[the-loop]] #90 — remove the window, do not police it). */
  _plan() {
    return [
      { band: 'What fed the week', rows: [
        { key: 'inventory', name: 'Inventory', build: this._inventorySection },
        { key: 'floor',     name: 'The Floor', build: this._floorSection },
        { key: 'events',    name: 'Events',    build: this._eventsSection } ] },
      { band: 'The week itself', rows: [
        { key: 'week',      name: 'The Week',  build: this._weekSection } ] },
      { band: 'What the week fed', rows: [
        { key: 'audit',     name: 'Run Audit', build: this._auditSection },
        { key: 'menus',     name: 'Menus',     build: this._menusSection },
        { key: 'books',     name: 'Books',     build: this._booksSection } ] }
    ];
  },
  /* ⚠ `right` IS OPTIONAL AND ONLY ONE BAND EVER GETS IT. The band is a flex row now so the Export
     PDF button can sit on the same line as the heading, right-aligned; every other band passes
     nothing and renders exactly as it did. */
  _bandHead(label, right) {
    return '<div class="wr-band">' + esc(label)
      + (right ? '<span class="wr-band-act">' + right + '</span>' : '') + '</div>';
  },
  /* ⛔⛔ THE LANDING RULE LIVES HERE AND NOT IN `render`, AND THAT IS THE WHOLE REASON IT IS ITS OWN
     MEMBER. `render` runs on every toggle, so deciding the open row there would re-open Inventory on
     every click and no row could ever be closed. Close The Week hit exactly this and solved it the
     same way — `_prepare()`, lifted out of `open()` so `week.js` can ask for it when it mounts the
     panel without going back through `openHubFullPage`. This page is reached BOTH ways (the rail row
     and the section bar's Review link go through the host; a deep link goes through `open`), so both
     doors call it or the landing is right through one of them and wrong through the other
     ([[lessons-paid-for]] #59 — walk the door the operator uses, not the one you can reach). */
  _prepare() {
    const first = (this._plan()[0] || { rows: [] }).rows[0];
    this._openSec = first ? first.key : null;
  },

  /* ⛔ `.wr-head` IS RETIRED (2026-08-25). It was the 34px `--card-head` band on the top of each
     section card, matched to `.ck-head` so a card head was the app's standard header. The sections
     are accordion ROWS now and their head is a CONTROL — a mark, a name, a state line and a chevron
     — not a card band, so the band class has no element left to reach. Removed from the stylesheet
     rather than left behind: dead CSS reads as a slot something is supposed to fill, and
     `verify-card-head-band` keeps `wr-head` in its registry AT ZERO so it cannot come back silently
     ([[harness-review-like-code]] #70 — invert or re-point, never delete the row). */

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
    //      consumer honours it: hub.js and r-dashboard.js both print '-'. This was the
    //      only site that invented a value. (A third consumer was named here until T123
    //      deleted it; a justification that cites a door which no longer exists leaves the
    //      next reader keeping a phantom in step.)
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
  /* ⛔⛔ THIS CARD GREW, AND EVERY ARRIVAL CAME FROM THE NAV RATHER THAN FROM AN OPINION. Measured
     off `SectionTabs.groupsFor('inventory')` on the live build: the Voids / Comps Log, the Waste /
     Spill Log, the Vendor Discrepancies page and Trapped Cash are all INVENTORY rows now — Kyle
     moved them there — while this recap still filed voids and waste under Shift, discrepancies under
     Profit and trapped cash under Cash. A recap that files a record somewhere the operator cannot
     navigate to is telling them the wrong place to go ([[lessons-paid-for]] #83: ask what the
     operator DOES there, not which old page name matches). */
  _inventorySection(key, name) {
    // No cockpit alias and no absence guard, for the reason written on the Week card.
    const inv = (App.inventoryData) || {};
    const shf = (App.shiftData) || {};
    const products = (inv.ic_products || []).filter(p => p.active !== false);
    if (!products.length || !(inv.ic_counts || []).length) return null;

    /* ⚠ THE BORROW HERE WAS LIVE IN MECHANISM AND INERT IN EFFECT, WHICH IS THE WORST OF BOTH.
       `computeState()` returns 27 fields and exactly THREE depend on the week (`hasCountThisWeek`,
       `weekCount`, `deliveriesThisWeek`). This card reads seven, and not one of them is on that
       list — so the page moved another screen's week selector to change three values it then threw
       away. Measured before cutting, not assumed. */
    const st = this._inventoryFigures();
    /* Trapped Cash is an Inventory ▸ Reports row now.
       ⚠ BARE, like the `CashEngine.trapped()` call in `_inventoryFigures` twenty lines down and for
       the reason written there: a guarded fallback on a helper that is required for CORRECTNESS
       turns a loud failure into a quiet wrong number, which is the trade this codebase gets wrong
       most often ([[the-loop]] #40). My first version read `window.CashEngine && …` and would have
       printed a dash for trapped cash on any load where the engine was late. */
    const trap = CashEngine.trapped();

    /* ⭐ THE RECORDS, NOT THEIR COUNTS. Every one of these used to be `.length` and the whole point
       of the rewrite is the detail that was being thrown away on the next line. */
    const cCounts = (inv.ic_counts || []).filter(c => this._inWeek(c.date));
    const cSpot   = App.completedSpotChecks().filter(s => this._inWeek(s.date));
    const cDeliv  = (inv.ic_deliveries || []).filter(d => this._inWeek(d.date));
    const cOrders = (inv.ic_orders || []).filter(o => this._inWeek(o.date));
    const cAdj    = (inv.ic_adjustments || []).filter(a => this._inWeek(a.date_time || a.created_at));
    const cXfer   = (inv.ic_transfers || []).filter(t => this._inWeek(t.date_time || t.created_at));
    // Inventory ▸ Logs and Inventory ▸ Vendors, read the same way every other line on this card is.
    const cVC     = (shf.sc_void_comps || []).filter(r => this._inWeek(r.date));
    const cWaste  = (shf.sc_waste || []).filter(r => this._inWeek(r.date));
    const cDisc   = ((App.data && App.data.vendor_discrepancies) || [])
      .filter(d => this._inWeek(d.date || d.filed_at || d.created_at));

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
    /* ⚠ THE THREE SENTENCES BELOW ARE LIFTED WHOLE, NOT REWRITTEN. They were already correct on the
       Shift and Profit cards; what changed is which card they belong to. Re-typing a working
       sentence is how the same fact ends up with two spellings ([[lessons-paid-for]] #131). */
    if (cVC.length) {
      const voidTot = cVC.filter(r => r.type === 'Void').reduce((t, r) => t + (r.amount || 0), 0);
      const compTot = cVC.filter(r => r.type === 'Comp').reduce((t, r) => t + (r.amount || 0), 0);
      const topVC = this._topOf(cVC, r => r.amount || 0) || (cVC.length === 1 ? cVC[0] : null);
      const bits = topVC ? ['Biggest was ' + this._amt(topVC.amount),
        this._nm(topVC.item) ? 'on ' + this._nm(topVC.item) : '',
        this._nm(topVC.server) ? 'by ' + this._nm(topVC.server) : '',
        this._day(topVC.date)].filter(Boolean) : [];
      did.push(this._n(cVC.length + ' ' + this._plu(cVC.length, 'void or comp', 'voids and comps')) + ', ' + this._m0(voidTot + compTot) + '.'
        + (bits.length ? ' ' + bits.join(' ')
            + (this._nm(topVC.reason) ? ' (' + this._nm(topVC.reason).toLowerCase() + ')' : '') + '.' : ''));
    }
    if (cWaste.length) {
      const cost = cWaste.reduce((t, r) => t + (r.cost || 0), 0);
      const top = this._topOf(cWaste, r => r.cost || 0) || (cWaste.length === 1 ? cWaste[0] : null);
      did.push(this._n(cWaste.length + ' waste ' + this._plu(cWaste.length, 'entry', 'entries')) + (cost ? ', ' + this._m0(cost) : '') + '.'
        + (top && this._nm(top.product_name) ? ' Most of it ' + this._nm(top.product_name)
            + (this._nm(top.reason) ? ' (' + this._nm(top.reason).toLowerCase() + ')' : '') + '.' : ''));
    }
    if (cDisc.length) {
      const over = cDisc.reduce((t, d) => t + (d.overcharge || 0), 0);
      did.push(this._n(cDisc.length + ' vendor ' + this._plu(cDisc.length, 'discrepancy', 'discrepancies')) + ' filed'
        + (over ? ', ' + this._m0(over) + ' overcharged' : '') + '.');
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
      this._res('Dead Stock', String(st.deadAll), st.deadAll > 0 ? 'var(--red)' : 'var(--t1)'),
      /* ⛔ TRAPPED CASH CAME OFF THE CASH CARD (2026-08-25). `c-trapped` is an INVENTORY ▸ Reports
         row now, and it answers the same question as the two cells beside it: what is your money
         doing on the shelf. It sat under a Cash heading here while the operator's only door to it
         was in Inventory. Same reader as before — `CashEngine.trapped()` — so the figure does not
         move, only the card it is filed on. */
      this._res('Trapped Cash', trap.hasData ? App.fmtCurrency(trap.total, 0) : '-',
        (trap.hasData && trap.total > 0) ? 'var(--amber)' : 'var(--t1)')
    ]);

    // The PDF carries the same sentences the screen shows. Paper and page say one thing.
    (this._pdf || (this._pdf = [])).push({ name: name, activity: this._didPlain(did),
      // ⛔ W3: the PDF is the artefact that leaves the building, so it names the basis too.
      results: 'Current stock: Used ' + (st.periodCost != null ? App.fmtCurrency(st.periodCost, 0) : '-') + ', Below Par ' + App.fmtCurrency(st.reorderTotal, 0) + ', Dead Stock ' + st.deadAll + ', Trapped Cash ' + (trap.hasData ? App.fmtCurrency(trap.total, 0) : '-') + '; Ordered this week ' + App.fmtCurrency(ordTot, 0) });
    /* ⛔ W3: EVERY CELL NAMES ITS OWN BASIS NOW. Three of these four are figures about TODAY —
       `Below Par` is the Order Sheet's plan as it stands, `Dead Stock` is what is tying up cash
       right now, and `Used This Period` is the newest count PAIR, whenever those counts happened.
       Printed under a heading naming a finished week they read as that week's numbers, which is the
       defect this card already removed `Recoverable/yr` and `Shrinkage 30d` for.
       ⭐ THE PAGE ALREADY HAD THE ANSWER: Cash and Events both suffix the band when its figures are
       current state (`· Current Position`, `· Current Pipeline`). Inventory joins them, and the one
       genuinely week-true cell says so in its own label rather than being tarred by the suffix. */
    return this._sectionCard(key, name, [
      { label: 'Done This Week', html: activity },
      { label: 'What It Turned Up &middot; Current Stock', html: results }
    ], { did: did });
  },

  /* ── THE FLOOR ────────────────────────────────────────────────────────────────────────────────
     ⛔⛔⛔ LABOR AND SHIFT WERE TWO CARDS AND THE FLOOR IS ONE SECTION (Kyle, 2026-08-23: *"the floor
     link goes under audits in rail menu and control goes away"*). `_PROTO_CONTROL` was DELETED, not
     emptied, and The Floor took both modules' pages; this recap was still printing a LABOR card and
     a SHIFT card for a bar whose rail has neither word on it.
     ⭐ WHAT THE MERGE IS NOT: it is not two cards stacked. Measured against the section's own nav —
     Schedules, Pay, The Safe, Sales, Records, Checklists, Setup — voids/comps and waste are NOT here
     any more (they are Inventory ▸ Logs) and neither is the sales log, so the merged card is
     genuinely smaller than the two it replaces rather than the sum of them.
     ⭐⭐ AND THE SERVER CHECKS CAME HOME. `r-server-check` and `sales-integrity` are The Floor ▸
     Sales; they were split across the old Profit and Revenue cards, which is two cards reporting one
     pair of screens.
     ⛔⛔ ONE MORE THING MOVED OFF THIS CARD AND IT MATTERS MOST: Net Sales, Covers and Check Avg.
     They are `sc_shifts` — and NOTHING in The Floor's nav writes `sc_shifts`. The sales lane that
     does is on CLOSE THE WEEK, so the week's takings belong to The Week card. That also ends the
     page printing Net Sales twice under two headings ([[the-loop]] #54).
     ⚠ THE LABOR % LABEL IS LOAD-BEARING AND IT IS NOT A STYLE CHOICE. [[labor-cost-model]] locks
     THREE deliberate labor bases that are NOT meant to match, and this one — cost over raw
     `sc_shifts` revenue — is the operational read, which that file says must be labelled "% of floor
     sales" so it is never mistaken for the P&L number. This page dropped the qualifier and printed
     "Labor 24.1%" in its header beside "Labor % 24.9%" on this card. Both are right; only the label
     was wrong ([[the-loop]] #57 — different quantities are allowed to differ, the fix is the label).
  */
  /* ⭐⭐ THE CARD IS ONE, THE READERS ARE TWO, AND THAT IS DELIBERATE. The Floor's pages sit in two
     stores — `lc_*` (schedules, hours, tips, staff) and `sc_*` (the safe, drawers, records) — and
     each half has its own day-one gate: a bar can run The Floor for its checklists and never log an
     hour. Composing two readers keeps each gate honest, where one merged body would have to answer
     for both at once and would go dark on a bar that only uses half the section.
     ⚠ NEITHER HALF RETURNS MARKUP. They hand back `{ did, open, cells }` so `_floorSection` decides
     the card, which is the only place that knows the row's key and name. A half that rendered its
     own card would be the two-cards-stacked shape the merge exists to end. */
  _floorLabor() {
    const lab = (App.laborData) || {};
    if (!(lab.lc_staff || []).length || !(lab.lc_actuals || []).length) return null;

    const target = App.laborTargetPct ? App.laborTargetPct() : 29;
    const today = App.todayLocal();

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
    /* ⛔ THE OLD STRIP PRINTED THE PENDING COUNT UNDER "DONE THIS WEEK", AND IT IS NOT A WEEK
       FIGURE. It counts every request still sitting unanswered, whenever it was made, so a request
       typed in March was being reported as something the crew did last week. What belongs in a
       recap is requests RAISED in the week, off `created_at`, which is what this reads.
       ⭐ AND THE PENDING COUNT ITSELF LEFT THIS FILE on 2026-09-04 with the carrying band. It was
       always a fact about TODAY rather than about the week on screen, which is precisely why it
       could move: the Hub's Floor card reports it now, off the same one-line read of the same
       store. A figure that describes the present belongs on the page about the present. */
    const toNew = (lab.lc_time_off || []).filter(t => this._inWeek(t.created_at)).length;
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
    const cells = [
      this._res('Labor Cost', App.fmtCurrency(wkCost, 0)),
      /* ⛔⛔⛔ "% OF FLOOR SALES", NOT A BARE "LABOR %", AND THE RULE IS LOCKED RATHER THAN CHOSEN.
         [[labor-cost-model]] THE DENOMINATORS names THREE labor percentages on three deliberate
         bases and says in as many words that they are NOT meant to match: `labor_pct_blended` over
         TOTAL SALES, `hourly_labor_pct` over bar+food, and this one — cost over the raw
         `sc_shifts` takings — which that file calls the operational live-vs-confirmed view and
         instructs to label *"% of floor sales"* so it is not mistaken for the P&L number. The
         instruction ends *"Keep the label if you touch it."*
         MEASURED ON THE PUSHED BUILD: this page's header read LABOR 24.1% (the confirmed week's
         blended figure) while this cell read LABOR % 24.9% — same denominator that week, numerators
         $4,613.78 against $4,774.66, the difference being the OT premium and tip-credit makeup that
         `lc_actuals` does not store. Both numbers are correct and the page said nothing about which
         question either one answered ([[the-loop]] #57 — different quantities may differ; the fix is
         the label, never the arithmetic). */
      this._res('Labor % (floor sales)', laborPct != null ? laborPct.toFixed(1) + '%' : '-', (laborPct != null && laborPct > target) ? 'var(--amber)' : 'var(--t1)'),
      this._res('Hours', wkHours.toFixed(1)),
      this._res('RPLH', rplh != null ? App.fmtCurrency(rplh) : '-'),
      this._res('OT Risk', String(otRisk), otRisk > 0 ? 'var(--amber)' : 'var(--t1)')
    ];

    // The paper says what the screen says, including the qualifier on the labor percentage.
    return { did: did, cells: cells,
      plain: 'Labor Cost ' + App.fmtCurrency(wkCost, 0) + ', Labor % (floor sales) ' + (laborPct != null ? laborPct.toFixed(1) + '%' : '-') + ', Hours ' + wkHours.toFixed(1) + ', RPLH ' + (rplh != null ? App.fmtCurrency(rplh) : '-') + ', OT Risk ' + otRisk };
  },

  /* ── The Floor's second half: the safe, the drawers and the shift records ─────────────────────
     ⛔ THE SALES HALF LEFT THIS READER. Net Sales, Covers, Check Avg and the day-by-day sales
     sentence were here because `sc_shifts` was the Shift cockpit's own store. Nothing in The Floor's
     nav writes `sc_shifts` — the sales lane that does is on CLOSE THE WEEK — so they are the WEEK's
     numbers and `_weekSection` reads them now. Voids/comps and waste left for the same kind of
     reason: they are Inventory ▸ Logs rows. What is left is exactly what The Floor's own pages own. */
  _floorShift() {
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
    /* ⚠ THE SALES, VOIDS/COMPS AND WASTE READS ARE GONE FROM HERE, NOT JUST THEIR SENTENCES. A
       `const` that is computed and read by nothing is the shape a half-finished move leaves behind,
       and it reads to the next person as a feature that was built and never wired
       ([[the-loop]] #25). `days` survives because the "cash was never reconciled" guard needs to
       know the bar traded at all. */
    const wkS = (sh.sc_shifts || []).filter(s => this._inWeek(s.date));
    const days = wkS.length;
    const wkVar = (sh.sc_variances || []).filter(v => this._inWeek(v.date));
    const netVar = wkVar.reduce((t, v) => t + (v.variance || 0), 0);
    const shorts = wkVar.filter(v => v.status === 'Short').length;
    const overs = wkVar.filter(v => v.status === 'Over').length;
    const reconN = wkVar.length;
    const walkRows = (sh.sc_walked_tabs || []).filter(r => this._inWeek(r.date));
    const walkedN = walkRows.length;
    // Named only when one genuinely beats every other — see `_topOf`.
    const worstVar = this._topOf(wkVar.filter(v => (v.variance || 0) < 0), v => -(v.variance || 0))
      || (wkVar.filter(v => (v.variance || 0) < 0).length === 1 ? wkVar.filter(v => (v.variance || 0) < 0)[0] : null);

    /* ⛔ THE DAY-BY-DAY SALES SENTENCE MOVED TO THE WEEK. It reads `sc_shifts`, and the only thing in
       the app that writes `sc_shifts` is Close The Week's sales lane — so "7 days of sales logged,
       $19,150 on 500 covers" is a fact about the WEEK being closed, not about the section. Leaving
       it here is what put Net Sales on two cards under two headings. */
    const did = [];
    if (reconN) {
      const clean = reconN - shorts - overs;
      did.push(this._n(reconN + ' drawer ' + this._plu(reconN, 'reconcile')) + ', '
        + (shorts + overs === 0 ? 'all within tolerance.'
           : clean + ' within tolerance, ' + this._join([shorts ? shorts + ' short' : '', overs ? overs + ' over' : ''].filter(Boolean)) + '.')
        + (worstVar ? ' Worst was ' + this._nm(worstVar.drawer) + this._on(worstVar.date) + ', '
            + App.fmtBal(worstVar.variance, 0) + this._by(worstVar.cashier) + '.' : ''));
    }
    /* ⛔ THE VOIDS/COMPS AND WASTE SENTENCES MOVED TO INVENTORY, whole and unedited, because the Voids
       / Comps Log and the Waste / Spill Log are INVENTORY ▸ Logs rows now. The composed-from-parts
       note that used to live here went with the sentence it describes. */
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
    const cells = [
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
        reconN ? (App.fmtSigned(netVar, 0).sign < 0 ? 'var(--red)' : 'var(--t1)') : 'var(--t3)')
      /* ⛔ VOIDS + COMPS IS NOT A CELL HERE ANY MORE. Same move as the sentence above it — the log is
         an Inventory row — and it was also the second place this page printed that total. */
    ];

    // ⚠ THE PDF SAYS WHAT THE SCREEN SAYS. Same guard, same rounded sign — this line is the one
    // that gets handed to somebody, so a "$0.00" here for an uncounted week is the same lie in a
    // document ([[the-loop]] #54: the moment a quantity is printed twice, the test is that they agree).
    return { did: did, cells: cells,
      plain: 'Over/Short ' + (reconN ? (App.fmtSigned(netVar, 0).sign > 0 ? '+' : '') + App.fmtBal(netVar, 0) : 'Not counted') };
  },

  /* ── The Floor's third half: the Sales pages ──────────────────────────────────────────────────
     ⛔⛔ SERVER CHECK AND INTEGRITY REVIEW ARE ONE PAIR OF SCREENS AND THIS PAGE REPORTED THEM ON TWO
     DIFFERENT CARDS. `sales_reviews` (the Integrity Review's filed report) was on the Profit card and
     `revenue_server_checks` was on the Revenue card — two deleted sections between them, for two
     rows sitting side by side under The Floor ▸ Sales.
     ⚠ ITS OWN GATE, for the reason the header on `_floorLabor` gives: these two stores are neither
     `lc_*` nor `sc_*`, so a bar that runs checks without logging hours or drawers still gets its
     lines, and a bar that does neither adds nothing rather than an empty heading. */
  _floorSales() {
    const dat = App.data || {};
    const revWk  = (dat.sales_reviews || []).filter(r => this._inWeek(r.date || r.created_at));
    const chkWk  = (dat.revenue_server_checks || []).filter(c => this._inWeek(c.date || c.created_at));
    if (!revWk.length && !chkWk.length) return null;

    const did = [];
    if (chkWk.length) {
      const sales = chkWk.reduce((t, c) => t + (c.sales || 0), 0);
      const covs = chkWk.reduce((t, c) => t + (c.covers || 0), 0);
      const who = [...new Set(chkWk.map(c => this._nm(c.server_name)).filter(Boolean))];
      did.push(this._n(chkWk.length + ' server ' + this._plu(chkWk.length, 'check')) + ' run'
        + this._on(chkWk[0].date) + '.'
        + (who.length && who.length <= this._few() ? ' ' + this._join(who) + '.' : '')
        + (sales ? ' ' + this._m0(sales) + ' across ' + covs + ' ' + this._plu(covs, 'cover') + '.' : ''));
    }
    revWk.forEach(r => {
      const s = r.summary || {};
      did.push(this._n('Integrity review') + ' filed' + this._on(r.date || r.created_at) + '.'
        + (s.reviewed ? ' ' + s.reviewed + ' ' + this._plu(s.reviewed, 'server') + ' checked, '
            + (s.flagged || 0) + ' flagged' + (s.high ? ', ' + s.high + ' high risk' : '')
            + (s.exposure ? ', ' + this._amt(s.exposure) + ' exposed' : '') + '.' : ''));
    });
    return { did: did, cells: [], plain: '' };
  },

  /* ── THE FLOOR, composed ──────────────────────────────────────────────────────────────────────
     ⚠ THE ORDER OF THE HALVES IS THE SECTION'S OWN BAR ORDER — Schedules and Pay, then The Safe and
     the Records, then Sales — so the card reads the way the top bar reads. There is no ranking in
     it and nothing sorts the halves against each other: the activity rows come out in the order the
     three parts produce them, which is the bar's order.
     ⚠ THIS NOTE USED TO CITE THE CARRY-OVER SORTER AS THE REASON NO RANKING WAS NEEDED. That sorter
     left with the band on 2026-09-04, so the sentence became false the moment the code changed. A
     comment that has outlived its mechanism is worse than none, because the next reader acts on it
     ([[the-loop]] #61's third grep — the render call, the orphaned helpers, and the words). */
  _floorSection(key, name) {
    const parts = [this._floorLabor(), this._floorShift(), this._floorSales()].filter(Boolean);
    if (!parts.length) return null;
    const did = parts.flatMap(p => p.did || []);
    const cells = parts.flatMap(p => p.cells || []);
    const activity = this._didList(did);
    (this._pdf || (this._pdf = [])).push({ name: name, activity: this._didPlain(did),
      results: parts.map(p => p.plain).filter(Boolean).join(', ') || 'Nothing measured' });
    return this._sectionCard(key, name, [
      { label: 'Done This Week', html: activity },
      { label: 'What It Turned Up', html: this._resRow(cells) }
    ], { did: did });
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

  /* ── THE WEEK ─────────────────────────────────────────────────────────────────────────────────
     ⭐⭐⭐ THIS CARD IS NEW, AND IT IS THE ONE THE PAGE WAS MISSING. The Week is a rail section with
     three pages of its own — Close, Review, History — and the recap of a week had no card for the
     week itself: its cost percentages sat on a PROFIT card, its check average on a REVENUE card and
     its takings on a SHIFT card, two of those three named after sections the app has deleted.
     ⭐ EVERY FIGURE HERE COMES OFF THE WEEK RECORD OR THE WEEK'S OWN SALES LOG, which is what makes
     it the week's card rather than a summary of other cards: `weeks` and `revenue_weeks` are written
     by Confirm the Week, and `sc_shifts` by Close The Week's sales lane. Nothing on it is a fact
     about today.
     ⛔⛔ AND IT IS DELIBERATELY NOT A SECOND COPY OF THE HEADER. The stat box at the top of the page
     answers "what did you sign off" — Net Sales, Prime Cost, Labor — so this card carries the week
     numbers that headline does NOT: covers, check average, the two component costs and revenue per
     labor hour. Before this, Net Sales was printed twice, Prime Cost twice and Check Average twice,
     each pair under a different heading with nothing saying they were the same figure
     ([[the-loop]] #54 — the moment a quantity appears twice, the test is that they agree, and the
     cheaper fix is that it appears once).
     ⚠ THE TWO HELPERS ARE READ BY LABEL, NEVER BY POSITION. `_metricsRows` returns three rows and
     this card wants two of them; `metrics[0]` / `metrics[2]` would break silently the day anyone
     reorders that table, which is a defect this suite has already paid for
     ([[lessons-paid-for]] #70). */
  _weekSection(key, name) {
    const sh = (App.shiftData) || {};
    const w = this._savedProfitWeek(this._wkE());
    const rw = this._savedRevenueWeek(this._wkE());
    const wkS = (sh.sc_shifts || []).filter(s => this._inWeek(s.date));
    if (!w && !rw && !wkS.length) return null;

    const costRows = w ? this._costRows(w) : null;
    const metrics = this._metricsRows(rw || {});
    const metric = lab => metrics.find(m => m.label === lab) || null;
    const rev = wkS.reduce((t, s) => t + (parseFloat(s.total_revenue) || 0), 0);
    const covers = wkS.reduce((t, s) => t + (s.covers || 0), 0);
    const days = wkS.length;
    // Named only when one day genuinely beats every other — see `_topOf`.
    const bestDay = this._topOf(wkS, s => parseFloat(s.total_revenue) || 0);

    /* ⛔ A WEEK TOTAL IS NOT ONE DAY. `days` is a ROW COUNT, which was the same thing as a day count
       for as long as the only way sales arrived was a file or the day-by-day grid. Close The Week
       now takes three numbers for the whole week and writes ONE row, so this read "1 day of sales
       logged, $19,000 on 500 covers" about a full seven days ([[output-honesty]] — a number that is
       true of the record and false about the bar).
       ⭐ The row says what it is, so this asks rather than infers. And when it IS a week total there
       is no honest day count to give, so the sentence names the week instead of counting.
       ⚠ `_topOf` already refuses below two rows, so the "Best night" clause cannot fire on a week
       total and name a whole week as one night — checked, not assumed. */
    const weekTotalOnly = wkS.length > 0 && wkS.every(s => App.isWeekTotalShift(s));
    const did = [];
    if (days && weekTotalOnly) did.push(this._n('The week\'s sales') + ', ' + this._m0(rev)
      + ' on ' + covers + ' ' + this._plu(covers, 'cover') + '.');
    else if (days) did.push(this._n(days + ' ' + this._plu(days, 'day')) + ' of sales logged, ' + this._m0(rev)
      + ' on ' + covers + ' ' + this._plu(covers, 'cover') + '.'
      + (bestDay ? ' Best night' + this._on(bestDay.date) + ', ' + this._m0(bestDay.total_revenue)
          + (bestDay.covers ? ' on ' + bestDay.covers + ' covers' : '') + '.' : ''));
    /* ⭐ CONFIRMING THE WEEK IS A THING THE OPERATOR DID, so it gets a line like every other thing
       they did. It is the one act this whole section exists for and the recap never said it out
       loud — the page only ever mentioned the close by ACCUSING somebody of skipping it. */
    if (w) did.push(this._n('The week') + ' was confirmed.');
    const activity = this._didList(did);

    const costCell = (i, label) => {
      const r = costRows ? costRows[i] : null;
      const has = r && r.val != null;
      return this._res(label, has ? r.val.toFixed(1) + '%' : '-', has ? (r.over ? 'var(--red)' : 'var(--green)') : 'var(--t1)');
    };
    const mCell = (lab, label) => {
      const m = metric(lab);
      const col = (m && m.good != null) ? (m.good ? 'var(--green)' : 'var(--red)') : 'var(--t1)';
      return this._res(label, m ? m.value : '-', col);
    };
    const cells = [
      this._res('Covers', String(covers)),
      mCell('Check Average', 'Check Avg'),
      costCell(0, 'Bar Pour'),
      costCell(1, 'Food Cost'),
      mCell('Revenue / Labor Hour', 'Rev / Labor Hr')
    ];


    const pcv = i => (costRows && costRows[i] && costRows[i].val != null) ? (costRows[i].val.toFixed(1) + '%') : '-';
    (this._pdf || (this._pdf = [])).push({ name: name, activity: this._didPlain(did),
      results: 'Covers ' + covers + ', Check Avg ' + ((metric('Check Average') || {}).value || '-')
        + ', Bar Pour ' + pcv(0) + ', Food ' + pcv(1)
        + ', Rev/Labor Hr ' + ((metric('Revenue / Labor Hour') || {}).value || '-') });
    return this._sectionCard(key, name, [
      { label: 'Done This Week', html: activity },
      { label: 'What It Turned Up', html: this._resRow(cells) }
    ], { did: did });
  },

  /* ── RUN AUDIT ────────────────────────────────────────────────────────────────────────────────
     ⭐⭐⭐ FOUR AUDITS, ONE SECTION, AND THE FIRST OF THEM HAD NEVER BEEN ON THIS PAGE AT ALL.
     MEASURED on the pushed build: `bar_cop_audits` — the Operations Audit — holds 13 records, one of
     them inside the reviewed week, scored 76 with 7 action items, and this recap read the other
     three stores and not that one. Run Audit's own bar lists Operations FIRST. Meanwhile Profit,
     Revenue and Cash each had a full CARD named after a section the app deleted, and the only
     content any of them had left was an audit.
     ⛔ THE STORE NAMES ARE THE APP'S AND ARE NOT TIDIED HERE. `audits` is the Profit audit;
     `bar_cop_audits` is Operations. Renaming either is a data migration, not a recap change, and a
     field's meaning belongs to the code that already writes it ([[lessons-paid-for]] #63). The table
     below is the one place the pairing is written.
     ⚠ AN AUDIT A BAR HAS NEVER RUN AT ALL RAISES NOTHING. Day one has no audits by definition, and a
     recap that opens by listing four things you have never done is the accusation this page had
     removed. Staleness is only asked of an audit that exists. */
  _auditSection(key, name) {
    const dat = App.data || {};
    const AUD = [
      { label: 'Operations', store: 'bar_cop_audits' },
      { label: 'Profit',     store: 'audits' },
      { label: 'Revenue',    store: 'revenue_audits' },
      { label: 'Cash',       store: 'cash_audits' }
    ];
    const reads = AUD.map(a => {
      const rows = dat[a.store] || [];
      return { label: a.label, rows: rows,
        wk: rows.filter(r => this._inWeek((r.date || r.generated_at || '').slice(0, 10))),
        gap: this._auditGap(rows) };
    });
    if (!reads.some(r => r.rows.length)) return null;

    const did = [];
    reads.forEach(r => r.wk.forEach(a => {
      const items = (a.action_items || []);
      const yr = items.reduce((s, x) => s + (x.monthly_impact || 0), 0) * 12;
      did.push(this._n(r.label + ' audit') + ' run' + this._on(a.date || (a.generated_at || '').slice(0, 10))
        + (a.overall_score != null ? ', scored ' + a.overall_score : '') + '.'
        + (items.length ? ' ' + items.length + ' action ' + this._plu(items.length, 'item')
            + (yr ? ' worth ' + this._m0(yr) + '/yr' : '') + '.' : ''));
    }));
    const activity = this._didList(did);

    /* ⭐ THE SCORE AS IT STOOD WHEN THE WEEK CLOSED, not as it stands today. `_auditGap` already
       walks each store to the newest record on or before the week's end for the staleness line; it
       hands back that RECORD now so the cell and the warning cannot disagree about which run they
       are describing ([[the-loop]] #54, one walk not two).
       ⚠ NEUTRAL, NO COLOUR. A score is a number, and colour on this page means "something is wrong
       here" ([[dashboard-discipline]]). What is wrong is staleness, and that is said in words below
       rather than painted onto a figure that is only ever as good as the day it was run. */
    const cells = reads.map(r => this._res(r.label,
      (r.gap.rec && r.gap.rec.overall_score != null) ? String(r.gap.rec.overall_score) : '-'));


    (this._pdf || (this._pdf = [])).push({ name: name, activity: this._didPlain(did),
      results: reads.map(r => r.label + ' ' + ((r.gap.rec && r.gap.rec.overall_score != null) ? r.gap.rec.overall_score : '-')).join(', ') });
    return this._sectionCard(key, name, [
      { label: 'Done This Week', html: activity },
      { label: 'What It Turned Up &middot; Scores At Week End', html: this._resRow(cells) }
    ], { did: did });
  },

  /* ── MENUS ────────────────────────────────────────────────────────────────────────────────────
     ⭐⭐ A SECTION WITH FIVE PAGES AND NO CARD. Menus is a rail row — Builder, Rundown, Engineering,
     Recipe Summary, Dog Test — and its week showed up in two other places: the price log and the dog
     tests were on the REVENUE card, and "N menu items over cost target" was on the INVENTORY card.
     Inventory owns the product COSTS that feed a menu item, which is a reason the two are linked and
     not a reason to file a menu finding under Inventory.
     ⛔ UNGRADEABLE ITEMS ARE DELIBERATELY NOT A CELL HERE, AND THIS IS THE MEASUREMENT THAT DECIDED
     IT. [[the-loop]] #72 says a "N problems" count must print what it could not evaluate beside it,
     which is exactly what `App.menuItemsUngradeable()` is for. Measured on the live seed it returns
     28 — and every one of them is a beer, a wine or an NA item, because `menuTargetPct` returns null
     for those categories BY DESIGN. Printing "28 ungradeable" would manufacture an alarm out of a
     deliberate rule ([[lessons-paid-for]] #91 — a reading that looks like a hole in the data, where
     the app is right). The count belongs where a target CAN be set, which is not this recap. */
  _menusSection(key, name) {
    const dat = App.data || {};
    const items = App.menuItems ? App.menuItems().filter(it => it && !it.archived) : [];
    if (!items.length) return null;

    const priceWk = (dat.revenue_price_log || []).filter(p => this._inWeek(p.date || p.created_at || p.changed_at));
    const dogWk   = (dat.menu_dog_tests || []).filter(t => this._inWeek(t.start_date || t.created_at));
    const over    = App.menuItemsOverTarget ? App.menuItemsOverTarget().length : 0;

    const did = [];
    if (priceWk.length) {
      const each = priceWk.length <= this._few()
        ? ' ' + this._join(priceWk.map(p => this._nm(p.item_name)
            + (p.old_price != null && p.new_price != null ? ' ' + this._amt(p.old_price) + ' to ' + this._amt(p.new_price) : ''))) + '.'
        : '';
      did.push(this._n(priceWk.length + ' price ' + this._plu(priceWk.length, 'change')) + ' made.' + each);
    }
    if (dogWk.length) did.push(this._n(dogWk.length + ' dog ' + this._plu(dogWk.length, 'test')) + ' started'
      + (dogWk.length <= this._few() ? ' on ' + this._join(dogWk.map(t => this._nm(t.item_name))) : '') + '.');
    const activity = this._didList(did);

    /* ⚠ THESE TWO ARE FACTS ABOUT TODAY, not about the finished week, so the band says so in its own
       label the same way Inventory's and Books' do. A menu is priced as it stands; there is no
       weekly snapshot of it to read back ([[lessons-paid-for]] #89's neighbour — say the basis). */
    const cells = [
      /* ⚠ "MENU ITEMS", NOT "PRICED ITEMS", AND THE DIFFERENCE IS HONESTY. This counts every
         non-archived item on the menu — an item with no price on it is in that number — so calling
         them priced would be a claim the figure does not support ([[output-honesty]]: every
         displayed number must be true, including what its label says it is). */
      this._res('Menu Items', String(items.length)),
      this._res('Over Cost Target', String(over), over > 0 ? 'var(--amber)' : 'var(--t1)'),
      this._res('Price Changes', String(priceWk.length))
    ];


    (this._pdf || (this._pdf = [])).push({ name: name, activity: this._didPlain(did),
      // ⚠ The paper says what the screen says, down to the noun — see the cell's own note.
      results: 'Current menu: ' + items.length + ' menu items, ' + over + ' over cost target; '
        + priceWk.length + ' price change' + (priceWk.length === 1 ? '' : 's') + ' this week' });
    return this._sectionCard(key, name, [
      { label: 'Done This Week', html: activity },
      { label: 'What It Turned Up &middot; Current Menu', html: this._resRow(cells) }
    ], { did: did });
  },
  // ── Events (pipeline, not a weekly close) ───────────────────────────────────
  _eventsSection(key, name) {
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


    (this._pdf || (this._pdf = [])).push({ name: name, activity: this._didPlain(did),
      results: 'Booked ' + ED._money(st.bookedRev) + ', Pipeline ' + ED._money(st.pipeline) + ', Deposits Due ' + ED._money(st.depositsDue) + ', Win Rate ' + st.conv });
    return this._sectionCard(key, name, [
      { label: 'Done This Week', html: activity },
      { label: 'What It Turned Up &middot; Current Pipeline', html: results }
    ], { did: did });
  },

  // ── Books (monthly close) ───────────────────────────────────────────────────
  /* ⛔⛔ THESE TWO WERE BORROWED FROM `S.HubBooksHome` AND THAT PAGE IS GONE (2026-08-23). This
     section read `BH._money` / `BH._pct` and opened `if (!BH) return ''` — so deleting Close Books
     would have emptied a whole Week in Review card with nothing in the console to say why. Found by
     sweeping who READS the page rather than by reading the delete list, which is the sweep that
     names what breaks ([[lessons-paid-for]] #111 — the same shape as `weeklyReadout` reading
     `window.FIX` through the Fix retirement).
     ⭐ RE-HOMED, NOT RE-IMPLEMENTED: both were one-line formatters over `App.fmtBal`, so they come
     here verbatim and this section now depends on nothing outside itself. */
  _money(v) { return (v == null || isNaN(v)) ? '-' : App.fmtBal(Number(v)); },
  _pct(v)   { return (v == null || isNaN(v)) ? '-' : (v * 100).toFixed(1) + '%'; },

  /* ⛔⛔ BOOKS TOOK THE CASH POSITION, AND IT TOOK IT FROM A CARD NAMED AFTER A DELETED SECTION.
     Measured off the section's own nav: Break-Even, Capital Efficiency, Cash Position, Cash Bridge,
     Cash Forecast, Profit Forecast and Revenue Forecast are all BOOKS rows now. The recap was
     printing runway and safe-to-spend under a CASH heading whose only door had been deleted, and
     printing the SAME cash-outflow line on both that card and this one — one week's outflows counted
     once and reported twice, ten inches apart.
     ⚠ TRAPPED CASH DID NOT COME HERE. It went to Inventory, because `c-trapped` is an Inventory ▸
     Reports row. The old Cash card's four figures split across two sections and neither half is a
     judgement call — each followed the page its operator can actually open. */
  _booksSection(key, name) {
    const BH = this;
    if (!((App.data && App.data.weeks) || []).length) return null;
    /* ⚠ BARE, for the reason `_inventoryFigures` writes out below: an optional guard on a helper
       required for correctness reverts to a quiet dash instead of failing ([[the-loop]] #40), and
       this member already calls `CashEngine.cashOutflows()` bare further down. `hasData` /
       `hasOpening` are the ENGINE's own "is there enough to answer" flags and they are what decide
       whether a figure prints or a dash does — that is the honest empty state, not a missing file. */
    const sf = CashEngine.survivalForecast(13);
    const pos = CashEngine.position();
    const runwayLabel = r => r == null ? '13+ wks' : r === 0 ? 'This wk' : r + ' wk' + (r === 1 ? '' : 's');

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
    /* ⛔⛔⛔ IT SAID "once the month-end books are closed" AND NOTHING IN THIS APP RECORDS THAT
       (Kyle, 2026-08-25: *"what are you using to determine if a month end books are closed.. what
       criteria are you using now to determine that is done?"*). The honest answer was NOTHING.
       MEASURED on the pushed build: `settled` asks two things and neither is an action the operator
       takes — the month must be EARLIER than this one, and `_weeksComplete(mKey).complete` must
       hold, which is "no gaps among the weeks that end in it". Swept the tree: **ZERO writers** of a
       month-closed fact, no store, no field. The only trace of a month-end run is a localStorage
       timestamp with no month on it, which cannot answer the question and which nothing reads for
       it. And `hub-books.js` has no close action at all — its members GENERATE a pack.
       ⛔ SO THE SENTENCE PROMISED A GATE THE CARD CANNOT SEE. Measured live: August's four weeks
       were ALREADY all confirmed and the only thing outstanding was the calendar, while this line
       sent the operator off to close books that would not have moved the card
       ([[lessons-paid-for]] #116 — copy describing a mechanism the app does not have is FALSE, and
       false is not a matter of taste).
       ⭐ IT NAMES THE ONE THAT IS ACTUALLY OUTSTANDING, because the card knows which. A month still
       running and a month with two weeks missing are different problems with different fixes, and
       only the second one is anything the operator can act on today.
       ⚠ THE VOCABULARY IS THE APP'S OWN. Books Help already states this routine correctly —
       *"make sure the weeks are all in, then generate Month-End Books"* — so this reuses "weeks are
       in" rather than inventing a third way to say it. */
    const missingWks = Number(wc.missing) || 0;
    const results = settled
      ? this._resRow([
          this._res('Op Income YTD', BH._money(yInc), yInc < 0 ? 'var(--red)' : 'var(--t1)'),
          this._res('Margin', BH._pct(yMargin)),
          this._res('Month Revenue', BH._money(mRev)),
          this._res('Month Income', BH._money(mInc), mInc < 0 ? 'var(--red)' : 'var(--t1)')
        ])
      /* ⛔⛔ THE DIRECTIVE SITS WITH THE STATE IT ANSWERS, NOT UNDER THE FINDINGS (Kyle, 2026-08-25:
         *"that needs to be higher.. like in the what it turned up section or something.. not at the
         bottom under carrying into next week items"*). He is right, and the reason is that they are
         one thought: the first line says why the month's figures are absent and the second says what
         to do about it. Parked at the foot of the card it read as a finding, sitting under the amber
         and red pills that DO mean something is wrong — and a monthly routine is not a finding, which
         is the whole reason it was written as a plain row rather than a pill.
         ⚠ AND IT LEAVES WITH THE FIGURES. Once the month is settled the band prints real numbers and
         there is nothing left to tell anybody to do, so the directive is simply absent rather than
         hanging around advising work that is finished.
         ⚠ THE BAND HE WAS POINTING AT NO LONGER EXISTS (2026-09-04). His words are kept verbatim
         because they are the record of why this sits where it sits, and the reason still holds: a
         monthly routine is not a finding and must not read as one. There is simply nothing below it
         to be mistaken for any more. */
      : this._didList([
          missingWks > 0
            ? esc(mLabel) + ' has <b>' + missingWks + '</b> ' + this._plu(missingWks, 'week')
              + ' still to confirm. Its figures show here once ' + (missingWks === 1 ? 'it is' : 'they are') + ' in.'
            : esc(mLabel) + ' is not over yet. Its figures show here once the month ends, with every week in it confirmed.',
          /* ⭐ THE THREE STEPS ARE BOOKS HELP'S OWN, IN ITS ORDER: log the money out, get the weeks
             in, generate the pack. Directives, not teaching ([[writing-style]]), and every one of
             them is something an operator can actually go and do — unlike "close the month-end
             books", which this replaced and which is not an action this app has. */
          'Get your bills and cash outflows in before the month ends, and confirm every week. Then generate Month-End Books.'
        ]);

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


    /* ⚠ ITS OWN BAND, AND THE LABEL SAYS THE BASIS. Runway and safe-to-spend are a position as it
       stands TODAY, while the band above them reports a finished MONTH — two different clocks, and
       the page already had the convention for saying so (`· Current Position`, `· Current Stock`).
       Stuffing them into one band would have put a live figure under a month heading, which is the
       exact defect Kyle reported on this card once already. */
    const cashCells = this._resRow([
      this._res('Runway', (sf.hasData && sf.hasOpening) ? runwayLabel(sf.runway) : '-', (sf.hasOpening && sf.runway != null) ? 'var(--red)' : 'var(--t1)'),
      this._res('Safe to Spend', pos.hasOpening ? App.fmtBal(pos.safe, 0) : '-', (pos.hasOpening && pos.safe < 0) ? 'var(--red)' : 'var(--t1)'),
      this._res('Tightest Week', (sf.hasData && sf.lowPoint) ? App.fmtBal(sf.lowPoint.balance, 0) : '-', (sf.lowPoint && sf.lowPoint.balance < 0) ? 'var(--red)' : 'var(--t1)')
    ]);

    (this._pdf || (this._pdf = [])).push({ name: name, activity: this._didPlain(did),
      results: (settled
        ? 'Op Income YTD ' + BH._money(yInc) + ', Margin ' + BH._pct(yMargin) + ', ' + mLabel + ' Revenue ' + BH._money(mRev) + ', ' + mLabel + ' Income ' + BH._money(mInc)
        /* ⚠ THE PAPER SAYS WHAT THE SCREEN SAYS, INCLUDING WHICH OF THE TWO IS OUTSTANDING. This
           read "is still open, so its figures are not in yet" — vaguer than the screen and, like it,
           silent about the real reason. The PDF is the artefact somebody reads without the app in
           front of them, so it is the one that can least afford to be vague (step 0.6). */
        : mLabel + (missingWks > 0
            ? ' has ' + missingWks + ' ' + this._plu(missingWks, 'week') + ' still to confirm, so its figures are not in yet.'
            : ' is not over yet, so its figures are not in yet.'))
        + '  Current position: Runway ' + ((sf.hasData && sf.hasOpening) ? runwayLabel(sf.runway) : '-')
        + ', Safe to Spend ' + (pos.hasOpening ? App.fmtBal(pos.safe, 0) : '-')
        + ', Tightest Week ' + ((sf.hasData && sf.lowPoint) ? App.fmtBal(sf.lowPoint.balance, 0) : '-') });
    return this._sectionCard(key, name, [
      { label: 'Done This Week', html: activity },
      { label: settled ? 'What It Turned Up &middot; ' + esc(mLabel) : 'What It Turned Up', html: results },
      { label: 'Where The Cash Stands &middot; Today', html: cashCells }
    ], { did: did });
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
    /* ⛔ THE WEEK SELECTOR LEADS THE PAGE AND THE EXPORT RIDES THE FIRST BAND (Kyle, 2026-08-25:
       *"move the week selector above the stat box and the export pdf button on to the same row as
       'what fed the week' card title still right side aligned"*). The selector decides WHICH week
       every figure below it describes, so it belongs above the figures rather than between them and
       the page title; and the export is an action on the whole recap, not on the week picker.
       ⚠ THE TOP MARGIN GOES WITH IT. It carried `24px` because it sat under the stat box; as the
       first thing on the page that gap would be doubling the screen's own padding. */
    const exportBtn = '<button class="btn btn-ghost btn-sm no-print" id="wr-export">Export PDF</button>';
    const selectorRow = '<div class="no-print" style="display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 12px;">'
      + prevBtn + pill + nextBtn + nowBtn + '</div>';

    this._pdf = [];   // section payloads, collected as each section builds, for the PDF
    /* ⛔⛔ THE ROWS AND THEIR ORDER COME FROM `_plan()`, NEVER FROM A LIST TYPED HERE. The eight
       hardcoded calls this replaced were the reason the page could go stale without anything saying
       so: five of the eight named sections the app no longer has, and three sections it DOES have
       (The Week, Run Audit, Menus) had no row at all, because nothing tied this list to the rail.
       ⚠ A BAND WITH NOTHING UNDER IT IS NOT DRAWN. A section with no data returns null — day one, or
       a bar that runs no events — and a heading over an empty space reads as a section that failed
       rather than one that was never used. Same reason `_PROTO_CONTROL` was deleted from the rail
       rather than emptied ([[lessons-paid-for]] #51's neighbour). */
    /* ⚠ THE EXPORT GOES ON THE FIRST BAND THAT ACTUALLY RENDERS, NOT ON `_plan()[0]`. A section with
       no data returns null and its band is never drawn, so keying the button to the first entry in
       the table would hide it entirely for a bar that runs no inventory — and the export is about
       the whole recap, not about that one band. If NOTHING renders there is nothing to export and
       its absence is correct; the wiring is `?.`-guarded for exactly that. */
    let exportPlaced = false;
    const bands = this._plan().map(g => {
      // `.call(this, …)` because `build` is the function itself — see `_plan`.
      const rows = g.rows.map(r => r.build.call(this, r.key, r.name)).filter(Boolean).join('');
      if (!rows) return '';
      const head = this._bandHead(g.band, exportPlaced ? '' : exportBtn);
      exportPlaced = true;
      return head + rows;
    }).join('');

    mount.innerHTML = '<div class="screen wr-screen">'
      + selectorRow
      + this._topCard()
      + '<div class="wr-grid">' + bands + '</div>'
      + '</div>';

    mount.querySelectorAll('.wr-arrow').forEach(a =>
      a.addEventListener('click', () => this._step(parseInt(a.dataset.step, 10))));
    mount.querySelector('.wr-now')?.addEventListener('click', () => { this._wkStart = this._maxMonday(); this.render(mount); });
    document.getElementById('wr-export')?.addEventListener('click', () => this._exportPDF());
    /* ⛔⛔⛔ THE SELECTOR AND THE CLASS ARE ONE FACT. `_sectionCard` renders `class="wr-step-head"`
       and this line binds to it; changing one without the other is six rows that draw perfectly and
       do nothing on click, which is what shipped on Close The Week under a green gate
       ([[the-loop]] integrity #11). `verify-week-review-accordion` parses the class out of the
       rendered row and the selector out of this line and asserts they agree, because a node harness
       cannot click.
       ⚠ CLICKING THE OPEN ROW CLOSES IT. Kyle asked for rows that open AND close, so this is a
       toggle, not a radio — and `_openSec` is allowed to be null. `_prepare` is what puts Inventory
       back on the next landing; nothing here re-opens anything. */
    mount.querySelectorAll('.wr-step-head').forEach(el => el.addEventListener('click', () => {
      const k = el.dataset.sec;
      this._openSec = (this._openSec === k) ? null : k;
      this.render(this.container);
    }));
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
