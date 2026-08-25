'use strict';

/* ── THE WEEK ─────────────────────────────────────────────────────────────────
   THREE PAGES — Close The Week, Week in Review, Week History — reached from the
   section's three top-bar links and from nothing else on the page. Kyle,
   2026-08-23: *"make a top bar nav.. Close, Review, History.. no drop downs on
   these.. but get rid of the tabs and have each link go to the specific page..
   again no more tabs on the pages.. only navigate from the top bar links."*

   ⚠ IT WAS ONE TABBED PAGE FOR A DAY, and the host is what survives that. The
   tab strip is gone; `open(which)` still resolves any of the four week ids and
   mounts that page, which is the whole reason this file exists.

   ⛔⛔ THE THREE ARE NOT THE SAME KIND OF PAGE, and that is the difficulty this
   host absorbs. `week-close` and `week-review` went through `App.openHubFullPage`
   (the hub shell); `week-history` was a MODULE screen in `_CONVERTED`, rendering
   into `#content-area`. One host means History uses the hub shell, which is what
   Books and Audits use and what two of the three already used.

   ⭐⭐ EVERY OLD ID STAYS ALIVE AS A PAGE TARGET, AND THAT IS WHAT MAKES THIS
   SAFE. Measured before a line was written: `week-close` has 34 inbound
   references across 15 files, `week-review` 12 across 5, `week-history` 26
   across 7, plus SIXTY-FOUR harness files. Re-pointing 72 call sites is how a
   change like this ships three dead links; instead `openScreen('week-close')`
   and friends open the page they always did.

   ⛔ THIS FILE OWNS NO WEEK LOGIC. Each page mounts the SHIPPED screen object
   into the panel — `S.WeekClose`, `S.WeekReview`, `S.WeekHistory` render
   themselves exactly as before. A second implementation of any of them is the
   drift the suite exists to catch; this is a host, nothing more.

   ⚠ ONE GATE, because db.js files all three under the same area (`'week'`). It
   is asked in `open()` rather than per page for that reason — and it is asked at
   all because `week-close` shipped with NO access gate until 2026-08-12.        */

S.Week = {

  /* ⭐ THE ORDER IS THE ASK: close, then review, then history. The rail row lands
     on the first one. Keys are short; the LABELS are what the operator reads.
     ⚠ TWO LABELS PER PAGE, AND THEY ARE DIFFERENT ON PURPOSE (Kyle, 2026-08-23:
     *"make a top bar nav.. Close, Review, History"*). The short word is the
     top-bar link; the long one is the page's own name, used for the hub page
     title and the back-link breadcrumb. Both come from here so they cannot
     drift, and adding a fourth page still changes only this table + LEGACY. */
  PAGES: [['close', 'Close The Week', 'Close'], ['review', 'Week in Review', 'Review'], ['history', 'Week History', 'History']],

  page: 'close',
  container: null,

  /* Which screen id each page answers to. Used by the routing in app.js so
     every id resolves here, and by `_stamp` so the "you visited this" marks the
     Fix steps read keep working — those are keyed on the OLD ids and a step that
     cannot be ticked is the defect [[lessons-paid-for]] #39 describes. */
  LEGACY: { close: 'week-close', review: 'week-review', history: 'week-history' },

  /* ⭐⭐ ONE MAP, AND IT LIVES HERE. `open` takes EITHER a page key (`'close'`) or one of the
     screen ids (`'week-close'`) and resolves it itself, so `_protoGlobalClick` can hand it whatever
     id it was given and stays a one-liner.
     ⛔ THE FIRST VERSION PUT AN id→page MAP IN `app.js` AS WELL, which is one fact written twice —
     exactly the drift this suite exists to catch. The pin caught it: it went looking for a spelling
     the code did not have, and the honest fix was to delete the second map rather than teach the
     assertion about it. Add a fourth page and only `PAGES` + `LEGACY` change. */
  /* Does this argument name a PAGE (a page key or one of the legacy screen ids), or the SECTION?
     The two get different landings, so the question is asked once, here, off `LEGACY` — the same
     table `_resolve` and the gate already read. */
  _namesAPage(which) {
    return !!(which && (this.LEGACY[which] || Object.keys(this.LEGACY).some(k => this.LEGACY[k] === which)));
  },
  /* ⛔⛔⛔ THE SECTION KEY LANDS ON THE SECTION'S FIRST PAGE, NOT ON WHERE YOU WERE (Kyle,
     2026-08-25: *"the week rail menu link is the only link when you click it does not automatically
     land on the 1st top bar link by default.. so if i click on history and leave the page and then
     click the week again.. it lands still on history.. it should always land on close the week"*).
     This line read `return hit || this.page;` and its own comment said so out loud — *"'week' and
     anything unknown land where we are"* — which is right for a bare re-open and wrong for the rail
     row, because the rail hands this the SECTION key. Reproduced by RUNNING the shipped member
     against an object parked on history: `_resolve('week')` came back 'history'.
     ⭐ THE OTHER SIX SECTIONS NEVER HAD THIS, and the reason is worth knowing: their landing is
     decided in `_protoGlobalClick` itself (The Floor names `lc-build-schedule`, Menus names
     `r-menu-items`, Audits and Books name their opener). The Week is the only section that delegates
     the choice to a page object, which is the one place last-page-viewed state lives.
     ⭐ DERIVED FROM `PAGES`, NEVER TYPED. The landing is the first LINK in the section's own bar, so
     reordering that table moves the landing with it and there is no second fact to keep in step.
     ⚠ A BARE `_resolve()` STILL STAYS PUT. That is the re-open contract and it is the one case the
     old fallback was genuinely right about; only a NAMED thing that is not a page moves. */
  _resolve(which) {
    if (!which) return this.page;
    if (this.LEGACY[which]) return which;                                   // already a page key
    const hit = Object.keys(this.LEGACY).find(k => this.LEGACY[k] === which);
    return hit || this.PAGES[0][0];                                         // the SECTION key, and anything unknown, lands on the first page
  },

  /* ⭐⭐⭐ THE SECTION'S THREE LINKS, DERIVED FROM `PAGES` AND NOTHING ELSE. `App.navHTMLFor('week')`
     hands this to `SectionTabs`, which makes one top-bar link per GROUP — so three groups of one
     row each gives three links, and a group holding a single destination renders as a link that
     NAVIGATES rather than one that opens a menu. That is exactly what Kyle asked for
     (2026-08-23: *"Close, Review, History.. no drop downs on these.. but get rid of the tabs and
     have each link go to the specific page"*), and it is the same shape the four Audits links use.
     ⭐ THE ICONS COME OFF THE RAIL'S OWN VOCABULARY (`App._RAIL_IC` → `App._NAV_SECTION_IC`), so the
     bar and the rail cannot show two different marks for the same page. A second set of SVGs here
     is exactly the drift the one-nav-source rule exists to stop.
     ⚠ THE ROWS CARRY `data-hub-action`, NOT `data-screen`: all three are hub full-pages, and
     `SectionTabs._goRow` routes an action through `S.Hub.routeSidebarAction`, which already knows
     these ids. `groupsFor` keys a screen-less row on its action, so the active mark works too.
     ⚠ MOBILE IS UNTOUCHED, MEASURED NOT ASSUMED: the drawer's `railRow('week')` falls to its LEAF
     branch and never asks for this markup, because 'week' is neither `_isSection` nor one of the
     three hub-sidebar keys. The phone still shows one row that opens Close. */
  navHTML() {
    const IC = (typeof App !== 'undefined' && App._NAV_SECTION_IC) || {};
    const ICKEY = { close: 'dash', review: 'review', history: 'history' };
    /* ⚠ TWO SURFACES, TWO LABELS, AND BOTH ARE KYLE'S WORDS. The GROUP name is the top-bar link, so
       it carries the short word he named there ("Close"). The ROW label is what the mobile drawer
       and the section sidebar show, and on the phone he asked for the full page names on the second
       menu page: *"Close the week, Week in Review, Week History."* Both come out of `PAGES`, so they
       cannot drift from each other or from the page title `open()` hands the host. */
    return this.PAGES.map(([k, title, link]) => {
      const id = this.LEGACY[k];
      return '<div class="nav-section">' + esc(link) + '</div>'
        + '<div class="nav-item" data-hub-action="' + esc(id) + '" id="nav-' + esc(id) + '">'
        + '<svg class="nav-icon" viewBox="0 0 17 17" fill="none">' + (IC[ICKEY[k]] || '') + '</svg>'
        + '<span class="nav-label">' + esc(title) + '</span></div>';
    }).join('');
  },

  /* ⭐ THE PAGE'S OWN NAME AND ITS OWN ACTION GO TO THE HOST. Both were the constant `'The Week'` /
     `'week'` while this was one tabbed page, which was right then and is wrong now: the action is
     what `_renderProtoTopnav` marks the bar link with, so a constant would leave the same link lit
     whichever page you opened. `_GLOBAL_OF_ACTION` already maps all three ids to 'week', so the
     rail still marks The Week, and `_HUB_SIDEBAR_OF_ACTION` already has all three at 'none', so
     they stay full width with no hub sidebar. */
  /* ⛔⛔⛔ EACH PAGE ASKS ITS OWN QUESTION (2026-08-24). This gated every one of the three on
     `week-close`, so Close, Review and History — three separate links in The Week's bar — shared a
     single permission. Harmless while a grant was per AREA (all three are `week`) and a hole the
     moment Kyle asked for per-link checkboxes: tick History without Close and Close still opens,
     because there is nothing behind it to refuse. Same shape as the four Books pages fixed in the
     same pass ([[lessons-paid-for]] #128).
     ⭐ RESOLVED FIRST, GATED ON THE RESULT, ASSIGNED LAST. `LEGACY` is already the one table pairing
     a page key with its screen id, so the gate reads the same source the router and the title do and
     a fourth page is covered the day it is added — no second list. Assigning `this.page` only after
     the gate matters: a refused open must not leave the object pointing at a page the member was
     just told they cannot have.
     ⚠ THE AREA IS UNCHANGED FOR ALL THREE, which is what makes this inert for today's grants. */
  /* ⛔⛔ AND POINTING THE SECTION KEY AT CLOSE WOULD OTHERWISE HAND A SCOPED MEMBER A DEAD RAIL ROW.
     The gate below asks about the page that was resolved, so a member granted Review but not Close
     would press The Week and be refused every time, while the Review link in the bar beside it works
     — a control that renders perfectly and does nothing, and one NEITHER the owner NOR the demo can
     ever meet ([[the-loop]] #149: a permission-gated path is invisible to owner-and-demo testing).
     ⭐ THIS IS NOT A NEW MECHANISM. `_protoGlobalClick` already does exactly this twice, for The
     Floor and for Menus: land on the named page, and if that one is refused take the first row in
     BAR ORDER they can open. Same rule, applied to the one section whose landing is resolved inside
     the page object rather than in the router.
     ⛔ SCOPED TO A SECTION-LEVEL ASK, DELIBERATELY. A direct link to a page a member may not have
     must still REFUSE; falling through there would open a page their grant does not include. */
  open(which) {
    let page = this._resolve(which);
    if (!this._namesAPage(which) && App._hubBlocked && App._hubBlocked(this.LEGACY[page])) {
      const first = this.PAGES.map(t => t[0]).find(k => !App._hubBlocked(this.LEGACY[k]));
      if (first) page = first;
    }
    if (App._hubBlocked && App._hubBlocked(this.LEGACY[page] || 'week-close')) return;
    this.page = page;
    const row = this.PAGES.find(t => t[0] === this.page) || this.PAGES[0];
    App.openHubFullPage(row[1], (mount) => { this.container = mount; this.render(mount); }, this.LEGACY[this.page]);
  },

  /* ⛔⛔⛔ NO TAB BAR. Kyle, 2026-08-23: *"get rid of the tabs and have each link go to the specific
     page.. again no more tabs on the pages.. only navigate from the top bar links."* The three
     pages are reached from the section's three top-bar links and from nothing else on the page.
     ⭐ NOTHING REPLACES IT. Measured on the deployed build before cutting: every other page in a
     barred section opens straight into its own content, and the top bar shows the section ICON
     rather than a page name. The page is named by the marked link. */
  render(mount) {
    if (!mount) return;
    mount.innerHTML = '<div class="screen"><div id="wk-panel"></div></div>';
    this._mountPanel();
  },

  _panel() { return document.getElementById('wk-panel'); },

  /* ⚠ EACH SCREEN IS HANDED THE PANEL AS ITS OWN CONTAINER, so its internal
     re-renders (an import landing, a week stepper) replace the PANEL's markup and
     leave the panel alone. That is why the panel is its own node inside the mount
     rather than part of what the screens draw into. */
  _mountPanel() {
    const p = this._panel();
    if (!p) return;
    /* ⛔ NO try/catch HERE, AND THAT IS DELIBERATE. The first version caught a render throw and
       painted a line of its own copy, which invented two things the app does not have: an error
       path and the words for it. `verify-design-code` RULE 2b refused the copy — correctly, and it
       is a list for Kyle to rule on, so re-baselining past it would have been me approving my own
       design change.
       ⭐ THE REAL QUESTION IS WHAT A CATCH WOULD HIDE ([[the-loop]] #90 inverted). These three
       screens already throw uncaught when opened standalone, and an uncaught throw is what reaches
       the error digest; swallowing it here would make a broken page QUIETER than the same broken
       page is today. The app's own convention for a failed sub-render is `console.error` and
       nothing on screen (`app.js` section links, twice). Matching the status quo beats inventing. */
      if (this.page === 'close' && S.WeekClose) {
        /* `_prepare()` is Close's own landing rule — open the first row still
           owed. It lives in that file, lifted out of its `open()` so this host
           can ask for it without going back through `openHubFullPage`. */
        if (S.WeekClose._prepare) S.WeekClose._prepare();
        S.WeekClose.container = p;
        S.WeekClose.render(p);
      } else if (this.page === 'review' && S.WeekReview) {
        /* Same contract as Close's `_prepare()` above and for the same reason: Review's landing rule
           (open the Inventory row, whatever was left open last visit) cannot live in its `render`,
           which runs on every accordion toggle. Both doors into the page ask for it — this host, and
           `S.WeekReview.open` for a deep link — or the landing is right through one and wrong
           through the other ([[lessons-paid-for]] #59). */
        if (S.WeekReview._prepare) S.WeekReview._prepare();
        S.WeekReview.container = p;
        S.WeekReview.render(p);
      } else if (this.page === 'history' && S.WeekHistory) {
        // Module-screen signature: (container, actions). There is no actions bar here.
        S.WeekHistory.render(p, null);
      }
  },

  /* The one info "i" answers for whichever PAGE is open, so the directions match
     what is on screen rather than the page's name ([[help-model]]). */
  showHowTo() {
    const o = this.page === 'review' ? S.WeekReview : this.page === 'history' ? S.WeekHistory : S.WeekClose;
    if (o && o.showHowTo) return o.showHowTo();
    if (App.showHelpModal) App.showHelpModal('How The Week Works', [
      { p: ['Close the week, review what it was, and look back at every week you have confirmed. Three pages, one record.'] }
    ]);
  }
};
