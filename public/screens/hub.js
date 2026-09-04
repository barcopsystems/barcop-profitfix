'use strict';

S.Hub = {

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
    /* ⛔⛔ A WEEK CAN CLOSE WITH NO COGS FIGURE ON IT, AND THIS USED TO PRINT THAT AS `$0`. Every
       bucket's `cogs` is `_valOrNull` at confirm time, so an operator who closes a week before ever
       taking a count stores `bar.cogs: null` — and `Number(null) || 0` turned that into a confident
       zero on the Hub. It is the same defect as the `0 hrs` this rebuild was built to close, one
       cell along ([[lessons-paid-for]] #158 — a zero meaning "no basis" and a zero meaning "the
       operator said zero" look identical and have opposite fixes).
       ⭐ THE APP ALREADY HAD THE ANSWER AND ONLY HALF THE CARD USED IT. `confirm-week` computes
       `cogsIn` for exactly this question and nulls `primePct` when it is false, which is why the
       Prime cost cell was already honest while its neighbour was not — one field got the strict test
       and the one beside it did not ([[the-loop]] #73). Null when NO bucket carried a figure; a real
       0 that somebody typed still counts, because a typed zero is an answer. */
    const cogsFor = w => {
      if (!w) return null;
      let any = false;
      const total = ['bar', 'food', 'catering', 'other'].reduce((t, k) => {
        const b = w[k];
        if (b && typeof b === 'object' && b.cogs != null && b.cogs !== '') { any = true; return t + (Number(b.cogs) || 0); }
        return t;
      }, 0);
      return any ? total : null;
    };
    const d = (now, was) => (now == null || was == null) ? null : now - was;

    const hours = sum(acts, cur, r => r.hours);
    const otC = otCostFor(cur), voids = sum(vcs, cur, r => r.amount), cogs = cogsFor(pw[0]);

    /* ⛔⛔ THE ROW COUNTS ARE THE HONESTY GATE, AND THEY ARE THE POINT OF THE WHOLE REBUILD. `sum`
       returns null only when there is NO SPAN, and a closed week always supplies one — so the
       moment a week closes, `hours` reads 0 whether or not anybody logged an hour, and the Hub
       prints a confident `0 hrs` with a `+0` delta for a bar that has never used the roster. The
       week supplies a SPAN, not DATA. A count of the rows inside the span is the only thing that
       tells the two apart ([[lessons-paid-for]] #158 — a zero meaning "no basis" and a zero meaning
       "the operator said zero" look identical on screen and have opposite fixes). */
    const rows = (arr, span) => !span ? 0 : arr.reduce((t, r) => inSpan(r && r.date, span) ? t + 1 : t, 0);
    const vars = (App.shiftData || {}).sc_variances || [];
    /* Net sales and prime come off the SAME week record `cogs` already reads, in the same pass, so
       the three cannot end up describing different weeks ([[the-loop]] #54). */
    const revOf = w => !w ? null : ['bar', 'food', 'catering', 'other'].reduce((t, k) => {
      const b = w[k]; return t + (b && typeof b === 'object' ? (Number(b.revenue) || 0) : 0); }, 0);
    return {
      label: 'last week',
      end: end,
      netSales: revOf(pw[0]),
      prime: (pw[0] && pw[0].prime_cost_pct != null) ? Number(pw[0].prime_cost_pct) : null,
      /* ⛔⛔ POUR AND FOOD ARE HERE BECAUSE TAKING THE OLD BANDS OUT DROPPED THEM OFF THE HUB
         ENTIRELY, AND THAT WAS MEASURED, NOT ASSUMED. The retirement rests on the claim that every
         figure on the six bands is duplicated on a card; rendering the page before and after over
         one world says otherwise — bar pour cost and food cost were printed ONLY by the movement
         band and no card had a cell for either ([[lessons-paid-for]] #89 — a claim about what two
         versions produce is a hypothesis until both are run).
         ⭐ THEY BELONG TO THE WEEK BY THE SAME DERIVATION AS THE REST OF THIS CARD: both come off
         the closed week record, whose output page is Week in Review, which The Week's nav holds.
         ⚠ READ IN THE SAME PASS AS `cogs` AND `netSales`, off `pw[0]`, so the four cannot end up
         describing different weeks ([[the-loop]] #54).
         ⚠ EACH IS `null` WHEN ITS BUCKET CARRIED NO PERCENTAGE, never 0 — a week record can exist
         with an empty bucket, and a confident 0.0% pour cost is the exact zero-means-no-basis lie
         this rebuild exists to make unreachable ([[lessons-paid-for]] #158). */
      pour: (pw[0] && pw[0].bar && pw[0].bar.cost_pct != null) ? Number(pw[0].bar.cost_pct) : null,
      food: (pw[0] && pw[0].food && pw[0].food.cost_pct != null) ? Number(pw[0].food.cost_pct) : null,
      /* ⛔ LABOR IS PRIME'S THIRD COMPONENT, AND A CARD SHOWING PRIME PLUS TWO OF ITS THREE PARTS IS
         THE INCOHERENT ONE. Prime is pour + food + labor; the old movement band carried all four and
         the band cut dropped this one with the other two. Adding it is derived from the arithmetic
         rather than picked ([[lessons-paid-for]] #89 — the population was measured off the retired
         member, not remembered).
         ⚠ IT COMES OFF THE REVENUE WEEK, WHICH IS A DIFFERENT RECORD, so it prints ONLY when that
         week is the SAME week every other cell on this card is describing. Read unconditionally it
         would put one week's labor beside another week's prime with nothing on screen saying so —
         the two-screens-one-quantity defect inside a single card ([[the-loop]] #54). */
      labor: (rw[0] && String(rw[0].period_end || '') === String(end || '')
              && rw[0].labor_pct_blended != null) ? Number(rw[0].labor_pct_blended) : null,
      hoursRows: rows(acts, cur),
      voidRows: rows(vcs, cur),
      overShort: sum(vars, cur, r => r.variance), overShortRows: rows(vars, cur),
      hours: hours, hoursDelta: d(hours, sum(acts, prv, r => r.hours)),
      otCost: otC, otDelta: d(otC, otCostFor(prv)),
      cogs: cogs, cogsDelta: d(cogs, cogsFor(pw[1])),
      voids: voids, voidsDelta: d(voids, sum(vcs, prv, r => r.amount))
    };
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
    /* ⭐⭐ EVERY CANDIDATE NAMES ITS OUTPUT PAGE, AND THAT IS WHAT FILES IT ONTO A SECTION CARD.
       Kyle, 2026-09-03: *"same for biggest gain and worse drag.. can be on different sections for
       different things."* So the section is not typed anywhere — the card asks which section's nav
       holds this screen, the same rule every figure on the page already follows.
       ⚠ THE FOUR RATE METRICS ARE THE WEEK'S, INCLUDING LABOR, and that is a measurement rather than
       a preference: `labor_pct_blended` is written onto the WEEK RECORD by Close The Week and by
       nothing in The Floor's nav, which is the same tie-break that put `sc_shifts` on the Week card
       when Week in Review was re-filed ([[lessons-paid-for]] #143). The Floor owns the HOURS behind
       it; The Week owns the percentage the close computes. */
    const addRate = (label, wasPct, nowPct, base, unit, screen) => {
      if (wasPct == null || nowPct == null || !(base > 0)) return;
      cand.push({ label: label, was: App.fmtPct(wasPct), now: App.fmtPct(nowPct), screen: screen,
                  dollars: Math.round((wasPct - nowPct) / 100 * base), unit: unit });
    };
    addRate('Bar pour cost', pct(pWas.bar, 'cost_pct'), pct(pNow.bar, 'cost_pct'), rev(pNow.bar), 'a week', 'week-review');
    addRate('Food cost',     pct(pWas.food, 'cost_pct'), pct(pNow.food, 'cost_pct'), rev(pNow.food), 'a week', 'week-review');
    addRate('Labor',         pct(rWas, 'labor_pct_blended'), pct(rNow, 'labor_pct_blended'), totalRev(rNow), 'a week', 'week-review');

    /* CHECK AVERAGE uses the week's own `covers`, which is a stored field , never revenue divided by
       the check average, which is the same number wearing a disguise and would make the dollar figure
       an identity rather than a measurement. */
    if (rNow.check_avg != null && rWas.check_avg != null && Number(rNow.covers) > 0) {
      cand.push({ label: 'Check average', was: App.fmtCurrency(rWas.check_avg), now: App.fmtCurrency(rNow.check_avg), screen: 'week-review',
                  dollars: Math.round((rNow.check_avg - rWas.check_avg) * Number(rNow.covers)), unit: 'a week' });
    }

    const vcs = (App.shiftData || {}).sc_void_comps || [];
    const vNow = sumIn(vcs, curSpan, r => r.amount), vWas = sumIn(vcs, wasSpan, r => r.amount);
    /* ⚠ INVENTORY, NOT SHIFT. The Voids/Comps log is an INVENTORY ▸ Logs row now and its own
       Variance Report reads it, so the section that owns the page owns the reading. */
    if (vcs.length) cand.push({ label: 'Voids and comps', was: App.fmtCurrency(vWas, 0), now: App.fmtCurrency(vNow, 0), screen: 'sc-void-comp',
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
      cand.push({ label: 'Overtime', was: App.fmtCurrency(oWas, 0), now: App.fmtCurrency(oNow, 0), screen: 'lc-overtime-watch',
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
    /* ⚠ THE DATE FIELD IS NAMED PER STORE, because the stores do not agree and inventing one
       spelling would have quietly reported every new row as never done. Measured on the real
       records: `lc_schedules` keys on `week_start`, `menu_dog_tests` on `start_date`, `bookings` on
       `created_at`, `event_regulars` on `last_visit`; everything else carries `date`. A stub of the
       wrong shape certifies the bug exactly as a forgiving one does ([[lessons-paid-for]] #20). */
    const firstIn = (arr, f) => {
      const k = f || 'date';
      return (arr || []).filter(r => r && inWeek(r[k]))
        .sort((a, b) => String(a[k]).localeCompare(String(b[k])))[0] || null;
    };
    /* ⚠ BOOKS IS MONTHLY AND SAYS SO. Kyle: *"books could have a done this week.. or a done this
       month since it is more monthly."* Money out is logged against a month, so a week window would
       report a bar that logged its bills on the 2nd as having done nothing by the 10th. The ROW
       carries its own window and the card heads the block to match, rather than one list quietly
       meaning two different spans ([[output-honesty]] test 2 — correct for the timeframe its label
       claims). */
    const monthKey = App.todayLocal ? App.todayLocal().slice(0, 7) : '';
    const inMonth = d => String(d || '').slice(0, 7) === monthKey;
    const firstInMonth = (arr, f) => {
      const k = f || 'date';
      return (arr || []).filter(r => r && inMonth(r[k]))
        .sort((a, b) => String(a[k]).localeCompare(String(b[k])))[0] || null;
    };

    /* ⚠ `LAB` AND `SH` WENT WITH THE TWO ROWS THAT READ THEM (T72). Once Received delivery and
       Created order moved onto `ic_deliveries` / `ic_orders`, nothing in this member touched labor
       or shift data, and a local that is declared and read nowhere is the same leftover as a helper
       whose last caller went ([[the-loop]] #25 / [[lessons-paid-for]] #105). Measured before
       cutting: `LAB.` and `SH.` both at zero uses in the body. */
    /* ⚠ `LAB` AND `SH` ARE BACK, AND SO IS `D`. They were cut at T72 when nothing in this member
       read labor or shift data any more; the four sections Kyle asked for read all three again.
       A local declared and read nowhere is a leftover, and one READ and not declared is a throw —
       both directions are worth the one-line check ([[the-loop]] #25). */
    const INV = App.inventoryData || {};
    const LAB = App.laborData || {};
    const SH  = App.shiftData || {};
    const D   = App.data || {};
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
        hit: firstIn(App.completedSpotChecks()) },

      /* ⛔⛔ FOUR SECTIONS USED TO SAY "NOTHING NEEDS YOU HERE THIS WEEK" ON EVERY LOAD, and it was
         this list that was thin, not their weeks. Kyle walked the pushed build and named all four:
         *"the floor could have done this week.. build schedule, server check, etc."*, *"menus..
         nothing needs you this week.. there are menu engineering items, recipes over target, a dog
         test running"*, *"same with events"*, *"books could have a done this week."*
         ⭐ EVERY ROW IS A DATED RECORD THE APP ALREADY WRITES, which is what keeps rule 4 true: there
         is no tick anybody can fake, because the mark appears only when a record with a date on it
         exists ([[hub-section-cards]] rule 4).
         ⛔ AND EVERY `screen` BELOW IS A ROW IN ITS OWN SECTION'S NAV, measured off nav.js rather
         than remembered — The Floor holds 27 rows including `lc-build-schedule`, `lc-log-hours`,
         `sc-cash-control` and `r-server-check`; Menus holds 5 including `r-menu-engineering` and
         `r-dog-test`; Events holds `ev-bookings` and `ev-regulars`; Books holds
         `operating-expenses`. A screen its section's nav does not hold falls back to the section
         landing with a console error, which is the dead-row class this project has shipped three
         times ([[lessons-paid-for]] #18/#24/#126). */
      { label: 'Logged hours',      screen: 'lc-log-hours',      mod: 'labor',
        hit: firstIn(LAB.lc_actuals) },
      { label: 'Built the schedule', screen: 'lc-build-schedule', mod: 'labor',
        hit: firstIn(LAB.lc_schedules, 'week_start'), field: 'week_start' },
      /* ⚠ NOT "Counted a drawer": the same `sc_variances` row arrives from a dropped file, and
         labelling the record by the harder of its two doors tells an operator they did it the wrong
         way ([[two-doors-same-data]]). */
      { label: 'Drawer numbers in',  screen: 'sc-cash-control',   mod: 'shift',
        hit: firstIn(SH.sc_variances) },
      { label: 'Server check',      screen: 'r-server-check',    mod: 'revenue',
        hit: firstIn(D.revenue_server_checks) },
      { label: 'Repriced an item',  screen: 'r-menu-engineering', mod: 'revenue',
        hit: firstIn(D.revenue_price_log) },
      { label: 'Started a dog test', screen: 'r-dog-test',       mod: 'revenue',
        hit: firstIn(D.menu_dog_tests, 'start_date'), field: 'start_date' },
      { label: 'Took a booking',    screen: 'ev-bookings',       mod: 'events',
        hit: firstIn(D.bookings, 'created_at'), field: 'created_at' },
      { label: 'Logged a visit',    screen: 'ev-regulars',       mod: 'events',
        hit: firstIn(D.event_regulars, 'last_visit'), field: 'last_visit' },
      /* ⚠ THE ONE MONTHLY ROW. Its window is the calendar month and its caption says so on the card. */
      { label: 'Logged money out',  screen: 'operating-expenses', mod: 'hub', span: 'month',
        hit: firstInMonth(D.operating_expenses) }
    ].map(r => ({ label: r.label, screen: r.screen, mod: r.mod, span: r.span || 'week',
                  done: !!r.hit, when: r.hit ? dayOf(r.hit[r.field || 'date']) : '' }));

    /* The last row is the week itself. A `week` record ENDING on this week's Sunday means the
       operator confirmed it; nothing else in the app writes one ([[confirm-the-week]] — ONE popup
       writes both the profit `week` and the `revenue_week`). */
    const wk = ((App.data || {}).weeks || []).filter(w => w && String(w.period_end) === String(end))[0];
    /* ⚠ LABEL ONLY (Kyle, 2026-09-03: *"close and confirm the week .. to just 'close the week'"*).
       The source is untouched: a `week` record ending on this Sunday, which only Confirm the Week
       writes. Shortened because the page it opens is called Close The Week and the row was the one
       spelling in the app that said it twice. */
    rows.push({ label: 'Close the week', screen: 'week-close', mod: '', span: 'week',
                done: !!wk, when: wk ? dayOf(wk.period_end) : '' });
    return rows;
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
      /* ⚠ IT CARRIES A SCREEN NOW, AND THAT IS WHAT FILES IT. Section cards put each alert on the
         card whose nav holds the page it opens, so an item with only a `go` string has nowhere to
         live and lands in nobody's section. `books` is Books ▸ Statements ▸ Month-End Books, which
         is where this nudge already sent the operator. */
      if (hasLastMo) out.push({ sev: 'due', screen: 'books',
                                label: 'Close ' + lm.toLocaleDateString('en-US', { month: 'long' }) + ' in Books',
                                value: 'month-end', go: 'S.HubBooks&&S.HubBooks.open()' });
    }
    return out;
  },

  /* ⛔⛔ MENUS AND EVENTS HAD NO ALERT SOURCE AT ALL, so both cards said "Nothing needs you here this
     week" on every load whatever the bar was doing. Kyle, walking the pushed build: *"menus.. nothing
     needs you this week.. there are menu engineering items, recipes over target, a dog test running,
     if items were missing recipes"* and *"same with events."*
     ⭐ BOTH READ A HELPER THAT ALREADY OWNS THE QUESTION, never a re-derivation. `menuItemsUngradeable`
     is the app's own answer to "what cannot be graded", and it exists precisely so a count of items
     over target is not a green all-clear over a menu nobody has costed ([[the-loop]] #72 — a count of
     problems is only an all-clear if it could have counted anything). `depositsDueList` is the ONE
     definition of "a deposit is still due", written after two screens disagreed by $2,000.
     ⚠ EACH CARRIES THE SCREEN IT OPENS AND NOTHING ELSE FILES IT. `_sectionIndex` puts an alert on
     the card whose nav holds that page, so `r-menu-items` lands on Menus and `ev-bookings` on Events
     without either being named here ([[lessons-paid-for]] #167).
     ⚠ AND BOTH ARE CONDITION-GATED, so neither is a nag: no ungradeable item, no row. */
  _sectionAlerts() {
    const out = [];
    const ung = (App.menuItemsUngradeable) ? App.menuItemsUngradeable() : [];
    if (ung.length) out.push({
      sev: 'warn', screen: 'r-menu-items',
      label: ung.length === 1 ? 'One menu item has no cost or price'
                              : ung.length + ' menu items have no cost or price',
      value: 'cannot be graded'
    });
    const EB = (typeof S !== 'undefined') && S.EventsBookings;
    const due = (EB && EB.depositsDueList) ? EB.depositsDueList() : [];
    if (due.length) out.push({
      sev: 'warn', screen: 'ev-bookings',
      label: due.length === 1 ? 'One booking is still owed its deposit'
                              : due.length + ' bookings are still owed their deposit',
      value: App.fmtCurrency(EB.depositsDueTotal(), 0)
    });

    /* ⛔⛔⛔ THE SEVEN THAT WEEK IN REVIEW WAS THE ONLY HOME FOR (Kyle, 2026-09-04: *"those items
       should all be on the hub cards"*, then *"ok go"*). That sentence is a MEASUREMENT, not a
       fact, and measured it was short: the carrying band prints 15 items on the live demo and
       ELEVEN of the 28 it can print had no Hub equivalent at all. Four were live that day, one of
       them a red (safe to spend negative). Taking the band out without this first would have
       removed them from the app, which is exactly how the Hub nearly lost bar pour cost the day
       before ([[lessons-paid-for]] #168 — a retirement's premise is a measurement, so enumerate
       what the dying surface COULD print off its own source and tick each one off).
       ⭐⭐ AND IT IS #169's CURE, NOT A NEW ONE. Four cards said "nothing needs you here this week"
       last chat because the shared feed covered two sections of seven; the answer then was to widen
       the feed from helpers that already own the question, and it is the answer now. Not one number
       below is re-derived: `_inventoryFigures`, `_computeState` and `CashEngine.position` are the
       members those pages already read.
       ⛔ WHAT DID *NOT* COME ACROSS, AND WHY, because a silent omission is the thing to avoid: four
       of the eleven are facts about the WEEK YOU SELECTED rather than about today. Cash was never
       reconciled THAT week, walked tabs THAT week, that week was never confirmed, no bills logged
       for THAT month. Rule 3 for this page is overall standing, so those have no honest home here
       and they leave with the band. "Below par and no order placed all week" is the same shape, and
       its current half is already the Inventory card's Still to order CELL.
       ⚠ EVERY `screen` BELOW WAS CHECKED AGAINST THE REAL NAV RATHER THAN ASSUMED:
       `ic-par-suggestions` is an Inventory row, `lc-time-off` and `lc-build-schedule` are The
       Floor's, `ev-bookings` is Events', `c-position` is Books'. `_sectionIndex` files each row on
       the card whose nav holds the page it opens, so not one of them names a section here
       ([[lessons-paid-for]] #167 — the nav is the only structure that has moved with the product). */

    /* INVENTORY. As-of-now by construction: `_inventoryFigures` measures parOff against the newest
       count PAIR and its own header says the figure is as-of-now, which is what makes it readable
       here at all. Bare, like the two card builders that already call it — a guarded fallback would
       print nothing on a load where the file is late, and a missing alert is a silent under-report
       ([[the-loop]] #147). */
    const invFig = S.WeekReview._inventoryFigures();
    if (invFig.parOff > 0) out.push({
      sev: 'warn', screen: 'ic-par-suggestions',
      label: 'Pars off versus real usage',
      value: invFig.parOff + ' product' + (invFig.parOff === 1 ? '' : 's')
    });

    /* THE FLOOR. A request's STATUS is a current fact and never a week's, so this one needed no
       translation at all. */
    const lab = App.laborData || {};
    const toPending = (lab.lc_time_off || []).filter(r => r && r.status === 'Requested').length;
    if (toPending > 0) out.push({
      sev: 'warn', screen: 'lc-time-off',
      label: 'Time off to review',
      value: toPending + ' request' + (toPending === 1 ? '' : 's')
    });
    /* ⚠ NEXT WEEK IS MEASURED FROM TODAY, NOT FROM A REVIEWED WEEK. Week in Review asks whether a
       schedule exists for the week after the one on screen; the only version of that question the
       Hub can answer honestly is the one about the week actually coming.
       ⚠ AND IT IS GATED ON THE ROSTER EXISTING. A brand new account has no staff, so this would
       otherwise be the first thing it said, about work it cannot do yet — a prerequisite wearing a
       finding's clothes, which is the thing the card's own step list is for. */
    const nextMon = App.ymdLocal(new Date(new Date(App.weekStartFor(App.todayLocal()) + 'T00:00:00')
      .getTime() + 7 * 86400000));
    if ((lab.lc_staff || []).length
        && !(lab.lc_schedules || []).some(s => s && s.week_start === nextMon)) out.push({
      sev: 'bad', screen: 'lc-build-schedule',
      label: 'Next week has no schedule',
      value: 'week of ' + this._shortDate(nextMon)
    });

    /* EVENTS. ONE call answers all three: `_computeState` is the bookings page's own reader and
       already publishes open leads, the stale subset, the run-sheet gap and the completed-but-not
       -closed list. Guarded exactly like the deposits row above it, for the reason that row's pin
       (Y4) records: with the Events screen not loaded this says nothing rather than throwing. */
    let est = null;
    if (EB && EB._computeState) { try { est = EB._computeState(); } catch (e) { est = null; } }
    if (est) {
      /* ⚠ STALE IS WHAT MAKES IT RED, which is the rule the bookings page already applies to this
         same list. A lead nobody has touched in three days is the one worth the colour. */
      if (est.open.length) out.push({
        sev: est.stale.length ? 'bad' : 'warn', screen: 'ev-bookings',
        label: 'Open leads to follow up',
        value: est.open.length + (est.stale.length ? ', ' + est.stale.length + ' stale' : '')
      });
      if (est.noRunSheet.length) out.push({
        sev: 'warn', screen: 'ev-bookings',
        label: 'Events with no run sheet',
        value: est.noRunSheet.length + ' in 14 days'
      });
      if (est.completedOpen.length) out.push({
        sev: 'warn', screen: 'ev-bookings',
        label: 'Events to close out',
        value: est.completedOpen.length + ' completed'
      });
    }

    /* BOOKS. ⛔ THE RED THAT HAD NO HOME ANYWHERE ELSE. Safe to spend is the cushion minus the
       reserve target, so a negative one means the operator is into money already spoken for. It was
       the most serious line on the carrying band and the Hub had nothing like it: `forwardAlerts`
       warns about RUNWAY and about dipping under the reserve, which are two questions about the
       weeks ahead, not this one about today.
       ⚠ GATED ON `hasOpening`, or an account that has never entered an opening balance reads as
       overdrawn on its first load. */
    const pos = CashEngine.position();
    /* ⛔⛔ `fmtBal`, NOT `fmtCurrency`, AND THE PIN CAUGHT ME WRITING THE WRONG ONE. `fmtCurrency` is
       literally a dollar sign glued to the number, so a negative comes out as `$-2,894` with the
       minus INSIDE the money mark — the exact shape `verify-signed-zero-display` exists to sweep for
       and which shipped a `$-312.00/wk` on the pricing log once ([[lessons-paid-for]] #99).
       ⭐ AND THE DECIDING REASON IS NOT THE GLYPH, IT IS AGREEMENT: `c-position` prints this same
       figure with `App.fmtBal`, and it is the page this row opens. One quantity, two screens, one
       spelling ([[the-loop]] #54). */
    if (pos.hasOpening && pos.safe != null && pos.safe < 0) out.push({
      sev: 'bad', screen: 'c-position',
      label: 'Safe to spend is negative',
      value: App.fmtBal(pos.safe, 0)
    });

    return out;
  },

  // The one source both the card and the modal read.
  _needsItems() {
    return this.forwardAlerts().concat(this._dueItems()).concat(this._sectionAlerts());
  },




  /* ══ T138 · ONE CARD PER RAIL SECTION ═══════════════════════════════════════
     Kyle, 2026-09-03: *"what if the hub was setup more like the week review in a way.. where each
     section is it's own card on the hub.. inventory up top.. and then down in order.. and each one
     has it's own getting started sequence/steps that gives the 'Do this.. to get this' and once
     they do it.. it changes to the actual 'get this' data."*

     ⭐⭐⭐ THE PROPERTY THAT MAKES IT RIGHT: THERE IS NO DEAD SPACE ANYWHERE. Every cell in the row
     is EITHER a figure OR the job that produces that figure. A stat with no store behind it does
     not print a dash and it does not print a confident zero — it prints its own STEP.
     ⭐ THAT IS WHY THE REBUILD IS AN OUTPUT-HONESTY FIX RATHER THAN A LAYOUT CHANGE. Today, closing
     one week turns an honest dash into `0 hrs` / `$0` / `+0` for a bar that has never logged an
     hour, because `sum()` returns null only when there is no SPAN and a closed week supplies one.
     A cell that cannot appear until its own source exists cannot do that
     ([[output-honesty]], [[lessons-paid-for]] #158 — a zero meaning "no basis" and a zero meaning
     "the operator said zero" look identical on screen and have opposite fixes).

     ⛔ NO CHECK MARKS. Kyle: *"that section should not show 'set up inventory products' anymore..
     not put a check mark by it.. just the app removes it and updates that section to whatever is
     left to do to use it."* A satisfied step is REMOVED, never ticked, so the card always states
     what is LEFT — and there is no checklist surface left to fake.

     ⛔ THE CARD LIST IS DERIVED FROM `_PROTO_GLOBAL`, NEVER TYPED, so a section switched on
     tomorrow gets a card the day it ships. Week in Review paid for the other version: eight
     hardcoded cards, five of them naming sections the app had deleted, rendering without an error
     for weeks under a green gate ([[lessons-paid-for]] #143).
     ⛔ AND `build` HOLDS THE FUNCTION, NOT ITS NAME. String dispatch is invisible to
     `verify-no-retired-code`, which counts QUALIFIED references, and a member wrongly seeded as
     dead poisons its whole subtree — that mistake reported EVERY member of hub-week-review as
     unreached on one gate run (#144/#43). A real reference is visible to the ratchet and a mistyped
     name is a TypeError on the next render instead of a section silently missing from the page. */
  _sectionCardPlan() {
    const B = { inventory: this._inventoryCard, week:   this._weekCard,   audit:  this._auditCard,
                floor:     this._floorCard,     menus:  this._menusCard,  events: this._eventsCard,
                books:     this._booksCard };
    return ((typeof App !== 'undefined' && App._PROTO_GLOBAL) || [])
      .filter(r => r && r[0] !== 'hub')
      .map(r => ({ key: r[0], name: r[1], build: B[r[0]] || null }));
  },

  /* One spelling of a short date for this page. `render` had its own local copy and now reads this
     one, because the card and the bands above it print the same count dates and two formatters is
     how they start disagreeing ([[the-loop]] #54). */
  _shortDate(str) {
    if (!str) return '';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },

  /* ── THE INVENTORY CARD ───────────────────────────────────────────────────
     ⛔⛔ EVERY FIGURE IS AN INVENTORY FIGURE BECAUSE ITS OUTPUT PAGE IS AN INVENTORY PAGE, AND THE
     MAPPING IS DERIVED FROM THE NAV RATHER THAN REMEMBERED. Kyle's rule: *"break even is in books..
     that is where the user finds the break even page. put them where the output is first if there
     is a place."* Measured off `SectionTabs.groupsFor('inventory')` on the shipped build — 7 groups,
     25 rows — and all six ids used below are rows in it: Count History, Order Sheet, Trapped Cash,
     Usage Report, Add Products, Take Inventory. All six were OPENED through this page's own door
     (`S.Hub._enter(id, 'inventory')`) before being written here, which is the one check a
     destination's correctness cannot be inferred without ([[lessons-paid-for]] #18).
     ⚠ THE SAME MEASUREMENT RE-FILES CELLS THAT LOOK LIKE SOMEBODY ELSE'S: Trapped Cash is
     INVENTORY ▸ Reports and the Voids/Comps and Waste logs are INVENTORY ▸ Logs. The old strip
     still tags them `cash` and `shift`, which are MODULES, not sections.

     ⛔ ONE DOOR PER NUMBER, NEVER A SECOND LOOP. Below par, used-this-period and dead stock come
     from `S.WeekReview._inventoryFigures()` — the member that already owns them, and whose own
     header records that two hand-rolled copies of below par and of dead stock had already drifted
     twice before it existed. Trapped cash and the shelf value come from ONE `CashEngine.trapped()`
     call, because `shelfValue` is reported from the pass that built the numerator and reading it
     separately off `onHand()` is exactly how the two start disagreeing ([[the-loop]] #54).
     ⚠ BOTH BARE. A guarded `window.X &&` on a helper required for CORRECTNESS turns a loud failure
     into a quiet wrong number, and a silent $0 here reads as "nothing is tied up", which is the
     opposite of the truth ([[the-loop]] #40, [[lessons-paid-for]] #147).
     ⚠ `_inventoryFigures` READS NO `this` — measured on the shipped build by calling it detached
     (`.call({})` returns an identical object), so borrowing it carries none of Week in Review's
     week state with it. That is the check [[lessons-paid-for]] #135 exists for, where a borrowed
     member's `this.container` took a whole screen to the error boundary.

     ⭐⭐ ONE TABLE, TWO HALVES. A cell names the GATES its figure needs; a gate names the JOB that
     meets it. So the promise on a step and the cell that replaces it are the same object and cannot
     drift apart — the Get Started card's `lights:` mechanism one level up, and the reason this card
     can never claim a payoff the app does not produce ([[lessons-paid-for]] #64: a claim about what
     the app will do is a measurement, not a sentence).
     ⚠ A GATE IS THE FIGURE'S OWN SOURCE, NEVER A PROXY FOR IT. `trap.hasData` is `!!usageBase()`,
     which is null below two counts, and `fig.periodCost` is null for the same reason. Writing the
     gate as `ic_counts.length >= 2` would be a second statement of the same rule and would go stale
     the day either engine changed what it needs. */
  /* ⭐⭐⭐ EVERY DESTINATION ON EVERY SECTION CARD IS A ROW IN THAT SECTION'S OWN NAV, RESOLVED AT
     CLICK TIME AND ROUTED THE WAY THE SECTION BAR ROUTES IT. Kyle's rule 1 for this rebuild is that
     a number lives where its OUTPUT PAGE lives; this is that rule made structural, so a cell cannot
     name a page its section does not have and cannot reach it through the wrong door.
     ⛔⛔ AND THE WRONG DOOR IS THE DEFECT THIS PROJECT SHIPS MOST. `App.navigate` is
     MODULE-INTERNAL, so it lands on "Coming soon." for anything outside the active module; a hub
     page is not a module screen at all; and The Floor, Menus and Books each hold pages from THREE
     other modules. Hand-typing a `mod` per cell would have been twenty chances to get that wrong,
     and this exact class shipped dead rows three times in three days ([[lessons-paid-for]]
     #24/#120/#126 — rendering is downstream of reaching, and every one of those failed SILENTLY).
     ⭐ SO THE ROW CARRIES ITS OWN DOOR, exactly as `SectionTabs.groupsFor` publishes it:
     `hubAction` for a hub page, `mod` for a module screen belonging to another module, and neither
     for a screen in the section's own module — where the section key IS the module key.
     ⚠ A MISSING ROW IS LOUD. Landing on the section is the safe fallback, but SILENCE is how three
     dead links reached Kyle twice; the console line is the runtime half of the harness census. */
  /* ⭐⭐⭐ WHICH SECTION OWNS THIS PAGE. Kyle, 2026-09-03: *"each section holds it's own data, info,
     needs to, best gain, worst drag, done this week, stats, do this first, etc.. whatever makes
     sense for that section to show to an operator on the hub."* So nothing on this page is filed by
     hand: an ITEM belongs to the section whose nav holds the page it opens, which is rule 1 pointed
     at alerts and activity instead of at figures.
     ⭐ IT IS ONLY A WELL-FORMED QUESTION BECAUSE NO PAGE IS IN TWO SECTIONS. Measured across all
     seven on the shipped build: 79 rows, zero shared. Pinned, because the day a page appears in two
     navs this index silently starts answering with whichever section was walked first.
     ⚠ THE `mod` ON AN ALERT IS NOT ITS SECTION AND MUST NOT BE USED HERE. The alerts still carry
     module keys from before the rail existed — `sc-licensing` says `shift`, `vendor-watch` says
     `inventory` — and two of those modules are not sections at all. The nav is the only source that
     has moved with the product ([[lessons-paid-for]] #143). */
  _sectionIndex() {
    const idx = {};
    if (typeof SectionTabs === 'undefined' || !SectionTabs.groupsFor) return idx;
    ((typeof App !== 'undefined' && App._PROTO_GLOBAL) || []).forEach(r => {
      if (!r || r[0] === 'hub') return;
      (SectionTabs.groupsFor(r[0]) || []).forEach(g => (g.rows || []).forEach(row => {
        if (row && row.screen && !(row.screen in idx)) idx[row.screen] = r[0];
      }));
    });
    return idx;
  },

  _sectionOfScreen(screen, idx) {
    return (idx || this._sectionIndex())[screen] || null;
  },

  /* The three lists a card can hold, each filed the one way. `_needsItems`, `_doneThisWeek` and
     `_bestWorst` are untouched: they stay the ONE source, and this only asks each row where it
     belongs ([[the-loop]] #54 — a second copy of a list is how two screens start disagreeing). */
  _sectionLists(key, idx) {
    const ix = idx || this._sectionIndex();
    const mine = a => a && this._sectionOfScreen(a.screen, ix) === key;
    /* Severity first, so the top row of a card's Needs attention IS its do-this-first. A separate
       "do this first" block naming the same row would be the same fact twice on one card. */
    const rank = { bad: 0, warn: 1, due: 2 };
    const needs = this._needsItems().filter(mine)
      .sort((a, b) => (rank[a.sev] == null ? 3 : rank[a.sev]) - (rank[b.sev] == null ? 3 : rank[b.sev]));
    const done = this._doneThisWeek().filter(mine);
    const bw = this._bestWorst();
    return { needs: needs, done: done,
             gain: (bw && mine(bw.gain)) ? bw.gain : null,
             drag: (bw && mine(bw.drag)) ? bw.drag : null };
  },

  _goSectionRow(key, screen) {
    let row = null;
    const groups = (typeof SectionTabs !== 'undefined' && SectionTabs.groupsFor)
      ? (SectionTabs.groupsFor(key) || []) : [];
    groups.forEach(g => (g.rows || []).forEach(r => { if (!row && r && r.screen === screen) row = r; }));
    if (!row) {
      console.error('section card: "' + key + '" has no nav row for "' + screen + '"');
      return App.jumpToSection(key);
    }
    if (!row.hubAction) return this._enter(row.screen, row.mod || key);
    const el = document.createElement('div');
    el.className = 'nav-item';
    el.setAttribute('data-hub-action', row.hubAction);
    el.setAttribute('data-screen', row.screen);
    if (row.mod) el.setAttribute('data-mod', row.mod);
    return this.routeSidebarAction(el);
  },

  /* ⭐⭐ THE ONE ASSEMBLER, AND SEVEN COPIES OF IT WAS THE ALTERNATIVE. Each card declares its GATES
     (a job, and whether the thing that job produces exists yet) and its CELLS (a figure, and the
     gates it needs); this turns them into the figures that can honestly be printed and the jobs
     still owed. Written per card it would be seven chances for the empty-state rule to drift, which
     is the shape this codebase pays for over and over ([[the-loop]] #54).
     ⛔ A FIGURE NEVER RENDERS BEFORE ITS SOURCE, AND A JOB NEVER SURVIVES ITS FIGURE. That pair is
     the whole output-honesty claim: the Hub prints `0 hrs` today the moment a week closes, whether
     or not anybody logged an hour, because a closed week supplies a SPAN and `sum()` returns null
     only when there is no span ([[lessons-paid-for]] #158).
     ⭐ A JOB'S PAYOFF NAMES THE CELLS IT IS THE *LAST* UNMET GATE FOR, so a cell is promised once, by
     the job that finishes it, rather than by every job on the way to it. A gate that finishes
     nothing states what it is FOR instead — a payoff there would be a schedule wearing a promise's
     clothes ([[lessons-paid-for]] #65: a prerequisite line that understates by one costs the
     operator a whole cycle). */
  _cardFrom(key, name, gates, cells) {
    const known = gates.map(g => g.key);
    /* ⛔ A CELL NAMING A GATE NOBODY DECLARED WOULD VANISH IN SILENCE, which is the worst shape
       available here: `met()` answers false, the figure never renders, and no job appears to explain
       it because no gate owns the key. It is a typo that removes a number from the operator's
       dashboard and reports nothing ([[lessons-paid-for]] #126 — every one of the dead links this
       project has shipped failed SILENTLY). Loud at runtime, censused in the harness. */
    cells.forEach(c => c.needs.forEach(k => { if (known.indexOf(k) < 0)
      console.error('section card ' + key + ': cell "' + c.label + '" needs gate "' + k + '", which is not declared'); }));
    const met = k => !!(gates.find(g => g.key === k) || {}).met;
    const live = cells.filter(c => c.needs.every(met));
    const dark = cells.filter(c => !c.needs.every(met));
    const lastGateOf = c => c.needs.filter(k => !met(k)).slice(-1)[0];
    /* ⭐ TWO GATES CAN BE MET BY ONE JOB, so the jobs are merged by their LABEL and the payoffs join
       up. Closing your first week produces the week's sales, its prime cost and its cost of goods,
       and printing "Close your first week" three times down one row would be the card keeping score
       in a different costume. */
    const steps = [];
    gates.filter(g => !g.met && dark.some(c => c.needs.indexOf(g.key) >= 0)).forEach(g => {
      const gives = dark.filter(c => lastGateOf(c) === g.key).map(c => c.label);
      const same = steps.find(s => s.label === g.label);
      if (same) { gives.forEach(n => { if (same.gives.indexOf(n) < 0) same.gives.push(n); });
                  if (!same.note && g.note) same.note = g.note; return; }
      steps.push({ label: g.label, screen: g.screen, from: g.from || null, gives: gives, note: g.note || '' });
    });
    steps.forEach(s => { s.sub = s.gives.length ? s.gives.join(', ') : s.note; });
    /* ⚠ `extra` IS AN OPTIONAL FIFTH ARGUMENT, NOT A PER-KEY BRANCH IN THE BODY BUILDER. The Run
       Audit card has something no other card has — four audits, each with a score, a last-run date
       and its own recovered figure — and a card that renders a block nobody else does is a real
       difference rather than a special case. Handing it in keeps `_cardBodyHTML` general, so a second
       card that grows its own block tomorrow needs no edit to the assembler. */
    return { key: key, name: name, stats: live, steps: steps, extra: arguments[4] || '' };
  },

  _inventoryCard(key, name) {
    const I = (App.inventoryData) || {};
    const products = (I.ic_products || []).filter(p => p.active !== false);
    const withPar  = products.filter(p => p.par_level != null && p.par_level !== '' && Number(p.par_level) > 0);
    const asc      = [...(I.ic_counts || [])].sort(App.cmpOldest);
    const latest   = asc.length ? asc[asc.length - 1] : null;
    const prev     = asc.length >= 2 ? asc[asc.length - 2] : null;
    /* ⚠ CALLED FOR ONE FIELD, `periodCost`, AND THAT IS DELIBERATE. Since Above par, Dead stock and
       Still to order moved onto their own engines this member supplies only the usage figure — and
       it is still the ONE DOOR for it, because nothing else computes the newest count PAIR's cost.
       Re-deriving that here to save the other work would be the second loop this file's own header
       exists to prevent ([[the-loop]] #54, [[lessons-paid-for]] #87). */
    const fig      = S.WeekReview._inventoryFigures();
    const trap     = CashEngine.trapped();
    /* ⚠ BARE, like the two above and for the same reason: a guarded `window.X &&` on a helper
       required for CORRECTNESS turns a loud failure into a quiet wrong number, and a silent $0 on
       this cell reads as "nothing left to order" ([[the-loop]] #40). Null when there is no count,
       which is the honest shape — the cell is gated on `count` and never renders then. */
    const still    = S.InventoryOrderSheet.stillToOrder();
    const m0       = v => App.fmtCurrency(v || 0, 0);
    const plu      = (n, one) => n + ' ' + one + (n === 1 ? '' : 's');

    /* ⛔ PRODUCTS AND PARS ARE ONE GATE, NOT TWO, AND THE SCREEN IS WHY: the par is a FIELD ON THE
       ADD PRODUCT FORM, so two steps pointing at `ic-product-setup` where one is a field of the
       other is padding. Measured on the live seed: 110 active products, 110 of them with a par. */
    const gates = [
      { key: 'setup', met: products.length > 0 && withPar.length > 0,
        label: products.length ? 'Set a par on your products' : 'Add your products and pars',
        /* ⚠ THE NOTE MOVES WITH THE LABEL, AND THE FIRST VERSION DID NOT. It read "So the count has
           something to measure" in BOTH halves, so an operator who had already added 110 products
           and was only missing pars was told why to add products. The two halves are different
           jobs answering different questions and the sentence has to say which one is outstanding
           ([[lessons-paid-for]] #149 — merging two branches carries one state's message into a
           state it is false for). Caught by rendering world 2, not by reading the diff. */
        note: products.length ? 'So the order sheet knows when you are short'
                              : 'So a count has something to measure', screen: 'ic-product-setup' },
      { key: 'count', met: !!latest,       label: 'Take a count',          screen: 'ic-take-inventory' },
      { key: 'usage', met: !!trap.hasData, label: 'Count again next week', screen: 'ic-take-inventory' }
    ];
    const dead = trap.items.filter(x => x.kind === 'dead').length;
    const over = trap.items.filter(x => x.kind === 'over').length;

    /* ⚠ EVERY CELL CARRIES ITS OWN BASIS IN ITS SUB LINE, because they are not all the same
       reading. Three are as-of-now (the shelf as counted, the order sheet's plan as it stands, what
       is tied up right now) and one is the newest count PAIR. Kyle's rule 3 for this rebuild is
       "overall standing, not last week", which makes the timeframe a per-stat decision and the sub
       line is where that decision is stated ([[output-honesty]] test 2: correct for the timeframe
       its label claims). */
    const cells = [
      { label: 'On the shelf', needs: ['count'], screen: 'ic-count-history',
        value: m0(trap.shelfValue), sub: latest ? 'counted ' + this._shortDate(latest.date) : '' },
      /* ⛔⛔ "STILL TO ORDER", NOT "BELOW PAR", AND THE DIFFERENCE WAS A LIVE DISAGREEMENT (Kyle's
         call, 2026-09-03). `belowParByVendor()` sums everything under par — $3,409 / 82 items on the
         demo — while the Order Sheet's own headline reads $1,964.45 / 44, because that page drops
         any vendor with an order already in flight. An operator read the Hub, clicked the cell, and
         met a different number one click later with nothing saying why. The cell asks the
         destination's own question now, through `stillToOrder`, which is the one door both read
         ([[the-loop]] #54 — when a number appears on two screens, the test is the AGREEMENT).
         ⚠ THE OTHER READERS OF `belowParByVendor` ARE DELIBERATELY UNTOUCHED. Week in Review's
         Below Par cell, `_stripMetrics` and the cash engine ask the WIDER question and are labelled
         for it; different quantities are allowed to differ ([[the-loop]] #57). */
      { label: 'Still to order', needs: ['setup', 'count'], screen: 'ic-order-sheet',
        value: m0(still ? still.total : 0), sub: plu(still ? still.items : 0, 'item') + ' to reorder' },
      /* ⛔⛔ TRAPPED CASH IS TWO CELLS, NOT ONE, AND THE GATE IS WHY (Kyle's call, 2026-09-03).
         `trapped()` reports `hasData: !!usageBase()`, which is null below TWO counts — but that is
         the DEAD-STOCK requirement. Above par needs only position against a par, and on a single
         count the engine was holding a real **$2,600** while the tile said "Count to surface this".
         Split, each half carries its own gate and each is honest at the moment it appears.
         ⭐ THE WORDS ARE `c-trapped`'S OWN. That page's stat row already reads "Dead Stock" and
         "Above Par", so the cells and the page they open say the same thing; a third spelling here
         is how one fact ends up with two names ([[lessons-paid-for]] #131).
         ⚠ AND NEVER THE TOTAL AS WELL. Showing `trap.total` beside its two halves would put a
         composite and its components in one row, which is the canonical double-count
         ([[output-honesty]] test 3).
         ⚠ ABOVE PAR NEEDS `setup` TOO: the test is `qty > par`, so a product with no par can never
         be over it. */
      { label: 'Above par', needs: ['setup', 'count'], screen: 'c-trapped',
        value: m0(trap.overPar), sub: plu(over, 'product') + ' over their par' },
      { label: 'Dead stock', needs: ['usage'], screen: 'c-trapped',
        value: m0(trap.dead), sub: plu(dead, 'product') + ' that never moved' },
      { label: 'Used this period', needs: ['usage'], screen: 'ic-report-usage',
        value: m0(fig.periodCost),
        sub: (prev && latest) ? this._shortDate(prev.date) + ' to ' + this._shortDate(latest.date) : '' }
    ];

    return this._cardFrom(key, name, gates, cells);
  },

  /* ── THE CARD, CLOSED ─────────────────────────────────────────────────────
     Kyle: *"each card started out as the height of the money band closed... and each one had it's
     own stat money band... then can be expanded open to see anything else."*
     ⚠ THERE IS NO CHEVRON YET AND THAT IS DELIBERATE. The expanded half is the next piece; a
     control that opens nothing is a dead control, and this project has shipped one of those under a
     green gate before ([[lessons-paid-for]] #159/#120 — a feature is not walked until the control an
     operator presses has been pressed).
     ⭐ A STAT CELL BORROWS THE MONEY BAND'S GRAMMAR (label, figure, basis) so the two read as the
     same kind of object one level apart. A STEP CELL DELIBERATELY DOES NOT: it is a job, not a
     reading, and giving every object on a page the same grammar is what made the previous Hub read
     as a spreadsheet. */
  /* ── THE WEEK ─────────────────────────────────────────────────────────
     Three pages: Close, Review, History. Every figure here is the CONFIRMED WEEK RECORD, read once
     through `_lastClosedWeek` — the member that already owns "which week is the last closed one"
     and answers it by the CALENDAR rather than by which row was saved last, because an operator may
     confirm mid-week.
     ⚠ WEEKS CLOSED IS THE ONE FIGURE HERE THAT IS OVERALL STANDING; the other three are that week's,
     and each says which week on its own line. Kyle's rule 3 makes the timeframe a PER-STAT decision,
     so the card states it per stat rather than putting one date on the whole row. */
  _weekCard(key, name) {
    const D = App.data || {};
    const lw = this._lastClosedWeek();
    const closed = (D.weeks || []).length;
    const m0 = v => App.fmtCurrency(v || 0, 0);
    const on = lw.end ? 'week ending ' + this._shortDate(lw.end) : '';
    const gates = [
      { key: 'closed', met: !!lw.end, label: 'Close your first week', screen: 'week-close' },
      /* A second gate with the SAME job, because a week record can exist without a prime figure and
         nothing else fixes that. The assembler merges the two into one line. */
      { key: 'prime', met: lw.prime != null, label: 'Close your first week', screen: 'week-close' },
      /* Each percentage gets its OWN gate rather than riding on `prime`, because a week record can
         carry one bucket and not another — a bar that sells no food has no food cost, and printing
         0.0% for it would be a confident zero over an absence. The assembler de-dupes by LABEL, so
         all three collapse into the one "Close your first week" job while each cell still waits for
         its own source. */
      { key: 'pour',  met: lw.pour  != null, label: 'Close your first week', screen: 'week-close' },
      { key: 'food',  met: lw.food  != null, label: 'Close your first week', screen: 'week-close' },
      { key: 'labor', met: lw.labor != null, label: 'Close your first week', screen: 'week-close' },
      /* ⚠ COGS IS THE ONE GATE ON THIS CARD THAT CLOSING A WEEK DOES NOT ALWAYS MEET, so its job is
         TAKE A COUNT rather than close the week — that is what produces the figure. The assembler
         de-dupes by label, so it stands as its own line beside the closing job rather than merging
         into it, which is correct: they are two different pieces of work. */
      { key: 'cogs',  met: lw.cogs  != null, label: 'Take a count', screen: 'ic-take-inventory',
        from: 'inventory' }
    ];
    /* ⚠ PRIME SITS BESIDE ITS OWN COMPONENTS AND IS NOT A TOTAL OF THEM. Prime is pour + food +
       labor; the three are shown side by side the way the old movement band showed them, never
       summed into one figure ([[output-honesty]] test 3 — never add a composite to its parts). */
    /* ⛔ NO "WEEKS CLOSED" CELL. Kyle, 2026-09-03: *"get rid of the weeks closed 13 since you
       started.. doesn't need to be there."* It counted the operator's own history back at them and
       is not a reading on the bar; every other cell on this card is a figure from the week itself.
       ⚠ `closed` STAYS AS A GATE. It is what the other cells wait on, and it is still what the one
       closing job promises — only the cell went. */
    const cells = [
      { label: 'Net sales', needs: ['closed'], screen: 'week-review', value: m0(lw.netSales), sub: on },
      { label: 'Prime cost', needs: ['prime'], screen: 'week-review',
        value: App.fmtPct(lw.prime), sub: on },
      { label: 'Bar pour cost', needs: ['pour'], screen: 'week-review',
        value: App.fmtPct(lw.pour), sub: on },
      { label: 'Food cost', needs: ['food'], screen: 'week-review',
        value: App.fmtPct(lw.food), sub: on },
      { label: 'Labor', needs: ['labor'], screen: 'week-review',
        value: App.fmtPct(lw.labor), sub: on },
      /* ⚠ ITS OWN GATE, NOT `closed`. A week closes without a cogs figure whenever the operator has
         not counted yet, and gated on the week existing this cell printed `$0` for them. */
      { label: 'Cost of goods', needs: ['cogs'], screen: 'week-history', value: m0(lw.cogs), sub: on }
    ];
    return this._cardFrom(key, name, gates, cells);
  },

  /* ── RUN AUDIT ─────────────────────────────────────────────────────
     ⛔⛔ THE TWO CROSS-AUDIT FIGURES HAVE NO SINGLE PAGE, AND THE DESTINATIONS ARE DERIVED RATHER
     THAN PICKED. `On the table` opens the audit holding the LARGEST share and says which one on the
     cell, so the door moves with the money instead of being somebody's preference — measured on the
     demo, Revenue holds $5,223 of $6,055, so pointing it at Profit because Profit is listed first
     would send an operator to the smaller pile. `Recovered` opens the Operations Audit because that
     page READS `Recovery.total()` itself (`hub-bar-cop-audit` sets `dollarsRecovered` from it), so
     it is the same figure at the destination rather than a page that merely sounds related
     ([[lessons-paid-for]] #83 — ask what the operator DOES there, never which name matches).
     ⚠ NO PER-AUDIT DOLLAR CELLS. The Operations and Cash audits produce action items with NO dollar
     impact (8 and 3 of them on the demo, $0 between them), so a per-audit money cell would print a
     confident $0 over three real findings — a ratio-as-dollar of the exact kind `noDollar` exists to
     prevent ([[output-honesty]]). The score is what those audits produce; the dollars are what the
     recovery audits produce, and they are counted once, together. */
  _auditCard(key, name) {
    const D = App.data || {};
    const newest = arr => (arr || []).filter(a => a && a.overall_score != null)
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0] || null;
    const opp = a => a ? (a.action_items || []).reduce((t, x) => t + (x.monthly_impact || 0), 0) : 0;
    const bc = newest(D.bar_cop_audits);
    const climb = this._auditClimb();
    const three = [
      { name: 'Profit',  screen: 'audit-tracker', opp: opp(newest(D.audits)) },
      { name: 'Revenue', screen: 'r-audit',       opp: opp(newest(D.revenue_audits)) },
      { name: 'Cash',    screen: 'c-audit',       opp: opp(newest(D.cash_audits)) }
    ];
    const total = three.reduce((t, o) => t + o.opp, 0);
    const top = three.slice().sort((a, b) => b.opp - a.opp)[0];
    /* ⚠ BARE. `recovery.js` assigns `window.Recovery`, so the name resolves; a guarded read here
       would print $0 on any load where the file is late, and a silent zero on THIS cell reads as
       "you have recovered nothing" ([[the-loop]] #40). */
    const rec = Recovery.total();
    const m0 = v => App.fmtCurrency(v || 0, 0);
    const gates = [
      { key: 'ops',   met: !!bc, label: 'Run your first audit', screen: 'bar-cop-audit' },
      { key: 'money', met: total > 0, label: 'Run a Profit, Revenue or Cash audit', screen: 'audit-tracker' },
      /* ⛔⛔⛔ "MARK A FIX AS DONE" WAS A CONTROL THE APP DOES NOT HAVE (Kyle, 2026-09-04: *"MARK A
         FIX AS DONE is not even a feature in the app anymore"*). He is right, and measuring it made
         it sharper: NOTHING marks a fix. `Recovery.total()` reads `_fixBaselines` plus `fix_log`,
         `ensureBaseline` is stamped automatically the moment a gap is DETECTED, and the only writer
         of a `fix_log` row in the whole tree is `App.logPriceChange` — a side effect of repricing an
         item, not a button. So the step told a new operator to go and press something that has not
         existed since the Fix layer was deleted ([[lessons-paid-for]] #116 — copy describing a
         deleted mechanism is FALSE, not a wording preference).
         ⭐ THE HONEST JOB IS THE ONE THAT ACTUALLY MOVES THE FIGURE. `compute()` measures the weeks
         at or after the baseline, so what produces a number is acting on a finding and then closing
         the week. The note was already true and stays. */
      { key: 'fixed', met: (rec.dollars || 0) > 0, label: 'Act on a finding, then close the week',
        screen: 'bar-cop-audit',
        note: 'Bar Cop measures what it was worth from your closed weeks. There is nothing to tick off' }
    ];
    const cells = [
      { label: 'Operations score', needs: ['ops'], screen: 'bar-cop-audit',
        value: bc ? String(bc.overall_score) : '',
        sub: climb ? (climb.delta >= 0 ? 'up ' : 'down ') + Math.abs(climb.delta) + ' since '
                     + this._shortDate(climb.firstDate)
                   : 'run ' + this._shortDate(bc && bc.date) },
      /* ⛔ PLAIN WORDS, BECAUSE THE DEMO IS THE SHOP WINDOW (Kyle, 2026-09-04: *"on the table / a
         month, most of it in revenue / recovered / 4 measured fixes .. these need to be said more
         plainly.. no one knows what that means.. so a potential user looking at the demo also has no
         idea what you are talking about"*). "On the table" and "Recovered" are Bar Cop nouns: they
         mean something to somebody who has used the product and nothing at all to the person
         deciding whether to. The figures are unchanged; only the words are
         ([[writing-style]] — a payoff may use only words the reader already owns). */
      { label: 'Money to go after', needs: ['money'], screen: top.screen,
        value: m0(total), sub: 'per month, most of it in ' + top.name },
      { label: 'Money you got back', needs: ['fixed'], screen: 'bar-cop-audit',
        value: m0(rec.dollars),
        sub: 'from ' + rec.fixes + ' thing' + (rec.fixes === 1 ? '' : 's') + ' you fixed' }
    ];
    /* ⚠ THE RINGS ARE THE CARD'S OWN BLOCK and they render only when the card is OPENED, like every
       other body block. Closed, this card is still three figures like the rest; opened, it is the
       three recovery audits with their dates, their movement and what each has paid back — which is
       the difference between a card that reads as a summary and the one Kyle called boring. */
    return this._cardFrom(key, name, gates, cells, this._auditRingsHTML());
  },

  /* ── THE FLOOR ─────────────────────────────────────────────────────
     ⛔⛔⛔ THIS CARD IS WHERE THE OUTPUT-HONESTY DEFECT LIVED, and the gates are the fix. Hours and
     overtime are gated on `hoursRows` — the COUNT of `lc_actuals` rows inside the closed week's span
     — not on the week existing. Gated the old way they printed `0 hrs` and `$0` the moment any week
     closed, for a bar that has never logged an hour ([[lessons-paid-for]] #158).
     ⚠ TWO GATES, NOT ONE, AND THE ROSTER COMES FIRST because an hours import only lands for people
     already on it — measured in `PosIngest`, where an unmatched NAME is a roster fix and never an
     auto-created person. That is why the job says so rather than just saying "log your hours".
     ⚠ OVER AND SHORT READS `sc_variances`, and its gate is that store's own rows in the same span.
     Its job is COUNT A DRAWER on Cash Control, which is where the count is taken; Over and Short is
     the read, and sending an operator there to do the work would be the wrong half of the pair
     ([[lessons-paid-for]] #47). */
  _floorCard(key, name) {
    const LB = App.laborData || {};
    const lw = this._lastClosedWeek();
    const m0 = v => App.fmtCurrency(v || 0, 0);
    const on = lw.end ? 'week ending ' + this._shortDate(lw.end) : '';
    const gates = [
      { key: 'roster', met: (LB.lc_positions || []).length > 0 && (LB.lc_staff || []).length > 0,
        label: 'Add your positions and staff', screen: 'lc-positions',
        note: 'An hours report only lands for people already on your roster' },
      { key: 'hours', met: lw.hoursRows > 0, label: 'Log a week of hours', screen: 'lc-log-hours' },
      /* ⛔⛔ TWO DOORS, AND THE STEP NAMED THE HARDER ONE AS IF IT WERE THE ONLY ONE (Kyle,
         2026-09-04: *"a user doesn't have to count a drawer to get over and short.. they can drop a
         drawer file.. you can't pick one over the other when there are two options.. and definitely
         don't want to pick the optional manual way over a simple file drop"*). Over and short comes
         from `sc_variances`, and the cash lane on CLOSE THE WEEK writes those rows from a dropped
         file exactly as the manual count does. Naming only the count made typing look compulsory.
         ⭐ THE DROP LEADS AND THE DOOR GOES WITH IT. `from: 'week'` is how a job whose page lives in
         another section keeps a working door — `week-close` is a row in The Week's nav, so the
         router resolves it there ([[lessons-paid-for]] #167). The manual count is named in the same
         breath so neither reads as the only way ([[two-doors-same-data]]). */
      { key: 'safe',  met: lw.overShortRows > 0, from: 'week', screen: 'week-close',
        label: 'Drop a drawer file, or count one by hand' }
    ];
    const cells = [
      { label: 'Hours logged', needs: ['roster', 'hours'], screen: 'lc-log-hours',
        value: Math.round(lw.hours || 0) + ' hrs', sub: on },
      { label: 'Overtime', needs: ['roster', 'hours'], screen: 'lc-overtime-watch',
        value: m0(lw.otCost), sub: on },
      { label: 'Over and short', needs: ['safe'], screen: 'cash-recon',
        value: App.fmtBal(lw.overShort || 0),
        sub: lw.overShortRows + ' drawer' + (lw.overShortRows === 1 ? '' : 's') + ' in'
             + (on ? ', ' + on : '') }
    ];
    return this._cardFrom(key, name, gates, cells);
  },

  /* ── MENUS ────────────────────────────────────────────────────────
     ⚠ OVER COST TARGET IS `App.menuItemsOverTarget()`, THE APP'S OWN RULE, never a re-derivation.
     A probe once re-implemented it as `cost / price * 100 > target` and flagged 37 of 78 items,
     because `menuTargetPct` returns NULL for beer and wine and `> null` is true for everything
     ([[harness-review-like-code]], the Revenue walk). The real answer was 9.
     ⚠ THE COSTED GATE IS THE FIGURE'S OWN PREREQUISITE: an item with no cost or no price cannot be
     over target, so a count taken before any item is costed would be a confident 0 over a menu
     nobody has priced. */
  _menusCard(key, name) {
    const D = App.data || {};
    const items = (D.menu_items || []);
    const costed = items.filter(i => (Number(i.cost) || 0) > 0 && (Number(i.price) || 0) > 0);
    const over = App.menuItemsOverTarget().length;
    const gates = [
      { key: 'items',  met: items.length > 0, label: 'Build your menu', screen: 'r-menu-items' },
      { key: 'costed', met: costed.length > 0, label: 'Put a cost and a price on each item',
        screen: 'r-menu-items', note: 'That is what turns a menu into a margin' }
    ];
    const cells = [
      { label: 'Menu items', needs: ['items'], screen: 'r-menu-items', value: String(items.length),
        sub: costed.length === items.length ? 'all costed' : costed.length + ' costed' },
      { label: 'Over cost target', needs: ['costed'], screen: 'r-menu-engineering',
        value: String(over), sub: 'of ' + costed.length + ' costed item' + (costed.length === 1 ? '' : 's') }
    ];
    return this._cardFrom(key, name, gates, cells);
  },

  /* ── EVENTS ──────────────────────────────────────────────────────
     ⚠ BOOKED AHEAD IS FORWARD-LOOKING AND SAYS SO. It is the quoted value of events still to come,
     which is not money in the register, so the cell counts EVENTS on its own line rather than
     dressing a pipeline as takings ([[output-honesty]] test 5 — a projection is never the headline
     that reads as banked cash).
     ⚠ A LOST BOOKING IS NOT PIPELINE. `stage` carries Lead / Quote Sent / Booked / Completed / Lost,
     and counting a Lost one would inflate the figure with work that is gone. */
  _eventsCard(key, name) {
    const D = App.data || {};
    const today = App.todayLocal();
    const up = (D.bookings || []).filter(b => b && String(b.event_date || '') >= today
      && String(b.stage || '') !== 'Lost');
    const ahead = up.reduce((t, b) => t + (Number(b.quoted_total) || 0), 0);
    const regs = (D.event_regulars || []).length;
    const gates = [
      { key: 'booked', met: up.length > 0, label: 'Take your first booking', screen: 'ev-bookings' },
      { key: 'regulars', met: regs > 0, label: 'Start a regulars list', screen: 'ev-regulars',
        note: 'The people worth calling when a date opens up' }
    ];
    const cells = [
      { label: 'Booked ahead', needs: ['booked'], screen: 'ev-bookings',
        value: App.fmtCurrency(ahead, 0),
        sub: up.length + ' event' + (up.length === 1 ? '' : 's') + ' still to come' },
      { label: 'Regulars', needs: ['regulars'], screen: 'ev-regulars', value: String(regs),
        sub: 'on your list' }
    ];
    return this._cardFrom(key, name, gates, cells);
  },

  /* ── BOOKS ─────────────────────────────────────────────────────────
     ⭐ BREAK-EVEN IS A BOOKS FIGURE BECAUSE THE BREAK-EVEN PAGE IS A BOOKS PAGE. Kyle's own example
     of rule 1: *"break even is in books.. that is where the user finds the break even page."*
     ⚠ AND ITS SECOND JOB LIVES IN ANOTHER SECTION. `summary()` needs the nut AND a week's sales, so
     with the bills in and no week closed the outstanding job is Close The Week — THE WEEK's page.
     `from` carries the door there; pointing it through the Books nav would resolve nothing.
     ⚠ THE MONEY-OUT WORDING AND DESTINATION ARE THE APP'S OWN. The Break-Even page's empty state
     already says *"Drop your bank statement, or enter your bills by hand, at the top of Money Out"*
     and sends the operator to `operating-expenses`, so this reuses that rather than inventing a
     third way to say it ([[lessons-paid-for]] #148).
     ⚠ LAST FULL MONTH, NOT THIS ONE. A month three days old is not a figure an operator can judge,
     and the cell names the month it is talking about. */
  _booksCard(key, name) {
    const D = App.data || {};
    const be = S.HubBreakEven.summary();
    const sf = CashEngine.survivalForecast(13);
    const d = new Date(App.todayLocal() + 'T00:00:00'); d.setDate(1); d.setMonth(d.getMonth() - 1);
    const mo = App.ymdLocal(d).slice(0, 7);
    const moName = d.toLocaleDateString('en-US', { month: 'long' });
    const outRows = (D.operating_expenses || []).filter(o => String(o.date || '').slice(0, 7) === mo);
    const outTotal = outRows.reduce((t, o) => t + (Number(o.amount) || 0), 0);
    const runway = !sf.hasData ? '' : (sf.runway == null ? '13+ wks'
      : sf.runway === 0 ? 'This wk' : sf.runway + ' wk' + (sf.runway === 1 ? '' : 's'));
    const m0 = v => App.fmtCurrency(v || 0, 0);
    const gates = [
      { key: 'out', met: outRows.length > 0, label: 'Log your money out', screen: 'operating-expenses',
        note: 'Drop your bank statement, or enter your bills by hand' },
      { key: 'be', met: !!be.hasData,
        label: outRows.length ? 'Close a week' : 'Log your money out',
        screen: outRows.length ? 'week-close' : 'operating-expenses',
        from: outRows.length ? 'week' : null },
      { key: 'cash', met: !!sf.hasData, label: 'Enter your opening balance', screen: 'c-position' }
    ];
    const cells = [
      { label: 'Money out', needs: ['out'], screen: 'operating-expenses', value: m0(outTotal),
        sub: moName + ', ' + outRows.length + ' bill' + (outRows.length === 1 ? '' : 's') },
      { label: 'Break-even', needs: ['be'], screen: 'breakeven', value: m0(be.breakEven),
        sub: be.hasData ? (be.ok ? 'cleared by ' + m0(be.delta) : m0(Math.abs(be.delta)) + ' short') : '' },
      { label: 'Cash runway', needs: ['cash'], screen: 'c-forecast', value: runway,
        sub: 'at today\'s burn' }
    ];
    return this._cardFrom(key, name, gates, cells);
  },

  /* ── THE CARD, OPEN ──────────────────────────────────────────────────────
     Kyle, 2026-09-03: *"the needs attention can go on each of their individual sections.... same
     with do this first.. same for biggest gain and worse drag.. this is the whole point of doing
     this... each section holds it's own data, info, needs to, best gain, worst drag, done this week,
     stats, do this first, etc.. whatever makes sense for that section to show to an operator."*
     ⛔⛔ SO THERE IS NO CROSS-SECTION BAND LEFT ON THIS PAGE. Needs Attention, the movement pairs,
     the gain/drag pair and Done This Week were four bands that mixed every section together; each
     one is now the part of it that belongs to the card it is on, filed by which section's nav holds
     the page it opens. Nothing is typed and nothing is duplicated: `_needsItems`, `_doneThisWeek`
     and `_bestWorst` remain the ONE source and this only asks each row where it lives.
     ⭐ THE TOP NEEDS ROW *IS* DO THIS FIRST. The list is severity-ordered, so a separate block naming
     the same row would be the same fact twice on one card. The only card that gets its own Do This
     First is Run Audit, where the biggest audit action item is a different thing from an alert.
     ⚠ A BLOCK WITH NOTHING IN IT DOES NOT RENDER. An empty heading is the dead space this rebuild
     exists to remove, and a green all-clear over a section nobody has set up is worse than silence
     ([[the-loop]] #72 — a count is only an all-clear if it could have counted anything). */
  _cardBodyHTML(card, lists) {
    const eyebrow = t => '<div class="sh" style="margin:0 0 8px;">' + esc(t) + '</div>';
    const block = (t, inner) => inner ? '<div style="margin-top:16px;padding-top:14px;'
      + 'border-top:1px solid var(--b2);">' + eyebrow(t) + inner + '</div>' : '';
    const go = s => 'S.Hub._goSectionRow(\'' + esc(card.key) + '\',\'' + esc(s) + '\')';

    const needRows = lists.needs.map(a =>
      '<div onclick="' + go(a.screen) + '" style="display:flex;align-items:center;gap:10px;'
      + 'padding:7px 0;cursor:pointer;min-width:0;">'
      + '<span style="width:6px;height:6px;border-radius:50%;flex-shrink:0;background:'
      + (a.sev === 'bad' ? 'var(--red)' : a.sev === 'warn' ? 'var(--amber)' : 'var(--t3)') + ';"></span>'
      + '<span style="flex:1;min-width:0;font-size:12px;color:var(--t1);white-space:nowrap;'
      + 'overflow:hidden;text-overflow:ellipsis;">' + esc(a.label || a.text || '') + '</span>'
      + (a.value ? '<span style="font-size:11px;color:var(--t3);white-space:nowrap;">' + esc(a.value) + '</span>' : '')
      + '</div>').join('');

    /* ⚠ EITHER HALF CAN BE LEGITIMATELY ABSENT and the card says nothing rather than inventing a
       reading. Two weeks where nothing in this section slipped has no drag, which is the truth. */
    const mv = m => !m ? '' :
        '<div style="flex:1;min-width:180px;">'
      + '<div style="display:flex;align-items:baseline;gap:9px;flex-wrap:wrap;">'
      +   '<span style="font-size:20px;font-weight:700;color:' + (m.up ? 'var(--green)' : 'var(--red)')
      +   ';">' + esc(App.fmtCurrency(Math.abs(m.o.dollars), 0)) + '</span>'
      +   '<span style="font-size:12px;color:var(--t2);">' + (m.up ? 'saved ' : 'lost ') + esc(m.o.unit) + '</span>'
      + '</div>'
      + '<div style="font-size:12px;color:var(--t1);margin-top:5px;">' + esc(m.o.label)
      +   ' <span style="color:var(--t3);">' + esc(m.o.was) + ' &rarr; ' + esc(m.o.now) + '</span></div>'
      + '</div>';
    const moved = (lists.gain || lists.drag)
      ? '<div style="display:flex;gap:20px;flex-wrap:wrap;">'
        + mv(lists.gain ? { o: lists.gain, up: true } : null)
        + mv(lists.drag ? { o: lists.drag, up: false } : null) + '</div>' : '';

    /* ⚠ THE TICK HERE IS NOT A CHECKLIST TICK, AND THE DIFFERENCE IS RULE 4's WHOLE SUBJECT. A JOB
       is never ticked — it is removed. A DONE THIS WEEK row is a DATED RECORD: the mark appears
       because a count, a delivery or an order exists with a date on it, so there is nothing here a
       person can tick by hand and nothing to fake. It is Close The Week's own mark, at 18px, because
       these are the two pages an operator moves between every week. */
    const doneRows = lists.done.map(r =>
      '<div onclick="' + go(r.screen) + '" style="display:flex;align-items:center;gap:10px;'
      + 'padding:7px 0;cursor:pointer;">'
      + (r.done
          ? '<span style="width:18px;height:18px;border-radius:50%;flex-shrink:0;display:flex;'
            + 'align-items:center;justify-content:center;background:var(--green);color:var(--bg);'
            + 'font-size:10px;font-weight:800;">&#10003;</span>'
          : '<span style="width:18px;height:18px;border-radius:50%;flex-shrink:0;'
            + 'border:1px solid var(--b1);"></span>')
      + '<span style="flex:1;min-width:0;font-size:12px;color:' + (r.done ? 'var(--t1)' : 'var(--t2)') + ';">'
      + esc(r.label) + '</span>'
      + '<span style="font-size:11px;color:var(--t3);white-space:nowrap;">'
      + (r.when ? 'Last done ' + esc(r.when) : 'Not yet') + '</span></div>').join('');

    /* ⚠ THE HEADING FOLLOWS THE ROWS' OWN WINDOW. Books' one activity row is a calendar MONTH
       (money out is logged against a month), so heading it "Done this week" would be a label that is
       false about its own contents ([[output-honesty]] test 2). Read off the rows rather than
       hard-coded per card, so a monthly row added to another section takes its heading with it. */
    const doneSpans = new Set(lists.done.map(r => r.span || 'week'));
    const doneHead = (doneSpans.size === 1 && doneSpans.has('month')) ? 'Done this month' : 'Done this week';
    const body = block('Audit scores', card.extra || '')
              + block('Needs attention', needRows) + block('What moved', moved)
              + block(doneHead, doneRows);
    /* ⚠ A CARD WITH NOTHING TO OPEN SAYS SO RATHER THAN OPENING ON AN EMPTY BOX. It happens: a
       section with no alerts, no movement and no dated activity this week is a section running
       quietly, and that is a sentence, not a blank. */
    return body || '<div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--b2);'
      + 'font-size:12px;color:var(--t3);">Nothing needs you here this week.</div>';
  },

  _sectionCardHTML(card) {
    /* ⚠ A CELL HAS A CEILING, AND A CARD WITH TWO CELLS IS WHY. On plain `flex:1` a two-figure card
       stretches each cell to nearly 600px while the five-figure card beside it sits at 210px, so the
       thin sections read as a half-empty band — the exact objection that started this rebuild
       ([[hub-section-cards]]: *"the money band only matters if they are using the app to fill them..
       otherwise you have an almost empty band up there for no reason"*). Capped, every card's
       columns line up down the page whatever it holds. */
    /* ⛔⛔ A FIXED SIX-COLUMN GRID, NOT FLEX, AND THE REASON IS ALIGNMENT ACROSS CARDS. Kyle,
       2026-09-03: *"all the columns in each card need to be aligned with each other from one card to
       the next."* On `flex:1 1 132px` every card sized its own cells to its own count, so Inventory's
       five and The Week's six landed on different x positions all the way down the page and the
       stack read as six unrelated widths. Six fixed tracks means column 2 is column 2 on every card
       whatever it holds, and a card with two cells simply leaves four empty.
       ⚠ SIX BECAUSE THE WIDEST CARD HAS SIX. The Week is the ceiling now that Weeks closed is gone;
       a seventh cell anywhere would need this number moved, which is why it is stated here and
       asserted in the harness rather than left to be noticed on the page. */
    const cell = (inner, go) => '<div class="hub-sec-cell" onclick="' + go + '">' + inner + '</div>';
    /* ⚠ `from` IS HOW A JOB THAT LIVES IN ANOTHER SECTION KEEPS A WORKING DOOR. Break-even needs a
       closed week, and Close The Week is THE WEEK's page — pointing a Books step at it through the
       Books nav would resolve nothing and land the operator on the section instead. The dependency
       is declared rather than fudged, so the census can read it. */
    const enter = c => 'S.Hub._goSectionRow(\'' + esc(c.from || card.key) + '\',\'' + esc(c.screen) + '\')';
    const stat = s => cell(
        '<div style="font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--t3);margin-bottom:7px;">' + esc(s.label) + '</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:28px;font-weight:600;letter-spacing:-0.3px;line-height:0.95;color:var(--t1);">' + esc(s.value) + '</div>'
      + (s.sub ? '<div style="font-size:10px;color:var(--t4);margin-top:6px;">' + esc(s.sub) + '</div>' : ''),
      enter(s));
    const step = s => cell(
        '<div style="font-size:13px;font-weight:700;color:var(--t1);line-height:1.3;">' + esc(s.label) + '</div>'
      + (s.sub ? '<div style="font-size:11px;color:var(--t3);margin-top:6px;line-height:1.4;">' + esc(s.sub) + '</div>' : ''),
      enter(s));
    const parts = card.stats.map(stat).concat(card.steps.map(step));
    /* ⛔ THE HEAD OPENS THE CARD; THE SECTION NAME INSIDE IT OPENS THE SECTION. Two jobs on one
       control was the alternative and it is the mistake the section-links bar already refuses:
       *"a link that both opened a menu and moved you was two jobs on one control, and the move
       happened before you had read the menu."* So the row toggles, the name navigates, and the
       name stops the toggle from firing underneath it.
       ⚠ `hub-sec-head` AND THE SELECTOR IN `render` MOVE TOGETHER OR EVERY CARD IS DEAD ON CLICK.
       A node harness cannot click, so the class is parsed out of this markup and the selector out
       of the wiring and the two are asserted against each other — the defect that killed all six
       Close The Week rows under a green gate ([[the-loop]] integrity #11, [[lessons-paid-for]] #27). */
    const open = this._openCard() === card.key;
    return '<div style="background:var(--surface);border:1px solid var(--b-edge);border-radius:var(--r);padding:14px 18px 16px;">'
      /* ⭐ THE SECTION NAME IS THE PAGE'S ONE PIECE OF COLOUR (Kyle, 2026-09-03: *"it needs something
         design wise.. not a lot of color.. but a little somewhere at minimum the section names at
         least in gold text"*). Gold is this product's accent and the names are what an operator
         reads down the page, so it lands on the seven words that structure the whole screen and
         nowhere else ([[color-system-locked]] — the token, never a hex). */
      + '<div class="hub-sec-head' + (open ? '' : ' collapsed') + '" data-sec="' + esc(card.key) + '" '
      /* ⛔ THE HEAD IS A BAND WITH A RULE UNDER IT AND IT BLEEDS TO THE CARD'S EDGES (Kyle,
         2026-09-04, pointing at the Log Voids / Comps head: *"on each card put header divider line
         and move the chevron next to the card section name and the hide button stays aligned right
         side"*). The negative margin cancels the card's own 14px/18px padding so the rule runs edge
         to edge the way every headed card in the app already draws it, and the top radius matches
         the card's so the band cannot poke out of the corner. This is the shape of
         `App.collapsibleCardTitle`, which is what the screen he sent is built from.
         ⚠ THE FILL READS THE TOKEN, NEVER A COLOUR. `--card-head` and `--surface` hold the same
         value today, so the band is visually inert until the day he splits them — which is exactly
         the day a head that had hard-coded the body colour would silently stop matching every other
         card in the app ([[color-system-locked]] — the token, never a hex).
         ⚠ AND THE HEAD IS NEVER THE WHOLE BOX HERE, so it needs no collapsed special case. The stat
         row renders whether the card is open or shut and only the BODY is gated, so there is always
         something under the rule. `.card` had to give up its bottom padding for exactly the
         opposite reason, and copying that here would cut a real card's real padding. */
      +   'style="display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer;'
      +   'background:var(--card-head);margin:-14px -18px 12px;padding:13px 18px;'
      +   'border-bottom:1px solid var(--b-edge);border-radius:var(--r) var(--r) 0 0;">'
      /* ⭐ THE NAME AND THE CHEVRON ARE ONE GROUP, so the pair reads as one control on the left and
         Hide owns the far right whatever the name's length. The flex spacer that used to sit
         between them is gone: it pushed the chevron to the far edge, away from the word it belongs
         to, which is the thing being fixed.
         ⛔⛔ THE SHARED CHEVRON, NOT A SECOND ONE. This was a hand-rolled 11px span that rotated
         180° when open, so it pointed the wrong way in BOTH states and had no hover, while every
         other accordion in the app (Week in Review, Close The Week, Build Schedule, the import
         confirm shell, Product Setup) uses `.card-chevron`: 14px, `--t3`, gold on hover, DOWN when
         open and `rotate(-90deg)` when closed. Kyle caught all three ([[the-loop]] #95 — grep for
         the mechanism before building one, the existing callers are the spec).
         ⭐ AND IT TRAILS THE NAME FOR THE REASON THE APP'S OWN HEAD ALREADY GIVES:
         `collapsibleCardTitle` says the caret trails the title so the title starts at the same left
         edge on every card, and so the caret and the right-hand action are never adjacent.
         ⚠ The two hub-specific chevron rules live in this file's own style block rather than in
         `style.css`, because markup in a script plus layout in a stylesheet is a two-file atomic
         unit and there is no such thing ([[lessons-paid-for]] #66). */
      /* ⛔⛔⛔ THE WHOLE HEAD OPENS THE CARD, AND THE NAME NO LONGER NAVIGATES (Kyle, 2026-09-04:
         *"the section titles when clicked should open the card... right now if you click inventory it
         takes you to inventory and if you click the other section titles it does nothing... so the
         entire header if clicked should open the card.. except for the Hide button"*).
         ⛔ MEASURED, AND IT WAS WORSE THAN ONE ODD ROW: `App.jumpToSection` looks the key up in
         `App._SECTION_DASH`, which holds MODULE keys — profit, revenue, cash, events, inventory,
         labor, shift. Of the seven card keys only `inventory` and `events` are in it, so TWO titles
         navigated and FIVE returned silently. That is the dead-row class this project has shipped
         three times, and its own guard already says why: jumpToSection only knows module keys, so a
         hub section handed to it returns on the missing lookup ([[lessons-paid-for]] #120/#126).
         ⭐ HIS FIX REMOVES THE CLASS RATHER THAN REPAIRING IT. With no second job on the row there
         is no key to resolve and nothing to go dead — the rail is how an operator reaches a section,
         and the card head does one thing ([[the-loop]] #90 — remove the window, do not police it). */
      + '<span style="display:inline-flex;align-items:center;gap:8px;min-width:0;">'
      +   '<span style="font-size:13px;font-weight:700;color:var(--gold);">'
      +     esc(card.name) + '</span>'
      +   '<span class="card-chevron" aria-hidden="true">&#9662;</span>'
      + '</span>'
      /* ⛔ THIRD JOB ON THE HEAD ROW, AND IT STOPS THE TOGGLE LIKE THE NAME DOES. The row toggles,
         the name navigates, this hides — three controls, three jobs, none of them firing each
         other. A hide that also opened the card would be the two-jobs-on-one-control mistake the
         section-links bar already refuses. */
      /* ⚠ A GHOST BUTTON, NOT A WORD. Kyle: *"the hide needs to be a ghost button because just the
         word next to the chevron is confusing on that they are two different things."* He is right
         and it is the same reasoning as the section name: three controls sharing one row have to
         LOOK like three controls, or the row reads as one label with a decoration. */
      + '<button type="button" class="btn btn-ghost btn-sm" '
      +   'onclick="event.stopPropagation();S.Hub._setCardHidden(\'' + esc(card.key) + '\',true)" '
      +   'title="Hide this section from the Hub" '
      +   'style="font-size:10px;padding:3px 9px;flex-shrink:0;">Hide</button>'
      + '</div>'
      /* ⛔⛔ THE ROW CARRIES NO CLASS, AND THE GATE CAUGHT THE FIRST VERSION THAT BORROWED THE MONEY
         BAND'S. Two things were wrong with renting it. It is that band's INNER PADDING (`style.css`,
         18px 20px), which this card does not want on top of its own. And `verify-card-head-band`
         LOCATES the money band by walking back from the first occurrence of that class in this file
         — these members sit above `render`, so the borrowed name moved the locator onto THIS card:
         C3 resolved a stranger and reported it green while C4 correctly said the stranger has no
         `overflow:hidden`. A false green feeding a real red, which is the most confusing pair a
         suite can print, and the pin's own comment already described it from the last time
         ([[lessons-paid-for]] #11/#70/#101 — a class name is a namespace claim, and the pass that
         rents one does not know who else is renting it. Grep the stylesheet before choosing one).
         ⚠ AND THE NAME IS NOT SPELLED IN THIS COMMENT EITHER. The first repair named it here, which
         put the literal string ABOVE the real one and moved the locator a second time — integrity
         #2 again, the prose written in the same edit naming the thing the check is looking for
         ([[lessons-paid-for]] #154/#161). The locator now de-comments; this stays indirect anyway.
         ⚠ `hub-stat-div` IS deliberately kept: it is the same divider object as the money band's, it
         carries the 768px hide rule from this file's own style block, and nothing locates by it. */
      /* ⚠ THE DIVIDERS ARE A BORDER NOW, NOT ELEMENTS. As flex children they were grid items in the
         wrong sense — a `<div>` between every pair would take its own track and knock the columns
         out of line, which is the thing this row exists to fix. A left border on every cell but the
         first of each row draws the same line and cannot affect the tracks. */
      + '<div class="hub-sec-stats">'
      +   parts.join('')
      + '</div>'
      + (open ? this._cardBodyHTML(card, this._sectionLists(card.key)) : '')
      + '</div>';
  },

  /* ⛔⛔ ONLY INVENTORY HAS A BUILDER TODAY, BY KYLE'S BUILD ORDER: *"build the inventory card alone
     first, both states, and put it in front of me before a line of the other six."* A key with no
     builder renders NOTHING rather than an empty card, so the page cannot grow a row of blanks
     while the other six are written. ⛔ AND THE WHOLE PAGE SHIPS AT ONCE — the Hub is the marketing
     screenshot and the live demo, and one section card beside six old bands must never reach
     production ([[lessons-paid-for]] #19). */
  /* ── THE FOUR AUDITS, WITH THEIR SCORES, THEIR DATES AND WHAT EACH HAS PAID BACK ─────────────
     Kyle, walking the pushed build: *"why is this so boring and not giving the operator anything..
     it could have the 3 other audit scores.. in the color score rings with their last run date just
     like on the other hub.. it could have their current score vs their last score.. and there is no
     cash freed to date number for the cash audit."*
     ⭐ THE RECOVERED FIGURE IS PER AUDIT, FROM THE ENGINE THAT ALREADY SPLITS IT. `Recovery
     .moduleSummary(mod).recovered` is the same arithmetic as the cross-audit total the card's own
     cell shows, asked one module at a time — so the Cash ring's figure IS the cash freed to date and
     it cannot disagree with the headline above it ([[the-loop]] #54). No second loop, no new rule.
     ⚠ BARE, like `Recovery.total()` twelve lines up and for the same reason: `recovery.js` assigns
     `window.Recovery`, so the name resolves, and a guarded fallback would print a quiet $0 for a bar
     that has recovered real money ([[the-loop]] #40).
     ⚠ THE DELTA IS AGAINST THE PREVIOUS RUN OF THE SAME AUDIT, and it is null when there is only one
     on file. A first audit has nothing to be up or down against, and printing +0 there would be a
     measured-looking zero over an absence ([[lessons-paid-for]] #158). */
  _auditReadings() {
    const D = App.data || {};
    const one = (arr, name, screen, mod) => {
      const all = (D[arr] || []).filter(x => x && x.date && x.overall_score != null)
        .sort((x, y) => String(y.date).localeCompare(String(x.date)));
      const a = all[0], prev = all[1];
      const sum = Recovery.moduleSummary(mod);
      return { name: name, screen: screen, mod: mod,
               score: a ? a.overall_score : null,
               date:  a ? a.date : null,
               delta: (a && prev) ? (a.overall_score - prev.overall_score) : null,
               recovered: sum ? sum.recovered : 0 };
    };
    return [
      one('audits',         'Profit',  'audit-tracker', 'profit'),
      one('revenue_audits', 'Revenue', 'r-audit',       'revenue'),
      one('cash_audits',    'Cash',    'c-audit',       'cash')
    ];
  },

  /* ⭐ THE REAL RING, NOT A HAND-DRAWN ONE. `AuditUI.scoreRing` is the SVG arc every audit section
     header already uses "so they read identically", and the last time this card was built I drew a
     bordered div with my own colour ladder instead — a second implementation of a shared job that
     looked nothing like the audits. `App.scoreColor` is that ladder, so the number under the ring
     cannot drift from the ring's own fill ([[the-loop]] #95 — the existing callers are the spec). */
  _auditRingsHTML() {
    const rows = this._auditReadings();
    const ring = m => {
      const has = m.score != null;
      const svg = has && typeof AuditUI !== 'undefined' && AuditUI.scoreRing
        ? AuditUI.scoreRing(m.score, 44)
        : '<div style="width:44px;height:44px;border-radius:50%;border:2px solid var(--b2);display:flex;'
          + 'align-items:center;justify-content:center;font-size:13px;color:var(--t4);">-</div>';
      /* ⚠ COLOUR ANSWERS GOOD OR BAD, NEVER UP OR DOWN, and a score rising is good for every one of
         these three. The arrow is direction and the colour is judgement; conflating them is what
         makes a generic dashboard unable to say anything useful. */
      const d = m.delta;
      const deltaTxt = d == null ? ''
        : '<div style="font-size:10px;font-weight:700;margin-top:3px;color:'
          + (d === 0 ? 'var(--t4)' : d > 0 ? 'var(--green)' : 'var(--red)') + ';">'
          + (d === 0 ? 'no change' : (d > 0 ? '&#9650; +' : '&#9660; ') + d + ' pts') + '</div>';
      return '<div onclick="S.Hub._goSectionRow(\'audit\',\'' + esc(m.screen) + '\')" '
        + 'style="flex:0 0 auto;min-width:110px;cursor:pointer;display:flex;flex-direction:column;'
        + 'align-items:flex-start;text-align:left;">'
        + svg
        + '<div style="font-size:11px;color:var(--t1);margin-top:7px;font-weight:700;">' + esc(m.name) + '</div>'
        + '<div style="font-size:10px;color:var(--t4);margin-top:2px;">'
        +   (m.date ? 'run ' + esc(this._shortDate(m.date) || m.date) : 'never run') + '</div>'
        + deltaTxt
        /* ⚠ THE RECOVERED LINE RENDERS ONLY WHEN THERE IS SOMETHING TO SAY. A `$0` under every ring
           on a new account is three confident zeros where the honest answer is that nothing has been
           measured yet, and the audit above it already says "never run". */
        + '</div>';
    };
    /* ⛔ LEFT, NOT CENTRED, AND NO MONEY UNDER THE RING (Kyle, 2026-09-04: *"the 3 audit scores in
       the drop down align left.. not centered.. and remove the gold numbers.. just the score, last
       run and score point difference up/down"*). Three centred columns floated in the middle of a
       full-width card while every other block on the page starts at the left edge, and the gold
       `$X back` line repeated the Money you got back cell six inches above it.
       ⚠ `flex:0 0 auto` RATHER THAN `flex:1`, or three items still spread themselves across the
       width and "left" would be true of the text inside each column and false of the columns. */
    return '<div style="display:flex;gap:28px;flex-wrap:wrap;">' + rows.map(ring).join('') + '</div>';
  },

  /* ── HIDING A CARD ──────────────────────────────────────────────────────────────────────────
     Kyle's spec, in his words: *"each card can be hidden if the user wants."* It is the answer to a
     bar that never books an event seeing an Events job on its Hub forever.
     ⭐ ON THE ACCOUNT, NOT localStorage, and that is the same reasoning the Get Started card's
     visibility was settled on: hiding Events on the office laptop and finding it back on the phone
     reads as a bug, so the choice has to follow the operator rather than the device.
     ⚠ REVERSIBLE, AND THE WAY BACK IS ON THE PAGE. A hide with no restore is a one-way door an
     operator cannot see out of, and this project has already paid for making a one-way operation
     reversible after the fact ([[the-loop]] #44 — everything the one-way version destroyed becomes
     a fact the reverse has to reconstruct). Nothing is destroyed here: the card is filtered, its
     name sits at the foot of the list, and one press brings it back.
     ⚠ AN UNRECOGNISED VALUE READS AS "NOTHING HIDDEN". A card coming back is a nuisance; a card
     gone because a stray value looked like a hide is a section the operator cannot find. */
  /* ⛔⛔ WHICH CARD IS OPEN IS REMEMBERED, AND IT DEFAULTS TO INVENTORY (Kyle, 2026-09-04: *"i
     would make inventory card open by default on first landing on the hub both on empty state and
     full state.... and only change once a user clicks/closes/opens one.. and then it remembers the
     users last state... so if they close inventory and leave and come back then it is closed... but
     for the demo and new user empty state it should always land with inventory card open."*)
     ⭐ THIS REVERSES A DECISION, IT DOES NOT DRIFT FROM ONE. The page shipped all-closed by design
     and `verify-hub-section-cards` N4 recorded that in writing. The pin was right about the old
     rule; the rule changed, so the pin is re-pointed rather than loosened ([[the-loop]] #19 — when
     a change turns a pin red, the first question is whether the pin was ever right, and here it
     was, up to today).
     ⛔ THERE IS NO FIELD ANY MORE, AND THAT IS THE POINT. The old in-memory one plus a stored
     copy is two sources for one fact, and the render would race the save. One door: the account is
     the value, both the render and the toggle read it through this member
     ([[lessons-paid-for]] #14 — a default is decided by whoever assigns first, so leaving an
     assignment anywhere else would make this accessor inert).
     ⚠ THE THREE STATES ARE DISTINCT AND ONLY TWO OF THEM ARE STORED. Nothing stored at all is a
     new account, the demo, or an operator who has never touched a head: Inventory opens. An empty
     string is a REAL CHOICE the operator made (they closed the one that was open) and it survives.
     A stray value of any other type reads as the default rather than as "all closed", because a
     Hub that lands with nothing open is a page of headings ([[empty-is-not-an-answer]] — an empty
     control is not an answer, and neither is a value nobody wrote). */
  _openCard() {
    const v = ((App.data || {}).settings || {}).hub_open_card;
    if (typeof v !== 'string') return 'inventory';
    return v || null;
  },
  /* ⚠ SYNCHRONOUS IN MEMORY, SAVED IN THE BACKGROUND, AND THAT IS DELIBERATELY NOT WHAT
     `_setCardHidden` DOES. Hiding a card awaits the write before repainting, which is fine for a
     decision an operator makes once. An accordion toggle is pressed constantly, and awaiting a
     network round trip before the card opens would put a visible stall on the most-used control on
     the page. The value is true in memory before `render` reads it, so the repaint cannot race it.
     ⚠ THE DEMO CHANGES IN MEMORY AND SAVES NOTHING, exactly as every other demo write does
     ([[live-demo-mode]]). A fresh load re-seeds, so the shop window always lands on Inventory,
     which is the half of his rule the storage would otherwise break. */
  _setOpenCard(key) {
    const s = (App.data || {}).settings;
    if (!s) return;
    s.hub_open_card = key || '';
    if (!App.demoMode) {
      Promise.resolve(App.saveKey('settings')).catch(e => console.error('open-card save failed', e));
    }
  },
  _hiddenCards() {
    const v = ((App.data || {}).settings || {}).hub_hidden_cards;
    return new Set(Array.isArray(v) ? v.filter(k => typeof k === 'string') : []);
  },
  async _setCardHidden(key, hidden) {
    const s = (App.data || {}).settings;
    if (!s) return;
    const cur = this._hiddenCards();
    if (hidden) cur.add(key); else cur.delete(key);
    s.hub_hidden_cards = [...cur];
    /* ⚠ THE DEMO CHANGES IN MEMORY AND SAVES NOTHING, which is what the demo already promises
       everywhere else: a visitor's edits are session-only ([[live-demo-mode]]). Returning early
       instead would leave a control on the shop window that does nothing when pressed, and a dead
       control is the defect this project ships most ([[lessons-paid-for]] #120/#159). */
    if (!App.demoMode) {
      try { await App.saveKey('settings'); }
      catch (e) { console.error('hidden-card save failed', e); }
    }
    if (App.showHub) App.showHub();
  },
  /* The way back. It renders only when something is hidden, so a Hub with every section on shows
     nothing at all here ([[empty-state-day1]] — a block with nothing to say does not draw a heading). */
  _hiddenFootHTML(plan, hidden) {
    const rows = plan.filter(r => hidden.has(r.key));
    if (!rows.length) return '';
    return '<div style="margin-top:14px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;'
      + 'font-size:11px;color:var(--t3);">'
      + '<span>Hidden:</span>'
      + rows.map(r => '<span onclick="S.Hub._setCardHidden(\'' + esc(r.key) + '\',false)" '
          + 'title="Show this section again" '
          + 'style="cursor:pointer;color:var(--t2);border:1px solid var(--b-edge);'
          + 'border-radius:6px;padding:3px 9px;">' + esc(r.name) + '</span>').join('')
      + '</div>';
  },

  _sectionCards() {
    const hidden = this._hiddenCards();
    /* ⚠ THE PLAN IS READ ONCE AND BOTH HALVES READ IT, so the foot can only ever name a section the
       page would otherwise have drawn. Filtering the plan and then re-deriving the hidden names from
       somewhere else is how the two would start disagreeing ([[the-loop]] #54). */
    const plan = this._sectionCardPlan().filter(r => typeof r.build === 'function');
    const cards = plan.filter(r => !hidden.has(r.key))
      .map(r => { const card = r.build.call(this, r.key, r.name); return card ? this._sectionCardHTML(card) : ''; })
      .filter(Boolean).join('<div style="height:12px;"></div>');
    return cards + this._hiddenFootHTML(plan, hidden);
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

    const barName = s.bar_name || 'Your Operation';


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
            <div class="hub-greet" style="font-size:19px;font-weight:700;color:var(--t1);">${esc(this._greeting())}, <span id="hub-greet-account-switcher" class="hub-greet-bar">${esc(barName)}</span></div>
            <div style="font-size:12px;color:var(--t3);">${esc(dateLine)}</div>
          </div>
          <div class="hub-grid-row">${this._sectionCards()}</div>
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
        /* ── THE SECTION CARD'S STAT ROW ──────────────────────────────────────────────────────
           ⚠ NO BACKTICKS IN THIS BLOCK, and it is not a style choice: this sits inside a TEMPLATE
           LITERAL, so one backtick ends the string and takes the whole file with it. The rule was
           already written twelve lines below and I broke it anyway on the first pass.
           SIX FIXED TRACKS so column 2 is column 2 on every card down the page, whatever that card
           holds. A card with two cells leaves four empty rather than stretching its two across the
           width, which is what made the stack read as six unrelated layouts.
           The divider is a LEFT BORDER on every cell but the first of a row, so it cannot take a
           track of its own; nth-child(6n+1) is the first of each row at six columns. */
        .hub-app .hub-sec-stats{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));row-gap:16px;}
        .hub-app .hub-sec-cell{cursor:pointer;min-width:0;padding:0 14px;border-left:1px solid var(--b2);}
        .hub-app .hub-sec-cell:nth-child(6n+1){border-left:0;padding-left:0;}
        /* THE CHEVRON, on the app's shared rules. The shared card-chevron class supplies the glyph
           size, the colour and the transition in style.css; these two say what a HUB card head does
           with it, and they are the same pair every other accordion in the app declares. */
        .hub-app .hub-sec-head:hover .card-chevron{color:var(--gold);}
        .hub-app .hub-sec-head.collapsed .card-chevron{transform:rotate(-90deg);}
        /* ⚠ THE PHONE GETS TWO TRACKS, NOT SIX. Kyle on the mobile view: *"that just looks pretty
           bad."* Six 1fr tracks on a 375px screen is a 60px column, so a 28px figure wrapped and
           every label stacked into a ragged column. Two keeps the pairs readable and the cards the
           same shape as each other; the borders re-key to the first of each PAIR. */
        @media (max-width:768px){
          .hub-app .hub-sec-stats{grid-template-columns:repeat(2,minmax(0,1fr));column-gap:0;}
          .hub-app .hub-sec-cell:nth-child(6n+1){border-left:1px solid var(--b2);padding-left:14px;}
          .hub-app .hub-sec-cell:nth-child(2n+1){border-left:0;padding-left:0;}
        }
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
    /* ⛔ THE ROW IS BOUND TO THE CLASS THE HEAD RENDERS, AND ONE CLICK IS ALL THAT PROVES IT. A
       feature is not walked until the control an operator presses has been pressed, and this project
       has shipped a nav that rendered perfectly and did nothing on click three times
       ([[lessons-paid-for]] #120/#126). `verify-hub-section-cards` parses this selector out of the
       source and the class out of the markup and asserts the two against each other.
       ⚠ ONE OPEN AT A TIME, and clicking the open one closes it. */
    container.querySelectorAll('.hub-sec-head').forEach(h => h.addEventListener('click', () => {
      const k = h.getAttribute('data-sec');
      this._setOpenCard(this._openCard() === k ? '' : k);
      this.render(this._stage || container);
    }));
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
