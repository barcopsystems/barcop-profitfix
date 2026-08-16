'use strict';

/* ── THE LABOR IMPORT LANE ── hours and tips, hosted by whichever page is drawing them.

   Moved out of `lc-dashboard.js` on 2026-08-11, BY BYTE RANGE, so every member below is the code
   that shipped rather than a retyping of it. It moved because Close The Week hosts these two
   lanes and that cockpit is being deleted: while the lane lived inside the page, deleting the
   page deleted the four import doors on the one screen that replaces it.

   ⛔⛔⛔ THERE IS NO LONGER A "DEFAULT" HOST, AND THAT IS THE REAL CHANGE. Every accessor here
   used to read `host ? host.X() : this.X()`, where the right-hand side meant "this cockpit". On
   this object there IS no cockpit: `this.render` does not exist. So the fallback could not come
   with the code, and the Labor cockpit now passes a host of its own (`LC_HOST`) exactly as Close
   The Week always did. Two hosts, no default, and nothing left that reaches back into a page.
   That is what makes deleting `lc-dashboard.js` a file removal rather than a repair.

   A HOST IS: { zone: {hours, tips}, takeover, container(), rerender(), advance(step)? }
   `advance` is OPTIONAL and only the cockpit implements it — it opens the next step in that
   page’s accordion. Close The Week has no steps, so it does not offer one and the lane skips it.
   Same shape as `weekStart`/`weekEnd` on the Shift side: a host names what it has.

   ⚠ WHAT AN OPERATOR SEES DID NOT CHANGE. Proven by running the pre-move door and this one over
   the same files and asserting the records, the message and the mode are identical to the cent.  */

S.LaborLane = {

  /* The landing message and the dates it is about, read by whichever page is hosting: the cockpit
     in its own `render`, Close The Week in its lane sweep. Both are DECLARED here rather than
     appearing at first assignment, because a field that exists only at runtime is invisible to
     every member-based instrument in the suite ([[lessons-paid-for]] #26). */
  _flash: null,
  _flashDates: null,

  /* ⚠ THE LANE’S OWN COPY, and it is a copy on purpose. Every screen in this tree carries a local
     `fmtDate` — there is no `App.fmtDate` to share — so promoting it would be a tree-wide change
     riding on an unrelated one. The cockpit keeps its copy until it is deleted, and
     `verify-lane-extractable` pins that the two agree while both exist ([[the-loop]] #54: when a
     quantity is computed twice, test the EQUALITY, never either side). */
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  // Hide a step's own buttons while the column-mapper is open so they do not
  // stack under the mapper's Import/Cancel row; show them again on cancel.
  _toggleBtns(id, st) { const b = document.getElementById(id); if (b) b.style.display = (st === 'map') ? 'none' : 'flex'; },

  /* ⛔⛔⛔ A FILE DROPPED ON A STEP TAKES THE PAGE. Built by copying `sc-dashboard`, which is the one
     that shipped and that Kyle walked, which in turn was built to match Close The Books. Kyle,
     2026-08-08, on the first version of this door: *"mapping inline, not taking over the page.. need
     to be exactly like all the other ones."* He was right and I had invented a step-level gate
     instead of reading the reference.
     WHAT THE REFERENCE KEEPS AND WHY, in its own words: *"keeps the context of what they are closing
     and how far along they are"* — so Where You Stand and the progress banner STAY, and only the
     steps and the row of navigate-away buttons go.
     TWO SHAPES, and Kyle walked both on the shift cockpit:
       MAPPER  a card holding the drop zone and the column mapper, then the Import / Cancel row
               OUTSIDE it, which is exactly how Books renders its `card form-card` then its actions.
       CONFIRM the shell's panel and nothing else — it already brings its own heading, its own card
               and its own buttons, so wrapping it gives a card inside a card and a duplicate title.
     ⛔ ONE CANCEL. CSVMapper renders its own beside Import and releases the page through
     `_onMapState('drop')`. A second one is two controls for one job. */
  /* ⚠ `LC_ZONE` IS NOT HERE ANY MORE. It held `lc-ck-hours` / `lc-ck-tips`, which are the LABOR
     COCKPIT'S element ids, and its only reader was the fallback inside `_lbZone` — so the moment
     the fallback went it was a table nothing read ([[the-loop]] #25). It moved to that page's own
     `LC_HOST`, where ids belong: a host names its own.
     `LC_TITLE` stays, because BOTH hosts read it — the cockpit in its render, Close The Week in
     `renderLane` — so it is the lane's copy, not a page's. */
  LC_TITLE: { hours: 'Import your timeclock hours', tips: 'Import your tips' },
  _lbTakeover: null,    // which zone owns the page
  _lbCarry: null,       // its live mapper node, carried across the re-render
  _lbCarryActs: null,   // the mapper's Import/Cancel row, which lives in its own element
  /* The confirm screen, and the one-press guard on its button. DECLARED rather than springing into
     existence at first assignment, for the reason `_flash` is declared above: a field that only
     exists at runtime is invisible to every member-based instrument in this suite. */
  _laborReview: null,
  _laborReviewWriting: false,
  /* One accessor, so a third lane joins by adding a field here rather than by finding five call
     sites. The confirm screen holds the takeover open too: a file already dropped and waiting to be
     confirmed must not lose the page out from under it. */
  _anyLaborReview() { return this._laborReview; },
  lbTakeover() { return this._lbTakeover != null || !!this._anyLaborReview(); },
  _clearLbTakeover() { this._lbTakeover = null; this._lbCarry = null; this._lbCarryActs = null; },

  /* ── THE HOST ────────────────────────────────────────────────────────────────
     THE LANE DRAWS ON WHICHEVER PAGE IS SHOWING IT. This cockpit was the only page that could until
     Close The Week, so `lc-ck-hours` was written as a literal in four separate places and the
     re-render was written as `this.render` in eight.
     ⛔⛔ WHY A LITERAL IS WRONG, AND IT IS STRUCTURAL: the app has TWO shells. Module screens render
     into `#content-area` inside `#app`, hub pages into `.hub-app`, and the app HIDES the one it is
     not showing rather than removing it. So both pages can hold markup at the same moment and
     `getElementById` answers with whichever sits first in the document — the same duplicate-id
     defect the rail overlay shipped with, this time with the operator's parsed file on it. A host
     therefore NAMES ITS OWN ids.
     A host is `{ zone: {hours, tips}, takeover, container(), rerender(), advance(step)? }`.
     ⛔⛔⛔ AND THERE IS NO `null` HOST ANY MORE. Every accessor below used to read
     `host ? host.X() : this.X()`, where the right-hand side meant "the Labor cockpit" — which was
     honest while the cockpit was the only page that could draw a lane, and is impossible here:
     `this.render`, `this.container` and `this.actions` are members of a PAGE and this is not one.
     So the cockpit passes `LC_HOST` now, exactly as Close The Week passes `LB_HOST`. TWO HOSTS, NO
     DEFAULT — which is the property that makes deleting the cockpit a file removal.
     ⚠ NO HOST MEANS NOTHING, NEVER "guess". `_lbZone` answers '' and every caller already refuses
     on an empty zone; `_lbContainer` answers null and its callers already guard. A silent fallback
     to some other page's ids is the one behaviour this whole contract exists to prevent.
     ⭐ OWNERSHIP IS CLAIMED BY WHOEVER DRAWS. A page calls `lbClaim` as it renders the lane, so the
     lane always belongs to the page in front of the operator — and a parsed file carried across a
     navigation is ADOPTED by the page they land on rather than stranded on the one they left. */
  _lbHost: null,
  lbClaim(host)  { this._lbHost = host || null; },
  _lbZone(key)   { return ((this._lbHost && this._lbHost.zone) || {})[key] || ''; },
  _lbContainer() { return this._lbHost ? this._lbHost.container() : null; },
  _lbRerender()  { if (this._lbHost) this._lbHost.rerender(); },
  /* ⭐ THE STEP THE HOST SHOULD OPEN NEXT, and it is OPTIONAL for the same reason `weekStart` is
     optional on the Shift side: a host names what it has. The cockpit has an accordion and opens
     the next step after an import; Close The Week has no steps and offers no `advance`, so the
     lane simply does not call one. This replaces `this._openStep = nextStep`, which was the lane
     writing a PAGE's state directly — invisible to Close The Week and dead the day the cockpit
     goes. */
  _lbAdvance(step) { if (this._lbHost && this._lbHost.advance) this._lbHost.advance(step); },
  /* Which lane is in flight, so a page can refuse to draw one it does not render. Close The Week
     hosts hours and not tips, and a page that drew a lane it has no zone for would name an element
     it never rendered and then re-render itself over an import it cannot show. */
  _lbLaneKey()   { return this._laborReview ? this._laborReview.type : this._lbTakeover; },

  /* ⛔⛔⛔ THE HANDOVER, AND THE ONE THING IT MUST NOT DO IS REBUILD THE MAPPER.
     `CSVMapper.mount()` opens with `container.innerHTML = <drop zone>`, so escalating by re-mounting
     would throw the operator's parsed file away and put them back on an empty drop zone — work lost,
     silently. The live node is DETACHED and carried, and `render` re-attaches that same element with
     its listeners and parsed rows intact.
     ⛔⛔ AND THE ACTIONS SLOT IS CARRIED TOO, OR THE IMPORT BUTTON IS GONE AND THE FILE IS A DEAD END.
     Both zones here pass `actionsEl`, so CSVMapper renders its confirm button into a SEPARATE
     element. Money Out's first handover carried only the mapper, and Kyle found the result on the
     live build: a parsed file, the column mapper, and nothing but Cancel. */
  _onMapState(key, st) {
    /* ⛔ THE MAPPER'S OWN CANCEL GIVES THE PAGE BACK, through this same hook — CSVMapper emits
       exactly two states and going back to `drop` means the file was abandoned. One release path, so
       the page cannot be left taken over by a mapper showing an empty drop zone.
       ⚠ `drop` also fires when a mapper first MOUNTS, which is why this is gated on the zone already
       owning the page: at mount time nothing does, so it is a no-op. */
    if (st === 'drop') {
      if (this._lbTakeover === key) { this._clearLbTakeover(); this._lbRerender(); }
      return;
    }
    if (st !== 'map' || this._lbTakeover != null) return;
    const zone = this._lbZone(key);
    const node = zone ? document.getElementById(zone) : null;
    if (!node) return;
    const acts = document.getElementById(zone + '-actions');
    this._lbCarry = node;
    this._lbCarryActs = acts || null;
    node.remove();
    if (acts) acts.remove();
    this._lbTakeover = key;
    this._lbRerender();
  },

  // ── Inline hours import (step 1) ─────────────────────────────────────────────
  mountHoursImport() {
    const zone = this._lbZone('hours');
    const el = zone ? document.getElementById(zone) : null;
    if (!el || typeof CSVMapper === 'undefined' || typeof PosIngest === 'undefined') return;
    CSVMapper.mount(el, {
      dropTitle: 'Drop your weekly timeclock export here',
      subject: 'Hours',
      dropSub: 'Needs Staff, Date, and Hours. Shift matched if present. One row per shift.',
      fields: PosIngest.FIELDS.hours,
      confirmLabel: 'Import',
      // The Import / Cancel row lives OUTSIDE the mapper's card, exactly as Books and the shift
      // cockpit render it — which is also why the handover has to carry TWO nodes, not one.
      actionsEl: '#' + zone + '-actions',
      onState: st => { this._toggleBtns(zone + '-btns', st); this._onMapState('hours', st); },
      /* ⛔ THE MAPPER NO LONGER COMMITS. It hands the file to the confirm screen, which is where the
         operator presses the button. Same shape as every other converted door. */
      onComplete: rows => this._openLaborReview('hours', rows)
    });
  },
  // ── Inline tips import (step 2) ──────────────────────────────────────────────
  mountTipsImport() {
    const zone = this._lbZone('tips');
    const el = zone ? document.getElementById(zone) : null;
    if (!el || typeof CSVMapper === 'undefined' || typeof PosIngest === 'undefined') return;
    CSVMapper.mount(el, {
      dropTitle: 'Drop your POS tips export here',
      subject: 'Tips',
      dropSub: 'Needs Staff and Date plus card and/or cash tips. Servers match your roster by name.',
      fields: PosIngest.FIELDS.tips,
      confirmLabel: 'Import',
      actionsEl: '#' + zone + '-actions',
      onState: st => { this._toggleBtns(zone + '-btns', st); this._onMapState('tips', st); },
      onComplete: rows => this._openLaborReview('tips', rows)
    });
  },
  /* ── DOORS 12 AND 13: THE LABOR CONFIRM SCREEN ─────────────────────────────────────────────────
     ONE SCREEN, TWO LANES. Hours and tips already run through `importLane` parameterised by `type`
     end to end, so a second screen would be a second implementation of one decision. Everything that
     differs between them is a lookup on `type`: the columns, the figure, and the pay-period lock.
     ⛔⛔ THE CLOSED PAY PERIOD IS THIS DOOR'S OWN SHAPE, and it is why the screen could not simply be
     bolted on. `importLane` splices those rows out of `toAdd` AFTER the build — measured on a real
     83-row timeclock file, 74 built and 72 written. A confirm screen cannot stand on a list that
     changes after it is shown, so the screen applies the SAME test through the same helper. Both
     sides read `App.payPeriodClosedFor`, so the button's number and what the write keeps agree by
     construction rather than by two copies of a rule.
     ⚠ HOURS ONLY, deliberately: the lock is a property of logged hours, the Log Tips form has no
     such check, and `importLane`'s own note says so. Do not "fix" tips to match. */
  LABOR_NOTES: {
    summary:  'Your file\'s own totals line, not a person',
    noName:   'No name on this row',
    noMatch:  'This name is not on your roster',
    undated:  'Could not read the date on this row',
    repeat:   'Same line twice in your file, counted once',
    dup:      'Already logged',
    /* ⚠ THE REMEDY LIVES HERE, NOT ONLY IN THE RESULT LINE. When the clause list was suppressed
       for a reviewed import this was the one outcome whose fix existed nowhere else, and a skip the
       operator cannot act on is the one that reads as data loss ([[the-loop]] #25). */
    locked:   'That week\'s pay period is closed. Reopen it in Pay Periods to log these hours'
  },
  /* The two notes that read differently per lane. A `--` cell is "no hours to log", not "no tips". */
  _laborNote(type, status) {
    if (status === 'incomplete') return type === 'hours' ? 'No hours to log on this row' : 'No tips to log on this row';
    if (status === 'new')        return type === 'hours' ? 'Adding these hours' : 'Adding these tips';
    return this.LABOR_NOTES[status] || '';
  },
  // ⛔ ONE TEST, READ BY THE SCREEN AND BY THE WRITE. See the block comment above.
  _laborLocked(type, date) {
    return type === 'hours' && !!date && !!(App.payPeriodClosedFor && App.payPeriodClosedFor(date));
  },
  /* The file's own figure, read the way the builder reads it, so a row that does not land still shows
     what its line said. Blank when the cell genuinely carries no number — that row's whole problem. */
  _hoursCell(v) {
    const n = PosIngest._hours(v);
    return (n == null || isNaN(n) || n <= 0) ? '' : String(n);
  },
  _tipsCell(cash, card) {
    const t = PosIngest._num(cash) + PosIngest._num(card);
    return t > 0 ? App.fmtCurrency(t) : '';
  },
  _laborCols(type) {
    return [{ label: 'Staff', width: 26 }, { label: 'Date', width: 16 }, { label: 'Shift', width: 14 },
            { label: type === 'hours' ? 'Hours' : 'Tips', width: 12 }];
  },
  /* One shell row per FILE row. **No fold on this lane**, and that is not an oversight: a split shift
     is two records for one person on one day BY DESIGN, so collapsing by person would hide exactly the
     rows the operator is checking. The pmix fold exists because its write is per DISH; here the write
     is per row. */
  laborReviewRows(type, built, opts) {
    opts = opts || {};
    const removed = opts.removed || {};
    const rows = [];
    (built.perRow || []).forEach((v, i) => {
      const raw = v.raw || {};
      const key = raw._rid != null ? raw._rid : i;
      if (removed[key]) return;
      const rec = v.rec || null;
      /* A row the builder would write, on a week that is closed. It is not a builder concern — the
         builder knows nothing about pay periods — so the verdict is stamped here and the write drops
         the same rows through the same helper. */
      const locked = !!v.lands && !!rec && this._laborLocked(type, rec.date);
      const lands = !!v.lands && !locked;
      /* ⛔ ONE QUANTITY, ONE SPELLING, EVEN ON A ROW THAT DOES NOT LAND. Building the cell from the
         RECORD alone printed "Aug 4, 2026" on a landing row and "2026-08-04" on the repeat directly
         above it — the same column, two formats, found by reading the render over the real file.
         ⚠ AND THE EXCEPTION IS THE POINT: `fmtDate` answers '-' for a date it cannot parse, which
         would delete the one piece of evidence the operator needs on the one row whose DATE is the
         problem. So the raw text stands exactly where it is the subject. */
      /* ⛔⛔ THE READABILITY TEST IS THE BUILDER'S, NOT `fmtDate`'S, and getting that wrong invented a
         date on the one row that must not have one. `fmtDate` only answers '-' when `new Date` gives
         NaN — and `new Date('Week of 8/3')` does not: JS finds the 8/3 and returns **August 3, 2001**.
         So the row whose whole problem is an unreadable date rendered a confident wrong year, which
         is worse than the two-spellings bug this block was fixing. `normDate` is the same call that
         decided the row is `undated`, so the cell and the verdict now agree by construction. */
      const rawDate = String(raw.date || '').trim();
      const norm = rawDate ? PosIngest.normDate(rawDate) : '';
      const dateTxt = rec ? this.fmtDate(rec.date) : (norm ? this.fmtDate(norm) : rawDate);
      const shiftTxt = rec ? (rec.shift_type || '') : String(raw.shift || '').trim();
      /* ⛔ AND A ROW THAT DOES NOT LAND STILL CARRIED A FIGURE. The repeated line and the off-roster
         row both printed "—" over a file that plainly says 7.50 and 6.00, which reads as "there was
         no figure" when the real reason is sitting in the next column. Where the file's own cell is
         genuinely unreadable it still shows nothing, because there is nothing to show. */
      const rawFig = type === 'hours' ? this._hoursCell(raw.hours)
                                      : this._tipsCell(raw.cash_tips, raw.card_tips);
      const figure = rec
        ? (type === 'hours' ? String(rec.hours) : App.fmtCurrency(rec.total_tips || 0))
        : rawFig;
      rows.push({
        cells: [esc(v.name || '(no name)'), esc(dateTxt || '—'),
                esc(shiftTxt || '—'), esc(figure || '—')],
        note: locked ? this.LABOR_NOTES.locked : this._laborNote(type, v.status),
        notes: [], lands: lands, needsYou: false, key: key
      });
    });
    return { rows: rows, count: rows.filter(r => r.lands).length };
  },

  _openLaborReview(type, rows) {
    (rows || []).forEach((r, i) => { if (r && r._rid == null) r._rid = 'lb' + i; });
    this._laborReview = { type: type, rows: rows || [], open: {}, removed: {} };
    this._lbRerender();
  },
  _laborReviewSummary() {
    const r = this._laborReview;
    if (!r) return { rows: [], count: 0 };
    const live = r.rows.filter(x => !r.removed[x._rid]);
    return this.laborReviewRows(r.type, PosIngest.build(r.type, live), { removed: {} });
  },
  /* Built by a SEPARATE walk over only the removed rows, so a removed duplicate stops blocking the
     row behind it — its verdicts are meaningless here and only its cells are read. */
  _laborReviewRemoved() {
    const r = this._laborReview;
    if (!r) return [];
    const gone = r.rows.filter(x => r.removed[x._rid]);
    if (!gone.length) return [];
    return this.laborReviewRows(r.type, PosIngest.build(r.type, gone), { removed: {} }).rows;
  },
  _laborPanelOpts() {
    const r = this._laborReview || { type: 'hours' };
    const s = this._laborReviewSummary();
    /* ⛔ THE BUTTON AND THE SUCCESS LINE USE THE SAME WORDS. The button read "Add 72 Hours Rows" over
       a line saying "72 hour records imported" — one quantity, two names, on one screen. `importLane`
       has called them hour/tip records since long before this door existed, so the button follows it. */
    return { rows: s.rows, verb: 'Add', noun: r.type === 'hours' ? 'Hour Record' : 'Tip Record',
             nounPlural: r.type === 'hours' ? 'Hour Records' : 'Tip Records' };
  },
  laborReviewHTML() {
    const r = this._laborReview || { open: {}, type: 'hours' };
    return ImportConfirm.panel(Object.assign(this._laborPanelOpts(), {
      label: 'Check this file before it goes in',
      lead: 'Nothing is saved until you press the button below. Every row from your file is here with '
          + 'what Bar Cop worked out. Take out anything you do not want.',
      columns: this._laborCols(r.type),
      outcomeLabel: 'What happens',
      removedRows: this._laborReviewRemoved(),
      removable: true,
      open: r.open,
      settledLabel: 'Going In',
      goAttr: 'data-lbreview-go', backAttr: 'data-lbreview-back', backLabel: 'Start Over',
      // ⛔ THE RESULT SLOT BELONGS TO THE HOST. It was the literal `'lc-ck-hours-res'`, which on a
      // hub page names an element only the hidden cockpit ever rendered — so a refused import would
      // have written its reason into a node nobody can see.
      resultId: this._lbZone(r.type) + '-res',
      busy: !!this._laborReviewWriting
    }));
  },
  _wireLaborReview() {
    const c = this._lbContainer(), r = this._laborReview;
    if (!c || !r) return;
    c.querySelectorAll('[data-confirm-section]').forEach(h => h.addEventListener('click', () => {
      const k = h.dataset.confirmSection;
      r.open[k] = (k === 'needs') ? (r.open[k] === false) : !r.open[k];
      this._lbRerender();
    }));
    c.querySelectorAll('[data-confirm-remove]').forEach(b => b.addEventListener('click', () => {
      r.removed[b.dataset.confirmRemove] = true; this._lbRerender();
    }));
    c.querySelectorAll('[data-confirm-restore]').forEach(b => b.addEventListener('click', () => {
      delete r.removed[b.dataset.confirmRestore]; this._lbRerender();
    }));
    c.querySelector('[data-lbreview-go]')?.addEventListener('click', () => this._runLaborReview());
    c.querySelector('[data-lbreview-back]')?.addEventListener('click', () => this._backFromLaborReview());
  },
  /* ⛔⛔ START OVER GIVES THE PAGE BACK, NOT JUST THE SCREEN. It was
     `this._laborReview = null; this.render(...)`, which drops the confirm screen and leaves the
     takeover set over a mapper that was spent the moment its rows reached that screen — so the
     operator lands on a bare drop zone with the steps gone and nothing that returns the page. The
     same dead state Kyle found by navigating away, reached in one press on a button Bar Cop draws
     itself. Books hit this exact shape at its own Start Over and its comment says so; found here by
     checking whether the other takeover screens shared the release bug above. They did not. */
  _backFromLaborReview() {
    this._laborReview = null;
    this._clearLbTakeover();
    this._lbRerender();
  },

  // ⛔ ONE PRESS, ONE IMPORT. The button is rebuilt by every redraw, so a flag on the screen object is
  // the only thing a redraw cannot hand back.
  async _runLaborReview() {
    const r = this._laborReview;
    if (!r || this._laborReviewWriting) return;
    this._laborReviewWriting = true;
    const host = this._lbContainer();
    const btn = host && host.querySelector('[data-lbreview-go]');
    if (btn) { btn.disabled = true; btn.textContent = 'Adding...'; }
    try {
      const live = r.rows.filter(x => !r.removed[x._rid]);
      await this.importLane(r.type, live, this._lbZone(r.type) + '-res',
        r.type === 'hours' ? 'tips' : 'schedule', { reviewed: true });
    } finally {
      this._laborReviewWriting = false;
      if (this._laborReview) {
        const h2 = this._lbContainer();
        const b = h2 && h2.querySelector('[data-lbreview-go]');
        if (b) { b.disabled = false; b.textContent = ImportConfirm.goLabel(this._laborPanelOpts()); }
      }
    }
  },

  // Shared import path: match/dedup/build/save live in PosIngest so the cockpit
  // and the per-page lanes never drift. label = 'hours' | 'tips'.
  async importLane(type, rows, resultId, nextStep, opts) {
    opts = opts || {};
    /* ⚠ `fileRepeats` JOINS THE DESTRUCTURE FOR THE SAME REASON AS `incomplete` DID (S218). A line
       the file repeated verbatim is now counted ONCE — at this door that is hours into gross pay and
       tips into Form 8027, so it was the most expensive place the bug lived. A bucket no door reads
       is worse than the bug: the operator's row count stops matching Bar Cop's and nothing says why. */
    /* ⛔⛔ AND `summaryRows` JOINS IT FOR THE THIRD TIME, FOUND BY WALKING THE SHIPPED LANE. A real
       59-line timeclock export went in: 55 landed and the result line named 3 skips. 55 + 3 = 58.
       The missing one was the export's own "Grand Total" row — counted by the builder, listed on the
       confirm screen ("Your file's own totals line, not a person"), and dropped from the sentence the
       operator is left holding. **The comment directly above predicted this exact failure and I
       still shipped it**, which is what makes it worth writing down again: a bucket is not read
       until you can point at the words it produces.
       ⚠ Five other doors already report it — `r-server-check`'s wording and the reason behind it
       ("it used to say the roster did not match, which tells the operator to ADD A POS TOTALS LINE
       as a staff member") is what this follows. */
    const { toAdd, skipped, incomplete, undated, dupCount, fileRepeats, summaryRows } = PosIngest.build(type, rows);
    const noun = type === 'hours' ? 'hour' : 'tip';
    /* ⚠ THE THIRD DOOR INTO lc_actuals, AND IT HAD NO LOCK CHECK EITHER (L6). A closed pay period
       stamps the rows that existed at the time, so an import writes straight past it. Dropped here
       rather than at the commit so every downstream count (`toAdd.length`, the partial-save note,
       the flash) is already the WRITABLE set — and spliced in place rather than rebound, because
       `toAdd` is a destructured const and reassigning it throws only on the branch that runs
       ([[the-loop]] #72). Hours only: the lock is a property of logged hours, not of tips. */
    let lockedOut = 0;
    if (type === 'hours') {
      for (let i = toAdd.length - 1; i >= 0; i--) {
        if (App.payPeriodClosedFor(toAdd[i].date)) { toAdd.splice(i, 1); lockedOut++; }
      }
    }
    const setRes = html => { const r = document.getElementById(resultId); if (r) r.innerHTML = html; };
    /* ⚠ ROWS WHOSE DATE COULD NOT BE READ ARE NOW REFUSED RATHER THAN WRITTEN BLANK, so they have to
       be reported — this is the one skip an operator can actually fix in the file. Before the
       builder guard they were written with `date: ''`, and since the dedup key is staff + date +
       amount, every undated row of every week shared one key: week one imported and week two
       deduped away IN FULL under "N already logged", about rows that had never been logged.
       ⚠ AND A PARTIAL SAVE IS NOT A FAILED SAVE. This door writes row by row through the generic
       commit, same as the four already closed — App.landedOf/partialSaveNote carry the contract. */
    /* ⚠ "NO ROSTER MATCH" IS ONLY TRUE OF AN UNMATCHED NAME. The builder used to lump "this person
       is not on your roster" together with "this person IS on your roster and had nothing to log"
       — a `--` hours cell, a $0.00 tips line (an ordinary row for a barback, the kitchen, or
       someone's day off) — and this sentence called all of them a roster problem. The implied fix
       is to add the staff member, who already exists, which is how a roster gets duplicated. Split
       at the builder now, exactly as buildServer and buildPmix already were. */
    const nUnd = (undated || []).length, nInc = (incomplete || []).length;
    const nSum = (summaryRows || []).length;
    const figure = type === 'hours' ? 'no hours rung' : 'no tips to log';
    const outcomes = (skipped.length ? ' (' + skipped.length + ' skipped, name not on your roster)' : '')
      /* Next to the roster count on purpose: these are the two "this row is not a person" cases, and
         the totals line used to be counted INSIDE the roster one. Read together they say the file had
         two kinds of non-person row; read apart, the operator goes looking for a staff member called
         Grand Total. "Nothing to fix" is the point — it is not a problem with their export. */
      + (nSum ? ' (' + nSum + ' row' + (nSum === 1 ? '' : 's')
          + ' skipped, your file\'s own totals line. Nothing to fix.)' : '')
      + (nInc ? ' (' + nInc + ' row' + (nInc === 1 ? '' : 's') + ' skipped, ' + figure + ')' : '')
      + (nUnd ? ' (' + nUnd + ' row' + (nUnd === 1 ? '' : 's') + ' skipped, no readable date)' : '')
      + (dupCount ? ' (' + dupCount + ' already logged)' : '')
      // L6 — never drop a locked row in silence: it is the one skip that looks like data loss.
      + (lockedOut ? ' (' + lockedOut + ' row' + (lockedOut === 1 ? '' : 's')
          + ' skipped, that week\'s pay period is closed. Reopen it in Pay Periods before logging more hours.)' : '')
      // Counted once, and said so — never folded into "already logged", which would be false.
      + ((fileRepeats || 0) ? ' (' + fileRepeats + ' repeated line' + (fileRepeats === 1 ? '' : 's') + ' counted once)' : '');
    if (!toAdd.length) {
      /* ⚠ `nSum` COUNTS HERE TOO. This gate decides whether the dup-only headline ("All N were
         already logged") may claim ALL of them — so a file carrying dups AND a totals line would
         print a headline that is false about the totals row. It falls through to the general branch
         now, which names both. */
      const others = skipped.length + nInc + nUnd + nSum;
      /* ⚠ THE HEADLINE MUST NOT POINT AT THE COLUMNS WHEN THE COLUMNS ARE THE ONE THING THAT CANNOT
         BE WRONG. Staff, Date and Hours are all `required: true`, and CSVMapper blocks the Import
         button until every required field is mapped — so by the time this fires, the columns are
         mapped by definition. Once this branch was narrowed to "every row's NAME failed the roster
         match", the old copy ("Check the file has Staff, Date, and Hours") was sending the operator
         to the one place with nothing to find, while the clause right after it said the real thing.
         ⚠ AND THE DUP-ONLY HEADLINE DOES NOT GET `outcomes` — it already states the count, so
         appending the shared string printed it twice ("All 2 were already logged. (2 already
         logged)"). It is the one headline that duplicates rather than adds. */
      if (dupCount && !others) {
        setRes('<div style="font-size:13px;color:var(--red);margin-top:12px;">No new rows imported. All '
          + dupCount + ' were already logged.</div>');
        return;
      }
      setRes('<div style="font-size:13px;color:var(--red);margin-top:12px;">'
        + (nUnd && !skipped.length && !nInc && !dupCount ? 'No rows imported. Bar Cop could not read a date on ' + (nUnd === 1 ? 'the row' : 'any row') + '. Check the date column in your export.'
         : nInc && !skipped.length && !nUnd && !dupCount ? 'No rows imported. Every name matched your roster, but no row had ' + (type === 'hours' ? 'usable hours.' : 'a tip amount above zero.')
         : skipped.length && !nInc && !nUnd && !dupCount ? 'No rows imported. Not one name in the file matched your staff roster. Check the spellings, or add them in Staff Roster.'
         : 'No new rows imported.') + outcomes + '</div>');
      return;
    }
    const ok = await PosIngest.commit(type, toAdd);
    if (!ok) {
      setRes('<div style="font-size:13px;color:var(--red);margin-top:12px;">'
        + App.partialSaveNote(App.landedOf(toAdd, type === 'hours'
              ? (App.laborData && App.laborData.lc_actuals) : (App.laborData && App.laborData.lc_tips)),
            toAdd.length, noun + ' record', noun + ' records')
        + outcomes + '</div>');
      return;
    }
    // The import updates the status (flash + step sub-text); the operator marks
    // the step done themselves when the week's hours/tips are fully in.
    // Same `outcomes` string as the zero-row and failure messages, so all three describe one import
    // in one set of words — and the undated count cannot be reported on two paths and dropped on the third.
    /* ⭐ THE HEADLINE STANDS ALONE ON A REVIEWED IMPORT (Kyle, 2026-08-15): *"'70 hour records
       imported' and then maybe the dates.. all that other stuff reads as basically unreadable."* Every
       clause is a row on the screen he has just accepted, so this is the second telling of it; the
       hand-entry path keeps the full account, because it has no screen in front of it. */
    this._flash = toAdd.length + ' ' + noun + ' record' + (toAdd.length === 1 ? '' : 's') + ' imported'
      + (opts.reviewed ? '' : outcomes) + '.';
    /* ⛔⛔ WHAT LANDED, BY DATE, SO THE PAGE SHOWING THIS CAN SAY WHICH WEEK IT MEANS. Kyle, 2026-08-10,
       on the pushed tips lane: *"imported test tip file.. says imported.. tips card 'none logged'."*
       Both numbers were TRUE — this sentence counts the FILE, the row counts the WEEK on screen, and
       his file was dated outside it. Neither said what it was counting, so the first read is "broken".
       ⚠ The DATES, not a week label: this lane does not know what week its host is showing, and a
       file can straddle several. The host counts them against its own window. */
    this._flashDates = toAdd.map(r => r && r.date).filter(Boolean);
    /* ⛔⛔⛔ THE CONFIRM SCREEN CLEARS ON SUCCESS, AND ONLY ON SUCCESS. Leaving this out is what door 11
       shipped with: the write landed every time and the render put the same screen straight back,
       because `workspace` reads the review first. The two early returns above and the refusal branch
       all keep the screen up on purpose — every row stays listed so the operator can press again
       without re-dropping the file, and `setRes` writes into the shell's OWN result slot, so nothing
       re-renders over the message. */
    if (opts.reviewed) this._laborReview = null;
    /* ⛔⛔⛔ A FINISHED IMPORT GIVES THE PAGE BACK, AND THAT RELEASE BELONGS HERE, NOT IN A RENDER.
       Kyle, 2026-08-08: *"click add hours.. logs the hours but takes you back to the mapping screen
       with the import hours button.. click import again and it takes you to the needs a look screen
       saying already logged."* The write clears `_laborReview`, but the takeover flag and the
       CARRIED MAPPER NODE survived it, so the redraw re-attached a spent mapper and offered the same
       file for a second import.
       ⚠ IT WAS FIXED IN THIS COCKPIT'S `render`, keyed on `_flash` — one release path while there
       was one page. A lane hosted by Close The Week never runs this cockpit's render, so that fix
       would simply not have happened there and the defect would have come straight back on the new
       page. The release moved to the one place both hosts pass through: the moment the write lands.
       ⚠ AND IT MUST NOT TEAR AWAY A CONFIRM SCREEN. Today the line above has always cleared it by
       the time this runs, so the guard reads as redundant — it is not. `reviewed` is an OPTION, and
       a lane that ever commits without one would hit this line with the screen still up and lose
       every row the operator is looking at. The guard is what the release costs, not an assumption
       about who calls it. */
    if (!this._anyLaborReview()) this._clearLbTakeover();
    // Was `this._openStep = nextStep` — the lane reaching straight into the cockpit's accordion.
    // The host decides what, if anything, that means for its own page. See `_lbAdvance`.
    this._lbAdvance(nextStep);
    this._lbRerender();
  },
};
