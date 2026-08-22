'use strict';

/* ── THE WEEK ─────────────────────────────────────────────────────────────────
   One page, three tabs: Close The Week, Week in Review, Week History. Kyle,
   2026-08-23: *"turning week close, review and history into one tabbed page...
   the rail menu will become one link 'the week' and land on the 1st tab that is
   close the week, then week in review and then week history."*

   ⛔⛔ THE THREE WERE NOT THE SAME KIND OF PAGE, and that is the whole difficulty.
   `week-close` and `week-review` went through `App.openHubFullPage` (the hub
   shell); `week-history` was a MODULE screen in `_CONVERTED`, rendering into
   `#content-area`. A tabbed page needs ONE host, so History changes shells. The
   hub full-page is the host because two of the three already used it, it gives a
   titled full-width mount, and it is what Books and Audits use.

   ⭐⭐ THE THREE OLD IDS STAY ALIVE AS TAB TARGETS, AND THAT IS WHAT MAKES THIS
   SAFE. Measured before a line was written: `week-close` has 34 inbound
   references across 15 files, `week-review` 12 across 5, `week-history` 26
   across 7, plus SIXTY-FOUR harness files. Re-pointing 72 call sites is how a
   change like this ships three dead links; instead `openScreen('week-close')`
   and friends open THIS page on the right tab, so every existing link keeps
   working and lands where it always did.

   ⛔ THIS FILE OWNS NO WEEK LOGIC. Each tab mounts the SHIPPED screen object
   into the panel — `S.WeekClose`, `S.WeekReview`, `S.WeekHistory` render
   themselves exactly as before. A second implementation of any of them is the
   drift the suite exists to catch; this is a host, nothing more.

   ⚠ ONE GATE, because db.js files all three under the same area (`'week'`). It
   is asked in `open()` rather than per tab for that reason — and it is asked at
   all because `week-close` shipped with NO access gate until 2026-08-12.        */

S.Week = {

  /* ⭐ THE ORDER IS THE ASK: close, then review, then history. The rail row lands
     on the first one. Keys are short; the LABELS are what the operator reads. */
  TABS: [['close', 'Close The Week'], ['review', 'Week in Review'], ['history', 'Week History']],

  tab: 'close',
  container: null,

  /* Which legacy screen id each tab answers to. Used by the routing in app.js so
     the old ids resolve here, and by `_stamp` so the "you visited this" marks the
     Fix steps read keep working — those are keyed on the OLD ids and a step that
     cannot be ticked is the defect [[lessons-paid-for]] #39 describes. */
  LEGACY: { close: 'week-close', review: 'week-review', history: 'week-history' },

  open(tab) {
    if (App._hubBlocked && App._hubBlocked('week-close')) return;
    if (tab && this.LEGACY[tab]) this.tab = tab;
    App.openHubFullPage('The Week', (mount) => { this.container = mount; this.render(mount); }, 'week');
  },

  render(mount) {
    if (!mount) return;
    mount.innerHTML = '<div class="screen">' + this.tabBar() + '<div id="wk-panel"></div></div>';
    this._wire(mount);
    this._mountPanel();
  },

  /* The app's own tab strip (`ic-report-usage`, Tip History). NOT a second one:
     `.ch-tabs`/`.ch-tab`/`.on` are already styled in style.css and this is the
     look Kyle pointed at. */
  tabBar() {
    return '<div class="ch-tabs no-print">'
      + this.TABS.map(([k, label]) =>
          '<button class="ch-tab' + (this.tab === k ? ' on' : '') + '" data-tab="' + esc(k) + '">'
          + esc(label) + '</button>').join('')
      + '</div>';
  },

  /* ⛔ ASSIGNED, NOT ADDED. `render` runs on every tab switch, so `addEventListener`
     would stack a handler per switch and one click would fire N times. The panel's
     own screen sets its handler on `#wk-panel`, which is INSIDE this mount, so a
     row click bubbles up here and is ignored by the `.ch-tab` test. */
  _wire(mount) {
    mount.onclick = (ev) => {
      const t = ev.target.closest && ev.target.closest('.ch-tab');
      if (!t) return;
      const k = t.getAttribute('data-tab');
      if (!k || k === this.tab) return;      // re-rendering the tab you are on throws away its state
      this.tab = k;
      this.render(this.container);
    };
  },

  _panel() { return document.getElementById('wk-panel'); },

  /* ⚠ EACH SCREEN IS HANDED THE PANEL AS ITS OWN CONTAINER, so its internal
     re-renders (an import landing, a week stepper) replace the PANEL's markup and
     leave the tab strip alone. That is why the strip is a sibling of the panel
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
       the error digest; swallowing it here would make a broken tab QUIETER than the same broken
       page is today. The app's own convention for a failed sub-render is `console.error` and
       nothing on screen (`app.js` section links, twice). Matching the status quo beats inventing. */
      if (this.tab === 'close' && S.WeekClose) {
        /* `_prepare()` is Close's own landing rule — open the first row still
           owed. It lives in that file, lifted out of its `open()` so this host
           can ask for it without going back through `openHubFullPage`. */
        if (S.WeekClose._prepare) S.WeekClose._prepare();
        S.WeekClose.container = p;
        S.WeekClose.render(p);
      } else if (this.tab === 'review' && S.WeekReview) {
        S.WeekReview.container = p;
        S.WeekReview.render(p);
      } else if (this.tab === 'history' && S.WeekHistory) {
        // Module-screen signature: (container, actions). There is no actions bar here.
        S.WeekHistory.render(p, null);
      }
  },

  /* The one info "i" answers for whichever tab is open, so the directions match
     what is on screen rather than the page's name ([[help-model]]). */
  showHowTo() {
    const o = this.tab === 'review' ? S.WeekReview : this.tab === 'history' ? S.WeekHistory : S.WeekClose;
    if (o && o.showHowTo) return o.showHowTo();
    if (App.showHelpModal) App.showHelpModal('How The Week Works', [
      { p: ['Close the week, review what it was, and look back at every week you have confirmed. Three tabs, one record.'] }
    ]);
  }
};
