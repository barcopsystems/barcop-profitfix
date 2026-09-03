'use strict';

S.Hub = {

  AUDIT_STALE: 35,
  WEEKLY_CUTOFF: 8,
  _sidebarCollapsed: false,

  // ── Operations Audit context sidebar ─────────────────────────────────────────
  // The Hub shell's sidebar is context-aware. The Operations Audit pages get this
  // dedicated sidebar instead of the old grab-bag: Overall + quick-links into
  // each Recovery section's own audit page + History + Support. The three
  // Recovery-audit rows use data-hub-action "enter", so clicking one hands the
  // operator off into that section (leaving the Hub shell) and lands on its
  // existing audit page, unchanged.
  _auditSidebarHTML() {
    const ic = {
      audit:   '<circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 8.5l2 2L12 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
      profit:  '<path d="M2 13h11M4 13V8M7.5 13V4M11 13V9.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
      revenue: '<path d="M2 13l4-5 3 3 4.5-7M10 4h4v4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
      cash:    '<circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M8.5 4.7v7.6M10.6 6.3c-.4-.6-1.2-1-2.1-1-1.2 0-2.1.6-2.1 1.6 0 2.1 4.3 1.1 4.3 3.2 0 1-.9 1.6-2.2 1.6-1 0-1.8-.4-2.2-1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>',
      history: '<path d="M5 4.5h9M5 8.5h9M5 12.5h9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="2.6" cy="4.5" r="0.7" fill="currentColor"/><circle cx="2.6" cy="8.5" r="0.7" fill="currentColor"/><circle cx="2.6" cy="12.5" r="0.7" fill="currentColor"/>',
      help:    '<circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M7 6.5a1.5 1.5 0 0 1 3 0c0 1-1.5 1.5-1.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8.5" cy="12" r="0.6" fill="currentColor"/>',
      bug:     '<ellipse cx="8.5" cy="9" rx="3.5" ry="4.5" stroke="currentColor" stroke-width="1.3"/><path d="M5 9H2.5M14.5 9H12M5.5 5L4 3.5M11.5 5L13 3.5M5.5 13L4 14.5M11.5 13L13 14.5M8.5 4.5V3M7 4a2 2 0 0 1 3 0" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
      support: '<path d="M2.5 3.8h12v7.5H7.8l-3 2.3v-2.3H2.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" fill="none"/><path d="M5.3 6.6h6.4M5.3 8.7h4.2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>'
    };
    const row = (action, name, iconKey, extra) => {
      const attrs = (extra || []).map(([k, v]) => ' ' + k + '="' + v + '"').join('');
      return '<div class="nav-item" data-hub-action="' + action + '"' + attrs + '>'
        + '<svg class="nav-icon" viewBox="0 0 17 17" fill="none">' + ic[iconKey] + '</svg>'
        + '<span class="nav-label">' + name + '</span></div>';
    };
    /* ⭐⭐⭐ FOUR GROUPS OF ONE, AND THE GROUP NAMES ARE THE BAR'S LINKS (Kyle, 2026-08-22:
       *"a top bar menu like inventory does with 4 links.. Operations, Profit, Revenue, and Cash..
       each going to the corresponding audit landing page"*). `SectionTabs` makes one top-bar link
       per GROUP, so the group name IS the link. A group holding a single destination renders as a
       link that navigates rather than one that opens a one-row menu.
       ⛔ ALL FOUR AUDITS LIVE HERE NOW AND NOWHERE ELSE. Their rows came out of the Profit, Revenue
       and Cash menus in the same edit, which is the other half of what Kyle asked for: *"all 4
       audit pages now live in one place."* The SCREENS are untouched — only the nav rows moved, so
       every existing inbound link still resolves.
       ⚠ THE OLD GROUPING WAS "Audit" + "By Recovery System", which would have made TWO links. */
    return ''
      + '<div class="nav-section">Operations</div>'
      + row('bar-cop-audit', 'Operations Audit', 'audit', [])
      + '<div class="nav-section">Profit</div>'
      + row('enter', 'Profit Audit',  'profit',  [['data-mod', 'profit'],  ['data-screen', 'audit-tracker']])
      + '<div class="nav-section">Revenue</div>'
      + row('enter', 'Revenue Audit', 'revenue', [['data-mod', 'revenue'], ['data-screen', 'r-audit']])
      + '<div class="nav-section">Cash</div>'
      + row('enter', 'Cash Audit', 'cash', [['data-mod', 'cash'], ['data-screen', 'c-audit']])
      + '<div class="nav-section">Support</div>'
      + row('audit-help', 'Help and FAQ', 'help', [])
      + row('report-bug', 'Report a Bug', 'bug',  []);
  },

  // ── Books context sidebar ─────────────────────────────────────────────────
  // The Books section's sidebar: Accounting (Overview + the three deliverables)
  // + Operations (Permits, Operating Expenses, folded in from the retired
  // top-nav Operations link) + Support. Overview opens the Books landing
  // (S.HubBooksHome); the rest open their existing screens, all of which now
  // resolve to this 'books' sidebar context.
  _booksSidebarHTML() {
    const ic = {
      grid:    '<rect x="2" y="2" width="6" height="6" rx="0.5" stroke="currentColor" stroke-width="1.3" fill="none"/><rect x="9" y="2" width="6" height="6" rx="0.5" stroke="currentColor" stroke-width="1.3" fill="none"/><rect x="2" y="9" width="6" height="6" rx="0.5" stroke="currentColor" stroke-width="1.3" fill="none"/><rect x="9" y="9" width="6" height="6" rx="0.5" stroke="currentColor" stroke-width="1.3" fill="none"/>',
      report:  '<rect x="3.5" y="2" width="10" height="13" rx="0.5" stroke="currentColor" stroke-width="1.3"/><path d="M6 5.5h5M6 8h5M6 10.5h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M9 12.5l1.2 1.2 2.2-2.2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
      books:   '<rect x="3" y="2.5" width="11" height="12" rx="0.5" stroke="currentColor" stroke-width="1.3"/><path d="M3 5.5h11M6 8.5h5M6 10.5h5M6 12.5h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
      calendar:'<rect x="2" y="3.5" width="13" height="11.5" rx="0.5" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M2 7h13" stroke="currentColor" stroke-width="1.3"/><path d="M5 2v3M11.5 2v3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
      shield:  '<path d="M8.5 2L3 4v5c0 3 2.5 5 5.5 6 3-1 5.5-3 5.5-6V4l-5.5-2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" fill="none"/><path d="M6.5 8.5l1.5 1.5 3-3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
      expense: '<path d="M3.5 2v13l1.5-1 1.5 1 1.5-1 1.5 1 1.5-1 1.5 1V2H3.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M8.5 5.5v5M10 6.5H7.5a1 1 0 0 0 0 2H9.5a1 1 0 0 1 0 2H7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none"/>',
      cashout: '<circle cx="8.5" cy="8.5" r="6.3" stroke="currentColor" stroke-width="1.3"/><path d="M8.5 5.3v6.4M10.1 6.6H7.7a1.15 1.15 0 0 0 0 2.3H9.3a1.15 1.15 0 0 1 0 2.3H6.8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none"/>',
      history: '<path d="M5 4.5h9M5 8.5h9M5 12.5h9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="2.6" cy="4.5" r="0.7" fill="currentColor"/><circle cx="2.6" cy="8.5" r="0.7" fill="currentColor"/><circle cx="2.6" cy="12.5" r="0.7" fill="currentColor"/>',
      breakeven: '<path d="M2 12.5l4-4 3 2 5.5-6.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 8.5h13" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-dasharray="2 2"/>',
      /* ⭐ THE FOUR THAT CAME OVER FROM CASH AND THE THREE FORECASTS (T48). These SVGs were MOVED
         out of `nav.js` in the same edit, not copied: those rows are gone from the Cash, Profit and
         Revenue menus, so there is no second spelling left to drift from.
         ⛔ THE THREE FORECASTS NO LONGER SHARE ONE MARK (Kyle, 2026-08-23: *"give each of the
         forecasts a unique/different icon"*). They always shared it, and it never showed because
         they lived in three different menus; putting them in one drop-down is what made three
         identical rows visible. **The three marks are the app's OWN system icons for Profit, Revenue
         and Cash**, lifted from `_auditSidebarHTML` a few lines up rather than drawn — the Audits
         menu already tells an operator which of the three a row belongs to with exactly these, so
         the Forecasts menu now reads the same way instead of teaching a second vocabulary. */
      capital: '<path d="M2.5 14.5V8M7 14.5V4M11.5 14.5V10M2.5 14.5h12.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 3.5l2.5-1.5 1 2.6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>',
      position: '<rect x="2" y="4.5" width="13" height="9" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M2 7.2h13" stroke="currentColor" stroke-width="1.2"/><path d="M11 10.3h2.3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
      bridge:  '<path d="M2 11c2-5 11-5 13 0" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M2 11v2.5M15 11v2.5M6.5 9v4.5M10.5 9v4.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
      fcCash:    '<circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M8.5 4.7v7.6M10.6 6.3c-.4-.6-1.2-1-2.1-1-1.2 0-2.1.6-2.1 1.6 0 2.1 4.3 1.1 4.3 3.2 0 1-.9 1.6-2.2 1.6-1 0-1.8-.4-2.2-1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>',
      fcProfit:  '<path d="M2 13h11M4 13V8M7.5 13V4M11 13V9.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
      fcRevenue: '<path d="M2 13l4-5 3 3 4.5-7M10 4h4v4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
      help:    '<circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M7 6.5a1.5 1.5 0 0 1 3 0c0 1-1.5 1.5-1.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8.5" cy="12" r="0.6" fill="currentColor"/>',
      bug:     '<ellipse cx="8.5" cy="9" rx="3.5" ry="4.5" stroke="currentColor" stroke-width="1.3"/><path d="M5 9H2.5M14.5 9H12M5.5 5L4 3.5M11.5 5L13 3.5M5.5 13L4 14.5M11.5 13L13 14.5M8.5 4.5V3M7 4a2 2 0 0 1 3 0" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
      support: '<path d="M2.5 3.8h12v7.5H7.8l-3 2.3v-2.3H2.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" fill="none"/><path d="M5.3 6.6h6.4M5.3 8.7h4.2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>'
    };
    /* ⚠ `extra` JOINED THIS HELPER FOR T48, matching `_auditSidebarHTML`'s signature exactly. A row
       that opens a screen in ANOTHER module carries `data-mod` + `data-screen` and the `enter`
       action; `routeSidebarAction` then runs `_enter(screen, mod)`, which swaps the shell before
       navigating. Without `data-mod` that call is `showApp(undefined)` and the page never renders
       ([[lessons-paid-for]] #146 — `navigate` is module-internal and the wrong door ships dead
       links). Existing callers pass nothing and are byte-identical. */
    const row = (action, name, iconKey, extra) => {
      const attrs = (extra || []).map(([k, v]) => ' ' + k + '="' + v + '"').join('');
      return '<div class="nav-item" data-hub-action="' + action + '"' + attrs + '>'
        + '<svg class="nav-icon" viewBox="0 0 17 17" fill="none">' + ic[iconKey] + '</svg>'
        + '<span class="nav-label">' + name + '</span></div>';
    };
    /* ⭐⭐⭐ THE BOOKS BAR — MONEY OUT · STATEMENTS · CASH · FORECASTS (Kyle, T48, 2026-08-23).
       `SectionTabs` makes ONE top-bar link per GROUP, so every heading below IS a link and the four
       words here are the whole operator-visible change. Money Out holds a single destination, which
       renders as a link that NAVIGATES and takes the hand cursor; the other three open on hover.
       ⭐ HE CHOSE "STATEMENTS" OVER "REPORTS" because Inventory's bar already carries a Reports
       link, and two links called the same thing in two sections is how an operator learns that a
       word means nothing.
       ⛔⛔ THE GROUP NAME IS THE BAR AND THE ROW LABEL IS THE MENU, AND THEY ARE ALLOWED TO DIFFER.
       "Money Out" is the word Kyle uses; "All Money Out" is what that page calls itself in its own
       header and help, so the ROW keeps it — the same split Events uses ("Bookings" over "Event
       Booking"). Renaming the PAGE is a separate call and his to make.
       ⛔⛔⛔ SIX ROWS CAME FROM THREE OTHER SECTIONS AND LEFT THEM IN THE SAME EDIT. Capital
       Efficiency, Cash Position, Cash Bridge and Cash Forecast are out of the Cash menu; Profit
       Forecast and Revenue Forecast are out of theirs. Listed in two menus at once,
       `_railSectionForScreen` resolves on FIRST MATCH and would silently throw the operator into
       Books from the other section's own menu — so the removal is half the change, not tidying.
       ⚠ THE PERMISSION AREA MOVED WITH THEM (`DB.SCREEN_GROUPS`), the MODULE deliberately did not:
       `navigate` still renders all six out of the cash, profit and revenue branches. Pinned by
       `verify-area-access-doors` block G, because a scoped member is the only identity that can
       meet it and neither the owner nor the demo can ([[the-loop]] #149).
       ⚠ THIS ENDS THE CASH SECTION. What is left there is Purchasing and Trapped Cash, both of
       which Kyle has said go to Inventory, and Experiments, which wants a Tools section that does
       not exist yet. Until then a "Cash" drop-down inside Books sits beside a Cash rail row; that
       resolves when Cash dies and is live in between, which he has taken. */
    return ''
      /* ⭐⭐⭐ BUILD ORDER D — THREE ROWS OVER ONE STORE BECOME ONE. Phase 1 migrated every cash
         outflow into the expense ledger, item 19 stage 1 gave the log a kind chip that shows bills
         and cash together, and B made this screen read-only history with one entry point on Close
         The Books. Three sidebar rows for one list was the last thing left.
         ⛔ THE ACTION ID IS UNCHANGED ON PURPOSE. `operating-expenses` is referenced by
         `_GLOBAL_OF_ACTION`, `_HUB_SIDEBAR_OF_ACTION` and the help topics; renaming the route to
         match the label would be three more places to keep in step for no gain. The LABEL is what
         the operator reads.
         ⚠ AND THE CASH OUTFLOWS SCREEN OBJECT IS NOT AFFECTED BY LOSING ITS ROW — a nav row is not
         what loads a screen. All four Money Out doors still call `S.HubCashOutflows._writeCashRow` /
         `._deleteCashRow`, and a legacy declared series is still stoppable from the merged log under
         the Cash Outflows chip (measured before this row was removed).
         ⚠ Those two were `_writePair` / `_deletePair` until build order E, when they wrote a second
         store as well. `verify-money-out-one-row.js` C2/C4 pin that they exist and are still reached
         from here, so this note cannot go stale again without the gate saying so. */
      + '<div class="nav-section">Money Out</div>'
      + row('operating-expenses', 'All Money Out', 'expense')
      /* ⛔ LICENSING LEFT THIS SIDEBAR (build piece 5). It is a Shift Control screen now — see
         `nav.js`. Kyle: *"it has nothing to do with books really."* Correct once it holds no money:
         nothing in Books reads a permit record, and its two real consumers are the Hub's alert panel
         and the Audit's operational exposures.
         ⚠ THE BOOKS LANDING KEEPS EVERY PERMIT LINK IT HAD — the due count, the "clear the N flagged"
         next move, the Licensing button and the get-started step. A quick link crossing sections is
         normal here; the Audit sidebar jump-links into Recovery the same way. */
      /* ⚠ "Accounting" BECAME "Statements" (T48). The heading was never a bar link before, so the
         word only ever appeared as a rule in the sidebar; now it is what an operator reads across
         the top and it has to name what is behind it. The three rows are unchanged. */
      + '<div class="nav-section">Statements</div>'
      + row('weekly-pnl', 'Weekly P&L Brief', 'report')
      + row('books', 'Month-End Books', 'books')
      + row('year-end', 'Annual Review', 'calendar')
      /* ⭐ BREAK-EVEN OPENS THE CASH GROUP because it is the only one of the four that is already a
         Books page (`hub-breakeven`); the other three are Cash module screens reached through
         `enter`. Kyle's order, taken as he gave it. */
      + '<div class="nav-section">Cash</div>'
      + row('breakeven', 'Break-Even', 'breakeven')
      + row('enter', 'Capital Efficiency', 'capital',  [['data-mod', 'cash'], ['data-screen', 'c-capital']])
      + row('enter', 'Cash Position',      'position', [['data-mod', 'cash'], ['data-screen', 'c-position']])
      + row('enter', 'Cash Bridge',        'bridge',   [['data-mod', 'cash'], ['data-screen', 'c-bridge']])
      /* ⚠ THE ROW LABELS KEEP THE LONG NAMES. "Cash Forecast" / "Profit Forecast" / "Revenue
         Forecast" are what this app's help, its audit copy and its own page headers call these
         three, so shortening them in the menu would leave a dozen operator-facing sentences naming
         screens by words the app no longer shows — the same reason Events kept "Event Booking"
         under a group called "Bookings". The GROUP is Kyle's word; the rows are the app's. */
      + '<div class="nav-section">Forecasts</div>'
      + row('enter', 'Cash Forecast',    'fcCash',    [['data-mod', 'cash'],    ['data-screen', 'c-forecast']])
      + row('enter', 'Profit Forecast',  'fcProfit',  [['data-mod', 'profit'],  ['data-screen', 'profit-forecast']])
      + row('enter', 'Revenue Forecast', 'fcRevenue', [['data-mod', 'revenue'], ['data-screen', 'r-forecast']])
      + '<div class="nav-section">Support</div>'
      + row('books-help', 'Help and FAQ', 'help')
      + row('report-bug', 'Report a Bug', 'bug');
  },

  // ── Settings context sidebar ──────────────────────────────────────────────
  // The Settings section: Setup (Overview landing + Getting Started) + Settings
  // (the App Settings sections split into Business Profile + Recovery Targets)
  // + Account (User Accounts) + Support. Opened from the top-nav gear.
  _settingsSidebarHTML() {
    const ic = {
      getStart:'<path d="M2.5 8.5l4 4 8-8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
      profile: '<path d="M3 7.5V14h11V7.5" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M2 4h13l1 3.5H1L2 4z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" fill="none"/><path d="M6.5 14v-3.5h4V14" stroke="currentColor" stroke-width="1.2" fill="none"/>',
      target:  '<circle cx="8.5" cy="8.5" r="6.3" stroke="currentColor" stroke-width="1.3"/><circle cx="8.5" cy="8.5" r="3.4" stroke="currentColor" stroke-width="1.3"/><circle cx="8.5" cy="8.5" r="1" fill="currentColor"/>',
      user:    '<circle cx="8.5" cy="6" r="2.8" stroke="currentColor" stroke-width="1.3"/><path d="M3 14.5c0-2.7 2.5-4.5 5.5-4.5s5.5 1.8 5.5 4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
      team:    '<circle cx="6" cy="6.5" r="2.3" stroke="currentColor" stroke-width="1.3"/><path d="M1.8 14c0-2.4 1.9-4 4.2-4s4.2 1.6 4.2 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="12" cy="6" r="1.9" stroke="currentColor" stroke-width="1.2"/><path d="M11.4 10.1c1.8.3 3.1 1.7 3.1 3.9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
      data:    '<ellipse cx="8.5" cy="4.2" rx="5.4" ry="2.2" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M3.1 4.2v8.4c0 1.22 2.42 2.2 5.4 2.2s5.4-.98 5.4-2.2V4.2" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M3.1 8.4c0 1.22 2.42 2.2 5.4 2.2s5.4-.98 5.4-2.2" stroke="currentColor" stroke-width="1.2" fill="none"/>',
      help:    '<circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M7 6.5a1.5 1.5 0 0 1 3 0c0 1-1.5 1.5-1.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8.5" cy="12" r="0.6" fill="currentColor"/>',
      bug:     '<ellipse cx="8.5" cy="9" rx="3.5" ry="4.5" stroke="currentColor" stroke-width="1.3"/><path d="M5 9H2.5M14.5 9H12M5.5 5L4 3.5M11.5 5L13 3.5M5.5 13L4 14.5M11.5 13L13 14.5M8.5 4.5V3M7 4a2 2 0 0 1 3 0" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
      support: '<path d="M2.5 3.8h12v7.5H7.8l-3 2.3v-2.3H2.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" fill="none"/><path d="M5.3 6.6h6.4M5.3 8.7h4.2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>'
    };
    const row = (action, name, iconKey) =>
      '<div class="nav-item" data-hub-action="' + action + '">'
        + '<svg class="nav-icon" viewBox="0 0 17 17" fill="none">' + ic[iconKey] + '</svg>'
        + '<span class="nav-label">' + name + '</span></div>';
    // Getting Started (and its Setup heading) drop off once setup is complete,
    // the same way the old grab-bag hid it. Team Members is admin-only.
    // Data and Backup is OWNER-only, not admin-only: the page it opens renders its
    // controls inside `if (isOwnerNow)`, so an admin-gated row would be a link to an
    // empty page. hub-user-accounts.open('data') refuses non-owners for the same reason.
    // SET-2: the demo sees both rows, so a prospect can find Team Members and Data and Backup.
    // Same predicate as hub-settings-home, hub-user-accounts.render and open('data')'s refusal.
    const isAdmin   = App.demoMode || !!(window.DB && DB.isAdmin && DB.isAdmin());
    const isOwner   = App.demoMode || !!(window.DB && DB.isOwner && DB.isOwner());
    return ''
      + '<div class="nav-section">Settings</div>'
      + row('settings-profile', 'Business Profile', 'profile')
      + row('settings-targets', 'Recovery Targets', 'target')
      + '<div class="nav-section">Account</div>'
      + row('user-account', 'Your Account', 'user')
      + (isOwner ? row('user-data', 'Data and Backup', 'data') : '')
      + (isAdmin ? row('user-team', 'Team Members', 'team') : '')
      + '<div class="nav-section">Support</div>'
      + row('contact-support', 'Contact Support', 'support')
      + row('report-bug', 'Report a Bug', 'bug')
      + row('settings-help', 'Help and FAQ', 'help');
  },

  // Swap the Hub shell's sidebar for a context. 'audit' / 'books' / 'settings'
  // mount their dedicated sidebars; anything else restores the default
  // (grab-bag) nav cached when the Hub last rendered. The delegated click
  // handler lives on .sidebar-nav (wired once in render), so swapping
  // innerHTML keeps it live.
  /* ⛔⛔ THE HUB SIDEBAR'S ACTION ROUTER, AND IT HAD TO BECOME A NAMED MEMBER BEFORE THE RAIL
     OVERLAY COULD SHOW THESE SECTIONS AT ALL (2026-08-08).
     It used to be an anonymous if/else chain living inside the click listener bound to ONE node,
     so any other surface rendering the same rows would have painted them perfectly and done
     NOTHING on click. That is the dead-tab defect (integrity #11): wired in one place, rendered in
     another, and it looks alive right up until somebody presses it.
     Now both callers route through here: the Hub shell's own delegated listener, and
     App._wireRailMenu's listener on the overlay. One implementation, so a new action reaches both
     surfaces the day it is added rather than the day somebody remembers the second copy. */
  routeSidebarAction(item) {
    if (!item || item.classList.contains('nav-disabled')) return;
    const action = item.dataset.hubAction;
    if (action === 'enter') return this._enter(item.dataset.screen, item.dataset.mod);
    if (action === 'hub-home')           return App.showHub();
    if (action === 'audit-help')         return S.HubAuditHelp?.open?.();
    if (action === 'books-help')         return S.HubBooksHelp?.open?.();
    if (action === 'settings-help')      return S.HubSettingsHelp?.open?.();
    if (action === 'help')               return S.HubHelp.open();
    if (action === 'settings-profile')   return S.HubSettings.open('business-profile');
    if (action === 'settings-targets')   return S.HubSettings.open('recovery-targets');
    if (action === 'settings')           return S.HubSettings.open();
    if (action === 'user-account')       return S.HubUserAccounts.open('account');
    if (action === 'user-data')          return S.HubUserAccounts.open('data');
    if (action === 'user-team')          return S.HubUserAccounts.open('team');
    if (action === 'user-accounts')      return S.HubUserAccounts.open();
    if (action === 'bar-cop-audit')      return S.HubBarCopAudit?.open?.();
    if (action === 'books-home')         return S.HubOperatingExpenses?.open?.();
    if (action === 'breakeven')          return S.HubBreakEven?.open?.();
    if (action === 'books')              return S.HubBooks.open();
    if (action === 'weekly-pnl')         return S.Reports?._openQboModal?.();
    if (action === 'year-end')           return S.HubYearEnd.open();
    if (action === 'operating-expenses') return S.HubOperatingExpenses?.open?.();
    if (action === 'permits')            return S.HubPermits?.open?.();
    if (action === 'report-bug')         return (S.HubReportBug.openModal || S.HubReportBug.open).call(S.HubReportBug);
    if (action === 'contact-support')    return (S.HubSupport.openModal || S.HubSupport.open).call(S.HubSupport);
    /* ⛔⛔⛔ THE WEEK'S THREE PAGES, AND LEAVING THEM OUT SHIPPED THREE DEAD LINKS (Kyle, 2026-08-23:
       *"again the review and history links do not work"*). The section-links bar routes a row that
       carries a `data-hub-action` through HERE, so a bar row whose action this table does not name
       falls past every branch, returns undefined, and does nothing at all. Close looked alive only
       because the rail row had already landed the operator on it.
       ⭐ DELEGATED, NOT DUPLICATED: `_protoGlobalClick` is the door the rail presses for these ids
       and it resolves all four through `S.Week.open`. A second copy of that resolution here is the
       drift this table's own header warns about. */
    if (action === 'week' || action === 'week-close' || action === 'week-review' || action === 'week-history') {
      return App._protoGlobalClick(action);
    }
    /* ⛔⛔ AND AN UNKNOWN ACTION IS NOW LOUD. Falling off the end of this table is EXACTLY how three
       links shipped dead twice in two days, and it is invisible: no throw, no console line, a row
       that simply does nothing on click. `verify-section-tabs` block K now refuses any action an
       enabled section's bar can emit that this table does not answer — this line is the runtime half
       of that, so a door added tomorrow reports itself instead of going quiet
       ([[lessons-paid-for]] #120 — rendering is downstream of reaching). */
    console.error('routeSidebarAction: no route for action "' + action + '"');
  },

  /* `target` is optional and defaults to the Hub shell's own sidebar, which is every caller that
     existed before the rail. The overlay passes its own container so Audits, Books and Settings
     can be BROWSED from a page in another section without navigating into them — the same
     one-renderer-two-containers move `App._renderNav` got.
     ⭐ `_builtCtx` is cached ON THE NODE, not on this object, so the two containers keep separate
     caches and neither can suppress the other's rebuild. */
  renderSidebar(context, target) {
    const nav = target || document.querySelector('.hub-app .sidebar-nav');
    if (!nav) return;
    // Mobile-style Hub sections (a Dashboard leaf + group-icon accordions, like
    // the module sidebars). Each maps to its section landing's activeAction.
    const CHECKLIST_ICON = '<svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2.5 4.2l1.2 1.2 2-2.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 4h6.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M2.5 8.7l1.2 1.2 2-2.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 8.5h6.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M2.5 13.2l1.2 1.2 2-2.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 13h6.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';
    const MSTYLE = {
      /* ⛔⛔ NO LANDING LEAF FOR BOOKS ANY MORE, AND IT WOULD BE A DUPLICATE ROW (2026-08-23).
         The leaf existed to reach Close Books, which is NOT in this sidebar — legitimate. That page
         is deleted and the section's landing is All Money Out, which is ALREADY this sidebar's first
         row. Re-pointing the leaf at it put "All Money Out" in the overlay TWICE, which I saw only
         by opening the menu on the pushed build.
         ⚠ MY OWN SURVEY SAID THIS SIDEBAR HELD ONLY "Accounting" AND "Support" — it split the markup
         on `<div class="nav-section">` and therefore could not see the two rows that sit ABOVE the
         first heading. A parser that starts at the first heading is blind to everything before it
         ([[lessons-paid-for]] #7 — suspect the probe; #54 — ask what the markup does before the
         point you started reading).
         ⭐ THE EVENTS PRECEDENT IS EXACTLY THIS: its landing leaf pointed at `ev-bookings`, which the
         row below already opened, and the fix was to drop the leaf rather than rename it.
         ⚠ `{}` NOT REMOVED: `ms` must stay truthy or the section loses its flat-list treatment and
         its Report-a-Bug filtering. `if (ms.id)` is what guards the leaf. */
      books:    {},
      // No landing leaf: the Bar Cop Settings page is retired, so this section opens straight
      // onto its own pages, the same way Audits does.
      settings: { keepSupport: true },
      // Audits has no Dashboard leaf (the Operations Audit page IS its landing, now
      // a flat link); it only renames the recovery-audits group.
      audit:    { remaps: { groups: { 'By Recovery System': 'Recovery Audits' } } }
    };
    const ms = MSTYLE[context];
    // Mobile-style sidebars keep their DOM across in-section navigation so the
    // open drop-down persists (the module sidebars never rebuild either).
    if (ms && nav._builtCtx === context) return;
    nav._builtCtx = context;
    if (context === 'audit') {
      nav.innerHTML = this._auditSidebarHTML();
    } else if (context === 'books') {
      nav.innerHTML = this._booksSidebarHTML();
    } else if (context === 'settings') {
      nav.innerHTML = this._settingsSidebarHTML();
    } else if (this._grabBagNavHTML != null) {
      nav.innerHTML = this._grabBagNavHTML;
    }
    // A Dashboard leaf routing to the section landing, then a flat icon list with
    // a divider between groups (the desktop sidebar standard, app-wide). The
    // mobile drawer is built separately and is unaffected.
    nav.classList.toggle('nav-flat', !!ms);
    nav._mstyleClosed = false;
    if (ms) {
      if (ms.id) {
        /* ⛔ THE LEAF GOES FIRST, FULL STOP — it used to be inserted before the first `.nav-section`,
           which worked only because every sidebar happened to open with a section header. Removing
           the Books sidebar's leading empty divider (Kyle's ask, 2026-08-12) moved the anchor to the
           "Accounting" header, so Close Books landed THIRD, under All Money Out and Break-Even.
           ⚠ A divider was load-bearing and nothing said so. `_auditSidebarHTML` and
           `_settingsSidebarHTML` both still start with a section, so prepending is byte-identical for
           them — measured before changing it. */
        const firstSec = nav.firstElementChild;
        if (firstSec && !nav.querySelector('#' + ms.id)) {
          const d = document.createElement('div');
          d.className = 'nav-item nav-leaf';
          d.id = ms.id;
          d.setAttribute('data-hub-action', ms.action);
          d.innerHTML = (ms.leafIcon || '<svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="2" y="2" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="9.5" y="2" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="2" y="9.5" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="9.5" y="9.5" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/></svg>') + '<span class="nav-label">' + (ms.leafLabel || 'Dashboard') + '</span>';
          firstSec.parentNode.insertBefore(d, firstSec);
        }
      }
      // Drop Report a Bug, headers become dividers, shorten Help, apply any item
      // label remaps — the same flat transform the module sidebars get. (Group
      // label remaps are moot here since the flat list has no headers.)
      App._flatSidebar(nav, Object.assign({ keepSupport: ms.keepSupport }, ms.remaps || {}));
    }
  },

  /* ── THE SECTION STRIP: SIX SYSTEMS, ONE ROW ────────────────────────────────
     Replaces six cards that carried three stats, a progress bar, four hand-ticked step rows and a
     footer each. Kyle, 2026-08-10, on why: *"the current dashboard is the main image on the
     website.. and it looked intimidating... too much work.. 6 cards.. 4 steps each."* The Hub is the
     shop window, and it was still advertising the 24-step model Close The Week replaced.

     ⛔⛔ AND IT NO LONGER READS A COCKPIT. The old cards were BUILT from `safeSteps(S.<Cockpit>)`, so
     the six screens being deleted were not merely linked — they were the data source. Every value
     below comes from a store, a shared engine, or a screen that survives.

     ⭐ WHICH SIX, AND WHY THESE: measured across all 18 stats the Hub used to show, only FIVE are
     scored against a target at all (`tcol(value, target, dir)`) and two more carry a hard danger
     rule. The other eleven are raw facts the app never forms an opinion about — which is exactly why
     a bare "Shift -$28" told an operator nothing.
     ⭐ LABEL THE METRIC, NOT THE SYSTEM. "Over / short" says what the number is; "Shift" does not.
     ⚠ LABOR % SAT ON THE REVENUE CARD — the one labour metric with a target, while the Labor card
     carried three unjudged figures. Filed under the system it measures now.

     ⛔⛔⛔ AND A ZERO IS ONLY PRINTED WHEN IT IS MEASURED. The old empty state read
     *Revenue $0.00 · Voids $0.00 · Over/short "Not counted"* — two cells claiming a measured zero
     beside one telling the truth, and "Voids $0.00" reads as GOOD NEWS to someone who has imported
     nothing. Every cell here answers "-" until it has a basis. */
  _stripMetrics() {
    /* BELOW PAR comes from the ORDER SHEET, not from the dying Inventory cockpit. Measured:
       `ic-dashboard.computeState` never calculated it — it called `belowParByVendor()` (1,493 chars,
       self-contained, on a screen that survives) and summed the plan. That one fact is why the Hub
       needs no engine extraction to lose its last cockpit dependency.
       ⚠ NO COUNT, NO BASIS. `latest` is the count the plan is measured from; without it "nothing is
       below par" would be a claim about data that does not exist. */
    let belowPar = null;
    const os = (typeof S !== 'undefined') && S.InventoryOrderSheet;
    if (os && os.belowParByVendor) {
      const plan = os.belowParByVendor();
      if (plan && plan.latest && plan.groups) {
        /* ⛔ THE COST IS NOT A FIELD ON THE LINE — it is `suggested × unit_cost`, exactly as the
           Inventory cockpit computed it. My first version read `l.cost`, which does not exist, so
           the strip printed a confident **$0** on a demo whose old card read $3,988.05: a false zero
           on the one cell whose whole job is saying money is sitting on the shelf. The harness
           certified it because the fixture INVENTED `{cost: …}` instead of copying the real line
           ([[the-loop]] integrity #6 — read the dependency's shape, never guess it). */
        belowPar = 0;
        Object.keys(plan.groups).forEach(v =>
          (plan.groups[v] || []).forEach(l => { belowPar += (l.suggested || 0) * (l.unit_cost || 0); }));
      }
    }

    /* ⚠ OVER / SHORT LEFT THIS STRIP DELIBERATELY, IT WAS NOT DROPPED. It reads the CURRENT week, and
       on a Monday morning that is "Not counted" for every operator alive — which is the same trap as
       reading sales from a week that has not happened yet. The drawer variance still has its own
       screen and still feeds Cash Integrity in the audit. `verify-hub-shift-notcounted-tile` pins the
       "Not counted" wording, so it was RE-POINTED rather than deleted
       ([[harness-review-like-code]] #69 — a feature that MOVED reads as one that was LOST). */
    const cashSF = (typeof CashEngine !== 'undefined' && CashEngine.survivalForecast)
      ? CashEngine.survivalForecast(13) : { hasData: false };
    const runway = !cashSF.hasData ? null
      : (cashSF.runway == null ? '13+ wks'
         : cashSF.runway === 0 ? 'This wk' : cashSF.runway + ' wk' + (cashSF.runway === 1 ? '' : 's'));

    /* ⛔ THE STRIP STOPPED REPEATING THE BAND ABOVE IT. Kyle, 2026-08-10: *"the bottom section we put
       entirely different things.. not repeating most of what is already in there where you are box."*
       Prime cost, labor %, check average and weekly sales are all in the was-to-now band now, so a
       strip carrying them again said the same thing twice on one screen. These six are OPERATIONAL
       facts, each a different job, each a door into the section that owns it.
       ⚠ I SWAPPED ONE OF KYLE'S OWN CANDIDATES OUT AND IT NEEDS HIS EYES: he listed "sales data",
       but weekly sales is already a was-to-now pair, so it would have been the exact duplication he
       asked me to remove. Cash runway takes the slot. Spot checks moved to Done This Week by his
       call, because a "did you do it" fact reads better as a tick than as a number.
       ⛔ BELOW PAR AND CASH RUNWAY CARRY NO DELTA AND NEVER WILL. Both are computed live (the order
       sheet against the latest count; CashEngine against today's balances) and NOTHING stores a
       dated history of either — measured across every store. A delta needs a past reading, so those
       two cells state the figure and stop. The others compare against the week before last week. */
    const lw = this._lastClosedWeek();
    const money = (v, dp) => v == null ? '-' : App.fmtCurrency(v, dp == null ? 0 : dp);
    return [
      { label: 'Below par',      mod: 'inventory', screen: 'ic-order-sheet',
        value: belowPar == null ? '-' : App.fmtCurrency(belowPar, 0), sub: 'to reorder' },
      /* ⛔ EVERY DELTA DECLARES WHICH DIRECTION IS GOOD, because the colour answers good-or-bad and
         not up-or-down. Hours has NO direction: more hours is neither good nor bad without knowing
         the sales behind them, and colouring it would be the app pretending to a judgement it has
         not made ([[dashboard-discipline]] — colour is meaning, and an unjudged figure stays neutral).
         ⚠ THE DELTAS WERE COMPUTED AND RENDERED NOWHERE in my first version — `_sectionStrip` simply
         did not read them. That is [[the-loop]] #25 exactly: a field computed, carried and never
         read is a fix that never shipped. Caught by RUNNING the member and reading its output. */
      { label: 'Hours logged',   mod: 'labor',     screen: 'lc-log-hours',
        value: lw.hours == null ? '-' : (Math.round(lw.hours) + ' hrs'),
        sub: lw.label, delta: lw.hoursDelta, deltaText: lw.hoursDelta == null ? null
          : (lw.hoursDelta >= 0 ? '+' : '-') + Math.abs(Math.round(lw.hoursDelta)) + ' hrs', betterIsDown: null },
      { label: 'Overtime',       mod: 'labor',     screen: 'lc-overtime-watch',
        value: money(lw.otCost), sub: lw.label, delta: lw.otDelta,
        deltaText: lw.otDelta == null ? null : (lw.otDelta >= 0 ? '+' : '-') + App.fmtCurrency(Math.abs(lw.otDelta), 0),
        betterIsDown: true },
      /* ⛔ NOT `dashboard`. Kyle: *"the cost of good stat can't link to the old profit close the week
         page."* It was one of the six cockpits 1c deletes — I fixed the three money tiles and left
         this one behind, which is the "I did it for one and not the other" miss for the fourth time
         this build ([[lessons-paid-for]] #12).
         ⭐ `week-history` IS THE HONEST DESTINATION, not just a surviving one: this figure is
         `bar.cogs + food.cogs` off the CONFIRMED WEEK RECORD, and Week History is where those
         records live. A stat should land where its own number came from. */
      { label: 'Cost of goods',  mod: 'profit',    screen: 'week-history',
        value: money(lw.cogs), sub: lw.label, delta: lw.cogsDelta,
        deltaText: lw.cogsDelta == null ? null : (lw.cogsDelta >= 0 ? '+' : '-') + App.fmtCurrency(Math.abs(lw.cogsDelta), 0),
        betterIsDown: true },
      { label: 'Voids and comps', mod: 'shift',    screen: 'sc-void-comp',
        value: money(lw.voids, 2), sub: lw.label, delta: lw.voidsDelta,
        deltaText: lw.voidsDelta == null ? null : (lw.voidsDelta >= 0 ? '+' : '-') + App.fmtCurrency(Math.abs(lw.voidsDelta), 2),
        betterIsDown: true },
      { label: 'Cash runway',    mod: 'cash',      screen: 'c-forecast',
        value: runway || '-', sub: 'at today\'s burn' }
    ];
  },

  /* ── THE LAST CLOSED WEEK, AND THE ONE BEFORE IT ────────────────────────────────────────────
     Kyle: *"on the sales/hours.. just put 'last week' or something small under them."* On a Monday
     morning the current week is empty, so an operational figure read from it is zero for every
     operator who opens the Hub at the start of their week. These read the last CLOSED week and say
     so on the cell.
     ⚠ "CLOSED" MEANS ENDED, NOT CONFIRMED. A week record is written when the operator confirms, and
     they may confirm mid-week, so the newest `weeks` row is not reliably last week. The honest test
     is the calendar: the newest week whose period_end falls BEFORE the current week began. */
  _lastClosedWeek() {
    const D = App.data || {};
    const thisStart = (App.nextSunday && App.weekStartFor) ? App.weekStartFor(App.nextSunday()) : null;
    const before = arr => (arr || [])
      .filter(w => w && w.period_end && (!thisStart || String(w.period_end) < thisStart))
      .sort((a, b) => String(b.period_end).localeCompare(String(a.period_end)));
    const pw = before(D.weeks), rw = before(D.revenue_weeks);
    const end = (pw[0] && pw[0].period_end) || (rw[0] && rw[0].period_end) || null;
    if (!end) return { label: 'last week', hours: null, otCost: null, cogs: null, voids: null };
    const prevEnd = (pw[1] && pw[1].period_end) || (rw[1] && rw[1].period_end) || null;

    /* Seven days ending on period_end, inclusive. `App.weekStartFor` is the app's own answer so the
       Hub cannot disagree with the rest of the product about where a week begins. */
    const spanOf = e => ({ from: App.weekStartFor ? App.weekStartFor(e) : e, to: e });
    const cur = spanOf(end), prv = prevEnd ? spanOf(prevEnd) : null;
    const inSpan = (d, s) => { const x = String(d || '').slice(0, 10); return !!s && !!x && x >= s.from && x <= s.to; };

    const acts = (App.laborData || {}).lc_actuals || [];
    const vcs  = (App.shiftData || {}).sc_void_comps || [];
    const sum = (arr, span, pick) => !span ? null
      : arr.reduce((t, r) => inSpan(r && r.date, span) ? t + (Number(pick(r)) || 0) : t, 0);

    /* OVERTIME COST, NOT OVERTIME HOURS. `lc_actuals` carries `hours`, `wage` and `cost` per row;
       hours past 40 in the week for one person are the overtime. Summed per staff member so a
       person working two short shifts is not counted as two people ([[labor-cost-model]] — read it
       before changing any labor number; the OT premium invariant lives there). */
    const otCostFor = span => {
      if (!span) return null;
      const byStaff = {};
      acts.forEach(r => { if (inSpan(r && r.date, span)) {
        const k = r.staff_id || r.name || '?';
        byStaff[k] = byStaff[k] || { h: 0, wage: Number(r.wage) || 0 };
        byStaff[k].h += Number(r.hours) || 0;
        if (!byStaff[k].wage) byStaff[k].wage = Number(r.wage) || 0;
      } });
      return Object.keys(byStaff).reduce((t, k) => {
        const o = Math.max(0, byStaff[k].h - 40);
        return t + o * byStaff[k].wage * 0.5;      // the PREMIUM half only, per the locked model
      }, 0);
    };

    /* ⛔⛔⛔ A WEEK'S `bar` / `food` / `catering` / `other` ARE OBJECTS, NOT NUMBERS. Each is
       `{ revenue, cogs, labor, cost_pct, … }`. My first version wrote `Number(w.bar) || 0`, which is
       `NaN || 0` = **0**, so Cost of goods shipped a confident **$0** to the live Hub where the truth
       was $5,092. Caught by walking the pushed build, not by any assertion, because my fixture had
       invented flat numbers.
       ⛔ THAT IS THE THIRD TIME THIS EXACT CLASS HAS BITTEN THIS ONE STRIP: `[object Object]` in the
       over/short cell, a false `$0` on below par, and now this. Every one was a fixture that made up
       the dependency's shape instead of copying it ([[lessons-paid-for]] #20). The fixture carries
       the real nested shape now, so a flat number can never certify this again.
       ⚠ ALL FOUR BUCKETS, not just bar and food. Catering and other carry cogs too, and a bar that
       does events would have been quietly under-reported. */
    const cogsFor = w => {
      if (!w) return null;
      return ['bar', 'food', 'catering', 'other'].reduce((t, k) => {
        const b = w[k];
        return t + (b && typeof b === 'object' ? (Number(b.cogs) || 0) : 0);
      }, 0);
    };
    const d = (now, was) => (now == null || was == null) ? null : now - was;

    const hours = sum(acts, cur, r => r.hours);
    const otC = otCostFor(cur), voids = sum(vcs, cur, r => r.amount), cogs = cogsFor(pw[0]);
    return {
      label: 'last week',
      end: end,
      hours: hours, hoursDelta: d(hours, sum(acts, prv, r => r.hours)),
      otCost: otC, otDelta: d(otC, otCostFor(prv)),
      cogs: cogs, cogsDelta: d(cogs, cogsFor(pw[1])),
      voids: voids, voidsDelta: d(voids, sum(vcs, prv, r => r.amount))
    };
  },

  /* ── GET STARTED: the four first jobs on an empty account ───────────────────────────────────
     Kyle, 2026-08-11: *"setup inventory control needs to go to list vendors.. setup labor control..
     to add positions.. setup shift control needs to go to add registers."*
     ⭐ EACH ONE IS THE FIRST THING YOU CAN ACTUALLY DO, not the section's front door. You cannot
     count stock with no vendors, schedule with no positions, or reconcile with no registers, so a
     chip that lands on the section's first nav row sends a new operator somewhere they can only
     read. All four were OPENED on the shipped build before being written here: List Vendors renders
     ADD A VENDOR, Add Positions renders ADD POSITION, Drawers / Registers renders ADD REGISTER.
     ⚠ A MEMBER SO A HARNESS CAN RESOLVE THEM. Built inline, these destinations were invisible to
     `verify-hub-destinations` (it scans for literal `_enter` calls and these are interpolated) —
     the same blind spot that let a dead cockpit link ship in the metric strip. */
  /* ⭐⭐ EACH STEP NOW SAYS WHAT IT BUYS, AND EVERY PAYOFF IS MEASURED (Kyle, 2026-08-14: *"what does
     that do for the user is what i think is missing... each main step should compound on the next"*).
     `lights` names the Hub cells that step turns from a dash into a figure, and
     `verify-hub-getting-started` RUNS `_stripMetrics` per section to prove each one. Nothing here
     may claim a cell the measurement does not produce.
     ⛔ THE PAYOFFS COME FROM THREE STORES, NOT ONE, and I had this wrong until it was measured:
     cost of goods off the WEEK record, hours and overtime off `lc_actuals`, voids off
     `sc_void_comps`. So each step owns its own cells and the week close is what makes them readable
     together. That is the compounding, and it is a fact about the code rather than a copy device.
     ⛔ STEP 2 DOES NOT SAY "your hours appear here". Measured: once a week closes, hours read
     `0 hrs` whether or not any were logged, because `sum()` returns null only when there is no
     span. So that cell going live is not evidence anybody logged anything, and the payoff has to
     be something else. What IS true is the line the step carries: an hours import only lands for
     people already on the roster, which the note above step 2 measures in `PosIngest`.
     ⛔⛔ IT USED TO NAME A GATE THAT DOES NOT EXIST (T31, corrected 2026-09-03): that the weekly
     close refuses a week with nobody's time on it. MEASURED in `confirm-week.js` — it refuses
     exactly two things, a negative figure and a zero revenue total. Nothing anywhere counts time
     before closing. A false comment reads as HANDLED to every later reader ([[the-loop]] #53) and
     this one was load-bearing, because it was the stated reason for step 2's wording.
     🔧 `verify-hub-getting-started` F5a/F5b/F5c now watch both halves: the app has no such gate,
     this card does not claim one, and the two real refusals are named so F5a cannot go vacuous.
     ⚠ RUN YOUR FIRST AUDIT IS GONE, by Kyle's call: *"the audit pages have their own steps to show
     what user needs to do for a full audit"*. The destination is the weekly loop now, which is what
     the four steps were always building toward.
     ⚠ REGISTERS ARE OPTIONAL, and the app already proves why: drop a drawer report and the cash
     import offers "Add as a new register" for every name it does not know, remembering the POS's
     spelling. It is only a real step for an operator reconciling drawers by hand. */
  /* Get Started's visibility, stored on the ACCOUNT so the choice follows the operator to every
     device. Three states and only one is permanent: 'open', 'hidden' (reversible), 'dismissed'.
     ⚠ ANY UNRECOGNISED VALUE READS AS 'open'. The card coming back is a nuisance; the card being
     gone because a stray value looked like a dismissal is data the operator cannot get back. */
  _gsState() {
    const v = ((App.data || {}).settings || {}).hub_getting_started;
    return (v === 'hidden' || v === 'dismissed') ? v : 'open';
  },
  async _gsSet(state) {
    if (App.demoMode) return;
    const s = (App.data || {}).settings;
    if (!s) return;
    s.hub_getting_started = state;
    try { await App.saveKey('settings'); } catch (e) { console.error('get-started state save failed', e); }
    // Repaint: every one of these states is a different card.
    if (App.showHub) App.showHub();
  },

  /* ⛔⛔ "NEEDS TWO CLOSED WEEKS" WAS WRONG, AND IT WAS WRONG IN THE DIRECTION THAT WASTES A WEEK.
     MEASURED on the live build by running `_movement` at one, two and three closed weeks: pairs
     came back 0, **0**, 3. Both cards compare `P[0]` against `P[2]`, so three closed weeks are
     needed even though the SPAN they report is two — `_bestWorst` already said three and its own
     comment explains why. So an operator who closed their second week read "Needs two closed weeks"
     while having exactly two, saw nothing appear, and had no way to know they were not owed
     anything. One helper now, because two sentences about one requirement is how they drifted.
     ⛔ NO LINK ON IT. It briefly carried a gold "Close a week" door on each of the three lines and
     Kyle removed them (2026-08-14): *"remove the three gold close a week links."* Three gold links
     stacked down one empty screen is the same too-much-gold he had just taken off the Get Started
     card. The line states the requirement and stops. Do not helpfully re-add a door here. */
  _needsWeeksMsg() {
    return 'Needs three closed weeks';
  },

  _getStartedSteps() {
    const D = App.data || {}, I = App.inventoryData || {}, L = App.laborData || {}, S2 = App.shiftData || {};
    const n = a => ((a || []).length > 0);
    return [
      { label: 'Count your bar', screen: 'ic-vendors', mod: 'inventory',
        how: 'Add your vendors and products, set your pars, take one count.',
        /* ⛔ THE SECOND SENTENCE IS A PREREQUISITE, NOT A FLOURISH (T121, 2026-09-03). This read
           *"what to reorder, and the cash sitting on your shelves"* — and one count does not
           produce that figure. `CashEngine.trapped()` returns `hasData: !!usageBase()`, and
           `usageBase()` is null below TWO counts, so the operator finished this step, looked at the
           money band and found Trapped Cash reading **"No data" / "Count to surface this"**: the
           card telling them to do the thing they had just done. Measured both ways in
           `verify-hub-getting-started` F1/F2 (one count → no figure; two → $48 on the fixture).
           ⭐ `lights` was right the whole time and only the prose overclaimed, which is why block C
           stayed green — the code that ENUMERATES may count, the copy that describes it may not
           ([[lessons-paid-for]] #82). F3 now holds the sentence to naming its own prerequisite. */
        gain: 'Straight away: what to reorder. Your second count adds the cash tied up on your shelves.',
        lights: ['Below par'], done: n(I.ic_counts) },
      /* ⛔ REQUIRED EVEN WITH A PERFECT POS, and this is the opposite of registers. Measured in
         `PosIngest`: an hours row whose name is not on the roster is `noMatch` and `lands: false` —
         its own comment says *"an unmatched NAME is a roster fix"*, because auto-creating people
         once meant "they added a duplicate that fixed nothing and corrupted the roster". A drawer
         report CAN mint registers; an hours report can never mint staff. The copy has to say so or
         an operator with a good POS export skips this and imports nothing. */
      { label: 'Add your people', screen: 'lc-positions', mod: 'labor',
        how: 'Add your positions, then your staff.',
        gain: 'Needed either way: an hours report only lands for people already on your roster.',
        lights: ['Hours logged', 'Overtime'], done: n(L.lc_positions) && n(L.lc_staff) },
      { label: 'Add your registers', screen: 'sc-drawers', mod: 'shift', optional: true,
        how: 'Only if you reconcile drawers in Bar Cop each shift.',
        gain: 'Drop a drawer report at step 4 instead and Bar Cop sets your registers up from it.',
        lights: [], done: n(S2.sc_drawers) },
      /* ⭐ THE TWO WAYS ARE NAMED HERE AND NOWHERE ELSE ON THIS CARD. Close the Week already shows
         both doors per piece — the drop lane AND a second button named for the page it opens (Log
         Hours, Tip Tracking, Cash Control, Take Inventory, Event Bookings), with sales' manual
         entry inline. Repeating that matrix on the Hub would duplicate it, and a duplicate drifts.
         This step just sets the expectation; the page itself does the teaching, at the moment the
         operator is choosing. */
      { label: 'Close your first week', screen: 'week-close', mod: 'profit',
        how: 'Drop your POS reports for the week, or enter each piece by hand.',
        gain: 'Every piece shows you both ways. Cost of goods comes off your count on its own.',
        lights: ['Cost of goods', 'Voids and comps'], done: n(D.weeks) }
    ];
  },

  /* Good morning / afternoon / evening, off the operator's own clock. Kyle's call, 2026-08-10.
     Takes the hour so a harness can drive all three without waiting for the day to pass. */
  _greeting(hour) {
    const h = (hour == null) ? new Date().getHours() : hour;
    return h < 12 ? 'Good morning' : (h < 17 ? 'Good afternoon' : 'Good evening');
  },

  /* ── THE CLIMB: the Operations Audit's whole history in two numbers ────────────────────────────
     ⛔⛔ READ THE RIGHT STORE. There are FOUR audit stores and they are easy to confuse: `audits` is
     the PROFIT audit, `revenue_audits`, `cash_audits`, and `bar_cop_audits` is the meta one whose
     score is the "75" on screen. I built the first version of this band off `audits` and told Kyle
     the climb was 33 to 75 — mixing the profit audit's floor with the Bar Cop audit's ceiling. The
     real Bar Cop climb is 40 to 75. Two stores, one sentence, and the number looked plausible the
     whole time ([[code-is-truth]] — read it out of the store, every time).
     ⚠ ONE AUDIT MEANS NO CLIMB. A single reading has nothing to climb from, so this returns null and
     the band renders its first-audit state rather than a delta against nothing. */
  _auditClimb() {
    const B = ((App.data || {}).bar_cop_audits || [])
      .filter(a => a && a.date && a.overall_score != null)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    if (B.length < 2) return null;
    const first = B[0], last = B[B.length - 1];
    const days = Math.round((new Date(last.date + 'T00:00:00') - new Date(first.date + 'T00:00:00')) / 86400000);
    return {
      first: first.overall_score, firstDate: first.date,
      last: last.overall_score, lastDate: last.date,
      delta: last.overall_score - first.overall_score,
      count: B.length, weeks: Math.max(1, Math.round(days / 7))
    };
  },

  /* The three recovery audits, each with its own last-run date. Kyle: *"have profit, revenue, cash
     audits with last run date or something in small text."* Never run reads as a dash, not a zero —
     a zero is a score somebody earned. */
  _moduleAudits() {
    const D = App.data || {};
    const one = (arr, name, screen, mod) => {
      const a = (D[arr] || []).filter(x => x && x.date && x.overall_score != null)
        .sort((x, y) => String(y.date).localeCompare(String(x.date)))[0];
      return { name: name, screen: screen, mod: mod,
               score: a ? a.overall_score : null, date: a ? a.date : null };
    };
    return [
      one('audits', 'Profit', 'audit-tracker', 'profit'),
      one('revenue_audits', 'Revenue', 'r-audit', 'revenue'),
      one('cash_audits', 'Cash', 'c-audit', 'cash')
    ];
  },

  /* ── MOVEMENT: a FIXED two-week comparison, never a growing window ──────────────────────────
     Kyle, 2026-08-10: *"should it be on a set running 2 week comparison? ... 4 weeks is too long..
     and don't think 1 week works?"* Measured across all thirteen weeks of history before answering:
     one-week moves ran a median of $818/mo (NOT noise, which is what I had claimed off a single
     pair), two-week $1,728/mo, four-week $3,215/mo.
     ⭐ TWO WEEKS, FIXED. A window that widens as the account ages grows without bound and stops
     meaning anything; a fixed one always answers the same question.
     ⛔ THE NUMBER SHRINKS AS THE OPERATOR IMPROVES, and that surprised us both: on this history the
     two-week reading decayed $3,025 -> $1,728 -> $836 -> $647 as prime cost converged. So the
     sentence carries the POINTS as well as the money, or a bar that has done everything right for a
     quarter reads its smallest headline ever as a let-down. The long story is the climb, on the left.
     ⛔ AND BELOW ABOUT $100 A MONTH IT STOPS CLAIMING A RESULT. $25 a week on a $19,000 week is not
     a result, it is noise wearing a dollar sign. */
  _movement() {
    const D = App.data || {};
    const thisStart = (App.nextSunday && App.weekStartFor) ? App.weekStartFor(App.nextSunday()) : null;
    const closed = arr => (arr || [])
      .filter(w => w && w.period_end && (!thisStart || String(w.period_end) < thisStart))
      .sort((a, b) => String(b.period_end).localeCompare(String(a.period_end)));
    const P = closed(D.weeks), R = closed(D.revenue_weeks);
    const rBy = {}; R.forEach(r => { rBy[r.period_end] = r; });
    const pNow = P[0], pWas = P[2], rNow = R[0], rWas = R[2];
    if (!pNow && !rNow) return null;

    const sales = r => r ? ((Number(r.bar_revenue) || 0) + (Number(r.floor_revenue) || 0)) : null;
    /* `deltaText` is formatted HERE, beside the values it describes, so the render never has to
       guess whether a pair is points, dollars or a count. A formatter chosen at render time is how
       "▲ 56.1% to 55.4%" happened. */
    const pair = (label, was, now, betterIsUp, fmt) =>
      (was == null || now == null) ? null
        : { label: label, was: fmt(was), now: fmt(now), delta: now - was,
            deltaText: fmt(Math.abs(now - was)),
            good: betterIsUp ? (now > was) : (now < was), flat: now === was };

    /* ⭐⭐ THE TWO COMPONENTS, THEIR TOTAL, AND THE VOLUME THEY SIT ON (Kyle, 2026-08-14):
       *"why did we do prime cost, labor, check average, weekly sales.. instead of Pour cost, Food
       Cost, Prime Cost, Weekly Sales?"* There was never a recorded reason for the old four, and his
       is better for one specific reason: PRIME COST IS COST OF GOODS PLUS LABOR, so showing Prime
       AND Labor was the total plus one of its two halves — the cost-of-goods half never appeared at
       all. An operator could watch prime move and had no way to tell whether pour or food drove it.
       ⛔ PRIORITY-ORDERED CANDIDATES, FIRST FOUR THAT RESOLVE. *"if a bar does not sell food and
       then has no food cost.. have the auto change to something else."* A bar with no food would
       otherwise render THREE cells and an empty fourth slot, which reads as broken rather than as a
       bar that does not do food. The two below the line are the fallbacks, in the order they should
       fill in — and because the rule is "first four that resolve", it covers ANY missing metric,
       not only food.
       ⚠ `cost_pct` IS STORED ON THE WEEK RECORD, checked against a real one on the deployed build
       (`bar:{cogs:2729, cost_pct:22.8, revenue:11969}`) rather than assumed from the field name. */
    const pairs = [
      pair('Pour cost', pWas && pWas.bar && pWas.bar.cost_pct, pNow && pNow.bar && pNow.bar.cost_pct, false, v => App.fmtPct(v)),
      pair('Food cost', pWas && pWas.food && pWas.food.cost_pct, pNow && pNow.food && pNow.food.cost_pct, false, v => App.fmtPct(v)),
      pair('Prime cost', pWas && pWas.prime_cost_pct, pNow && pNow.prime_cost_pct, false, v => App.fmtPct(v)),
      pair('Weekly sales', sales(rWas), sales(rNow), true, v => App.fmtCurrency(v, 0)),
      // ── fallbacks, used only when one of the four above cannot resolve ──
      pair('Labor', rWas && rWas.labor_pct_blended, rNow && rNow.labor_pct_blended, false, v => App.fmtPct(v)),
      pair('Check average', rWas && rWas.check_avg, rNow && rNow.check_avg, true, v => App.fmtCurrency(v))
    ].filter(Boolean).slice(0, 4);

    /* THE HEADLINE. Prime cost is COGS plus labor as a share of sales, so a move in it is the one
       figure that answers "am I running the place better", and points times sales is real money.
       ⚠ The sales basis is the CURRENT week's, not the old one: the saving is what today's volume
       is worth at the better cost, which is the number an operator can actually keep. */
    const nowPrime = pNow && pNow.prime_cost_pct, wasPrime = pWas && pWas.prime_cost_pct;
    const basis = sales(rNow || (pNow ? rBy[pNow.period_end] : null));
    let headline = null;
    if (nowPrime != null && wasPrime != null && basis) {
      const pts = wasPrime - nowPrime;                 // positive = improved
      const monthly = Math.round(pts / 100 * basis * 4.333);
      headline = (Math.abs(monthly) < 100)
        ? { holding: true, prime: App.fmtPct(nowPrime) }
        : { holding: false, better: monthly > 0, amount: App.fmtCurrency(Math.abs(monthly), 0),
            pts: Math.abs(pts).toFixed(1) };
    }
    return { pairs: pairs, headline: headline, window: 'two weeks ago' };
  },

  /* ── BIGGEST GAIN AND WORST DRAG, IN THE AUDIT'S OWN WORDS ──────────────────────────────────
     ⭐⭐⭐ THE HUB WRITES NO PROSE HERE, AND THAT IS THE WHOLE POINT. Kyle asked how the explainer line
     under these two cards is kept consistent and stopped from drifting into longer sentences. The
     answer is that it is not written by this file at all: `sub_score_detail` already carries, per
     measure, a `label` from a CLOSED vocabulary. Measured over 270 measures in 13 audits: 29
     distinct labels, 13 to 37 characters, and not one of the 64 `extra` strings is even a sentence.
     ⛔ `extra` IS DELIBERATELY NOT PRINTED. Its median length is ZERO (absent more than half the
     time), so anything built on it changes height with the data — exactly the drift Kyle was worried
     about. Worse, on Operational Consistency every extra reads "8 weeks of P&L data (need 3+)",
     which is a data-sufficiency note; printing that under "your biggest gain" would have been
     quietly wrong. The label plus the measure's own was-to-now percentage says more and cannot grow.
     ⭐ THE LINE IS THE BIGGEST MOVER INSIDE THE SECTION, NOT THE BEST OR WORST SCORE. Picking the
     highest gave "Weekly covers consistency, 96%", true and empty; the biggest mover gave "Weekly
     labor % consistency, 54% -> 87%", which is WHY the section moved.
     ⚠ TWO GUARDS, BOTH FROM WHAT THE DATA CAN DO: skip any measure flagged `na` (none on today's
     seed, but the field exists so a live account will hit it), and match measures BY LABEL across
     the two audits so a newly added measure cannot read as an infinite improvement. */
  _bestWorst() {
    const D = App.data || {};
    const thisStart = (App.nextSunday && App.weekStartFor) ? App.weekStartFor(App.nextSunday()) : null;
    const closed = arr => (arr || [])
      .filter(w => w && w.period_end && (!thisStart || String(w.period_end) < thisStart))
      .sort((a, b) => String(b.period_end).localeCompare(String(a.period_end)));
    const P = closed(D.weeks), R = closed(D.revenue_weeks);
    const pNow = P[0], pWas = P[2], rNow = R[0], rWas = R[2];
    if (!pNow || !pWas || !rNow || !rWas) return null;

    /* Seven days ending on each period_end, so the event stores can be summed over the SAME two
       weeks the P&L rows compare. One window for the whole card. */
    const span = e => ({ from: App.weekStartFor ? App.weekStartFor(e) : e, to: e });
    const curSpan = span(pNow.period_end), wasSpan = span(pWas.period_end);
    const inSpan = (d, s) => { const x = String(d || '').slice(0, 10); return !!x && x >= s.from && x <= s.to; };
    const sumIn = (arr, s, pick) => (arr || []).reduce((t, r) => inSpan(r && r.date, s) ? t + (Number(pick(r)) || 0) : t, 0);

    const pct = (o, k) => (o && o[k] != null) ? Number(o[k]) : null;
    const rev = o => (o ? (Number(o.revenue) || 0) : 0);
    const totalRev = r => r ? ((Number(r.bar_revenue) || 0) + (Number(r.floor_revenue) || 0)) : 0;

    /* ── EVERY CANDIDATE IS A REAL OPERATING NUMBER WITH A REAL WEEKLY DOLLAR ────────────────
       `dollars` is what the MOVE is worth per week at CURRENT volume: a rate change times the base
       it applies to, or, for the event stores, the change itself. Positive = money in the operator's
       pocket. `good` is the direction that helps, which is not always down and not always up. */
    const cand = [];
    const addRate = (label, wasPct, nowPct, base, unit) => {
      if (wasPct == null || nowPct == null || !(base > 0)) return;
      cand.push({ label: label, was: App.fmtPct(wasPct), now: App.fmtPct(nowPct),
                  dollars: Math.round((wasPct - nowPct) / 100 * base), unit: unit });
    };
    addRate('Bar pour cost', pct(pWas.bar, 'cost_pct'), pct(pNow.bar, 'cost_pct'), rev(pNow.bar), 'a week');
    addRate('Food cost',     pct(pWas.food, 'cost_pct'), pct(pNow.food, 'cost_pct'), rev(pNow.food), 'a week');
    addRate('Labor',         pct(rWas, 'labor_pct_blended'), pct(rNow, 'labor_pct_blended'), totalRev(rNow), 'a week');

    /* CHECK AVERAGE uses the week's own `covers`, which is a stored field , never revenue divided by
       the check average, which is the same number wearing a disguise and would make the dollar figure
       an identity rather than a measurement. */
    if (rNow.check_avg != null && rWas.check_avg != null && Number(rNow.covers) > 0) {
      cand.push({ label: 'Check average', was: App.fmtCurrency(rWas.check_avg), now: App.fmtCurrency(rNow.check_avg),
                  dollars: Math.round((rNow.check_avg - rWas.check_avg) * Number(rNow.covers)), unit: 'a week' });
    }

    const vcs = (App.shiftData || {}).sc_void_comps || [];
    const vNow = sumIn(vcs, curSpan, r => r.amount), vWas = sumIn(vcs, wasSpan, r => r.amount);
    if (vcs.length) cand.push({ label: 'Voids and comps', was: App.fmtCurrency(vWas, 0), now: App.fmtCurrency(vNow, 0),
                                dollars: Math.round(vWas - vNow), unit: 'a week' });

    /* OVERTIME PREMIUM, per the locked labor model: hours past 40 per PERSON per week, at half the
       wage on top ([[labor-cost-model]] , read it before changing any labor number). */
    const acts = (App.laborData || {}).lc_actuals || [];
    const otFor = s => {
      const by = {};
      acts.forEach(r => { if (inSpan(r && r.date, s)) {
        const k = r.staff_id || r.name || '?';
        by[k] = by[k] || { h: 0, wage: Number(r.wage) || 0 };
        by[k].h += Number(r.hours) || 0;
        if (!by[k].wage) by[k].wage = Number(r.wage) || 0;
      } });
      return Object.keys(by).reduce((t, k) => t + Math.max(0, by[k].h - 40) * by[k].wage * 0.5, 0);
    };
    if (acts.length) {
      const oNow = otFor(curSpan), oWas = otFor(wasSpan);
      cand.push({ label: 'Overtime', was: App.fmtCurrency(oWas, 0), now: App.fmtCurrency(oNow, 0),
                  dollars: Math.round(oWas - oNow), unit: 'a week' });
    }

    const moved = cand.filter(c => c.dollars !== 0);
    if (!moved.length) return { gain: null, drag: null, window: 'two weeks ago' };
    moved.sort((a, b) => b.dollars - a.dollars);
    const top = moved[0], bottom = moved[moved.length - 1];
    return {
      gain: top.dollars > 0 ? top : null,
      drag: bottom.dollars < 0 ? bottom : null,
      window: 'two weeks ago'
    };
  },
  /* ── DONE THIS WEEK: five fixed rows, ticked only by a real record ──────────────────────────
     Kyle, 2026-08-10: *"just pick the top 4-5 things.. so they are always listed and check off when
     done.. Monday resets."*
     ⛔ SAY THE OBVIOUS THING OUT LOUD: this IS a weekly checklist, and a checklist is what the Hub
     just deleted. The difference that makes it right is that NOTHING HERE CAN BE TICKED BY HAND. A
     tick appears because a dated record exists, so it cannot be faked and it needs no storage of its
     own. Five derived rows is not twenty-four hand-ticked ones ([[cockpit-steps-manual]] is about
     the opposite thing — steps the operator marks; these are facts the app observes).
     ⭐ SPOT CHECK REPLACED COUNT DRAWERS, KYLE'S CALL: *"users may never reconcile drawers or drop a
     drawer pos.. more likely to spot check."* A row that most operators can never satisfy is a row
     that makes the list look broken.
     ⭐⭐ AND THE SAME REASONING MOVED TWO MORE ROWS AT T72 (Kyle, 2026-09-03): *"change log hours to
     received delivery and import sales to created order"*. Hours and a sales import are things a
     bar may do fortnightly, through a POS export, or not in Bar Cop at all; **receiving a delivery
     and placing an order are what an operator does every single week**, so the two rows can now be
     satisfied by the ordinary run of the week rather than sitting unticked on a list that then
     reads as broken. That is Spot Check's argument applied twice more, not a new one.
     ⛔ THEY CHANGED SOURCE, NOT LABEL. See the rows themselves. */
  _doneThisWeek() {
    const end = App.nextSunday ? App.nextSunday() : null;
    const start = (end && App.weekStartFor) ? App.weekStartFor(end) : null;
    const inWeek = d => {
      const x = String(d || '').slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(x) && (!start || x >= start) && (!end || x <= end);
    };
    /* The DAY it happened, for the row's caption. `App.ymdLocal`/local-date convention throughout —
       never `toISOString`, which shifts a late-evening record into the next day ([[local-date-convention]]). */
    const dayOf = d => {
      const x = String(d || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(x)) return '';
      const dt = new Date(x + 'T00:00:00');
      return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
    };
    const firstIn = arr => (arr || []).filter(r => r && inWeek(r.date))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))[0] || null;

    /* ⚠ `LAB` AND `SH` WENT WITH THE TWO ROWS THAT READ THEM (T72). Once Received delivery and
       Created order moved onto `ic_deliveries` / `ic_orders`, nothing in this member touched labor
       or shift data, and a local that is declared and read nowhere is the same leftover as a helper
       whose last caller went ([[the-loop]] #25 / [[lessons-paid-for]] #105). Measured before
       cutting: `LAB.` and `SH.` both at zero uses in the body. */
    const INV = App.inventoryData || {};
    const rows = [
      { label: 'Take inventory count', screen: 'ic-take-inventory', mod: 'inventory', hit: firstIn(INV.ic_counts) },
      /* ⛔⛔ THESE TWO CHANGED THEIR SOURCE, NOT THEIR LABEL (Kyle, 2026-09-03: *"change log hours to
         received delivery and import sales to created order"*). They read `lc_actuals` and
         `sc_shifts`; a rename alone would have printed an HOURS date under a delivery heading and a
         SALES date under an order heading — a true-looking number about the wrong activity, which is
         the most convincing kind of wrong ([[lessons-paid-for]] #104 — fix the seed, not the
         sentence). `verify-hub-needs-all` D2/D3 seed the OLD stores and prove neither row ticks.
         ⚠ THE DESTINATION MOVED WITH THE SOURCE. Every row on this card opens the page where the
         operator DOES the thing, so these go to Receive Delivery and the Order Sheet, never to the
         history pages that merely list them ([[lessons-paid-for]] #47/#83). */
      { label: 'Received delivery',    screen: 'ic-receive-delivery', mod: 'inventory', hit: firstIn(INV.ic_deliveries) },
      { label: 'Created order',        screen: 'ic-order-sheet',      mod: 'inventory', hit: firstIn(INV.ic_orders) },
      /* ⛔ THROUGH THE SHARED HELPER, NOT THE RAW STORE, AND THE SUITE CAUGHT ME. My first version
         read `ic_spot_checks` directly, which counts an IN-PROGRESS check as a completed one — so
         opening a spot check and walking away would have ticked the row. `App.completedSpotChecks()`
         is the app's one answer to "which spot checks actually happened" and every other consumer
         already goes through it. A private copy of a shared job is a copy that has already drifted
         ([[the-loop]] "grep for other IMPLEMENTATIONS, not for callers"). */
      /* ⚠ A BARE CALL, DELIBERATELY. My first fix wrote `App.completedSpotChecks ? … : INV.ic_spot_checks`
         out of habit, and that guard means "if the helper is missing, go quietly back to counting
         in-progress checks as done" — it reinstates the exact defect on the failure path. A helper
         required for CORRECTNESS is called bare so a missing one fails loudly instead of producing a
         silently wrong tick ([[the-loop]] #40). */
      { label: 'Spot check',           screen: 'ic-spot-check',     mod: 'inventory',
        hit: firstIn(App.completedSpotChecks()) }
    ].map(r => ({ label: r.label, screen: r.screen, mod: r.mod,
                  done: !!r.hit, when: r.hit ? dayOf(r.hit.date) : '' }));

    /* The last row is the week itself. A `week` record ENDING on this week's Sunday means the
       operator confirmed it; nothing else in the app writes one ([[confirm-the-week]] — ONE popup
       writes both the profit `week` and the `revenue_week`). */
    const wk = ((App.data || {}).weeks || []).filter(w => w && String(w.period_end) === String(end))[0];
    /* ⚠ LABEL ONLY (Kyle, 2026-09-03: *"close and confirm the week .. to just 'close the week'"*).
       The source is untouched: a `week` record ending on this Sunday, which only Confirm the Week
       writes. Shortened because the page it opens is called Close The Week and the row was the one
       spelling in the app that said it twice. */
    rows.push({ label: 'Close the week', screen: 'week-close', mod: '',
                done: !!wk, when: wk ? dayOf(wk.period_end) : '' });
    return rows;
  },

  /* ── NEEDS ATTENTION, CAPPED BY SEVERITY RATHER THAN BY COUNT ───────────────
     Both Hub lists used to sit in a 188px `overflow-y:auto` box. Kyle: *"i want to get rid of the
     scrollbars.. because on mobile it is a real pain hitting the scrolling areas when you are just
     trying to scroll down the page."* And the scroll was buying almost nothing — 8 items in a box
     that showed about five, so it hid roughly three rows in exchange for a nested scroll trap.

     ⛔⛔ BUT A STRAIGHT TOP-N WOULD BURY AN EXPIRED PERMIT. On the shipped Hub, ServSafe (expired 13
     days) sat THIRD, below a certificate not due for another 8 — so a cap of four would have pushed
     something genuinely expired out of sight to make room for something merely upcoming. Needs
     Attention is not a ranked list, it is a mix of severities.
     ⭐ SO EVERY RED SHOWS, however many there are, and ambers fill whatever room is left. The list
     can only grow past the cap for things that are actually wrong. */
  /* ── THE ONE THING TO DO, PICKED HERE RATHER THAN INSIDE `render` ───────────
     A member so it can be RUN by a harness. The two defects that shipped on the section strip both
     lived in code no assertion could execute, and the label rule below is exactly the kind that goes
     wrong quietly: a recovery action reads *"Free $2,421.80 of lazy shelf cash: $2,405.00 in dead
     stock, $16.80 above par"*, and only the part before the first full stop belongs on a headline.
     ⚠ SPLIT ON A SENTENCE END, NOT ON ANY DOT — a decimal point is not a full stop, and cutting at
     one would render "Free $2" ([[harness-review-like-code]] #15, which cost a red on correct code
     for the same reason). `\.\s` and `\.$` are the two real endings. */
  _doFirst(items) {
    const all = items || [];
    if (!all.length) return null;
    const it = all[0];
    const raw = String(it.action || '');
    const label = (raw.split(/\.\s|\.$/)[0] || raw).trim();
    return { label: label, impact: it.impact || 0, more: all.length - 1, item: it };
  },

  _needsCapped(items, cap) {
    const all = items || [];
    const red = all.filter(a => a && a.sev === 'bad');
    const amber = all.filter(a => a && a.sev !== 'bad');
    const room = Math.max(0, (cap || 4) - red.length);
    const shown = red.concat(amber.slice(0, room));
    return { shown: shown, more: all.length - shown.length };
  },

  /* ── THE OVERFLOW LINK, AND THE HISTORY IT HAS TO CARRY (T72, Kyle 2026-09-03) ─────────────────
     *"next to needs attention .. if more than 5 items.. put something like (5 of X) and make that a
     clickable link that opens a modal with all listed and clickable with scrollbar if needed."*
     ⛔⛔ THE COMMENT ABOVE `bandItems` READS AS A VETO OF EXACTLY THIS AND IS NOT ONE. Kyle killed a
     count on this list twice: *"remove the '6 more' that has no meaning to a user"* and *"no links
     to the ones not listed"*. **Both objections were to a count with NOWHERE TO GO** — first a link
     to a page that did not hold the list, then a bare caption. This one opens the list itself, which
     is the thing that was missing. Do not restore the old wording on the strength of that note.
     ⛔ BOTH NUMBERS ARE DERIVED AND NEITHER IS A 5. `_needsCapped` shows EVERY red however many
     there are, so seven reds render seven rows and the label must read "7 of 13". A hardcoded five
     would be contradicted by the rows directly beneath it ([[output-honesty]]), and
     `verify-hub-needs-all` B3 is that case. */
  _needsMore(shown, total) {
    const s = Number(shown) || 0, t = Number(total) || 0;
    if (t <= s) return '';
    return '<span onclick="S.Hub._openNeedsAll()" style="cursor:pointer;color:var(--gold);'
      + 'text-decoration:underline;font-size:10px;font-weight:600;letter-spacing:0;'
      + 'text-transform:none;margin-left:8px;">(' + s + ' of ' + t + ')</span>';
  },

  /* ⭐ ONE SPELLING OF "WHERE DOES AN ALERT ROW GO", so the card and the modal cannot drift. This was
     a local inside `render`; the modal needs the identical rule, and a second copy of it is exactly
     what this codebase keeps paying for ([[the-loop]] — grep for other IMPLEMENTATIONS, not callers).
     ⚠ An item may carry its own `go` (the month-end Books row does), and that wins. */
  _goOf(a) {
    return (a && a.go) || ('S.Hub._enter(\'' + ((a && a.screen) || '') + '\',\'' + ((a && a.mod) || '') + '\')');
  },

  /* The month-end nudge, lifted out of `render` so the modal reads the SAME set the card does rather
     than re-deriving a near-copy. Reads `App.data.weeks` directly, which is what the render local it
     replaced was built from. */
  _dueItems() {
    const out = [];
    const now = new Date();
    if (now.getDate() <= 10) {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lmKey = App.ymdLocal(lm).slice(0, 7);
      const weeks = ((App.data || {}).weeks) || [];
      const hasLastMo = weeks.some(w => (((w.period_end || '') + '').slice(0, 7)) === lmKey);
      if (hasLastMo) out.push({ sev: 'due', label: 'Close ' + lm.toLocaleDateString('en-US', { month: 'long' }) + ' in Books',
                                value: 'month-end', go: 'S.HubBooks&&S.HubBooks.open()' });
    }
    return out;
  },

  // The one source both the card and the modal read.
  _needsItems() {
    return this.forwardAlerts().concat(this._dueItems());
  },

  /* The modal body: EVERY item, each a door, scrolling only when it needs to.
     ⚠ `max-height` + `overflow-y:auto` rather than a fixed height, so a list of six does not open a
     tall empty box and a list of forty does not run off the screen. Kyle removed the Hub's own
     scrollboxes because a nested scroll area is painful on a phone; this one is inside a modal the
     operator opened on purpose and closed the moment they are done, which is the case he asked for. */
  _needsAllHtml(items) {
    const all = items || [];
    const rows = all.map(a =>
      '<div class="hd-prow" onclick="App.closeModal(\'hub-needs-all\');' + this._goOf(a) + '" '
      + 'style="display:flex;align-items:center;gap:10px;padding:11px 12px;cursor:pointer;min-width:0;'
      + 'border-bottom:1px solid var(--b-edge);">'
      + '<span style="width:6px;height:6px;border-radius:50%;flex-shrink:0;background:'
      + (a.sev === 'bad' ? 'var(--red)' : 'var(--amber)') + ';"></span>'
      + '<span style="flex:1;min-width:0;font-size:12px;color:var(--t1);">' + esc(a.label || a.text || '') + '</span>'
      + (a.value ? '<span style="flex-shrink:0;font-size:11px;color:var(--t3);white-space:nowrap;">' + esc(a.value) + '</span>' : '')
      + '<span style="flex-shrink:0;color:var(--t4);font-size:13px;">&rsaquo;</span></div>').join('');
    return '<div style="background:var(--surface);border:1px solid var(--b-edge);border-radius:var(--r);padding:18px 20px;">'
      + '<div class="sh" style="margin:0 0 12px;">Needs attention</div>'
      + '<div style="max-height:60vh;overflow-y:auto;margin:0 -20px;padding:0 20px;">'
      + (rows || '<div style="font-size:12px;color:var(--t2);">Nothing needs you right now.</div>')
      + '</div></div>';
  },

  _openNeedsAll() {
    App.openModal(this._needsAllHtml(this._needsItems()), { id: 'hub-needs-all', maxWidth: 520 });
  },

  /* One row, six cells, each a door into its section. ⚠ THROUGH `jumpToSection`, which lands on the
     section's own first page — never on a cockpit screen id, which is what made the old cards
     undeletable. */
  _sectionStrip(metrics) {
    /* ⛔ COLOUR ON THE TEXT, NEVER A BADGE, and only where a direction has been DECLARED. A cell with
       `betterIsDown: null` (hours) stays neutral, and a cell with no delta at all (below par, cash
       runway, which nothing stores a history of) renders no chip rather than a zero. */
    const chip = m => {
      if (!m.deltaText || m.delta == null) return '';
      const good = (m.betterIsDown == null) ? null : (m.betterIsDown ? m.delta < 0 : m.delta > 0);
      const col = good == null ? 'var(--t3)' : (good ? 'var(--green)' : 'var(--red)');
      return '<div style="font-size:11px;font-weight:700;color:' + col + ';margin-top:5px;white-space:nowrap;">'
        + esc(m.deltaText) + '</div>';
    };
    /* ⛔ VERTICAL DIVIDERS BETWEEN THE CELLS. Kyle: *"the bottom card.. the stats need vertical
       dividers or something between them."* Six numbers in a flex row with only a gap between them
       read as one run-on line; a hairline makes each a separate reading. `:not(:last-child)` would
       need a class and a stylesheet rule, so the border is written per cell and suppressed on the
       last one by index — one place, no CSS to keep in step. */
    const cell = (m, i, arr) =>
      '<div onclick="' + (m.screen ? 'S.Hub._enter(\'' + esc(m.screen) + '\',\'' + esc(m.mod) + '\')'
                                   : 'App.jumpToSection(\'' + esc(m.mod) + '\')')
      + '" style="flex:1;min-width:112px;cursor:pointer;padding-right:16px;'
      + (i < arr.length - 1 ? 'border-right:1px solid var(--b2);' : '')
      + '">'
      + '<div style="font-size:17px;font-weight:700;color:var(--t1);white-space:nowrap;">' + esc(m.value) + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:2px;white-space:nowrap;">' + esc(m.label) + '</div>'
      + (m.sub ? '<div style="font-size:10px;color:var(--t4);margin-top:1px;white-space:nowrap;">' + esc(m.sub) + '</div>' : '')
      + chip(m)
      + '</div>';
    /* ⚠ `--surface`. This is the SECTION STRIP, not the money band, and it stays an ordinary card.
       I put it on `--stat` first and Kyle sent it back: *"wrong one on the hub.. the top number bar
       in the image... the bottom one change back to normal card."* Two boxes of numbers sit near
       each other on this page and only the TOP one is the stat box. */
    return '<div style="background:var(--surface);border:1px solid var(--b-edge);border-radius:var(--r);padding:14px 16px;display:flex;gap:16px;flex-wrap:wrap;">'
      + (metrics || []).map(cell).join('') + '</div>';
  },

  render(container) {
    this._stage = container;
    // Outer wrapper scrolls when the dashboard content exceeds the viewport
    // (tablets, small laptops). On a desktop monitor the min-heights on the
    // grid rows fit naturally and the scrollbar never appears.
    container.style.overflowY = 'auto';
    const data = App.data || {};

    // ── Data sources ──
    const s   = data.settings || {};
    const pt  = s.targets || {};
    const rt  = (data.revenue_settings || {}).targets || {};

    const pWeeks  = data.weeks || [];
    const rWeeks  = (data.revenue_weeks || []).filter(w => (w.bar_revenue||0)+(w.floor_revenue||0) > 0);
    const pAudits = data.audits || [];
    const rAudits = data.revenue_audits || [];
    const cAudits = data.cash_audits || [];

    const barName = s.bar_name || 'Your Operation';

    // Newest-first by date. Event logs load from the events tables ordered date
    // desc, so "latest" can no longer be assumed to be the last array element —
    // pick it by date (period_end for weeks, date for audits) instead.
    const _rd = r => ((r && (r.date || r.period_end || r.generated_at || r.saved_at || r.created_at)) || '') + '';
    const _newest = a => a.slice().sort((x, y) => _rd(y).localeCompare(_rd(x)));
    const last  = a => a.length ? _newest(a)[0] : null;
    const prior = a => a.length >= 2 ? _newest(a)[1] : null;
    const pW = last(pWeeks), rW = last(rWeeks);
    const pA = last(pAudits), rA = last(rAudits), cA = last(cAudits);

    // ── Helpers ──
    const daysSince = (str) => {
      if (!str) return null;
      const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
      if (isNaN(d.getTime())) return null;
      return Math.floor((Date.now() - d.getTime()) / 86400000);
    };
    const auditOpp  = (a) => a ? (a.action_items || []).reduce((sum,x) => sum + (x.monthly_impact || 0), 0) : 0;
    // Both scores must be REAL. `|| 0` turned an N/A audit into a 0, so a first audit with
    // nothing to score against a prior 63 invented a "-63 pts" trend out of no data. The
    // two lines below already guard `!= null`; this one was missed.
    const sysTrend  = (au) => { const l = last(au), p = prior(au);
      return (l && p && l.overall_score != null && p.overall_score != null) ? (l.overall_score - p.overall_score) : null; };
    const shortDate = (str) => str ? new Date(String(str).length<=10 ? str+'T00:00:00' : str).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : null;

    // ── Cross-system rollup ──
    const sysScores = [pA, rA, cA].map(a => a ? a.overall_score : null).filter(v => v != null);
    const overall   = sysScores.length ? Math.round(sysScores.reduce((a,b)=>a+b,0)/sysScores.length) : null;
    // A scored audit in any system, not just any recorded run: an estimate-only
    // audit records N/A (overall null) and must not flip the Hub off a guess.
    const anyAudit  = [].concat(pAudits, rAudits, cAudits).some(a => a && a.overall_score != null);
    const totalOpp  = auditOpp(pA) + auditOpp(rA) + auditOpp(cA);
    const trendVals = [sysTrend(pAudits), sysTrend(rAudits), sysTrend(cAudits)].filter(v => v != null);
    const netTrend  = trendVals.length ? trendVals.reduce((a,b)=>a+b,0) : null;

    // ── Weekly status ──
    const wkMods = [
      { name:'Profit',  d: daysSince(pW?.period_end) },
      { name:'Revenue', d: daysSince(rW?.period_end) },
    ].map(m => ({ ...m, current: m.d != null && m.d <= this.WEEKLY_CUTOFF }));
    const wkCount   = wkMods.filter(m => m.current).length;
    const wkOverdue = wkMods.filter(m => !m.current).map(m => m.name);

    // ── Key metrics ──
    const band = (val, target, dir) => {
      if (val == null) return 'none';
      if (dir === 'low')  return val <= target ? 'good' : val <= target*1.1 ? 'warn' : 'bad';
      return val >= target ? 'good' : val >= target*0.9 ? 'warn' : 'bad';
    };
    // Hub uses tier-2 (soft) red for status indicators so the few real
    // attention reds (Leaking This Week headline, Alerts count) carry more
    // visual weight than the supporting status data.
    // Color = problem, not category. On-target metrics stay neutral white so the
    // few amber/red flags carry all the weight. Scores still use softScore.
    const bandColor = b => b === 'good' ? 'var(--t1)' : b === 'warn' ? 'var(--amber)' : b === 'bad' ? 'var(--red-soft)' : 'var(--t4)';
    const softScore = s => { s = Number(s) || 0; return s >= 70 ? 'var(--green)' : s >= 50 ? 'var(--amber)' : 'var(--red-soft)'; };

    const pourT = pt.bar_pour_cost_pct ?? 22;
    const foodT = pt.food_cost_pct ?? 32;
    const primeT= pt.prime_cost_pct ?? 60;
    const caT   = rt.check_avg ?? 35;
    const laborT= App.laborTargetPct();

    /* ⭐ BOTH OF THESE ARE MEMBERS NOW (see hubMetrics / hubAlerts above the weekly readout).
       They were locals here, which meant the Bar Cop Briefing snapshot could only be built while
       the Hub was drawing. The Rail button lives in the top bar on every page, so it needs them
       from anywhere — and the answer is one implementation both callers read, never a second copy
       that drifts from what this page displays. */
    /* ⭐ NOTHING ON THIS PAGE READS `hubMetrics` / `hubAlerts` ANY MORE — the two locals fed the
       dead Key Metrics and Alerts panels. Both members STAY: `briefingSnapshot()` calls them, and
       The Rail button is in the top bar on every page, so the read has to exist away from here. */

    // ── Priority action items ──
    // Show every action item from every audited module, ranked by dollar
    // impact. Cap at 50 as a safety ceiling; the card scrolls internally
    // when the list runs past its allotted height.
    const itemRows = [];
    const collect = (audit, sysName, mod) => {
      if (!audit) return;
      (audit.action_items || []).forEach(it => {
        if (it && it.action) {
          /* ⚠ THE `FixPanel.inferGapId` FALLBACK WENT WITH THE FIX LAYER, AND IT WAS INERT.
             Every one of the 19 action-item push sites across the three audits tags `gap_id`
             explicitly. An audit stored before the field existed now resolves null, `PA_DEST`
             misses, and `paiGo` lands on the module's audit — a real page, not a dead end. */
          const gid = it.gap_id || null;
          itemRows.push({ action: it.action, impact: it.monthly_impact || 0, sys: sysName, mod: mod, gap: gid });
        }
      });
    };
    collect(pA, 'Profit',  'profit');
    collect(rA, 'Revenue', 'revenue');
    collect(cA, 'Cash', 'cash');
    itemRows.sort((a,b) => b.impact - a.impact);
    // `topItems` / `overflowItems` sliced `itemRows` for the dead Priority Actions panel. `itemRows`
    // itself SURVIVES — `this._doFirst(itemRows)` is what fills the Hub's "Do this first" row.

    /* ⚠ `todayStr` WENT WITH THE HEADER DATE. Kyle: *"date removed from main header.. i would just
       remove the date from the header"* — it lives on the page now, beside the greeting, where it
       anchors "as of when" for every comparison on the Hub. A `const` left behind after its only
       reader goes is how dead code accumulates, so it went in the same edit ([[the-loop]] #25:
       grep every field you add, or remove, for a second occurrence). */

    /* `PANEL`, `shWrapOpen`, `shWrapClose` and `cardSub` were the dead panels' shell and went with
       them — every reader was one of the six. `cardSub` had no reader at all, before or after. */

    // Stat tiles — center-aligned to match the 4-stat tile pattern used
    // throughout the rest of the app (module dashboards, etc.). Big number in
    // Barlow Condensed, colored by status (green for good, red for bad).
    const tile = (label, big, bigColor, sub, subColor) => `
      <div style="min-width:0;">
        <div style="font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--t3);margin-bottom:8px;">${label}</div>
        <div class="hub-wys-num" style="font-family:'Barlow Condensed',sans-serif;font-size:46px;font-weight:600;letter-spacing:-0.5px;line-height:0.9;color:${bigColor};">${big}</div>
        <div style="font-size:10px;color:${subColor||'var(--t3)'};margin-top:7px;">${sub}</div>
      </div>`;

    // Staff with an area locked see the hero/card in place but with its numbers
    // blanked to a dash and the click routed to the no-access notice — the Hub
    // grid never reflows, the section just reads as unavailable. For non-staff
    // (Owner/Admin/Viewer) canAccess is always true, so nothing changes. A null
    // screen = a management-only page (Operations Audit) locked to all Staff.
    const lockArea = (scr) => scr ? !App.canAccess(scr) : ((window.DB && DB.role && DB.role()) === 'staff');
    const heroTile = (scr, openJs, title, label, big, bigColor, sub) => {
      const lk = lockArea(scr);
      return '<div style="cursor:pointer;" onclick="' + (lk ? 'App.showNoAccess()' : openJs) + '"'
        + (lk ? '' : ' title="' + title + '"') + '>'
        + tile(label, lk ? '-' : big, lk ? 'var(--t4)' : bigColor, lk ? 'Request access from the owner' : sub)
        + '</div>';
    };

    // Top row answers the three owner questions: money available, money gotten
    // back, operation health. Opportunity (white) · Recovered (gold = the hero,
    // proven dollars) · Operations Audit (the operation-health score). The recovery
    // scores + trend now live only in the Audit Scores panel below.
    const recoveryTotal = window.Recovery ? Recovery.total() : { dollars: 0, fixes: 0 };
    const bcA      = last(data.bar_cop_audits || []);
    const bcScore  = bcA ? bcA.overall_score : null;
    const bcDays   = bcA && bcA.date ? daysSince(bcA.date) : null;
    // Audits run anytime with no limit, so the sub is the last-run date, not a
    // countdown to a next allowed run.
    const bcNextTxt = bcDays != null ? ' · run ' + (bcDays === 0 ? 'today' : bcDays === 1 ? 'yesterday' : bcDays + 'd ago') : '';
    // Faint vertical divider between the stats (desktop only; hidden on mobile
    // where the stats stack — see .hub-stat-div in the hub style block).
    const statDiv = '<div class="hub-stat-div" style="align-self:stretch;width:1px;background:var(--b2);flex-shrink:0;margin:0 10px;"></div>';

    // What's Due — the ongoing weekly cadence, shown only once setup is complete
    // (the permanent successor to the "Continue Setup" banner; never both). Honest:
    // each item appears only when it is actually due, so a current operator sees the
    // caught-up line, not a false nudge. The audit cadence is NOT repeated here, it
    // already lives in the Audit Scores panel (days-left + Run button).
    let whatsDueRight = '';
    if (App.data && App.data.settings && App.data.settings.onboarding_complete) {
      const nd = new Date(App.nextSunday() + 'T00:00:00'); nd.setDate(nd.getDate() - 7);
      const lastEnd = App.ymdLocal(nd);
      const wkConfirmed = arr => (arr || []).some(w => ((w.period_end || '') + '').slice(0, 10) >= lastEnd);
      const due = [];
      if (!wkConfirmed(data.weeks))         due.push({ text: 'Confirm last week in Profit',  screen: 'week-close',  mod: ''        });
      if (!wkConfirmed(data.revenue_weeks)) due.push({ text: 'Confirm last week in Revenue', screen: 'week-close',  mod: ''        });
      const dueRows = due.length
        ? due.slice(0, 3).map(it =>
            '<div onclick="S.Hub._enter(\'' + it.screen + '\',\'' + it.mod + '\')" style="display:flex;align-items:center;gap:9px;padding:6px 0;cursor:pointer;font-size:12px;color:var(--t1);line-height:1.35;">'
            + '<span style="width:6px;height:6px;border-radius:50%;background:var(--t3);flex-shrink:0;"></span>'
            + '<span style="flex:1;min-width:0;">' + esc(it.text) + '</span>'
            + '<span style="color:var(--t4);flex-shrink:0;">&rsaquo;</span></div>').join('')
        : '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:12px;color:var(--t3);"><span style="color:var(--green);font-weight:800;">&#10003;</span> You are current this week</div>';
      whatsDueRight = '<div style="flex:1 1 16px;min-width:0;"></div>' + statDiv
        + '<div style="flex:0 0 230px;min-width:190px;">'
        +   '<div style="font-size:9px;font-weight:700;letter-spacing:0.13em;text-transform:uppercase;color:var(--t3);margin-bottom:6px;">What\'s Due</div>'
        +   dueRows
        + '</div>';
    }
    // ── Cash + section status for the new section-card Hub ──
    const trapped   = (window.CashEngine && CashEngine.trapped) ? CashEngine.trapped() : { total: 0, hasData: false };
    const trappedCash = trapped.total || 0;
    const cashSF    = (window.CashEngine && CashEngine.survivalForecast) ? CashEngine.survivalForecast(13) : { hasData:false };
    const runwayTxt = !cashSF.hasData ? null : (cashSF.runway == null ? '13+ wks' : cashSF.runway === 0 ? 'This wk' : cashSF.runway + ' wk' + (cashSF.runway === 1 ? '' : 's'));

    const latestOf = (arr, fields) => { let m=''; (arr||[]).forEach(r=>{ fields.forEach(f=>{ const v=(r&&r[f])?(''+r[f]):''; if(v>m)m=v; }); }); return m||null; };
    const within7  = d => d != null && d <= 7;
    const icCounts = (App.inventoryData && App.inventoryData.ic_counts) || [];
    const icLast   = latestOf(icCounts, ['date','created_at','saved_at']);
    const icCounted= within7(daysSince(icLast));
    const lcActuals= (App.laborData && App.laborData.lc_actuals) || [];
    const lcLast   = latestOf(lcActuals, ['date','week_start','created_at','saved_at']);
    const lcLogged = within7(daysSince(lcLast));
    const pfCurrent= (wkMods.find(m => m.name === 'Profit')  || {}).current;
    const rvCurrent= (wkMods.find(m => m.name === 'Revenue') || {}).current;

    // ── Top card: the money line (Opportunity · Recovered · Trapped Cash ·
    //    Break-Even) on the left, the Operations Audit health score pushed right. ──
    const beSum = (S.HubBreakEven && S.HubBreakEven.summary) ? S.HubBreakEven.summary() : { hasData: false };
    const beVal = beSum.hasData ? App.fmtCurrency(beSum.breakEven, 0) : 'No data';
    const beCol = beSum.hasData ? (beSum.ok ? 'var(--green)' : 'var(--red)') : 'var(--t4)';
    const beSub = !beSum.hasData ? 'Set your costs to surface this'
      : (beSum.ok ? 'Cleared by ' + App.fmtCurrency(beSum.delta, 0) + ' last week'
                  : App.fmtCurrency(Math.abs(beSum.delta), 0) + ' short last week');
    /* ⭐ `--stat` (Kyle, 2026-08-14: *"the hub number box should be a stat box"* — THIS one, the top
       number bar). Four labelled money figures in a bordered box with no head is his definition
       exactly. It cannot be caught by `.card:has(.calc-item)` because the Hub hand-rolls its boxes
       rather than using `.card` and these cells are not `.calc-item`s, so it reads the token
       directly, which lands in the same place: change `--stat` and this moves with the rest. */
    const tiles =
        '<div style="background:var(--stat);border:1px solid var(--b-edge);border-radius:var(--r);overflow:hidden;">'
      /* The briefing slot is gone from this header. The Rail is the ONE whole-bar read now and it
         lives in the top bar, reachable from every page — including this one. */
      /* ⛔ THE "WHERE YOU STAND" HEADING IS GONE, KYLE'S CALL: *"remove the where you stand header..
         stats only in the border card."* The band is four labelled money figures inside a bordered
         card; a heading over them only repeated what the labels already say, and it cost a whole
         row of vertical space at the top of the page that sells the product. */
      + '<div class="hub-wys-body" style="display:flex;align-items:flex-start;gap:22px;flex-wrap:wrap;">'
      /* ⛔⛔ ALL THREE OF THESE POINTED AT DYING COCKPITS. Kyle, 2026-08-10: *"the top stats.. those
         need to be linked to the fix systems not the old close the week pages."* `dashboard`,
         `r-dashboard` and `c-dashboard` are three of the six screens 1c deletes, so these tiles were
         a live countdown to three dead links on the marketing page. They open the FIX system for
         their own money now, which is also the honest destination: a tile that says "here is what is
         on the table" should land where you go and take it.
         ⚠ THROUGH `_enterFix`, NOT `_enter`, so each one gets the module's real fix screen
         (`profit-fix` / `r-fix` / `c-fix`) from the one accessor that already knows the mapping —
         never a second hand-typed list that can drift ([[the-loop]] step 0.5, find the twin).
         ⭐ BREAK-EVEN IS UNCHANGED: `S.HubBreakEven.open()` is a Hub page that survives.
         🔧 Pinned by `verify-hub-destinations` C2, which resolves every destination in this file
         against the app's real router. */
      + heroTile('audit-tracker', "S.Hub._enterRecovery('profit')", 'Open the Profit Audit', 'Total Opportunity',
             anyAudit ? App.fmtCurrency(totalOpp,0) : 'No data',
             /* ⚠ `--t1`, NOT `--w`. Kyle, 2026-08-10: *"change all white text and numbers to a light
                grey though so it is easier on the eyes."* Pure white out-shines the gold hero on a
                dark page and is harsh at 40px. `--t1` is the light grey the rest of the product
                already uses for a number ([[color-system-locked]] — the token, never a hex). */
             anyAudit && totalOpp > 0 ? 'var(--t1)' : 'var(--t4)',
             /* Kyle: *"shorten the 'on the table to recover a month' text.. too long."* */
             anyAudit ? 'To recover a month' : 'Run an audit to surface this')
      + statDiv
      + heroTile('r-audit', "S.Hub._enterRecovery('revenue')", 'Open the Revenue Audit', 'Recovered',
             recoveryTotal.dollars > 0 ? App.fmtCurrency(recoveryTotal.dollars, 0) : '$0',
             recoveryTotal.dollars > 0 ? 'var(--gold)' : 'var(--t4)',
             recoveryTotal.dollars > 0 ? recoveryTotal.fixes + ' measured fix' + (recoveryTotal.fixes === 1 ? '' : 'es') : 'Mark a fix to start')
      + statDiv
      + heroTile('c-audit', "S.Hub._enterRecovery('cash')", 'Open the Cash Audit', 'Trapped Cash',
             trapped.hasData ? App.fmtCurrency(trappedCash, 0) : 'No data',
             trapped.hasData ? (trappedCash > 0 ? 'var(--t1)' : 'var(--green)') : 'var(--t4)',
             trapped.hasData ? (trappedCash > 0 ? 'Cash to free on the shelves' : 'Shelves are working') : 'Count to surface this')
      + statDiv
      + heroTile('hub-breakeven', "S.HubBreakEven.open()", 'Open Break-Even', 'Break-Even', beVal, beCol, beSub)
      // The four figures above are dollars (the money line); the Operations Audit is
      // a health score, not money, so a flex spacer pushes it to the right under
      // the Briefing button — money line left, operation-health read right. The
      // cell's width is matched to the Briefing button after mount (see below) so
      // the divider lines up flush with the button's left edge.
      /* ⛔ THE BAR COP AUDIT TILE CAME OUT OF THIS BAND, AND THE WALK IS WHAT FOUND IT. The climb
         panel directly underneath is now the Operations Audit read — first score, today's score, the
         gain and the three recovery audits — so the live page carried the heading "BAR COP AUDIT"
         TWICE, eight inches apart, showing 75 both times. The band is the MONEY line: four dollar
         figures, nothing else. `bcScore` / `softScore` / `bcNextTxt` still feed The Rail and the
         briefing, so nothing else lost a reader ([[the-loop]] #149 — enumerate what a registration
         is FOR before removing it). */
      + '</div></div>';

    // Getting Started replaces Where You Stand until the operator has fed Bar Cop
    // anything real. It flips to the live stats the moment any of them can populate
    // (an audit run, a week confirmed, or an inventory count taken). This is the
    // first thing a new operator sees after onboarding, so it points at the setup
    // that has to happen first — the three Control sections — then the first audit.
    // Nothing else can be done until those are set up.
    /* ⛔⛔⛔ THE FLIP KEYS ON THE FOUR TILES' OWN DATA, NOT ON "HAS THE OPERATOR DONE ANYTHING".
       Kyle, 2026-08-11: *"get started card is there until an actual number can be filled in on the
       stat box .. then get started goes away and stat box shows."*
       ⚠ THE OLD `hubStarted` WAS THE WRONG TEST FOR THIS AND WOULD HAVE SHIPPED THE SAME DEFECT BACK.
       It counted confirmed weeks, inventory counts and a Bar Cop score — none of which fills any of
       these four cells — so it could flip the band on and show FOUR "No data" boxes, which is
       exactly the screen Kyle was looking at when he asked for this. The honest question is the one
       he asked: can any of these four print a real number yet?
       ⭐ Each clause is the tile's own source, so a fifth tile added later cannot be forgotten here:
       Total Opportunity needs an audit, Recovered needs a measured fix, Trapped Cash needs a count,
       Break-Even needs costs set. */
    const bandHasANumber = anyAudit || recoveryTotal.dollars > 0 || trapped.hasData || !!beSum.hasData;
    // Same chip style as the section Get Started cards (App.controlGetStarted):
    // a Get Started title, one subtitle line, and a flex row of numbered chips
    // that navigate. Each chip carries its own module so the Hub router lands on
    // the right section.
    /* ⭐⭐ EACH CHIP NAMES THE EXACT FIRST JOB, NOT THE SECTION. Kyle, 2026-08-11: *"setup inventory
       control needs to go to list vendors.. setup labor control.. to add positions.. setup shift
       control needs to go to add registers."*
       ⛔ THEY WENT THROUGH `jumpToSection`, WHICH LANDS ON WHATEVER THE SECTION'S FIRST NAV ROW
       HAPPENS TO BE. That was a fix for a worse bug (they used to point at `ic-dashboard` and two
       siblings, three of the six cockpits being deleted, so a new operator's FIRST press was a dead
       link) but it left the destination decided by a table, not by the promise on the chip. A chip
       reading "Set up Inventory Control" landing on Take Inventory is not wrong exactly, it is just
       not the first thing you can actually DO on an empty account: you cannot count what has no
       vendors, you cannot schedule with no positions, you cannot reconcile with no registers.
       ⚠ ALL FOUR OPENED ON THE SHIPPED BUILD BEFORE THIS WAS WRITTEN, which is the one check a
       destination's correctness cannot be inferred without ([[lessons-paid-for]] #18): List Vendors
       renders ADD A VENDOR, Add Positions renders ADD POSITION, Drawers / Registers renders ADD
       REGISTER. Every one is the empty form, which is exactly where a new operator should land.
       ⚠ AND CHIP 4 IS NOW EXPLICIT TOO. It reached `audit-tracker` anyway, via the profit section's
       landing entry, but its promise is "run your first audit" and not "wherever profit happens to
       land" — so it names the screen rather than depending on a table that can move under it. */
    const gsChip = (n, label, screen, mod) =>
        '<div onclick="S.Hub._enter(\'' + screen + '\',\'' + mod + '\')" style="display:flex;align-items:center;gap:10px;cursor:pointer;flex:1;min-width:200px;padding:11px 13px;border:1px solid var(--gold-tint-bord);border-radius:8px;background:var(--gold-tint);">'
      +   '<span style="width:20px;height:20px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;line-height:1;background:var(--sel-active-bg);color:var(--gold);">' + n + '</span>'
      +   '<span style="font-size:12px;font-weight:600;color:var(--t1);">' + label + '</span></div>';
    /* ⛔ THE FOUR DESTINATIONS LIVE IN A MEMBER (`_getStartedSteps`), NOT INLINE, AND THE REASON IS A
       BLIND SPOT I ALREADY PAID FOR ONCE. `verify-hub-destinations` scans for LITERAL `_enter('x','y')`
       calls; a chip built by interpolation is invisible to it, which is exactly how Cost of goods
       shipped pointing at a dying cockpit in the strip. A member can be RUN, so the harness resolves
       each destination for real instead of parsing a template ([[the-loop]] #21 — a filtered search
       space is where the bug hides). */
    const gsSteps = this._getStartedSteps();
    /* ⛔ FOUR COLUMNS, AND THE CHIP IS UNTOUCHED. Kyle, 2026-08-14: *"i didn't want to change the
       design... all 4 steps still in 4 columns.. the step buttons stayed the same.. and then under
       each button in the 4 columns the text.. do this, this and this.. divider or something and the
       app does this, this and this."* My first version turned the chips into stacked rows, which is
       a design change nobody asked for ([[minimal-scope]]). `gsChip` is called exactly as it was;
       everything new sits UNDER it, and the divider separates what the operator does from what Bar
       Cop does with it.
       ⚠ THE CHIP CARRIES `flex:1`, WHICH MEANS THE MAIN AXIS. Dropped straight into a COLUMN it
       would grow vertically and stretch the button to the tallest column. The one-line row wrapper
       gives it a horizontal main axis again, so it fills the column's width and keeps its height. */
    /* ⛔ NO GOLD SENTENCES. Kyle, 2026-08-14: *"get rid of all the gold text color.. it's too much
       gold.. if you want like one gold word 'word:' or something in gold fine.. but full sentences
       no."* The second line was gold end to end across all four columns, which turned an accent
       into the page's loudest colour. The divider does the separating. */
    const gsCol = (n, s, col) =>
      '<div class="hub-gs-step">'
      +   '<div style="display:flex;grid-row:1;grid-column:' + col + ';">'
      +     gsChip(n, esc(s.label)
      /* Close the Week's exact OPTIONAL treatment, so both screens mean the same thing by it. */
              + (s.optional ? ' <span style="font-size:10px;font-weight:600;color:var(--t4);letter-spacing:0.5px;">OPTIONAL</span>' : ''),
              s.screen, s.mod)
      +   '</div>'
      /* ⛔ ONE BORDERED BOX, BUILT FROM TWO GRID ITEMS. Kyle wants the text under each chip wrapped
         like the Operations Audit card: border only, no fill. It cannot be a single element, because
         the rows are what align the divider across four columns of different-length copy — a
         wrapper spanning both rows would lay its own contents out independently and the dividers
         would go ragged again.
         ⭐ SO THE BOX IS DRAWN ACROSS THE SEAM: row 2 takes the top, left and right with the top
         corners rounded and NO bottom edge; row 3 takes a full border with the bottom corners
         rounded. Its top edge IS the divider, which is why exactly one line lands on the seam.
         ⚠ The gap under the chip is a MARGIN, not a grid row-gap: a row-gap applies to every row,
         so it would also open a gap between rows 2 and 3 and split the box in half. */
      +   '<div style="grid-row:2;grid-column:' + col + ';margin-top:8px;font-size:11px;color:'
      +     (s.optional ? 'var(--t3)' : 'var(--t2)') + ';line-height:1.55;padding:11px 12px;'
      +     'border:1px solid var(--b-edge);border-bottom:0;border-radius:8px 8px 0 0;">'
      +     esc(s.how) + '</div>'
      +   '<div style="grid-row:3;grid-column:' + col + ';font-size:11px;color:var(--t2);line-height:1.55;'
      +     'padding:11px 12px;border:1px solid var(--b-edge);border-radius:0 0 8px 8px;">'
      +     esc(s.gain || '') + '</div>'
      + '</div>';
    const gettingStarted = '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:14px;">'
      + 'Four steps to your first closed week. Each one adds to the last.</div>'
      /* ⚠ EVERY STEP RENDERS ALL THREE PARTS, even an empty payoff line, or its column would have no
         row 3 and the divider would vanish from that column alone — which is exactly the ragged look
         this grid exists to fix. */
      + '<div class="hub-gs">'
      +   gsSteps.map((s, i) => gsCol(i + 1, s, i + 1)).join('')
      + '</div>';
    /* ⛔⛔ REVERSED 2026-08-11, AND THE REASON I HAD IT THE OTHER WAY WAS WRONG. During the rebuild I
       made the band always render, arguing a new operator should see "the four numbers the product
       exists to produce". What they actually saw was **No data · $0 · No data · No data** occupying
       the top of the page, with Get Started stranded in the middle. Four dead cells do not say what
       Bar Cop is for; they say it has nothing to tell you.
       ⭐ SO GET STARTED TAKES THE BAND'S PLACE UNTIL A TILE CAN PRINT A REAL NUMBER, which is the
       locked flip rule ([[empty-state-day1]]) that this page had quietly stopped following. Same
       region, same shell, one design in both states: the top of the Hub always holds the thing worth
       looking at, whichever that is today. */
    /* ⛔⛔ THE TWO CARDS STACK NOW. They used to be either/or, and the cost was measured: with only
       inventory set up, `getStarted:false` and the money band took over — so the reward for
       finishing step 1 was that the instructions VANISHED, taking steps 2, 3 and 4 with them. Kyle:
       *"the money card shows under the getting started card once a number can be shown so a user
       can see a result of their work."* Get Started stays until the operator dismisses it, and the
       money band appears underneath the moment it has something real to say.
       ⭐ The band's own flip rule is untouched: it still renders only when a tile can print a real
       number, because four "No data" boxes say Bar Cop has nothing to tell you.
       ⛔ HIDDEN vs DISMISSED, and only the second is permanent. Both live in `settings` rather than
       localStorage so the choice follows the ACCOUNT: hiding on the office laptop and finding it
       back on the phone would read as a bug, and "permanently removed" has to mean everywhere.
       ⚠ NOT ON THE DEMO. Settings are read-only there, so a Dismiss carrying a permanent-delete
       warning would either do nothing or warn a prospect about deleting something on the shop
       window. The demo shows the money band it has always shown. */
    const gsState = (this._gsState ? this._gsState() : 'open');
    const gsHead = '<div style="display:flex;align-items:center;gap:10px;margin:0 0 10px;">'
      + '<div class="sh" style="margin:0;flex:1;">Get started</div>'
      + '<button class="btn btn-ghost btn-sm" id="hub-gs-hide" style="font-size:10px;padding:3px 9px;">'
      +   (gsState === 'hidden' ? 'Show' : 'Hide') + '</button>'
      + '<button class="btn btn-ghost btn-sm" id="hub-gs-dismiss" style="font-size:10px;padding:3px 9px;">Dismiss</button>'
      + '</div>';
    const allDone = gsSteps.filter(s => !s.optional).every(s => s.done);
    const gsBody = gsState === 'hidden' ? ''
      /* ⚠ FOUR WORDS, NOT TWELVE. This read "You are set up. Dismiss this when you are done with
         it." and `verify-design-code` RULE 2b took the file 2 -> 3 on card prose. It was right: the
         Dismiss button is eighteen pixels away in the head, so the sentence was explaining a
         control the operator can already see. */
      : allDone ? '<div style="font-size:12px;color:var(--t2);line-height:1.6;">You are set up.</div>'
      : gettingStarted;
    const gsCard = (App.demoMode || gsState === 'dismissed') ? ''
      : '<div style="background:var(--surface);border:1px solid var(--b-edge);border-radius:var(--r);padding:16px 18px;margin-bottom:14px;">'
        + gsHead + gsBody + '</div>';
    const topCard = gsCard + (bandHasANumber ? tiles : '');

    // ── Needs Attention band: the fires (alerts) + section-less weekly nudges
    //    (month-end Books, etc.). Catches what does not belong to a weekly section
    //    card. Condition-gated, so it is never a nag; collapses to All Clear. ──
    /* ⚠ THE MONTH-END NUDGE AND THE DESTINATION RULE BOTH MOVED TO MEMBERS (T72, 2026-09-03), so the
       Needs attention MODAL reads the same set and sends a row to the same place as the card. They
       were locals, and a modal cannot reach a local — copying either into it would have been a
       second implementation of the thing this suite exists to keep single. */
    const goOf = a => this._goOf(a);
    const rowDiv = (onclick, dot, label, value, valColor) =>
      '<div class="hd-prow" onclick="' + onclick + '" style="display:flex;align-items:center;gap:10px;padding:9px 12px;cursor:pointer;min-width:0;">'
      + '<span style="width:7px;height:7px;border-radius:50%;background:' + dot + ';flex-shrink:0;"></span>'
      + '<span style="flex:1;min-width:0;font-size:12px;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(label) + '</span>'
      + (value ? '<span style="flex-shrink:0;font-size:11px;font-weight:600;color:' + valColor + ';white-space:nowrap;">' + esc(value) + '</span>' : '')
      + '<span style="flex-shrink:0;color:var(--t4);font-size:13px;">&rsaquo;</span></div>';
    const cardWrap = (title, inner) => '<div style="display:flex;flex-direction:column;min-width:0;"><div class="sh" style="margin:0 0 10px;">' + title + '</div>'
      + '<div style="background:var(--surface);border:1px solid var(--b-edge);border-radius:var(--r);padding:13px 15px;flex:1;">' + inner + '</div></div>';

    // ── Priority Actions: the biggest recovery $ moves across all systems, ranked,
    //    each row a tap into its Fix step. The recovery/metric leaks live here, not
    //    in Needs Attention. ──
    // A few action items name a lever that lives OUTSIDE a Fix screen, so a Fix
    // deep-link would land shallow. Events have no Fix step (the work is in the
    // Events section), so route that one to its real home; every other gap is a
    // real Fix step and deep-links into its module's Fix screen at the gap.
    const PA_DEST = { 'events-catering': { screen: 'ev-bookings', mod: 'events' } };
    const paiGo = (it) => {
      const d = PA_DEST[it.gap];
      return d
        ? 'S.Hub._enter(\'' + d.screen + '\',\'' + d.mod + '\')'
        /* ⚠ The gap id is no longer passed: `_enterRecovery` lands on the module's AUDIT, which
           lists every gap it surfaced, so the focus had nothing left to consume. */
        : 'S.Hub._enterRecovery(\'' + it.mod + '\')';
    };
    /* ── DO THIS FIRST: ONE THING ────────────────────────────────────────────
       This was a ranked list of eight in a scroll box. One item is calmer AND more useful: the app
       has done the analysis, so it should say what the answer is rather than hand back a shortlist.
       ⭐ AND IT IS THE SAME REGION AS GET STARTED. Seeded, it is the biggest money move; empty, it is
       the four setup steps. Same position, same promise — the app tells you the one next thing.
       ⚠ THE REST ARE COUNTED, NOT LINKED. "N more" is a CAPTION, not a door.
       ⛔⛔ IT WAS A DOOR AND THE DOOR WAS WRONG. It carried the operator to `recovery-playbook`,
       which routes correctly and is a 32,365-character essay ("What running without systems costs")
       that does not contain the words "check average" — the very item the headline above it had just
       named. So the link was not dead, it was a BROKEN PROMISE, which is harder to spot and reads
       worse. There is no screen anywhere that holds "the other N recovery actions, ranked", and
       inventing one contradicts this card's whole reason to exist: the app has done the analysis, so
       it says the answer instead of handing back a shortlist. A "N more" LINK hands back the
       shortlist. The count still earns its place as a fact — it says the app found N+1 things and
       picked one — so it stays as quiet text in `--t3`.
       ⚠ AND THE COLOUR HAD TO MOVE OFF `--gold` WITH THE ONCLICK. Gold is this page's money/tappable
       signal; gold text that no longer responds to a press is a second lie replacing the first. */
    const first = this._doFirst(itemRows);
    /* ⛔ AND NOW THE COUNT IS GONE ENTIRELY. Kyle, 2026-08-10: *"remove the '6 more' that has no
       meaning to a user."* He is right and it is the end of a three-step retreat worth recording: it
       was a LINK to a page that did not hold the list, then a caption, and now nothing. A bare "6
       more" tells an operator there are six things somewhere with no way to see them and no reason
       to care — the count was only ever meaningful to me, as proof the ranking had a pile behind it.
       ⭐ WHICH IS THE CARD'S WHOLE POINT: the app did the analysis, so it says the answer. A count of
       what it did not say is the shortlist coming back in smaller type. */
    /* ⚠ NO EMPTY BRANCH HERE ANY MORE. This used to fall back to `gettingStarted`, and once Get
       Started moved up to the money band's place that branch became unreachable — `doFirstBand`
       returns nothing at all when there is no action. An unreachable fallback that still names a
       real card is how the next reader concludes this slot owns the empty state too. */
    const doFirst = !first ? ''
      : '<div onclick="' + paiGo(first.item) + '" style="cursor:pointer;">'
        /* Kyle: *"make the close the check average gap a little bigger."* 15px -> 18px. */
        + '<div style="font-size:18px;font-weight:700;color:var(--t1);line-height:1.3;">' + esc(first.label) + '</div>'
        + (first.impact > 0
            ? '<div style="font-size:12px;color:var(--t2);margin-top:6px;">Worth <span style="color:var(--gold);font-weight:700;">'
              + App.fmtCurrency(first.impact, 0) + '</span> a month</div>' : '')
        + '</div>';
    /* ⛔⛔ `priorityCard` AND `needsBand` ARE DELETED, NOT LEFT SITTING. The movement rebuild replaced
       both with `doFirstBand` and the Band-4 row list, and each was DECLARED AND NEVER READ from that
       moment — 45 lines of a previous layout that still looked load-bearing, including the
       `hub-permits` overflow caption. It was doing active harm: `verify-hub-destinations`' D block
       was asserting against captions in code nothing renders, so the suite was policing a page that
       no longer exists ([[the-loop]] #25 — a thing computed and read nowhere is a fix that never
       shipped; the same is true of a card that is built and never placed).
       ⭐ THE OVERFLOW CAPTION IS GONE FROM BOTH LISTS NOW, which is the end of a three-step retreat:
       a LINK to a page that did not hold the list, then a caption, then nothing. Kyle: *"remove the
       '6 more' that has no meaning to a user"* and *"no links to the ones not listed.. they are
       listed in multiple places on the app."*
       ⚠ `bandItems` SURVIVES — the new Needs You list reads it. Only the dead render went.
       ⭐⭐ AND AT T72 (2026-09-03) A COUNT CAME BACK, WHICH IS NOT A REVERSAL OF THE ABOVE. Both of
       Kyle's objections were to a count with NOWHERE TO GO: a link to a page that did not hold the
       list, then a bare caption. *"if more than 5 items.. put something like (5 of X) and make that
       a clickable link that opens a modal with all listed and clickable."* The destination IS the
       list now, which is the thing that was missing both previous times. See `_needsMore`. */
    const bandItems = this._needsItems();

    // ── Section cards: one per section, Control row + Recovery row. Each mirrors
    //    its section, a headline number/state + the weekly-close status + a jump
    //    into that section. The whole card is the deep link. ──
    /* ⛔⛔ THE SIX SECTION CARDS WERE CUT HERE, 2026-08-10, AND THE DEPENDENCY WENT WITH THEM.
       They carried three stats, a progress bar, FOUR hand-ticked step rows and a footer each — 24
       rows of a checklist nothing downstream ever read, on the page that is the marketing image.
       Kyle: *"it looked intimidating... too much work.. 6 cards.. 4 steps each."*
       ⭐ AND THEY WERE BUILT FROM `safeSteps(S.<Cockpit>)`, so the six screens being deleted were
       the Hub's DATA SOURCE, not merely its links. `_sectionStrip` / `_stripMetrics` replace them
       from stores, CashEngine and the surviving order sheet. Pinned by `verify-hub-no-cockpit`. */

    /* ⛔⛔⛔ THE FIVE DEAD PANELS WERE CUT HERE (2026-08-11). `auditPanel`, `metricsPanel`,
       `alertsPanel`, `chartPanel`, `actionPanel` and `readoutPanel` were all DECLARED AND NEVER
       READ — the chat-57 rebuild replaced the old six-panel grid with the movement bands and left
       ~415 lines of builder behind, still executing on every Hub render to produce strings nothing
       inserted. Their exclusive closure went with them: `auditRow`, `metricCells`, `alertHead`,
       `alertRows`, `allClear`, `miniChart`, the four trend series, `trendBody`, `actionBody`,
       `overflowFooter`, `ghStep`, `startHereGuide`, `actionHead`, `aiCount`, `readout`,
       `readoutBody`, `modBadge`, `hasWeekData` and `heroNum`.
       ⭐ THE DEAD SET IS A FIXPOINT, NOT A LIST ([[the-loop]] #63): the five Kyle named pulled in
       nineteen more, over four rounds, and every one was re-derived by READING its references
       rather than trusting the closure probe — whose spans attribute anything sitting between two
       dead declarations to the earlier one, which over-deletes.
       ⛔ AND TWO NAMES IN THE SET ARE LIVE MEMBERS OF `S.DashUI` — `metricsPanel` and `auditPanel`
       both exist there, for other screens. The duplicate-name trap: count the call sites in THIS
       file, because a name existing elsewhere is not evidence about this one. */

    /* ⛔ THE SNAPSHOT IS NOT BUILT HERE ANY MORE — `briefingSnapshot()` is its ONE owner.
       This assembled `this._briefingData` inline, which meant the read only existed once the Hub
       had drawn; The Rail is in the top bar and gets pressed on pages that never render this one.
       ⚠ Leaving this here alongside the member would have been the worse outcome of the two: two
       implementations of the same object, agreeing today and drifting the first time either was
       edited, on the very read whose promise is that it never contradicts the dashboard. */
    // ── Sidebar nav SVG icons, 17x17 viewBox to match the module sidebars ──
    const navIcons = {
      profit:  '<path d="M2 13h11M4 13V8M7.5 13V4M11 13V9.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
      revenue: '<path d="M2 13l4-5 3 3 4.5-7M10 4h4v4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
      cash:    '<circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M8.5 4.7v7.6M10.6 6.3c-.4-.6-1.2-1-2.1-1-1.2 0-2.1.6-2.1 1.6 0 2.1 4.3 1.1 4.3 3.2 0 1-.9 1.6-2.2 1.6-1 0-1.8-.4-2.2-1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>',
      inv:     '<path d="M2.5 5L8.5 2l6 3v7l-6 3-6-3V5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M2.5 5l6 3 6-3M8.5 8v7" stroke="currentColor" stroke-width="1.2"/>',
      labor:   '<circle cx="6" cy="6" r="2.6" stroke="currentColor" stroke-width="1.3"/><path d="M1.8 14c0-2.6 1.9-4.2 4.2-4.2s4.2 1.6 4.2 4.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M11.5 4.2a2.4 2.4 0 0 1 0 4.6M12 14c0-2.4-1.3-3.9-3-4.1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
      shift:   '<circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M8.5 5v4l2.5 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
      getStart:'<path d="M2.5 8.5l4 4 8-8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
      allBars: '<rect x="2" y="6" width="3" height="8" rx="0.5" stroke="currentColor" stroke-width="1.3"/><rect x="7" y="3" width="3" height="11" rx="0.5" stroke="currentColor" stroke-width="1.3"/><rect x="12" y="8" width="3" height="6" rx="0.5" stroke="currentColor" stroke-width="1.3"/>',
      books:   '<rect x="3" y="2.5" width="11" height="12" rx="0.5" stroke="currentColor" stroke-width="1.3"/><path d="M3 5.5h11M6 8.5h5M6 10.5h5M6 12.5h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
      calendar:'<rect x="2" y="3.5" width="13" height="11.5" rx="0.5" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M2 7h13" stroke="currentColor" stroke-width="1.3"/><path d="M5 2v3M11.5 2v3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><rect x="4" y="9" width="2" height="2" stroke="currentColor" stroke-width="1.1" fill="none"/><rect x="7.5" y="9" width="2" height="2" stroke="currentColor" stroke-width="1.1" fill="none"/><rect x="11" y="9" width="2" height="2" fill="currentColor"/>',
      user:    '<circle cx="8.5" cy="6" r="2.8" stroke="currentColor" stroke-width="1.3"/><path d="M3 14.5c0-2.7 2.5-4.5 5.5-4.5s5.5 1.8 5.5 4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
      report:  '<rect x="3.5" y="2" width="10" height="13" rx="0.5" stroke="currentColor" stroke-width="1.3"/><path d="M6 5.5h5M6 8h5M6 10.5h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M9 12.5l1.2 1.2 2.2-2.2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
      help:    '<circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M7 6.5a1.5 1.5 0 0 1 3 0c0 1-1.5 1.5-1.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8.5" cy="12" r="0.6" fill="currentColor"/>',
      settings:'<circle cx="8.5" cy="8.5" r="2" stroke="currentColor" stroke-width="1.3"/><path d="M8.5 2v1.5M8.5 13.5V15M2 8.5h1.5M13.5 8.5H15M3.8 3.8l1.1 1.1M12.1 12.1l1.1 1.1M3.8 13.2l1.1-1.1M12.1 4.9l1.1-1.1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
      bug:     '<ellipse cx="8.5" cy="9" rx="3.5" ry="4.5" stroke="currentColor" stroke-width="1.3"/><path d="M5 9H2.5M14.5 9H12M5.5 5L4 3.5M11.5 5L13 3.5M5.5 13L4 14.5M11.5 13L13 14.5M8.5 4.5V3M7 4a2 2 0 0 1 3 0" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
      mail:    '<rect x="2.2" y="4" width="12.6" height="9" rx="1" stroke="currentColor" stroke-width="1.3"/><path d="M2.2 4.5l6.3 4.5 6.3-4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
      hubhome: '<rect x="2" y="2" width="6" height="6" rx="0.5" stroke="currentColor" stroke-width="1.3" fill="none"/><rect x="9" y="2" width="6" height="6" rx="0.5" stroke="currentColor" stroke-width="1.3" fill="none"/><rect x="2" y="9" width="6" height="6" rx="0.5" stroke="currentColor" stroke-width="1.3" fill="none"/><rect x="9" y="9" width="6" height="6" rx="0.5" stroke="currentColor" stroke-width="1.3" fill="none"/>',
      audit:   '<circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 8.5l2 2L12 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
      expense: '<path d="M3.5 2v13l1.5-1 1.5 1 1.5-1 1.5 1 1.5-1 1.5 1V2H3.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M8.5 5.5v5M10 6.5H7.5a1 1 0 0 0 0 2H9.5a1 1 0 0 1 0 2H7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none"/>',
      cashout: '<circle cx="8.5" cy="8.5" r="6.3" stroke="currentColor" stroke-width="1.3"/><path d="M8.5 5.3v6.4M10.1 6.6H7.7a1.15 1.15 0 0 0 0 2.3H9.3a1.15 1.15 0 0 1 0 2.3H6.8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none"/>',
      shield:  '<path d="M8.5 2L3 4v5c0 3 2.5 5 5.5 6 3-1 5.5-3 5.5-6V4l-5.5-2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" fill="none"/><path d="M6.5 8.5l1.5 1.5 3-3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
      signout: '<path d="M6.5 3h-3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3M11 5.5l3 3-3 3M14 8.5H7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>'
    };

    // Build one sidebar nav row. extra is an array of [attr, value] tuples
    // for data-mod / data-screen on the module-enter rows.
    const navItem = (action, name, iconKey, extra) => {
      const attrs = (extra || []).map(([k,v]) => ' ' + k + '="' + v + '"').join('');
      return '<div class="nav-item" data-hub-action="' + action + '"' + attrs + '>'
        + '<svg class="nav-icon" viewBox="0 0 17 17" fill="none">' + navIcons[iconKey] + '</svg>'
        + '<span class="nav-label">' + name + '</span></div>';
    };

    // The Hub-shell DEFAULT sidebar. Its old navigation pile (Analysis, Recovery,
    // Control, Accounting, Operations, Setup) now lives in the top nav + the
    // per-section context sidebars, so the default is trimmed to Support, the
    // only thing not homed elsewhere. All mobile navigation goes through the
    // unified drawer (App.openMobileNav); this default shows on the desktop
    // Help / Contact pages.
    const sidebarNav = ''
      + '<div class="nav-section">Support</div>'
      + navItem('help',            'Help and FAQ', 'help', [])
      + navItem('report-bug',      'Report a Bug', 'bug',  []);

    // Cache the default (grab-bag) sidebar nav so renderSidebar() can restore it
    // after a context sidebar (e.g. Operations Audit) was swapped in.
    this._grabBagNavHTML = sidebarNav;

    const collapsedClass = this._sidebarCollapsed ? ' sidebar-collapsed' : '';

    // ── Hub landing layout ──────────────────────────────────────────────────
    // NEW_HUB_LAYOUT groups the panels into the owner's reading order: where you
    // stand (the three tiles) -> what to do now (Priority Action Items, Alerts,
    // Weekly Gaps) -> the supporting detail (Audit Scores, Key Metrics, Trend),
    // with the action band taller than the detail band so the eye lands on the
    // win and the next move first. Flip to false to restore the prior
    // equal-weight grid exactly (kept intact below; panels are unchanged).
    /* ── Hub landing layout: the money line, the Needs Attention band, then ONE ROW covering all six
       systems. It was two rows of three cards, each carrying a progress bar and four hand-ticked
       step rows — 24 rows of checklist on the page that is the product's marketing image. ── */
    /* ── THE HUB, REBUILT AROUND MOVEMENT RATHER THAN STATE ─────────────────────────────────────
       Kyle, 2026-08-10, on the version before this one: *"it's just small and empty and boring.. why
       not progression on data.. improvements on numbers.. you were here last week/month.. today
       you're here.. here is your biggest growth area and your worst."* He was right, and the
       diagnosis underneath it was that every object on the page had the SAME grammar — small grey
       label, number, caption, sixteen times. Sixteen different facts that all look like the same
       fact read as a spreadsheet. So each band here has a DIFFERENT grammar: pairs, a journey, a
       ranked judgement, rows, a strip.
       ⭐ AND IT FILLS 1200px BECAUSE PROGRESSION IS NATURALLY WIDE. A was-to-now fact is a pair, and
       pairs tile across a wide screen; a lone headline in 64px type does not, which is what killed
       the previous attempt. */
    const hbGrey = 'var(--t1)';
    /* ⛔ COLOUR ON THE TEXT, NEVER A BADGE. Kyle: *"no badge background on any numbers.. color text
       only not color badge."* And the colour answers GOOD OR BAD, not up or down — labor falling is
       green, check average falling would be red. A generic dashboard cannot do that because it does
       not know what good means for each figure. */
    const hbDelta = (good, text) => '<span style="font-size:11px;font-weight:700;color:'
      + (good == null ? 'var(--t4)' : (good ? 'var(--green)' : 'var(--red)')) + ';white-space:nowrap;">'
      + esc(text) + '</span>';
    const hbPanel = (inner, extra) => '<div style="background:var(--surface);border:1px solid var(--b-edge);'
      + 'border-radius:var(--r);padding:16px 18px;' + (extra || '') + '">' + inner + '</div>';
    /* ⚠ `right` IS RAW HTML AND THE TITLE IS STILL ESCAPED. The only caller passing one is the Needs
       attention overflow link, which `_needsMore` builds from two numbers it computed itself, so
       nothing operator-supplied reaches it. Escaping it would render the markup as text. */
    const hbSh = (t, right) => '<div class="sh" style="margin:0 0 10px;">' + esc(t) + (right || '') + '</div>';

    // ── Band 1a: the climb, plus the three recovery audits underneath it ──
    const climb = this._auditClimb();
    const mods = this._moduleAudits();
    /* ⛔⛔ THE REAL COMPONENT, NOT A HAND-DRAWN RING. Kyle: *"the other audit scores circles are not
       right.. they should be like the circles on the actual audit section scores."* `AuditUI.scoreRing`
       is that circle — an SVG arc filled to the score, used in EVERY section header across all four
       audits "so they read identically", per its own comment. I drew a plain bordered div with a
       hand-rolled colour ladder instead, which is a second implementation of a shared job and it
       looked nothing like the audits.
       ⭐ `App.scoreColor` is the shared colour ladder too, so the label under the ring cannot drift
       from the ring's own fill ([[the-loop]]: grep the DESTINATION for how anything else does it —
       the existing callers are the spec). */
    const hbRing = m => {
      const has = m.score != null;
      const ring = has
        ? AuditUI.scoreRing(m.score, 46)
        : '<div style="width:46px;height:46px;border-radius:50%;border:2px solid var(--b2);display:flex;'
          + 'align-items:center;justify-content:center;font-size:14px;color:var(--t4);">-</div>';
      return '<div onclick="S.Hub._enter(\'' + m.screen + '\',\'' + m.mod + '\')" style="flex:1;cursor:pointer;'
        + 'display:flex;flex-direction:column;align-items:center;">'
        + ring
        + '<div style="font-size:11px;color:' + hbGrey + ';margin-top:6px;">' + esc(m.name) + '</div>'
        + '<div style="font-size:10px;color:var(--t4);margin-top:2px;">'
        + (m.date ? 'Run ' + esc(shortDate(m.date) || m.date) : 'Never run') + '</div></div>';
    };
    const climbBlock = hbSh('Operations Audit')
      + (climb
        /* ⛔ THE RULE BETWEEN THE TWO SCORES IS A GRADIENT, AND THAT IS WHAT MAKES THE SPACE WORK.
           Kyle: *"the line going between the 40 and the 75 isn't anything like the image you showed..
           that is what made the space between the 2 scores work."* A flat `--b2` hairline reads as a
           divider separating two unrelated numbers; a rule that BRIGHTENS from dim into the score's
           own colour reads as a journey from there to here, which is the whole point of the band.
           ⭐ It ends on `App.scoreColor(climb.last)`, the app's shared ladder, so the rule, the number
           and the rings below it can never disagree about what 75 is worth.
           ⚠ It is two labelled endpoints and a rule, NOT a plotted series — the one thing on this
           page that comes close to a chart, and Kyle has seen it and kept it. */
        ? '<div style="display:flex;align-items:flex-end;gap:14px;">'
          + '<div><div style="font-size:30px;font-weight:700;color:var(--t3);line-height:1;">' + climb.first + '</div>'
          + '<div style="font-size:10px;color:var(--t4);margin-top:4px;">' + esc(shortDate(climb.firstDate) || '') + '</div></div>'
          + '<div style="flex:1;height:2px;margin-bottom:16px;background:linear-gradient(90deg,var(--b2),'
          + App.scoreColor(climb.last) + ');"></div>'
          /* Kyle: *"the score color should be the right color and you can make the 75 a little less
             bold.. not smaller just not as bold."* 48px stays, 800 -> 600. */
          + '<div style="text-align:right;"><div style="font-size:48px;font-weight:600;color:'
          + App.scoreColor(climb.last) + ';line-height:.9;">'
          + climb.last + '</div><div style="font-size:10px;color:var(--t3);margin-top:5px;">today</div></div></div>'
          + '<div style="margin-top:12px;display:flex;align-items:center;gap:9px;">'
          /* ⛔ `climb.delta`, NOT `climb.hbDelta`. A blind `\bdelta\b` rename hit the PROPERTY as well
             as the local, so the live band printed "undefined pts". I checked that rename for leaks
             OUTSIDE my block and never checked inside it — the half I owned was the half I did not
             look at. Found by reading the shipped page, not by any assertion. */
          + hbDelta(climb.delta >= 0, (climb.delta >= 0 ? '+' : '') + climb.delta + ' pts')
          + '<span style="font-size:12px;color:var(--t2);">in ' + climb.weeks + ' week'
          + (climb.weeks === 1 ? '' : 's') + ', across ' + climb.count + ' audits</span></div>'
        /* ⚠ A LABEL, NOT A SENTENCE. `verify-design-code` RULE 2b caught three explainer sentences
           I had written onto cards here (9 -> 12 in the ratchet), and the no-prose-on-cards standard
           is right: an empty state names what is missing, it does not narrate. Shorter is also the
           operator voice — directives, not lessons ([[writing-style]]). */
        : '<div style="font-size:12px;color:var(--t3);padding:6px 0 10px;">No audits yet</div>')
      + '<div style="display:flex;gap:10px;margin-top:16px;padding-top:14px;border-top:1px solid var(--b2);">'
      + mods.map(hbRing).join('') + '</div>';

    // ── Band 1b: where you were, where you are ──
    const mv = this._movement();
    const hbPair = p => '<div style="display:grid;grid-template-columns:120px 1fr auto;align-items:center;gap:14px;'
      + 'padding:9px 0;border-top:1px solid var(--b2);">'
      + '<span class="sh" style="margin:0;">' + esc(p.label) + '</span>'
      + '<span><span style="font-size:14px;color:var(--t3);">' + esc(p.was) + '</span>'
      + '<span style="color:var(--t4);margin:0 8px;font-size:13px;">&rarr;</span>'
      + '<span style="font-size:18px;font-weight:700;color:' + hbGrey + ';">' + esc(p.now) + '</span></span>'
      /* ⛔ THE CHIP SAYS THE CHANGE, NOT THE PAIR AGAIN. It rendered "▲ 56.1% to 55.4%" on the live
         build — a word-for-word repeat of the two figures three inches to its left, with the arrow
         pointing UP on a number that went DOWN. Two separate errors in one string: the ARROW is
         direction (down is down, always) and the COLOUR is judgement (down on prime cost is green).
         Conflating them is exactly what makes a generic dashboard unable to say anything useful. */
      + hbDelta(p.flat ? null : p.good,
          (p.delta === 0 ? '' : (p.delta < 0 ? '▼ ' : '▲ '))
          /* ⚠ NO HAND-ROLLED FALLBACK. My first version wrote `p.deltaText || Math.abs(p.delta).toFixed(…)`
             and `verify-signed-zero-display` refused it — correctly, twice over: it is a private
             re-implementation of a formatter the app already owns, AND a fallback to the exact shape
             that fix replaced ([[the-loop]] #40 / [[harness-review-like-code]] #10). `pair()` always
             sets `deltaText`, so the fallback was unreachable as well as wrong. */
          + esc(p.deltaText)) + '</div>';
    const hbHead = mv && mv.headline;
    const hbHeadline = !hbHead ? ''
      : '<div style="font-size:21px;font-weight:700;color:' + hbGrey + ';line-height:1.3;margin:2px 0 14px;">'
        + (hbHead.holding
            ? 'You are holding steady at <span style="color:var(--gold);">' + esc(hbHead.prime) + '</span> prime cost.'
            : 'You are running about <span style="color:var(--gold);">' + esc(hbHead.amount) + ' a month</span> '
              + (hbHead.better ? 'better' : 'worse') + ' than two weeks ago.')
        + '</div>';
    const movementBlock = hbSh('Where you were, where you are')
      + (mv && mv.pairs.length
        ? hbHeadline + mv.pairs.map(hbPair).join('')
        : '<div style="font-size:12px;color:var(--t3);padding:6px 0;">' + this._needsWeeksMsg() + '</div>');

    // ── Band 2: the one action ──
    /* Kyle: *"do this first card has #08131A background and normal ghost button not gold button."*
       `--card-head` IS #08131A, so the token goes in rather than the hex ([[color-system-locked]]).
       ⛔⛔ AND THIS LINE SHIPPED AS `var(--card-hbHead)` — MY BLIND `\bhead\b` RENAME MATCHED INSIDE
       THE CSS TOKEN NAME. An unknown custom property is not an error, it just resolves to nothing,
       so the card silently lost its background and NOTHING anywhere reported it. That is the third
       thing that rename broke (after the property accesses and `g.dataset.band`), and all three were
       invisible to `node --check` and to 449 harnesses. **A rename is a text edit, not a refactor:
       bound it to the block you own and read every hit.**
       Kyle also called the gold edge: *"get rid of the gold left side border."* */
    /* ⛔ THIS BAND STANDS DOWN WHEN GET STARTED HAS TAKEN THE TOP. It used to carry Get Started
       itself when there was no action to name, which is why the empty Hub rendered it TWICE the
       moment the flip moved Get Started up to the money band's place. One card, one home: this band
       exists only when there is a real biggest money move to point at.
       ⚠ THE HEADING LIVES HERE AND NOT IN `doFirst`, because the band lost its label once already in
       the rebuild and shipped unlabelled for two pushes — the old `cardWrap('Do This First', …)`
       supplied it and the replacement did not carry it across. `verify-hub-no-cockpit` F1b caught
       that, which is the control whose whole job is refusing to let a card pass by being deleted. */
    const doFirstBand = !first ? ''
      : '<div style="background:var(--card-head);border:1px solid var(--b-edge);'
      + 'border-radius:var(--r);padding:16px 18px;display:flex;'
      + 'align-items:center;gap:20px;flex-wrap:wrap;">'
      + '<div style="flex:1;min-width:220px;">'
      +   hbSh('Do this first')
      +   doFirst + '</div>'
      + '<button class="btn btn-ghost btn-sm" onclick="' + paiGo(first.item) + '">Open the audit</button>'
      + '</div>';

    // ── Band 3: biggest gain and worst drag, in the audit's own vocabulary ──
    const bw = this._bestWorst();
    /* ⛔⛔⛔ THESE TWO CARDS STOPPED SPEAKING IN AUDIT SCORES. Kyle, 2026-08-10: *"they are currently
       bar cop audit section scores.. something the user might not know what they are referencing
       right away.. what about actual stats from inventory or whatever.. like food cost saved xx%
       worth $xx last week."*
       ⭐ HE IS RIGHT AND THE OLD VERSION FAILED ITS OWN TEST. "Operational Consistency 86, +16" is a
       true reading of a Bar Cop sub-score and it is meaningless standing at the bar: it names an
       internal scoring category, not a thing an operator does. `Recovery Action -11` is worse, since
       nothing in the room is called that.
       ⭐ NOW EVERY CANDIDATE IS AN OPERATING NUMBER WITH A WEEKLY DOLLAR: bar pour cost, food cost,
       labor, check average, voids and comps, overtime. The dollar is what the MOVE is worth per week
       at current volume, which is the sentence an operator finishes for you: "food cost down half a
       point, that is fifty quid a week."
       ⚠ AND EITHER CARD CAN BE LEGITIMATELY EMPTY. Two weeks where nothing slipped has no drag, and
       saying so is the truth, not a gap in the page.
       ⚠ THE EMPTY STATE NAMES THE WINDOW IN THE SAME WORDS THE REST OF THE PAGE USES. It said "this
       fortnight", which is British and does not appear anywhere else in the product; every other
       reference to this comparison says two weeks. Kyle caught it. A word nobody in an Austin bar
       would say is a small thing that makes a page read as written by somebody else
       ([[writing-style]] — operator to operator, in their words). */
    /* ⛔ THIS CARD HAS TWO EMPTY STATES AND PRINTED ONE SENTENCE FOR BOTH (found 2026-08-12 by
       walking the Hub's day one, which had never been done). `_bestWorst()` returns NULL when there
       are not enough closed weeks, and an OBJECT with a null gain or drag when the weeks are there
       and nothing moved. The old signature took `bw && bw.gain`, which collapses both into one
       falsy value, so a brand-new bar with no data at all was told "Nothing slipped in the last two
       weeks" about a fortnight that never happened.
       ⭐ The page already knew the difference ONE PANEL UP: `movementBlock` prints its own
       needs-more-weeks line off `mv.pairs.length` ([[lessons-paid-for]] #33 — a guard that lives in
       one card's render does not exist for the card beside it).
       ⚠ AND IT SAYS THREE, NOT TWO. `_bestWorst` compares `P[0]` against `P[2]`, so three closed
       weeks are needed even though the SPAN it reports is two weeks. Borrowing the neighbour's exact
       words would have shipped a second sentence that is not true. */
    const bwCard = (t, reading, key, isGain) => {
      const o = reading ? reading[key] : null;
      if (!o) return hbPanel(hbSh(t)
        + '<div style="font-size:12px;color:var(--t3);">'
        + (!reading ? this._needsWeeksMsg()
           : isGain ? 'Nothing improved in the last two weeks' : 'Nothing slipped in the last two weeks') + '</div>');
      const col = isGain ? 'var(--green)' : 'var(--red)';
      const amount = App.fmtCurrency(Math.abs(o.dollars), 0);
      return hbPanel(hbSh(t)
        + '<div style="display:flex;align-items:baseline;gap:10px;margin:2px 0 8px;flex-wrap:wrap;">'
        + '<span style="font-size:25px;font-weight:700;color:' + col + ';">' + esc(amount) + '</span>'
        + '<span style="font-size:13px;color:var(--t2);">' + (isGain ? 'saved' : 'lost') + ' ' + esc(o.unit) + '</span>'
        + '</div>'
        + '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;">'
        +   '<span style="font-size:13px;font-weight:700;color:' + hbGrey + ';">' + esc(o.label) + '</span>'
        +   '<span style="font-size:12px;color:var(--t3);white-space:nowrap;">' + esc(o.was)
        +     ' <span style="color:var(--t4);">&rarr;</span> <span style="color:' + col + ';font-weight:700;">'
        +     esc(o.now) + '</span></span></div>');
    };

    // ── Band 4: needs you, and what is already done ──
    /* Kyle: *"the Needs you same number of rows and no links to the ones not listed.. they are listed
       in multiple places on the app.. so user can find them all."* So the overflow caption is gone
       entirely. The trade, stated once: seven reds show five and nothing says the other two exist. */
    /* ⛔ A FIXED ROW HEIGHT, NOT PADDING, SO THE TWO CARDS LINE UP. Kyle: *"the rows in both cards
       need to be the same height so the 5 rows are flush with each other on top and bottom."* They
       were `padding:10px` around content of different heights — the tick circle is 17px, a plain
       label is ~15px — so Needs You and Done This Week drifted apart by a few pixels per row and by
       the fifth row the two cards ended at visibly different points. `height` + `box-sizing` makes
       every row identical in both cards regardless of what is inside it, which is the only way five
       rows can be flush top AND bottom. */
    const ROW_H = 38;
    const hbRow = (inner) => '<div class="hd-arow" style="display:flex;align-items:center;gap:10px;'
      + 'height:' + ROW_H + 'px;box-sizing:border-box;padding:0 12px;border-radius:2px;'
      + 'margin-bottom:6px;">' + inner + '</div>';
    /* ⚠ CAPTURED ONCE. The heading's count reads `needCap.shown.length`, so it is the number of rows
       actually rendered rather than the cap — with seven reds the card shows seven and says so. */
    const needCap = this._needsCapped(bandItems, 5);
    const needRows = needCap.shown.map(a => hbRow(
      '<span style="width:6px;height:6px;border-radius:50%;flex-shrink:0;background:'
      + (a.sev === 'bad' ? 'var(--red)' : 'var(--amber)') + ';"></span>'
      + '<span style="flex:1;min-width:0;font-size:12px;color:' + hbGrey + ';white-space:nowrap;'
      + 'overflow:hidden;text-overflow:ellipsis;cursor:pointer;" onclick="' + goOf(a) + '">'
      + esc(a.label || a.text || '') + '</span>'
      + (a.value ? '<span style="font-size:11px;color:var(--t3);white-space:nowrap;">' + esc(a.value) + '</span>' : '')
    )).join('');
    /* ⛔ THE TICK IS CLOSE THE WEEK'S TICK, NOT A THIRD SPELLING OF ONE. Kyle: *"the circle
       checkmarks on done this week are wrong.. should be like the checkmarks on the week close page..
       same style just smaller."* `week-close.js#row` FILLS the circle green with a knocked-out mark
       (`background:var(--green);color:var(--bg)`); mine was an outlined ring with a green glyph, a
       different object doing the same job on the two pages an operator moves between every week.
       Copied exactly, 22px -> 18px, and the empty state keeps that file's own hairline ring.
       ⚠ THE UNDONE RING USES `--b1`, NOT `--gold`. Close The Week golds an outstanding row because
       that page is a checklist you are working right now; the Hub is a read, and a gold ring there
       would nag about five jobs on a Monday morning ([[test-the-first-drop]] rule 4 — copy the
       REASON, not just the shape). */
    const doneRows = this._doneThisWeek().map(r => hbRow(
      (r.done
        ? '<span style="width:18px;height:18px;border-radius:50%;flex-shrink:0;display:flex;'
          + 'align-items:center;justify-content:center;background:var(--green);color:var(--bg);'
          + 'font-size:10px;font-weight:800;">&#10003;</span>'
        : '<span style="width:18px;height:18px;border-radius:50%;flex-shrink:0;'
          + 'border:1px solid var(--b1);"></span>')
      + '<span style="flex:1;min-width:0;font-size:12px;color:' + (r.done ? hbGrey : 'var(--t2)') + ';">'
      + esc(r.label) + '</span>'
      /* Kyle: *"need something in front of the dates like 'last done tue X/XX'."* A bare "Tue, 8/11"
         beside a job title reads as a due date as easily as a done date, and on this card it is
         always the latter. */
      /* ⚠ AND A ROW THAT HAS NOT HAPPENED SAYS SO. This was an empty string, so on a day-one Hub
         five rows carried a label and nothing else while the six facts below them all kept their
         captions — the same screen disagreeing with itself about whether an empty row keeps its
         second line. "Not yet" is scoped by the card's own heading, DONE THIS WEEK. */
      + '<span style="font-size:11px;color:var(--t3);white-space:nowrap;">'
      + (r.when ? 'Last done ' + esc(r.when) : 'Not yet') + '</span>'
    )).join('');

    // ── Band 5: six operational facts, one job each, every one a door ──
    const sectionStrip = this._sectionStrip(this._stripMetrics());

    const dateLine = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    /* ⭐ THE BAR NAME IN THE GREETING IS A SLOT, NOT A STRING (Kyle, 2026-08-23): *"single unit the
       hub stays as is.. multi unit the good afternoon, 'bar name' becomes.. good afternoon, Bar
       drop down selector."* The multi-bar picker used to live in the top bar and does not go there
       at all any more — `#hub-greet-account-switcher` is its only home.
       ⛔ IT RENDERS THE NAME BY DEFAULT AND IS *UPGRADED* IN PLACE. `App.renderAccountSwitcher` runs
       AFTER this render (see `showApp`/`showHub`) and swaps a picker in only when the operator has
       more than one bar — so a single-location account, the demo, and a FAILED account lookup all
       keep the name that is already correct on screen. Rendering an empty slot and waiting for the
       async member to fill it would flash blank on every Hub load and stay blank on the one failure
       where it matters.
       ⚠ The note lives out here rather than as an HTML comment inside the template: this is a
       template literal, and a backticked identifier inside it terminates the string. */
    const hubGrid = `<div class="hub-grid" style="display:grid;gap:18px;padding-bottom:18px;">
          <div style="display:flex;align-items:baseline;justify-content:space-between;gap:16px;flex-wrap:wrap;">
            <div class="hub-greet" style="font-size:19px;font-weight:700;color:${hbGrey};">${esc(this._greeting())}, <span id="hub-greet-account-switcher" class="hub-greet-bar">${esc(barName)}</span></div>
            <div style="font-size:12px;color:var(--t3);">${esc(dateLine)}</div>
          </div>
          <div class="hub-grid-tiles">${topCard}</div>
          <div class="hub-grid-row" style="display:grid;grid-template-columns:396px 1fr;gap:18px;align-items:stretch;">
            ${hbPanel(climbBlock)}${hbPanel(movementBlock)}
          </div>
          ${doFirstBand}
          <div class="hub-grid-row" style="display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:stretch;">
            ${bwCard('Your biggest gain', bw, 'gain', true)}${bwCard('Your worst drag', bw, 'drag', false)}
          </div>
          <div class="hub-grid-row" style="display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:stretch;">
            ${hbPanel(hbSh('Needs attention', this._needsMore(needCap.shown.length, bandItems.length)) + (needRows || (bandHasANumber
              ? '<div style="font-size:12px;color:var(--t2);">All clear. Nothing needs you outside your weekly close.</div>'
              /* ⛔ AN EMPTY `needRows` HAS TWO CAUSES AND ONLY ONE OF THEM IS GOOD NEWS. On a bar
                 with no data at all nothing CAN be flagged, and the old single fallback printed a
                 green all-clear over an operation nobody has looked at yet ([[the-loop]] #72 — a
                 count is only an all-clear if it could have counted anything). `bandHasANumber` is
                 the page's own answer to "is there anything to say", and it already decides whether
                 the top of the Hub shows the money band or Get started. */
              : '<div style="font-size:12px;color:var(--t2);">Nothing to flag yet. Once your sections are set up, what needs you shows here.</div>')))}
            ${hbPanel(hbSh('Done this week') + doneRows)}
          </div>
          <div class="hub-grid-row">${sectionStrip}</div>
        </div>`;

    // ── Compose ──
    // Reuses the same .app / .sidebar / .topbar / .content classes as the
    // module shells so the Hub sidebar matches them exactly in width, logo
    // area, collapse behavior, and visual styling. The .hub-app class adds
    // hub-specific overrides for the fixed-viewport dashboard layout.
    container.innerHTML = `
      <style>
        .hub-app{min-height:100% !important;}
        .hub-app .content{padding:var(--sp) 24px 24px;min-width:0;}
        @media (max-width:768px){.hub-app .content{padding:16px 14px 72px;}}
        .hub-app .nav-item.nav-disabled{cursor:default;opacity:0.45;}
        .hub-app .nav-item.nav-disabled:hover{background:transparent;}
        .hub-app .nav-item.nav-disabled .nav-icon{color:var(--t4);}
        .hub-app .hd-metric{background:var(--surface);padding:8px 10px;border:1px solid var(--b-edge);border-radius:var(--r);cursor:pointer;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:3px;transition:border-color 0.12s;}
        .hub-app .hd-metric:hover{border-color:var(--b-edge);}
        .hub-app .hd-row{cursor:pointer;}
        .hub-app .hd-arow{background:var(--zone);}
        /* ⛔⛔ NO ROW CHANGES COLOUR ON HOVER (Kyle, 2026-08-24: "on the hub both the needs
           attention and done this week rows highlight this weird color on mouseover... that needs
           removed on both. no rows should change background color on mouseover.")
           ⭐ IT WAS ONE RULE CAUSING BOTH, WHICH IS WHY IT LOOKED IDENTICAL IN THE TWO CARDS: the
           hbRow builder makes every row in Needs Attention AND in Done This Week, and both come out
           as .hd-arow. So there was one hover to delete, not two.
           ⛔ AND BOTH WERE LITERAL HEXES IN A SCREEN FILE (#0F1A21 and #13212A), which is the one
           thing the colour system forbids outright: they cannot follow the palette when Kyle
           retunes it, so a hover that looked right once drifts away from every surface around it
           and reads as a weird tint (color-system-locked). .hd-step was DEAD besides: nothing in
           this file renders that class, so its rule only ever styled nothing.
           ⚠ NO BACKTICKS ANYWHERE IN THIS COMMENT, AND THAT IS NOT A STYLE CHOICE: this block sits
           inside a TEMPLATE LITERAL, so a backtick ends the string and takes the whole file with it.
           It did exactly that on the first write of this note.
           ⚠ .hd-row above is dead too (no markup uses it) and is left alone deliberately: it is a
           cursor, not a colour, and deleting it is not what was asked for. */
        .hub-app .hd-prow{border-top:1px solid var(--b2);}
        .hub-app .hd-prow:first-child{border-top:none;}
        @media (max-width:768px){.hub-app .hub-stat-div{display:none;}}
        /* Phones (portrait AND landscape, up to ~960px): stack the section-card and
           Priority/Needs rows into one clean column instead of squeezing 3-across
           and colliding. Full desktop keeps 3-across. */
        @media (max-width:960px){.hub-app .hub-grid-row{grid-template-columns:1fr !important;}}
        /* Where-You-Stand numbers shrink by breakpoint, not viewport width, so a wide
           landscape phone gets the smaller size too (a vw scale would keep them big). */
        @media (max-width:960px){.hub-app .hub-wys-num{font-size:32px !important;}}
        @media (max-width:560px){.hub-app .hub-wys-num{font-size:27px !important;}}
        /* Card-internal scroll for list panels (alerts, PAI, weekly readout)
           when row count exceeds card height. Thin scrollbar so it does not
           visually overwhelm the small lists. */
        .hub-app .hd-scroll{overflow-y:auto;}
        .hub-app .hd-scroll::-webkit-scrollbar{width:6px;}
        .hub-app .hd-scroll::-webkit-scrollbar-track{background:transparent;}
        .hub-app .hd-scroll::-webkit-scrollbar-thumb{background:var(--b2);border-radius:3px;}
        .hub-app .hd-scroll::-webkit-scrollbar-thumb:hover{background:var(--b1);}
        /* Trend chart data point hover — the marker grows on hover so the
           interaction reads as "this dot does something." */
        .hub-app .hd-chart-marker{width:5px;height:5px;border-radius:50%;background:rgba(219,171,70,0.55);transition:width 0.12s ease,height 0.12s ease,background 0.12s ease;}
        .hub-app .hd-chart-dot:hover .hd-chart-marker{width:8px;height:8px;background:rgba(219,171,70,0.9);}
        /* Shared tooltip element used by all three mini charts. Lives as a
           sibling of .hub-app inside the wrapper, so the selector has no
           ancestor — otherwise display:block would force the empty div into
           flow and ratchet the dashboard. */
        #hd-chart-tip{
          position:fixed;z-index:200;pointer-events:none;display:none;
          background:var(--surface);border:1px solid var(--b-edge);border-radius:5px;
          padding:8px 12px;min-width:140px;
          font-family:Barlow,sans-serif;font-size:11px;color:var(--t1);
          box-shadow:0 4px 14px rgba(0,0,0,0.45);
        }
      </style>
      <div id="hd-chart-tip"></div>
      <div class="app hub-app${collapsedClass}">
        <aside class="sidebar">
          <div class="sidebar-logo">
            <img src="assets/logo.png" alt="Bar Cop" class="sidebar-logo-full"/>
            <img src="assets/bar-graph-icon.png" alt="Bar Cop" class="sidebar-logo-icon"/>
            <button class="sidebar-logo-toggle" id="hub-sidebar-toggle" title="Toggle sidebar">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="1.5" rx="0.75" fill="currentColor"/><rect x="2" y="7.25" width="12" height="1.5" rx="0.75" fill="currentColor"/><rect x="2" y="11.5" width="12" height="1.5" rx="0.75" fill="currentColor"/></svg>
            </button>
            <button class="sidebar-mobile-close" id="hub-sidebar-mobile-close" aria-label="Close sidebar" type="button">&times;</button>
          </div>
          <div class="sidebar-multi-loc" id="hub-sidebar-multi-loc"></div>
          <nav class="sidebar-nav">${sidebarNav}</nav>
          <div class="sidebar-footer">
            <button class="sidebar-btn" id="hub-signout">
              <svg class="nav-icon" viewBox="0 0 17 17" fill="none">${navIcons.signout}</svg>
              <span class="sidebar-btn-label">${App.demoMode ? 'Exit Demo' : 'Sign Out'}</span>
            </button>
          </div>
        </aside>
        <div class="main">
          <header class="topbar">
            <div class="topbar-left">
              <button class="topbar-hamburger" id="hub-topbar-hamburger" aria-label="Open sidebar" type="button">
                <svg viewBox="0 0 17 17" fill="none"><rect x="2" y="4" width="13" height="1.5" rx="0.75" fill="currentColor"/><rect x="2" y="8" width="13" height="1.5" rx="0.75" fill="currentColor"/><rect x="2" y="12" width="13" height="1.5" rx="0.75" fill="currentColor"/></svg>
              </button>
              <h1 class="topbar-title">${esc(barName)}</h1>
            </div>
            <div id="hub-topbar-account-switcher" style="display:none;"></div>
            <div class="topbar-right"></div>
          </header>
          <main class="content">
            ${hubGrid}
          </main>
        </div>
        <div class="sidebar-backdrop" id="hub-sidebar-backdrop"></div>
      </div>
    `;

    // Default sidebar active state on the Hub Dashboard view.
    if (App.setActiveHubNav) App.setActiveHubNav('hub-home');

    /* ⛔ THE BRIEFING MOUNT AND ITS ALIGNMENT PASS ARE GONE WITH THE BUTTON. The rAF block sized the
       Operations Audit cell's right margin to the Briefing button's width so the two right edges lined
       up; with no button to measure it would have shifted the cell by the slot's zero width, which
       is a silent layout change rather than an error. Delete the measurement with the thing it
       measured. */
    /* ── Get Started: hide (reversible) and dismiss (not) ────────────────────────────────────
       ⛔ THE RE-RENDER IS THE WHOLE POINT OF DOING THIS IN THE WIRE STEP. Both controls change what
       the card is, so both have to repaint it; a handler that saves and leaves the old markup on
       screen reads as the button doing nothing. */
    document.getElementById('hub-gs-hide')?.addEventListener('click', async () => {
      await this._gsSet(this._gsState() === 'hidden' ? 'open' : 'hidden');
    });
    document.getElementById('hub-gs-dismiss')?.addEventListener('click', async () => {
      /* ⚠ THE WARNING NAMES WHAT IS LOST AND THAT IT IS FOREVER. Kyle's call: no restore row in
         Settings, the same bar as anything else destructive here. Hide is offered in the prompt
         because it is the answer for anyone who only wanted it out of the way. */
      /* ⚠ AN OPTIONS OBJECT, not positional arguments. Written `App.confirm(title, body, ok, cancel)`
         first, which passes a STRING where `opts` is read — every field would have come back
         undefined and the dialog would have said "Are you sure?" over a blank message with a
         Confirm button. Copied from a real call site rather than guessed. */
      const ok = await App.confirm({
        title: 'Remove Get Started for good?',
        message: 'These steps will not come back. If you just want them out of the way, use Hide instead.',
        confirmText: 'Remove', cancelText: 'Cancel'
      });
      if (ok) await this._gsSet('dismissed');
    });
    // ── Wire sign-out, sidebar toggle, sidebar nav clicks, recovery target ──
    document.getElementById('hub-signout')?.addEventListener('click', async () => {
      if (App.demoMode) { window.location.href = '/'; return; }
      await DB.signOut();
    });


    document.getElementById('hub-sidebar-toggle')?.addEventListener('click', () => {
      this._sidebarCollapsed = !this._sidebarCollapsed;
      container.querySelector('.hub-app')?.classList.toggle('sidebar-collapsed');
    });

    // Mobile sidebar toggle: hamburger opens the off-canvas sidebar, backdrop
    // click closes it. Tapping any nav item also closes the sidebar so the
    // operator does not have to reach back for the close button after
    // navigating. Only relevant below the 768px breakpoint.
    const hubApp = container.querySelector('.hub-app');
    const closeHubMobileSidebar = () => hubApp?.classList.remove('sidebar-open');
    document.getElementById('hub-topbar-hamburger')?.addEventListener('click', () => {
      hubApp?.classList.toggle('sidebar-open');
    });
    document.getElementById('hub-sidebar-backdrop')?.addEventListener('click', closeHubMobileSidebar);
    document.getElementById('hub-sidebar-mobile-close')?.addEventListener('click', closeHubMobileSidebar);

    const navEl = container.querySelector('.sidebar-nav');
    if (navEl) navEl.addEventListener('click', (ev) => {
      const item = ev.target.closest('.nav-item');
      if (!item || item.classList.contains('nav-disabled')) return;
      // Close the mobile sidebar after the click so the navigated screen has
      // full width to render. No-op on desktop where the class is never set.
      closeHubMobileSidebar();
      this.routeSidebarAction(item);
    });
    // Trend chart data point hover — populate and position the shared
    // tooltip with the dot's week, value, status, and target.
    const tip = container.querySelector('#hd-chart-tip');
    if (tip) {
      const bandText = { good: 'on target', warn: 'watch', bad: 'off target' };
      const bandCol  = { good: 'var(--green)', warn: 'var(--amber)', bad: 'var(--red)' };
      container.querySelectorAll('.hd-chart-dot').forEach(g => {
        g.addEventListener('mouseenter', () => {
          const r  = g.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          const b  = g.dataset.band || 'none';
          const col = bandCol[b] || 'var(--t1)';
          tip.innerHTML =
              '<div style="font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--t3);">Week Ending ' + g.dataset.date + '</div>'
            + '<div style="display:flex;align-items:baseline;gap:10px;margin-top:5px;">'
            +   '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:20px;font-weight:700;color:' + col + ';line-height:1;">' + g.dataset.disp + '</div>'
            +   (bandText[b] ? '<div style="font-size:9px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:' + col + ';">' + bandText[b] + '</div>' : '')
            + '</div>'
            + '<div style="font-size:10px;color:var(--t3);margin-top:4px;">Target ' + g.dataset.tgt + '</div>';
          tip.style.left = cx + 'px';
          tip.style.top  = (cy - 12) + 'px';
          tip.style.transform = 'translate(-50%, -100%)';
          tip.style.display = 'block';
        });
        g.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
      });
    }

  },

  // Route from a Hub Dashboard click (alerts, tiles, PAI, readout). When
  // module === 'hub', the screen value is a Hub-level screen key handled
  // inline (no module shell); everything else routes to the module shell.
  _enter(screen, module) {
    if (module === 'hub') {
      // Hub-owned pages self-gate via App._hubBlocked in their own open().
      if (screen === 'permits' && S.HubPermits)              { S.HubPermits.open(); return; }
      if (screen === 'operating-expenses' && S.HubOperatingExpenses) { S.HubOperatingExpenses.open(); return; }
      if (screen === 'bar-cop-audit' && S.HubBarCopAudit)    { S.HubBarCopAudit.open(); return; }
    }
    // Gate BEFORE showApp so a locked target shows the notice and never swaps
    // the section shell behind it (Priority Actions / Needs Attention route here).
    if (!App.canAccess(screen)) { App.showNoAccess(); return; }
    App.showApp(module || 'profit');
    App.navigate(screen);
  },

  /* Deep-link from the Hub's money tiles and the weekly readout into a module's RECOVERY page.
     ⛔⛔ THAT PAGE IS THE AUDIT NOW, NOT A FIX SCREEN (Kyle, 2026-08-23). The Fix systems are being
     taken out of the operator's view — measured first: their checklist writes nothing any consumer
     reads, and the recovered dollars are computed by `Recovery.compute` from confirmed weeks, not
     from anything a step does. The audits are where the recovery numbers live now.
     ⭐ ONE ACCESSOR, FOUR CALL SITES. Re-pointing here moves all three hero tiles and the readout
     row at once; the alternative was four hand-typed destinations, which is the drift the original
     comment on this member was already warning about.
     ⚠ RENAMED. It was `_enterFix`, and a name that says Fix while opening an audit is a false claim
     in the loudest possible place — every reader of every call site takes it on trust
     ([[lessons-paid-for]] #99, where the wrong fact was in a constant's NAME).
     ⚠ THE `gapId` ARGUMENT IS GONE. It set `App._fixFocus`, which only a Fix screen ever read. The
     audits list every gap they surfaced, so landing on the page IS landing on the gap; carrying a
     focus nothing consumes would be a field written and never read ([[the-loop]] #25). */
  _enterRecovery(module) {
    const scr = module === 'revenue' ? 'r-audit'
              : module === 'cash' ? 'c-audit'
              : 'audit-tracker';
    // Gate BEFORE showApp (see _enter) so a locked audit never swaps the shell.
    if (!App.canAccess(scr)) { App.showNoAccess(); return; }
    App.showApp(module || 'profit');
    App.navigate(scr);
  },

  /* ⚠ A NEEDS ATTENTION ROW NAMES AN ITEM, SO IT HAS TO LAND ON THAT ITEM. These two rows name
     a specific person or permit — "ServSafe Food Handler for Hector M. expired 13d ago" — and
     both landed on the destination screen scrolled to its inline ADD form, with the named record
     somewhere down the list. The operator pressed a row about Hector and got a blank New Staff
     form. Meanwhile the module cards on the SAME Hub deep-link to their exact step, so the page
     was already doing this correctly eight inches away.
     Same shape as _enterFix directly above, and both reuse a door the destination already owns:
     the roster's own staff page (profile + Certifications) and the Permits screen's own filter.
     No new mechanism, nothing visual. */
  /* ⭐ App._staffFocus ALREADY EXISTED with two callers (lc-reports, lc-training) and the roster
     already honours it and self-clears. The contract is an OBJECT — `{ staff_id }` — and my first
     version set a bare string, which would have matched nothing and silently landed on the list
     exactly as before. Grep the NAME of any mechanism you are about to invent ([[the-loop]] #95);
     here the mechanism was already built and the Hub simply was not using it. */
  _enterStaff(staffId) {
    if (!App.canAccess('lc-staff-roster')) { App.showNoAccess(); return; }
    App.showApp('labor');
    if (staffId) App._staffFocus = { staff_id: staffId };
    App.navigate('lc-staff-roster');
  },
  _enterPermits(filter) {
    if (!S.HubPermits) return;
    // 'expired' and 'due' are the screen's own filter values; anything else falls back to all.
    if (filter) S.HubPermits._filter = filter;
    S.HubPermits.open();
  },
  /* ⭐ THE SAME RULE AS THE TWO ABOVE, THIRD INSTANCE. "Spot checks to review" names checks that
     are already SAVED, and `ic-spot-check.render()` opens a blank NEW check, so the plain screen
     landing put the operator in front of an empty form with the thing they pressed for two
     presses away. The screen's HISTORY view is where those checks live and it already exists --
     `#sp-history` opens it through `App.pushView` -- so this reuses a door the destination owns
     rather than inventing one, exactly as `_enterStaff` and `_enterPermits` do.
     ⚠ ONE-SHOT, CLEARED BY THE READER, which is this app's convention for a cross-screen focus
     (`App._staffFocus`, `App._menuItemFocus`, `App._evBookingFocus` all work this way). A focus
     that outlived its visit would send an operator to History every time they opened the screen
     to take a check ([[the-loop]] #25 -- grep who NULLS a field, not just who reads it).
     ⚠ GATE BEFORE `showApp`, same as `_enter` and `_enterRecovery`: a locked target must show the
     notice without swapping the section shell behind it. */
  _enterSpotChecks() {
    if (!App.canAccess('ic-spot-check')) { App.showNoAccess(); return; }
    App._spotCheckFocus = true;
    App.showApp('inventory');
    App.navigate('ic-spot-check');
  },

  /* ── The Hub's data reads, lifted OUT of render() so The Rail can use them ──────────────────
     ⛔ WHY THESE ARE MEMBERS AND NOT LOCALS ANY MORE. The Rail button sits in the TOP BAR, so it
     is on every page — including the one an operator lands on cold from a bookmark or a refresh.
     The briefing snapshot used to be assembled inline at the end of `render()`, which means it
     only existed after the Hub had drawn. Pressed anywhere else, the briefing would have read an
     empty object and printed a thin, confident-sounding page that was missing most of the bar.
     That is worse than an error, because nothing looks wrong.
     ⭐ AND THEY ARE EXTRACTED, NOT COPIED. render() calls these too, so there is ONE implementation
     of "what are the key metrics" and ONE of "what is on the alert list". A second copy computed
     for the briefing would drift from the dashboard the first time either was edited, and the
     snapshot's whole promise is that the written read never contradicts the displayed numbers. */

  // The newest record in a list, by date. Event logs load date-desc, so "latest" cannot be
  // assumed to be the last array element — this is render()'s own `last`, shared rather than twinned.
  _newestOf(a) {
    const rd = r => ((r && (r.date || r.period_end || r.generated_at || r.saved_at || r.created_at)) || '') + '';
    return (a && a.length) ? a.slice().sort((x, y) => rd(y).localeCompare(rd(x)))[0] : null;
  },

  // The five key metrics with their targets and status band. Same shape render() puts on screen.
  hubMetrics() {
    const data = App.data || {};
    const s  = data.settings || {};
    const pt = s.targets || {};
    const rt = (data.revenue_settings || {}).targets || {};
    const pW = this._newestOf(data.weeks || []);
    // ⚠ The revenue-week filter is part of the question, not a tidy-up: a week with no revenue on
    // either side is not a week that can carry a check average. render() filters identically.
    const rW = this._newestOf((data.revenue_weeks || []).filter(w => (w.bar_revenue || 0) + (w.floor_revenue || 0) > 0));
    const band = (val, target, dir) => {
      if (val == null) return 'none';
      if (dir === 'low') return val <= target ? 'good' : val <= target * 1.1 ? 'warn' : 'bad';
      return val >= target ? 'good' : val >= target * 0.9 ? 'warn' : 'bad';
    };
    const pourT = pt.bar_pour_cost_pct ?? 22;
    const foodT = pt.food_cost_pct ?? 32;
    const primeT = pt.prime_cost_pct ?? 60;
    const caT = rt.check_avg ?? 35;
    const laborT = App.laborTargetPct();
    return [
      { label:'Bar Pour Cost', val: pW?.bar?.cost_pct ?? null, disp: pW?.bar?.cost_pct!=null?App.fmtPct(pW.bar.cost_pct):null, tgt: pourT+'%', status: band(pW?.bar?.cost_pct ?? null, pourT, 'low') },
      { label:'Food Cost', val: pW?.food?.cost_pct ?? null, disp: pW?.food?.cost_pct!=null?App.fmtPct(pW.food.cost_pct):null, tgt: foodT+'%', status: band(pW?.food?.cost_pct ?? null, foodT, 'low') },
      { label:'Prime Cost', val: pW?.prime_cost_pct ?? null, disp: pW?.prime_cost_pct!=null?App.fmtPct(pW.prime_cost_pct):null, tgt: primeT+'%', status: band(pW?.prime_cost_pct ?? null, primeT, 'low') },
      { label:'Check Average', val: rW?.check_avg ?? null, disp: rW?.check_avg!=null?App.fmtCurrency(rW.check_avg):null, tgt: App.fmtCurrency(caT), status: band(rW?.check_avg ?? null, caT, 'high') },
      { label:'Labor %', val: rW?.labor_pct_blended ?? null, disp: rW?.labor_pct_blended!=null?App.fmtPct(rW.labor_pct_blended):null, tgt: laborT+'%', status: band(rW?.labor_pct_blended ?? null, laborT, 'low') },
    ];
  },

  // Metric breaches + forward-looking signals + audit-state alerts, worst first.
  hubAlerts(metrics) {
    const data = App.data || {};
    metrics = metrics || this.hubMetrics();
    const sevRank = { bad: 0, warn: 1 };
    const metricAlerts = metrics
      .filter(m => m.status === 'warn' || m.status === 'bad')
      .map(m => ({ sev: m.status, label: m.label, value: m.disp + ' / ' + m.tgt,
        text: m.label + ' at ' + m.disp + ' · target ' + m.tgt }));
    /* Audit-based alerts so "All Clear" is honest: a recovery audit scoring below target, or one
       overdue / never run, is a real open item. Action items are NOT dumped here; they have their
       own Priority panel. */
    const auditAlerts = [];
    [ { name:'Profit',  a: this._newestOf(data.audits || []),         screen:'audit-tracker', mod:'profit' },
      { name:'Revenue', a: this._newestOf(data.revenue_audits || []), screen:'r-audit',       mod:'revenue' },
      { name:'Cash',    a: this._newestOf(data.cash_audits || []),    screen:'c-audit',       mod:'cash' }
    ].forEach(d => {
      if (!d.a) { auditAlerts.push({ sev:'warn', label: d.name + ' audit', value: 'not run', text: d.name + ' audit not run yet', screen: d.screen, mod: d.mod }); return; }
      const score = d.a.overall_score;
      const target = (d.a.raw && d.a.raw.TARGET_SCORE) || 70;
      if (score != null && score < target) {
        auditAlerts.push({ sev: score < target - 10 ? 'bad' : 'warn', label: d.name + ' audit', value: score + ' / ' + target + '+', text: d.name + ' audit at ' + score + ' · target ' + target + '+', screen: d.screen, mod: d.mod });
      }
      const days = d.a.date ? Math.floor((Date.now() - new Date(d.a.date + 'T00:00:00').getTime()) / 86400000) : null;
      if (days != null && days > 30) {
        auditAlerts.push({ sev:'warn', label: d.name + ' audit', value: 'last run ' + days + 'd', text: d.name + ' audit last run ' + days + ' days ago, run a fresh one', screen: d.screen, mod: d.mod });
      }
    });
    return metricAlerts.concat(this.forwardAlerts()).concat(auditAlerts)
      .sort((a, b) => sevRank[a.sev] - sevRank[b.sev])
      .slice(0, 50);
  },

  /* THE RAIL's snapshot. Computed from App.data on demand, so it is correct from any page and is
     never staler than the moment it is asked. ⚠ It must keep mirroring what the Hub displays —
     that is the whole reason the written read can be trusted — which is why it reads the same
     hubMetrics() / hubAlerts() / weeklyReadout() the Hub itself renders from. */
  briefingSnapshot() {
    const data = App.data || {};
    const s = data.settings || {};
    const pA = this._newestOf(data.audits || []);
    const rA = this._newestOf(data.revenue_audits || []);
    const cA = this._newestOf(data.cash_audits || []);
    const bcA = this._newestOf(data.bar_cop_audits || []);
    const auditOpp = a => a ? (a.action_items || []).reduce((sum, x) => sum + (x.monthly_impact || 0), 0) : 0;
    // A scored audit in any system, not merely a recorded run: an estimate-only audit records N/A.
    const anyAudit = [].concat(data.audits || [], data.revenue_audits || [], data.cash_audits || [])
      .some(a => a && a.overall_score != null);
    const recoveryTotal = window.Recovery ? Recovery.total() : { dollars: 0, fixes: 0 };
    const readout = this.weeklyReadout();
    const metrics = this.hubMetrics();
    const alerts = this.hubAlerts(metrics);
    return {
      /* ⛔⛔ `sections:` IS GONE (2026-08-11, Kyle: *"drop the paragraph"*). It walked all eight
         section objects calling `hubSteps()` and handed The Rail a done/total per section. Every
         one of those counts came off a MANUAL TICK MAP — 32 steps across the cockpits, 31 of them
         checkboxes nothing downstream read — so the briefing was reporting how many boxes had been
         pressed as if it were a read on the bar.
         ⭐ AND IT WAS `hubSteps()`'s ONLY CALLER IN THE TREE. Removing it retires that member on all
         eight objects at once, which is what makes deleting the six cockpits a file removal: this
         was their last surviving reader outside Week in Review. */
      bar: s.bar_name || 'Your Operation',
      opportunity: anyAudit ? (auditOpp(pA) + auditOpp(rA) + auditOpp(cA)) : null,
      recovered: recoveryTotal.dollars,
      fixes: recoveryTotal.fixes,
      audits: {
        profit:  pA ? pA.overall_score : null,
        revenue: rA ? rA.overall_score : null,
        cash:    cA ? cA.overall_score : null,
        barCop:  bcA ? bcA.overall_score : null,
        target:  (pA && pA.raw && pA.raw.TARGET_SCORE) || 70
      },
      weekly: {
        leak: readout.leakTotal,
        opp:  readout.oppTotal,
        items: (readout.items || []).slice(0, 6).map(it => ({ label: it.label, weekly: it.weekly, module: it.module }))
      },
      metrics: metrics.map(m => ({ label: m.label, val: m.disp, target: m.tgt, status: m.status })),
      critical: alerts.filter(a => a.sev === 'bad').map(a => a.text).slice(0, 8)
    };
  },

  /* Weekly money readout (Section 10.3) — what is leaking this week, where, and
     biggest first. Profit and Revenue read live from Recovery.gapImpact (same
     engine the dashboards use). A gap-area only counts when its weekly dollar
     loss computes from real data. Cash's opportunity is a one-time trapped
     amount, not a weekly leak, so it lives on the Cash screens, not here. */
  weeklyReadout() {
    /* ⛔ THE GAP LIST MOVED. This read `window.FIX`, which the three fixlayer files built, and
       returned an empty readout without it — so deleting them would have emptied this block in
       silence, on The Rail's briefing, which is on every page. `Recovery.START_GAPS` is the same
       list at its permanent home: measured before the swap, profit 5 of 5 and revenue 6 of 6 ids
       identical, and the only property read off a gap here is `id`. */
    if (!window.Recovery || !Recovery.START_GAPS) return { items: [], total: 0, leakTotal: 0, oppTotal: 0 };
    const seen = {};
    const items = [];
    // Split honestly (decision 2): a cost gap is a recoverable LEAK; everything
    // else is projected REVENUE opportunity. labor-scheduling is a cost gap even
    // though it lives in the Revenue audit, so we categorize by gap, not module.
    const kindOf = (gapId) => (Recovery.COST_GAPS || []).indexOf(gapId) !== -1 ? 'cost' : 'revenue';

    // Profit + Revenue — live metric-based
    [['profit'], ['revenue']].forEach(([mod]) => {
      (Recovery.START_GAPS[mod] || []).forEach(g => {
        if ((Recovery.COMPOSITE_GAPS || []).indexOf(g.id) !== -1) return;   // skip composite (double-count)
        const imp = Recovery.gapImpact(g.id);
        if (!imp || imp.onTarget || !(imp.dollars > 0)) return;
        if (seen[imp.label]) return;
        seen[imp.label] = true;
        items.push({ label: imp.label, gapId: g.id, module: mod, kind: kindOf(g.id),
                     weekly: imp.dollars / 52, band: imp.band });
      });
    });

    items.sort((a, b) => b.weekly - a.weekly);
    const leakTotal = items.filter(x => x.kind === 'cost').reduce((s, x) => s + x.weekly, 0);
    const oppTotal  = items.filter(x => x.kind === 'revenue').reduce((s, x) => s + x.weekly, 0);
    return { items: items, total: items.reduce((s, x) => s + x.weekly, 0), leakTotal: leakTotal, oppTotal: oppTotal };
  },

  /* Forward-looking alerts (Section 10.4) — predictive signals, not just
     historical breaches. Each fires only when the data to compute it exists,
     never on a fabricated projection. They feed the same Hub alert strip. */
  forwardAlerts() {
    const data = App.data || {};
    const out = [];
    // Event stores load newest-first; sort defensively by date DESC so the
    // latest week is index 0 regardless of source order (event-store gotcha).
    const _byDateDesc = a => a.slice().sort((x, y) =>
      String((y && (y.period_end || y.date)) || '').localeCompare(String((x && (x.period_end || x.date)) || '')));
    const iso = d => App.ymdLocal(d);
    const mondayOf = d => { const x = new Date(d); const day = x.getDay();
      x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day)); return iso(x); };

    // 1. Projected overtime — current week, lc_actuals projected against lc_schedules
    const ld = App.laborData || {};
    const ws = mondayOf(new Date());
    const weEnd = (() => { const d = new Date(ws + 'T00:00:00'); d.setDate(d.getDate() + 6); return iso(d); })();
    const wkActuals = (ld.lc_actuals || []).filter(a => a.date >= ws && a.date <= weEnd);
    // Newest wins if a week ever carries two schedules (see cash-engine.laborForWeek).
    // This drives an alert the operator acts on, so it takes the same picker as
    // Overtime Watch / Log Hours / the Call-Out Log, not first-in-array.
    const sched = (ld.lc_schedules || []).filter(s => {
      if (!s.week_start) return false;
      const st = new Date(s.week_start + 'T00:00:00').getTime();
      const tg = new Date(ws + 'T00:00:00').getTime();
      return !isNaN(st) && tg >= st && tg <= st + 6 * 86400000;
    }).sort(App.cmpNewest)[0];
    const otMap = {};
    wkActuals.forEach(a => { const id = a.staff_id || a.name;
      (otMap[id] = otMap[id] || { actual: 0, scheduled: 0, wage: a.wage, name: a.name }).actual += (a.hours || 0); });
    if (sched) (sched.shifts || []).forEach(sh => { const id = sh.staff_id || sh.name;
      (otMap[id] = otMap[id] || { actual: 0, scheduled: 0, name: sh.name }).scheduled += (sh.hours || 0); });
    let otCount = 0, otCost = 0;
    Object.keys(otMap).forEach(id => {
      const e = otMap[id];
      const st = (ld.lc_staff || []).find(s => s.id === id);
      // Exempt (salaried) staff cannot earn an OT premium, so they must not appear in an OT alert —
      // the canonical projection (lc-dashboard.weekProjection) skips them; this re-derivation didn't,
      // so a salaried GM logging 50h showed as "1 staff over 40 hours · ~$X premium" they can't earn.
      if (st && App.isSalaried(st)) return;
      const wage = st && st.wage != null ? st.wage : (e.wage || 0);
      const otHrs = Math.max(0, Math.max(e.actual, e.scheduled) - 40);
      if (otHrs > 0) { otCount++; otCost += otHrs * wage * 0.5; }
    });
    if (otCount > 0) out.push({
      sev: otCount >= 3 ? 'bad' : 'warn',
      label: 'Overtime projected', value: otCount + ' staff · ~' + App.fmtCurrency(otCost, 0),
      text: 'Overtime projected: ' + otCount + ' staff over 40 hours this week, about ' + App.fmtCurrency(otCost, 0) + ' in extra OT premium.',
      screen: 'lc-overtime-watch', mod: 'labor'
    });

    // 2. Projected month-end prime cost — latest week's pace held to month end
    const weeks = _byDateDesc(data.weeks || []);
    const lw = weeks.length ? weeks[0] : null;
    const primeT = ((data.settings || {}).targets || {}).prime_cost_pct ?? 60;
    if (lw && lw.prime_cost_pct != null && lw.prime_cost_pct > primeT) {
      const gap = lw.prime_cost_pct - primeT;
      // prime_cost_pct is measured against TOTAL sales (bar + food + catering + ancillary — see
      // confirm-week), so the dollarized overage must use that SAME base. Bar+food only understated
      // "the month closes about $X over" by the catering + ancillary share of sales.
      const monthlyRev = (((lw.bar || {}).revenue || 0) + ((lw.food || {}).revenue || 0)
        + ((lw.catering || {}).revenue || 0) + ((lw.other || {}).revenue || 0)) * 4.345;
      const monthlyOver = (gap / 100) * monthlyRev;
      out.push({
        sev: gap > 3 ? 'bad' : 'warn',
        label: 'Prime cost over target', value: lw.prime_cost_pct.toFixed(1) + '% / ' + primeT + '%',
        text: 'Prime cost is tracking at ' + lw.prime_cost_pct.toFixed(1) + '%, ' + gap.toFixed(1) + ' points over your ' + primeT + '% target. Hold this pace and the month closes about ' + App.fmtCurrency(monthlyOver, 0) + ' over.',
        /* ⚠ THE PROFIT AUDIT, NOT THE FIX SYSTEM (2026-08-23). This row names prime cost over
           target, and the audit is where that reading is surfaced and explained — it renders a
           prime-cost context card for exactly this. The Fix system it used to open is leaving the
           operator's view, and a row that names an item has to land on that item. */
        screen: 'audit-tracker', mod: 'profit'
      });
    }

    // 4. Recurring cash shortages — repeated shorts in recent drawer counts
    // (Shift Control sc_variances, the owner of cash data).
    const variances = (App.shiftData || {}).sc_variances || [];
    if (variances.length >= 2) {
      // ⚠ SORT BEFORE SLICING. db.js loads events newest-first, but every write APPENDS
      // (App.putRecord does arr.push), so after importing this week's reconciles the new rows sit at
      // the END and slice(0,6) read LAST week's — firing a red "cash came up short in 3 of the last
      // 6 counts" about a week already closed, or staying silent through a bad week. Ninth time this
      // ordering class has bitten; _byDateDesc is defined sixty lines above, in this same function.
      const recent = _byDateDesc(variances).slice(0, 6);
      const shorts = recent.filter(r => r.status === 'Short').length;
      if (shorts >= 2) out.push({
        sev: shorts >= 3 ? 'bad' : 'warn',
        label: 'Cash shortages, recurring', value: shorts + ' of ' + recent.length + ' counts',
        text: 'Cash came up short in ' + shorts + ' of the last ' + recent.length + ' drawer counts. Recurring shortages point to a process gap, not a one-off.',
        screen: 'cash-recon', mod: 'profit'
      });
    }

    // 4d. Cash crunch — the 13-week survival forecast runs the account to zero or
    // thin. The most urgent thing Bar Cop can surface: a profitable bar that runs
    // out of cash still closes the doors. Runway-to-zero fires the top-severity
    // alert; a dip under the reserve or a stretch of tight weeks warns.
    if (window.CashEngine) {
      try {
        const sf = CashEngine.survivalForecast(13);
        if (sf && sf.hasData) {
          const low = sf.lowPoint;
          const wk = low ? new Date(low.ws + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
          if (sf.hasOpening && sf.runway != null) {
            out.push({
              sev: 'bad',
              label: 'Cash crunch ahead', value: 'runway ' + (sf.runway === 0 ? '~1 wk' : sf.runway + ' wk' + (sf.runway === 1 ? '' : 's')),
              text: 'Cash crunch ahead: your account runs dry in about ' + (sf.runway === 0 ? 'a week' : sf.runway + ' week' + (sf.runway === 1 ? '' : 's')) + (low ? ', bottoming out the week of ' + wk + ' at ' + App.fmtCurrency(low.balance, 0) : '') + '. Free trapped cash and move a payment now.',
              screen: 'c-forecast', mod: 'cash'
            });
          } else if (sf.hasOpening && low && CashEngine.reserveTarget() > 0 && low.balance >= 0 && low.balance < CashEngine.reserveTarget()) {
            out.push({
              sev: 'warn',
              label: 'Cash dips under reserve', value: 'wk of ' + wk,
              text: 'Cash dips under your reserve the week of ' + wk + ', down to ' + App.fmtCurrency(low.balance, 0) + '. Hold payments to their due dates and free trapped cash to keep the cushion.',
              screen: 'c-forecast', mod: 'cash'
            });
          } else if (!sf.hasOpening && sf.tightWeeks >= 2) {
            out.push({
              sev: 'warn',
              label: 'Tight weeks ahead', value: sf.tightWeeks + ' of 13',
              text: sf.tightWeeks + ' of the next 13 weeks have more cash going out than coming in. Set your opening balance in Cash Position to see your real runway.',
              screen: 'c-position', mod: 'cash'
            });
          }
        }
      } catch (e) {}
    }

    // 4b. Permits and licenses coming due — pulled from the Permits and
    // Compliance log. Expired or due within 14 days = critical; within 30 = warn.
    const permits = data.permits_compliance || [];
    permits.forEach(p => {
      if (!p || !p.renewal_date) return;
      const d = new Date(String(p.renewal_date).length <= 10 ? p.renewal_date + 'T00:00:00' : p.renewal_date);
      if (isNaN(d.getTime())) return;
      const days = Math.floor((d.getTime() - Date.now()) / 86400000);
      if (days < 0) {
        out.push({
          sev: 'bad',
          label: (p.name || 'Permit'), value: 'expired ' + Math.abs(days) + 'd ago',
          text: (p.name || 'Permit') + ' expired ' + Math.abs(days) + ' day' + (Math.abs(days)===1?'':'s') + ' ago. Review and renew right away.',
          screen: 'sc-licensing', mod: 'shift', go: "S.Hub._enterPermits('expired')"
        });
      } else if (days <= 14) {
        out.push({
          sev: 'bad',
          label: (p.name || 'Permit'), value: 'renew in ' + days + 'd',
          text: (p.name || 'Permit') + ' renewal due in ' + days + ' day' + (days===1?'':'s') + '. Mark Renewed once paid, and log what it cost with the rest of your money out.',
          screen: 'sc-licensing', mod: 'shift', go: "S.Hub._enterPermits('due')"
        });
      } else if (days <= 30) {
        out.push({
          sev: 'warn',
          label: (p.name || 'Permit'), value: 'due in ' + days + 'd',
          text: (p.name || 'Permit') + ' renewal due in ' + days + ' days. Get the check or card ready.',
          screen: 'sc-licensing', mod: 'shift', go: "S.Hub._enterPermits('due')"
        });
      }
    });

    // 4c. Staff certifications expiring soon — pulled from Labor Control's
    // certifications log. Expired or due within 14 days = critical; within 30 = warn.
    const certs = (App.laborData && App.laborData.lc_certs) || [];
    const lcStaff = (App.laborData && App.laborData.lc_staff) || [];
    certs.forEach(c => {
      if (!c || !c.expiration_date) return;
      const d = new Date(String(c.expiration_date).length <= 10 ? c.expiration_date + 'T00:00:00' : c.expiration_date);
      if (isNaN(d.getTime())) return;
      const days = Math.floor((d.getTime() - Date.now()) / 86400000);
      const certType = c.cert_type || c.cert_name || c.name || 'Certification';
      const certWho = (lcStaff.find(s => s.id === c.staff_id) || {}).name || c.staff_name || '';
      const certLabel = certType + (certWho ? ' for ' + certWho : '');
      // The row names a PERSON, so it opens that person's page, where their Certifications
      // live. A cert with no staff link falls back to the roster itself.
      const certGo = c.staff_id ? "S.Hub._enterStaff('" + c.staff_id + "')" : null;
      if (days < 0) {
        out.push({
          sev: 'bad',
          label: certLabel, value: 'expired ' + Math.abs(days) + 'd ago',
          text: certLabel + ' expired ' + Math.abs(days) + ' day' + (Math.abs(days)===1?'':'s') + ' ago. Not current until renewed.',
          screen: 'lc-staff-roster', mod: 'labor', go: certGo
        });
      } else if (days <= 14) {
        out.push({
          sev: 'bad',
          label: certLabel, value: 'expires in ' + days + 'd',
          text: certLabel + ' expires in ' + days + ' day' + (days===1?'':'s') + '. Schedule renewal now.',
          screen: 'lc-staff-roster', mod: 'labor', go: certGo
        });
      } else if (days <= 30) {
        out.push({
          sev: 'warn',
          label: certLabel, value: 'expires in ' + days + 'd',
          text: certLabel + ' expires in ' + days + ' days. Renewal window opens soon.',
          screen: 'lc-staff-roster', mod: 'labor', go: certGo
        });
      }
    });

    // 4d. Urgent maintenance still open — pulled from Shift Control's Maintenance
    // Log. An Urgent issue that has not been Resolved carries across shift changes
    // until someone fixes it, so it stays on the Hub alerts until it is closed.
    const maintList = (App.shiftData || {}).sc_maintenance || [];
    const urgentOpen = maintList.filter(m => m && m.priority === 'Urgent' && m.status !== 'Resolved');
    if (urgentOpen.length) {
      const label = (urgentOpen[0].issue || urgentOpen[0].item || 'An urgent issue');
      out.push({
        sev: 'bad',
        label: 'Urgent maintenance', value: urgentOpen.length + ' open',
        text: urgentOpen.length === 1
          ? label + ' is flagged Urgent and still open in the Maintenance Log. Handle it before it costs you a shift.'
          : urgentOpen.length + ' urgent maintenance issues are still open, including ' + label + '. Handle them before they cost you a shift.',
        screen: 'sc-maintenance', mod: 'shift'
      });
    }

    // 5. Vendor price re-drift — fresh price increases in recent deliveries
    const dels = (App.inventoryData || {}).ic_deliveries || [];
    // 45 days means 45. (This one names no day count on screen, so it was the only one of the eight
    // not printing a false figure — routed anyway so the convention has a single implementation.)
    // Bounded at the top as well (S217) — a future-dated delivery would otherwise raise a
    // price-drift alert from whenever it was typed until the date arrived.
    const inWin = App.inWindow(45);
    let incCount = 0;
    dels.filter(d => inWin(d.date)).forEach(d => {
      (d.line_items || []).forEach(li => {
        if (li.price_changed && li.prev_price != null && li.price_per_unit != null
            && li.price_per_unit > li.prev_price) incCount++;
      });
    });
    if (incCount >= 2) out.push({
      sev: 'warn',
      label: 'Vendor prices rose', value: incCount + ' items · 45d',
      text: 'Vendor prices rose on ' + incCount + ' items in deliveries over the last 45 days. Verify these against quoted sheets before they stick.',
      /* ⚠ `mod` IS HARDCODED HERE, so `App._moduleOf` cannot rescue this one. Moved with the screen
         on 2026-08-23 when Vendor Tracker left Profit for Inventory. Every other caller of these
         ids resolves the shell through `openScreen`; this row carries it inline, which is exactly
         the kind of second spelling that gets left behind ([[lessons-paid-for]] #111 — sweep who
         READS it, not what you moved). Pinned by `verify-vendors-in-inventory` D1. */
      screen: 'vendor-watch', mod: 'inventory'
    });

    // 6. Loss Prevention flags (last 7 days), in two honest tiers so red stays
    // reserved for the real thing. Severe (confirmed theft) is Critical and reads
    // as theft to act on; softer signals (drawer shorts, flagged spot checks) are
    // Watch, worded as items to review rather than theft. Comp-volume-by-server is
    // a windowed pattern, surfaced on the Loss Prevention page, not in this stream.
    /* 6. LOSS-PREVENTION FLAGS, LAST 7 DAYS, SPLIT INTO THE THREE SIGNALS THEY ARE MADE OF.
       ⛔⛔ THIS USED TO CALL `S.TheftRisk.recentFlags` AND SEND BOTH ROWS TO THAT PAGE. Kyle
       retired Loss Prevention on 2026-08-23, so the function and the destination both went — and
       a count with no page to open is worse than no count. Deleting the alert outright would
       have been a loss he did not ask for, and re-pointing both rows at one screen was not
       available either: the old "soft" row MERGED drawer shorts with flagged spot checks, two
       different stores, so no single destination could be honest for it.
       ⭐ SO EACH SIGNAL LANDS WHERE AN OPERATOR CAN ACT ON IT: a confirmed theft adjustment on
       the Adjustment Log, a drawer short on Over and Short, a flagged spot check on Spot Check.
       Ask what the operator DOES there, never which page name matches the words
       ([[lessons-paid-for]] #47/#83, and [[fix-wrong-destinations]]).
       ⚠ SEVERE STAYS ITS OWN TIER. Red is reserved for a confirmed theft adjustment; a short or
       a flagged check is worded as something to review, not as theft. That distinction was the
       whole point of the two tiers and it survives the split. */
    {
      const wk7 = new Date(); wk7.setDate(wk7.getDate() - 6);
      const since = iso(wk7);
      const inWk = d => { const s = d ? String(d).slice(0, 10) : ''; return s && s >= since; };
      const theft = ((App.inventoryData && App.inventoryData.ic_adjustments) || [])
        .filter(a => a.reason === 'Theft' && inWk((a.date_time || '').slice(0, 10))).length;
      const shorts = ((App.shiftData && App.shiftData.sc_variances) || [])
        .filter(v => v.status === 'Short' && inWk(v.date)).length;
      /* One entry per flagged CHECK, never per flagged LINE. A check that flagged five products
         announced five separate things to review before this rule was written. */
      const spots = (App.completedSpotChecks() || [])
        .filter(c => inWk(c.date) && (c.items || []).some(it => it.flagged)).length;
      if (theft > 0) out.push({
        sev: 'bad',
        label: 'Theft flags to act on', value: String(theft),
        text: theft + ' adjustment' + (theft === 1 ? '' : 's') + ' logged as theft in the last 7 days. '
          + 'Work them off the Adjustment Log.',
        screen: 'ic-adjustments', mod: 'inventory'
      });
      if (shorts > 0) out.push({
        sev: 'warn',
        label: 'Drawer shorts to review', value: String(shorts),
        text: shorts + ' drawer count' + (shorts === 1 ? '' : 's') + ' came up short in the last 7 days. '
          + 'Over and Short groups them by cashier and by register.',
        screen: 'cash-recon', mod: 'profit'
      });
      if (spots > 0) out.push({
        sev: 'warn',
        label: 'Spot checks to review', value: String(spots),
        text: spots + ' spot check' + (spots === 1 ? '' : 's') + ' flagged a product in the last 7 days. '
          + 'Check anything that does not add up.',
        /* ⛔ ITS OWN DOOR, BECAUSE THE SCREEN DEFAULT IS A BLANK NEW CHECK. Walked on the deployed
           build 2026-08-24: pressing this row landed on PRODUCTS 0 · FLAGGED 0 · TOTAL VARIANCE
           $0.00 with the flagged check two more presses away. Its two siblings above were walked
           on the same pass and are honest -- the Adjustment Log renders the named adjustment in
           view, Over and Short reads OUT OF TOLERANCE 1 -- so only this one needed a door.
           Same rule, and the same remedy, as the permit and certification rows below. */
        screen: 'ic-spot-check', mod: 'inventory', go: 'S.Hub._enterSpotChecks()'
      });
    }

    return out;
  }

};
