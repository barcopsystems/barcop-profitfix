'use strict';

S.Hub = {

  AUDIT_STALE: 35,
  WEEKLY_CUTOFF: 8,
  _sidebarCollapsed: false,

  // ── Bar Cop Audit context sidebar ─────────────────────────────────────────
  // The Hub shell's sidebar is context-aware. The Bar Cop Audit pages get this
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
    return ''
      + '<div class="nav-section">Audit</div>'
      + row('bar-cop-audit', 'Bar Cop Audit', 'audit', [])
      + '<div class="nav-section">By Recovery System</div>'
      + row('enter', 'Profit Audit',  'profit',  [['data-mod', 'profit'],  ['data-screen', 'audit-tracker']])
      + row('enter', 'Revenue Audit', 'revenue', [['data-mod', 'revenue'], ['data-screen', 'r-audit']])
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
      help:    '<circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M7 6.5a1.5 1.5 0 0 1 3 0c0 1-1.5 1.5-1.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8.5" cy="12" r="0.6" fill="currentColor"/>',
      bug:     '<ellipse cx="8.5" cy="9" rx="3.5" ry="4.5" stroke="currentColor" stroke-width="1.3"/><path d="M5 9H2.5M14.5 9H12M5.5 5L4 3.5M11.5 5L13 3.5M5.5 13L4 14.5M11.5 13L13 14.5M8.5 4.5V3M7 4a2 2 0 0 1 3 0" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
      support: '<path d="M2.5 3.8h12v7.5H7.8l-3 2.3v-2.3H2.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" fill="none"/><path d="M5.3 6.6h6.4M5.3 8.7h4.2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>'
    };
    const row = (action, name, iconKey) =>
      '<div class="nav-item" data-hub-action="' + action + '">'
        + '<svg class="nav-icon" viewBox="0 0 17 17" fill="none">' + ic[iconKey] + '</svg>'
        + '<span class="nav-label">' + name + '</span></div>';
    /* ⭐⭐ KYLE'S ORDER (build piece 5): *"licensing goes away and move 'Money Out' right above
       'Break Even' so it is Money Out .. the Break-Even then divider then the three books links."*
       Money Out and Break-Even are one pair now — where the money went, and what it takes to cover
       it — and the divider below them opens the Accounting group. The "Operations" heading went with
       Licensing: a group of one is not a group. */
    return ''
      + '<div class="nav-section"></div>'
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
      + row('operating-expenses', 'Money Out', 'expense')
      + row('breakeven', 'Break-Even', 'breakeven')
      /* ⛔ LICENSING LEFT THIS SIDEBAR (build piece 5). It is a Shift Control screen now — see
         `nav.js`. Kyle: *"it has nothing to do with books really."* Correct once it holds no money:
         nothing in Books reads a permit record, and its two real consumers are the Hub's alert panel
         and the Audit's operational exposures.
         ⚠ THE BOOKS LANDING KEEPS EVERY PERMIT LINK IT HAD — the due count, the "clear the N flagged"
         next move, the Licensing button and the get-started step. A quick link crossing sections is
         normal here; the Audit sidebar jump-links into Recovery the same way. */
      + '<div class="nav-section">Accounting</div>'
      + row('weekly-pnl', 'Weekly P&L Brief', 'report')
      + row('books', 'Month-End Books', 'books')
      + row('year-end', 'Annual Review', 'calendar')
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
    if (action === 'books-home')         return S.HubBooksHome?.open?.();
    if (action === 'breakeven')          return S.HubBreakEven?.open?.();
    if (action === 'books')              return S.HubBooks.open();
    if (action === 'weekly-pnl')         return S.Reports?._openQboModal?.();
    if (action === 'year-end')           return S.HubYearEnd.open();
    if (action === 'operating-expenses') return S.HubOperatingExpenses?.open?.();
    if (action === 'permits')            return S.HubPermits?.open?.();
    if (action === 'report-bug')         return (S.HubReportBug.openModal || S.HubReportBug.open).call(S.HubReportBug);
    if (action === 'contact-support')    return (S.HubSupport.openModal || S.HubSupport.open).call(S.HubSupport);
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
      books:    { id: 'nav-books-home',    action: 'books-home', leafLabel: 'Close The Books', leafIcon: CHECKLIST_ICON },
      // No landing leaf: the Bar Cop Settings page is retired, so this section opens straight
      // onto its own pages, the same way Audits does.
      settings: { keepSupport: true },
      // Audits has no Dashboard leaf (the Bar Cop Audit page IS its landing, now
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
        const firstSec = nav.querySelector('.nav-section');
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

  /* Good morning / afternoon / evening, off the operator's own clock. Kyle's call, 2026-08-10.
     Takes the hour so a harness can drive all three without waiting for the day to pass. */
  _greeting(hour) {
    const h = (hour == null) ? new Date().getHours() : hour;
    return h < 12 ? 'Good morning' : (h < 17 ? 'Good afternoon' : 'Good evening');
  },

  /* ── THE CLIMB: the Bar Cop Audit's whole history in two numbers ────────────────────────────
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

    const pairs = [
      pair('Prime cost', pWas && pWas.prime_cost_pct, pNow && pNow.prime_cost_pct, false, v => App.fmtPct(v)),
      pair('Labor', rWas && rWas.labor_pct_blended, rNow && rNow.labor_pct_blended, false, v => App.fmtPct(v)),
      pair('Check average', rWas && rWas.check_avg, rNow && rNow.check_avg, true, v => App.fmtCurrency(v)),
      pair('Weekly sales', sales(rWas), sales(rNow), true, v => App.fmtCurrency(v, 0))
    ].filter(Boolean);

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
     that makes the list look broken. */
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

    const INV = App.inventoryData || {}, LAB = App.laborData || {}, SH = App.shiftData || {};
    const rows = [
      { label: 'Take inventory count', screen: 'ic-take-inventory', mod: 'inventory', hit: firstIn(INV.ic_counts) },
      { label: 'Log hours',            screen: 'lc-log-hours',      mod: 'labor',     hit: firstIn(LAB.lc_actuals) },
      { label: 'Import sales',         screen: 'sc-cash-control',   mod: 'shift',     hit: firstIn(SH.sc_shifts) },
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
    rows.push({ label: 'Close and confirm the week', screen: 'week-close', mod: '',
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
    const metrics = this.hubMetrics();
    const alerts = this.hubAlerts(metrics);

    // ── Priority action items ──
    // Show every action item from every audited module, ranked by dollar
    // impact. Cap at 50 as a safety ceiling; the card scrolls internally
    // when the list runs past its allotted height.
    const itemRows = [];
    const collect = (audit, sysName, mod) => {
      if (!audit) return;
      (audit.action_items || []).forEach(it => {
        if (it && it.action) {
          const gid = it.gap_id || (window.FixPanel ? FixPanel.inferGapId(it.action, mod) : null);
          itemRows.push({ action: it.action, impact: it.monthly_impact || 0, sys: sysName, mod: mod, gap: gid });
        }
      });
    };
    collect(pA, 'Profit',  'profit');
    collect(rA, 'Revenue', 'revenue');
    collect(cA, 'Cash', 'cash');
    itemRows.sort((a,b) => b.impact - a.impact);
    // Cap visible PAIs at 8 — top by impact — so the most important items are
    // never hidden behind a scrollbar. Overflow flagged in a small footer.
    const topItems = itemRows.slice(0, 8);
    const overflowItems = Math.max(0, itemRows.length - topItems.length);

    /* ⚠ `todayStr` WENT WITH THE HEADER DATE. Kyle: *"date removed from main header.. i would just
       remove the date from the header"* — it lives on the page now, beside the greeting, where it
       anchors "as of when" for every comparison on the Hub. A `const` left behind after its only
       reader goes is how dead code accumulates, so it went in the same edit ([[the-loop]] #25:
       grep every field you add, or remove, for a second occurrence). */

    // ── UI builders ──
    const PANEL = `background:var(--surface);border:1px solid var(--b-edge);border-radius:var(--r);padding:13px 15px;display:flex;flex-direction:column;overflow:hidden;min-height:0;`;

    // Heading-outside panel (matches the Control + Recovery dashboards): the
    // title is a single-line .sh heading ABOVE the card (standard 10px gap to
    // its card; the grid's 18px row gap gives the larger gap above) and the
    // PANEL card flexes to fill the grid cell. Any sub line lives inside the
    // card, not under the heading.
    const shWrapOpen = (t, cardPad) => '<div style="display:flex;flex-direction:column;min-width:0;min-height:0;">'
      + '<div class="sh" style="margin:0 0 10px;">' + t + '</div>'
      + '<div style="' + PANEL + 'flex:1;' + (cardPad ? 'padding:' + cardPad + ';' : '') + '">';
    const shWrapClose = '</div></div>';
    const cardSub = (s) => '<div style="font-size:10px;color:var(--t4);margin:0 0 8px;flex-shrink:0;">' + s + '</div>';

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
    // screen = a management-only page (Bar Cop Audit) locked to all Staff.
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
    // proven dollars) · Bar Cop Audit (the operation-health score). The recovery
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
      if (!wkConfirmed(data.weeks))         due.push({ text: 'Confirm last week in Profit',  screen: 'dashboard',   mod: 'profit'  });
      if (!wkConfirmed(data.revenue_weeks)) due.push({ text: 'Confirm last week in Revenue', screen: 'r-dashboard', mod: 'revenue' });
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
    //    Break-Even) on the left, the Bar Cop Audit health score pushed right. ──
    const beSum = (S.HubBreakEven && S.HubBreakEven.summary) ? S.HubBreakEven.summary() : { hasData: false };
    const beVal = beSum.hasData ? App.fmtCurrency(beSum.breakEven, 0) : 'No data';
    const beCol = beSum.hasData ? (beSum.ok ? 'var(--green)' : 'var(--red)') : 'var(--t4)';
    const beSub = !beSum.hasData ? 'Set your costs to surface this'
      : (beSum.ok ? 'Cleared by ' + App.fmtCurrency(beSum.delta, 0) + ' last week'
                  : App.fmtCurrency(Math.abs(beSum.delta), 0) + ' short last week');
    const tiles =
        '<div style="background:var(--surface);border:1px solid var(--b-edge);border-radius:var(--r);overflow:hidden;">'
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
      + heroTile('profit-fix', "S.Hub._enterFix('profit',null)", 'Open the Profit Fix system', 'Total Opportunity',
             anyAudit ? App.fmtCurrency(totalOpp,0) : 'No data',
             /* ⚠ `--t1`, NOT `--w`. Kyle, 2026-08-10: *"change all white text and numbers to a light
                grey though so it is easier on the eyes."* Pure white out-shines the gold hero on a
                dark page and is harsh at 40px. `--t1` is the light grey the rest of the product
                already uses for a number ([[color-system-locked]] — the token, never a hex). */
             anyAudit && totalOpp > 0 ? 'var(--t1)' : 'var(--t4)',
             /* Kyle: *"shorten the 'on the table to recover a month' text.. too long."* */
             anyAudit ? 'To recover a month' : 'Run an audit to surface this')
      + statDiv
      + heroTile('r-fix', "S.Hub._enterFix('revenue',null)", 'Open the Revenue Fix system', 'Recovered',
             recoveryTotal.dollars > 0 ? App.fmtCurrency(recoveryTotal.dollars, 0) : '$0',
             recoveryTotal.dollars > 0 ? 'var(--gold)' : 'var(--t4)',
             recoveryTotal.dollars > 0 ? recoveryTotal.fixes + ' measured fix' + (recoveryTotal.fixes === 1 ? '' : 'es') : 'Mark a fix to start')
      + statDiv
      + heroTile('c-fix', "S.Hub._enterFix('cash',null)", 'Open the Cash Fix system', 'Trapped Cash',
             trapped.hasData ? App.fmtCurrency(trappedCash, 0) : 'No data',
             trapped.hasData ? (trappedCash > 0 ? 'var(--t1)' : 'var(--green)') : 'var(--t4)',
             trapped.hasData ? (trappedCash > 0 ? 'Cash to free on the shelves' : 'Shelves are working') : 'Count to surface this')
      + statDiv
      + heroTile('hub-books-home', "S.HubBreakEven.open()", 'Open Break-Even', 'Break-Even', beVal, beCol, beSub)
      // The four figures above are dollars (the money line); the Bar Cop Audit is
      // a health score, not money, so a flex spacer pushes it to the right under
      // the Briefing button — money line left, operation-health read right. The
      // cell's width is matched to the Briefing button after mount (see below) so
      // the divider lines up flush with the button's left edge.
      /* ⛔ THE BAR COP AUDIT TILE CAME OUT OF THIS BAND, AND THE WALK IS WHAT FOUND IT. The climb
         panel directly underneath is now the Bar Cop Audit read — first score, today's score, the
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
    /* ⚠ THE CHIPS GO THROUGH `jumpToSection`, NOT AT A COCKPIT SCREEN ID. They pointed at
       `ic-dashboard` / `lc-dashboard` / `sc-dashboard` — three of the six being deleted — so the very
       first thing a new operator pressed would have been a dead link. `jumpToSection` lands on each
       section's own first page, which is one door and already correct. */
    const gsChip = (n, label, mod) =>
        '<div onclick="App.jumpToSection(\'' + mod + '\')" style="display:flex;align-items:center;gap:10px;cursor:pointer;flex:1;min-width:200px;padding:11px 13px;border:1px solid var(--gold-tint-bord);border-radius:8px;background:var(--gold-tint);">'
      +   '<span style="width:20px;height:20px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;line-height:1;background:var(--sel-active-bg);color:var(--gold);">' + n + '</span>'
      +   '<span style="font-size:12px;font-weight:600;color:var(--t1);">' + label + '</span></div>';
    const gettingStarted = '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:14px;">Set up your Control sections first, then run your first audit.</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;">'
      +   gsChip(1, 'Set up Inventory Control', 'inventory')
      +   gsChip(2, 'Set up Labor Control', 'labor')
      +   gsChip(3, 'Set up Shift Control', 'shift')
      +   gsChip(4, 'Run your first audit', 'profit')
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
    const topCard = bandHasANumber ? tiles
      : '<div style="background:var(--surface);border:1px solid var(--b-edge);border-radius:var(--r);padding:16px 18px;">'
        + '<div class="sh" style="margin:0 0 10px;">Get started</div>' + gettingStarted + '</div>';

    // ── Needs Attention band: the fires (alerts) + section-less weekly nudges
    //    (month-end Books, etc.). Catches what does not belong to a weekly section
    //    card. Condition-gated, so it is never a nag; collapses to All Clear. ──
    const dueItems = [];
    (function () {
      const now = new Date();
      if (now.getDate() <= 10) {
        const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lmKey = App.ymdLocal(lm).slice(0, 7);
        const hasLastMo = (pWeeks || []).some(w => (((w.period_end || '') + '').slice(0, 7)) === lmKey);
        if (hasLastMo) dueItems.push({ sev:'due', label:'Close ' + lm.toLocaleDateString('en-US',{month:'long'}) + ' in Books', value:'month-end', go:'S.HubBooks&&S.HubBooks.open()' });
      }
    })();
    const goOf = a => a.go || ('S.Hub._enter(\'' + a.screen + '\',\'' + (a.mod || '') + '\')');
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
        : 'S.Hub._enterFix(\'' + it.mod + '\',' + (it.gap ? '\'' + it.gap + '\'' : 'null') + ')';
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
       ⚠ `bandItems` SURVIVES — the new Needs You list reads it. Only the dead render went. */
    const bandItems = this.forwardAlerts().concat(dueItems);

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

    // Audit Scores panel — three stacked rows, one per module.
    // Each row uses the PDF-cover layout: bold module name + action top-right,
    // big score / 100 with the score bar full-width below it, then the red
    // dollar statement (or green "On target") computed honestly from the
    // audit's action_items, then audit date + trend in small subtext. The
    // action: audits are uncapped now, so there is no countdown. The button is
    // always live (Run First Audit before the first, Run Audit after).
    const auditRow = (name, audit, trend, screen, mod, isFirst) => {
      const score      = audit?.overall_score ?? null;
      // Number stays a quiet neutral; the score bar + marker below carry the
      // red/amber/green so the color is not doubled up on the number.
      const scoreColor = score != null ? 'var(--t1)' : 'var(--t4)';
      const btnLabel   = !audit ? 'Run First Audit' : 'Run Audit';
      const actionHtml = '<button class="btn btn-ghost btn-sm" onclick="S.Hub._enter(\'' + screen + '\',\'' + mod + '\')">' + btnLabel + '</button>';

      // Score block: big number / 100 + target line + bar with marker
      let scoreBlock;
      if (score != null) {
        const barPct = Math.max(0, Math.min(100, Math.round(score)));
        scoreBlock = ''
          + '<div style="display:flex;align-items:baseline;gap:12px;">'
          +   '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:34px;font-weight:700;color:' + scoreColor + ';line-height:1;">'
          +     score + '<span style="font-family:\'Barlow\',sans-serif;font-size:11px;color:var(--t3);font-weight:600;letter-spacing:0.04em;"> / 100</span></div>'
          +   '<div style="flex:1;font-size:10px;color:var(--t3);">Your target ' + ((audit && audit.raw && audit.raw.TARGET_SCORE) || 70) + ' or higher</div>'
          + '</div>'
          // Status bar shortened on the right so it clears the "Next Audit"
          // countdown / "Run Audit" button area (~85px wide on the right
          // edge of the row above). Bar still spans the score+industry text.
          + '<div style="margin-top:7px;margin-right:85px;">'
          +   '<div style="display:flex;height:6px;border-radius:4px;overflow:hidden;">'
          +     '<div style="width:50%;background:var(--red);"></div>'
          +     '<div style="width:20%;background:var(--amber);"></div>'
          +     '<div style="width:30%;background:var(--green);"></div>'
          +   '</div>'
          +   '<div style="position:relative;height:0;">'
          +     '<div style="position:absolute;top:-9px;left:' + barPct + '%;width:3px;height:11px;background:var(--w);border-radius:2px;transform:translateX(-1.5px);box-shadow:0 0 0 1.5px var(--surface);"></div>'
          +   '</div>'
          + '</div>';
      } else {
        scoreBlock = '<div style="display:flex;align-items:baseline;gap:12px;">'
          + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:34px;font-weight:700;color:var(--t4);line-height:1;">--</div>'
          + '<div style="flex:1;font-size:11px;color:var(--t3);">Run the first audit to score this recovery system.</div>'
          + '</div>';
      }

      // Combined summary line: leak status, trend vs last audit, audit date.
      // Was three stacked rows; now one inline row to free vertical space and
      // let the card breathe.
      let summaryLine = '';
      if (audit) {
        const monthly = (audit.action_items || []).reduce((s, a) => s + (a.monthly_impact || 0), 0);
        const weekly  = monthly / 4.345;
        const parts = [];
        // Module-aware: Profit cost leaks read "Leaking" (red); Revenue is mostly
        // projected growth so it reads "Opportunity" (gold), never pooled as a
        // leak; Cash's cash-to-free is a one-time amount, so no weekly dollar line.
        if (mod === 'cash') {
          // no weekly dollar line for Cash — the cash to free is a one-time amount in the audit
        } else if (weekly > 0) {
          if (mod === 'revenue') {
            parts.push('<span style="color:var(--t3);">Opportunity <span style="color:var(--t2);font-weight:700;">~' + App.fmtCurrency(weekly, 0) + ' /wk</span></span>');
          } else {
            parts.push('<span style="color:var(--t3);">Leaking <span style="color:var(--t2);font-weight:700;">~' + App.fmtCurrency(weekly, 0) + ' /wk</span></span>');
          }
        } else {
          parts.push('<span style="color:var(--green);font-weight:700;">On target</span>');
        }
        if (trend != null) {
          parts.push('<span style="color:' + (trend>=0?'var(--green)':'var(--red)') + ';font-weight:700;">'
            + (trend>=0?'+':'') + trend + ' pts</span>');
        }
        if (audit.date) {
          parts.push('<span style="color:var(--t3);">since ' + shortDate(audit.date) + ' audit</span>');
        }
        summaryLine = '<div style="font-size:10px;color:var(--t3);margin-top:8px;line-height:1.4;">'
          + parts.join(' <span style="color:var(--t4);">&middot;</span> ')
          + '</div>';
      }

      return '<div>'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px;">'
        +   '<div style="font-size:10px;font-weight:800;letter-spacing:0.18em;color:var(--t1);text-transform:uppercase;">' + name + '</div>'
        +   '<div style="flex-shrink:0;">' + actionHtml + '</div>'
        + '</div>'
        + '<div style="background:var(--bg);border:1px solid var(--b-edge);border-radius:var(--r);padding:12px 14px;">'
        +   scoreBlock
        +   summaryLine
        + '</div>'
        + '</div>';
    };
    const auditPanel = `${shWrapOpen('Audit Scores', '14px')}
      <div style="display:flex;flex-direction:column;gap:14px;flex:1;">
        ${auditRow('Profit',  pA, sysTrend(pAudits), 'audit-tracker', 'profit',  true)}
        ${auditRow('Revenue', rA, sysTrend(rAudits), 'r-audit',       'revenue', false)}
        ${auditRow('Cash',    cA, sysTrend(cAudits), 'c-audit',       'cash',    false)}
      </div>${shWrapClose}`;

    // (The old "Continue Setup" catch-up banner was removed with the Getting
    // Started checklist; the Hub's empty-state tiles + each section's day-one
    // guide are the onboarding now.)
    // (A "Closing the week" roll-up banner lived here and was PULLED 2026-08-02 — see the note
    //  on weekCloseRollup's removal in THE LIST: the app has no notion of which steps are
    //  REQUIRED to close a week, so any count it printed was a number nobody had defined.)
    // Key metrics panel — 6 tiles in a 3x2 grid (2 rows of 3). Tighter padding
    // and a 22px number so each tile fits in the shorter container that now
    // shares the middle column with the Recovery Scoreboard above it.
    const metricCells = metrics.map(m => `
      <div class="hd-metric" onclick="S.Hub._enter('${m.screen}','${m.mod}')">
        <div style="font-size:9px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:var(--t3);">${m.label}</div>
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:700;line-height:1;color:${bandColor(m.status)};">${m.disp || '-'}</div>
        <div style="font-size:9px;color:var(--t4);">${m.disp ? 'Target ' + m.tgt : 'No data'}</div>
      </div>`).join('');
    const metricsPanel = `${shWrapOpen('Key Metrics', '14px')}
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;flex:1;">${metricCells}</div>${shWrapClose}`;

    // Alerts panel — focal headline up top (big red count if alerts exist,
    // big green check + "All Clear" headline if not), then the alert rows
    // below as a clean list. Row styling matches the Priority Action Items
    // panel so the two list cards feel like a pair.
    let alertsPanel;
    if (alerts.length) {
      // Triage: split into Critical (bad) and Watch (warn) under their own
      // headers so the operator instantly sees what matters today.
      const rowOf = (a, isFirst, dotCol) => '<div class="hd-row hd-arow" onclick="S.Hub._enter(\'' + a.screen + '\',\'' + a.mod + '\')" '
        + 'style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-bottom:1px solid var(--b-edge);'
        + (isFirst ? 'border-top:1px solid var(--b-edge);' : '') + '">'
        + '<span style="width:8px;height:8px;border-radius:50%;background:' + dotCol + ';flex-shrink:0;"></span>'
        + '<div style="flex:1;min-width:0;font-size:12px;color:var(--t1);line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(a.text) + '</div>'
        + '</div>';
      const groupHead = (label, col, first) => '<div style="font-size:9px;font-weight:800;letter-spacing:0.13em;text-transform:uppercase;color:' + col + ';margin:' + (first ? '0' : '14px') + ' 0 7px;">' + label + '</div>';
      const critical = alerts.filter(a => a.sev === 'bad');
      const watch    = alerts.filter(a => a.sev === 'warn');
      const alertRows =
          (critical.length ? groupHead('Critical', 'var(--red)', true) + critical.map((a, i) => rowOf(a, i === 0, 'var(--red)')).join('') : '')
        + (watch.length    ? groupHead('Watch', 'var(--amber)', !critical.length) + watch.map((a, i) => rowOf(a, i === 0, 'var(--amber)')).join('') : '');
      const alertHead = '<div style="background:var(--bg);border:1px solid var(--b-edge);border-radius:var(--r);padding:12px 14px;display:flex;align-items:center;gap:12px;flex-shrink:0;">'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:38px;font-weight:700;color:var(--red);line-height:1;">' + alerts.length + '</div>'
        + '<div style="font-size:11px;color:var(--t2);line-height:1.35;position:relative;top:3px;">'
        +   'item' + (alerts.length===1?'':'s') + ' to address'
        +   '<div style="font-size:10px;color:var(--t3);margin-top:2px;">Worst first.</div>'
        + '</div></div>';
      alertsPanel = `${shWrapOpen('Alerts')}${alertHead}
        <div class="hd-scroll" style="flex:1;display:flex;flex-direction:column;margin-top:14px;">${alertRows}</div>${shWrapClose}`;
    } else {
      const allClear = '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;">'
        + '<svg width="38" height="38" viewBox="0 0 26 26" fill="none"><circle cx="13" cy="13" r="11" stroke="var(--green)" stroke-width="1.6"/><path d="M8 13l3.5 3.5L18 9" stroke="var(--green)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        + '<div style="font-size:18px;font-weight:800;color:var(--green);letter-spacing:0.04em;">All Clear</div>'
        + '<div style="font-size:10px;color:var(--t3);line-height:1.4;max-width:240px;">Weekly metrics on target and every recovery audit run, current, and at or above target.</div>'
        + '</div>';
      alertsPanel = `${shWrapOpen('Alerts')}${allClear}${shWrapClose}`;
    }

    // Trend chart panel — three stacked mini charts: Bar Pour Cost %,
    // Check Average $, Prime Cost %. Each chart sits in its own bordered
    // card. Line stroke is tuned for the small chart size (1.7px) — the
    // module dashboards use 2.5 because those charts are 3x taller.
    // Fix-event markers (Section 10.5) ride on the bottom chart only so
    // they show up once instead of three times. Each data point carries
    // hover data attributes consumed by the shared tooltip below.
    const miniChart = (label, weeks, valueOf, target, valFmt, dir, withMarkers) => {
      const series   = weeks.map(w => valueOf(w));
      const lastVal  = [...series].reverse().find(v => v != null) ?? null;
      const status   = lastVal != null ? band(lastVal, target, dir) : 'none';
      const curColor = bandColor(status);
      const curDisp  = lastVal != null ? valFmt(lastVal) : '--';
      const tgtDisp  = valFmt(target);

      const card = (inner) => '<div style="background:var(--surface);border:1px solid var(--b-edge);border-radius:var(--r);padding:7px 10px;display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;">' + inner + '</div>';

      const head = '<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:2px;flex-shrink:0;">'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--t3);">' + label + '</div>'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:17px;font-weight:700;color:' + curColor + ';line-height:1;">' + curDisp + '</div>'
        + '<div style="margin-left:auto;font-size:9px;color:var(--t4);">Target ' + tgtDisp + '</div>'
        + '</div>';

      const nonNull = series.filter(v => v != null);
      if (nonNull.length < 2) {
        return card(head
          + '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--t4);font-size:9px;letter-spacing:1px;text-transform:uppercase;font-weight:700;">Need 2+ weeks</div>');
      }

      const W = 540, H = 54, P = { t:6, r:6, b:4, l:6 };
      const cw = W-P.l-P.r, ch = H-P.t-P.b;
      let mn = Math.min(...nonNull, target);
      let mx = Math.max(...nonNull, target);
      const sp = (mx-mn)*0.2 || 1; mn -= sp; mx += sp;
      const x = i => P.l + (series.length > 1 ? (i/(series.length-1))*cw : cw/2);
      const y = v => P.t + ch - ((v-mn)/(mx-mn||1))*ch;

      // Smooth path through non-null values; nulls keep their x slot so the
      // time axis stays honest, the path just skips them. Build the line
      // path and the area path (line + closure down to chart floor) in the
      // same pass; the area gets a vertical gradient fill that fades to
      // transparent, matching the audit score chart style.
      const baseY = (H-P.b).toFixed(1);
      let d = '', area = '';
      let prev = -1, lastX = null;
      for (let i = 0; i < series.length; i++) {
        const v = series[i];
        if (v == null) continue;
        const xi = x(i), yi = y(v);
        if (prev < 0) {
          d    = 'M' + xi.toFixed(1) + ',' + yi.toFixed(1);
          area = 'M' + xi.toFixed(1) + ',' + baseY + ' L' + xi.toFixed(1) + ',' + yi.toFixed(1);
        } else {
          const cp = (xi-x(prev))*0.35;
          const seg = ' C' + (x(prev)+cp).toFixed(1) + ',' + y(series[prev]).toFixed(1) + ' '
            + (xi-cp).toFixed(1) + ',' + yi.toFixed(1) + ' '
            + xi.toFixed(1) + ',' + yi.toFixed(1);
          d    += seg;
          area += seg;
        }
        lastX = xi;
        prev = i;
      }
      if (area) area += ' L' + lastX.toFixed(1) + ',' + baseY + ' Z';

      const gradId = 'hub-trend-' + label.replace(/[^a-z]/gi,'').toLowerCase();

      const tgtLine = '<line x1="'+P.l+'" y1="'+y(target).toFixed(1)+'" x2="'+(W-P.r)+'" y2="'+y(target).toFixed(1)+'" stroke="#DBAB46" stroke-width="0.7" stroke-dasharray="4,4" opacity="0.4"/>';

      // Dots render as HTML <div>s positioned absolutely over the SVG
      // (instead of <circle>s inside the SVG). The SVG uses
      // preserveAspectRatio="none" so the line stretches to fill the card,
      // but that same stretching squishes SVG circles into vertical ovals.
      // CSS-sized divs stay round regardless of how the SVG is scaled.
      const dots = series.map((v,i) => {
        if (v == null) return '';
        const xPct = (x(i) / W * 100).toFixed(2);
        const yPct = (y(v) / H * 100).toFixed(2);
        const wkRaw = weeks[i] && weeks[i].period_end;
        const wkDate = wkRaw ? (shortDate(wkRaw) || '').toUpperCase() : '';
        const dotBand = band(v, target, dir);
        return '<div class="hd-chart-dot"'
          + ' data-label="' + esc(label) + '"'
          + ' data-disp="' + esc(valFmt(v)) + '"'
          + ' data-tgt="' + esc(tgtDisp) + '"'
          + ' data-date="' + esc(wkDate) + '"'
          + ' data-band="' + dotBand + '"'
          + ' style="position:absolute;left:' + xPct + '%;top:' + yPct + '%;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;">'
          + '<div class="hd-chart-marker"></div>'
          + '</div>';
      }).join('');

      let markerSvg = '';
      if (withMarkers && window.Recovery && window.FixPanel) {
        // The chart's OWN weeks, which is what `series` (and therefore every x position)
        // is built from. This read the outer `pWeeks` instead, and that array arrives
        // date-DESC from loadEvents, so slicing its tail returned the OLDEST weeks in
        // reverse order and every marker would have landed on the wrong week. Dead today
        // (all three miniChart calls pass withMarkers false), but armed for whoever
        // switches markers on.
        const refWeeks = weeks;
        if (refWeeks.length >= 2) {
          const marks = ['profit','revenue']
            .reduce((acc,m) => acc.concat(Recovery.chartMarkers(refWeeks, m)), []);
          const mxFn = i => P.l + (refWeeks.length > 1 ? (i/(refWeeks.length-1))*cw : cw/2);
          markerSvg = FixPanel.markerSvg(marks, mxFn, P.t, H-P.b);
        }
      }

      // Trend chart is the dashboard's visual rest zone — muted gold line and
      // a barely-there area fill so the shape carries the story without
      // adding to the color noise. Status still comes through via the head
      // (current value in band color) and per-dot hover tooltips.
      return card(head
        + '<div style="position:relative;flex:1;min-height:0;">'
        +   '<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" width="100%" height="100%" style="display:block;position:absolute;inset:0;">'
        +     '<defs><linearGradient id="'+gradId+'" x1="0" y1="0" x2="0" y2="1">'
        +       '<stop offset="0%" stop-color="#151C1C" stop-opacity="1"/>'
        +       '<stop offset="100%" stop-color="#151C1C" stop-opacity="0"/>'
        +     '</linearGradient></defs>'
        +     markerSvg
        +     tgtLine
        +     (area ? '<path d="'+area+'" fill="url(#'+gradId+')"/>' : '')
        +     '<path d="'+d+'" fill="none" stroke="#363523" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
        +   '</svg>'
        +   dots
        + '</div>');
    };

    const w8p = _newest(pWeeks).slice(0, 8).reverse();
    const w8r = _newest(rWeeks).slice(0, 8).reverse();
    const pourSeries  = w8p.map(w => w?.bar?.cost_pct ?? null);
    const caSeries    = w8r.map(w => w?.check_avg ?? null);
    const primeSeries = w8p.map(w => w?.prime_cost_pct ?? null);
    const anyTrend = pourSeries.filter(v=>v!=null).length >= 2
                  || caSeries.filter(v=>v!=null).length >= 2
                  || primeSeries.filter(v=>v!=null).length >= 2;

    let trendBody;
    if (!anyTrend) {
      trendBody = '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--t4);font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Enter 2+ weeks to see trends</div>';
    } else {
      trendBody = ''
        + miniChart('Bar Pour Cost %', w8p, w => w?.bar?.cost_pct ?? null,    pourT,  v => v.toFixed(1) + '%', 'low',  false)
        + miniChart('Check Average',   w8r, w => w?.check_avg ?? null,        caT,    v => App.fmtCurrency(v), 'high', false)
        + miniChart('Prime Cost %',    w8p, w => w?.prime_cost_pct ?? null,   primeT, v => v.toFixed(1) + '%', 'low',  false);
    }
    const chartPanel = `${shWrapOpen('Cost & Revenue Trend', '14px')}
      <div style="flex:1;display:flex;flex-direction:column;gap:6px;overflow:hidden;">${trendBody}</div>${shWrapClose}`;

    // Priority Action Items panel — dollar amount is the magnet (big gold
    // Barlow Condensed on the left), then a small module badge above the
    // action text on the right. Row styling matches the Alerts panel so the
    // two list cards feel like a pair.
    const actionBody = topItems.length
      ? topItems.map((it,i) => {
          const dollar = it.impact > 0 ? App.fmtCurrency(it.impact, 0) : '-';
          const modBadgeColors = {
            Profit:  { c: 'var(--t3)', bg: 'transparent' },
            Revenue: { c: 'var(--t3)', bg: 'transparent' },
            Cash:    { c: 'var(--t3)', bg: 'transparent' }
          };
          const mc = modBadgeColors[it.sys] || modBadgeColors.Profit;
          return '<div class="hd-row hd-arow" onclick="S.Hub._enterFix(\'' + it.mod + '\',' + (it.gap ? '\'' + it.gap + '\'' : 'null') + ')" '
            + 'style="display:flex;align-items:center;gap:14px;padding:10px 12px;border-bottom:1px solid var(--b-edge);'
            + (i === 0 ? 'border-top:1px solid var(--b-edge);' : '') + '">'
            + '<div style="flex-shrink:0;min-width:65px;white-space:nowrap;">'
            +   '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:19px;font-weight:700;color:var(--t1);line-height:1;">' + dollar + '</span>'
            +   (it.impact > 0 ? '<span style="font-size:9px;color:var(--t3);font-weight:600;margin-left:2px;">/mo</span>' : '')
            + '</div>'
            + '<div style="flex:1;min-width:0;font-size:11px;line-height:1.45;">'
            +   '<span style="font-size:9px;font-weight:800;letter-spacing:0.1em;color:' + mc.c + ';">' + it.sys.toUpperCase() + '</span>'
            +   '<span style="color:var(--t3);"> &middot; </span>'
            +   '<span style="color:var(--t1);">' + esc(it.action) + '</span>'
            + '</div>'
            + '</div>';
        }).join('')
      : `<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--t3);font-size:11px;text-align:center;line-height:1.5;padding:0 20px;">Run an audit in any system and your highest-impact opportunities will be ranked here.</div>`;
    const overflowFooter = overflowItems > 0
      ? '<div style="margin-top:auto;padding-top:10px;border-top:1px solid var(--b2);font-size:10px;color:var(--t3);text-align:center;flex-shrink:0;">+ ' + overflowItems + ' more action item' + (overflowItems === 1 ? '' : 's') + ' across your audits</div>'
      : '';
    // First-run guide: with no audit run yet, the Priority Actions panel
    // becomes a welcoming "Start Here" with the three steps to a first recovery
    // number, so a brand-new operator is never left wondering what to do.
    const ghStep = (n, t, d, btn, onclick) =>
        '<div style="display:flex;gap:13px;align-items:flex-start;padding:15px 2px;' + (n === 1 ? '' : 'border-top:1px solid var(--b2);') + '">'
      +   '<div style="flex-shrink:0;width:26px;height:26px;border-radius:50%;background:var(--gold-bg);color:var(--gold);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;">' + n + '</div>'
      +   '<div style="flex:1;min-width:0;">'
      +     '<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:3px;">' + t + '</div>'
      +     '<div style="font-size:11px;color:var(--t3);line-height:1.5;margin-bottom:10px;">' + d + '</div>'
      +     '<button class="btn btn-primary btn-sm" onclick="' + onclick + '">' + btn + '</button>'
      +   '</div>'
      + '</div>';
    const startHereGuide =
        '<div style="font-size:12.5px;color:var(--t2);line-height:1.55;padding:2px 2px 8px;">Welcome to Bar Cop. It finds the money leaking out of your operation and tells you exactly how to plug it. Two steps to your first recovery number:</div>'
      + ghStep(1, 'Run your first audit', 'Profit, Revenue, or Cash. Each one scores you and surfaces exactly where money is slipping away.', 'Run an Audit', 'S.Hub._enter(\'audit-tracker\',\'profit\')')
      + ghStep(2, 'Log this week\'s numbers', 'Enter Profit and Revenue each week so your gaps, trends, and metrics fill in.', 'Enter This Week', 'S.Hub._enter(\'this-week\',\'profit\')');
    const aiCount = itemRows.length;
    const actionHead = '<div style="background:var(--bg);border:1px solid var(--b-edge);border-radius:var(--r);padding:12px 14px;display:flex;align-items:center;gap:12px;flex-shrink:0;">'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:38px;font-weight:700;color:var(--t1);line-height:1;">' + aiCount + '</div>'
      + '<div style="font-size:11px;color:var(--t2);line-height:1.35;position:relative;top:3px;">'
      +   'action item' + (aiCount === 1 ? '' : 's')
      +   '<div style="font-size:10px;color:var(--t3);margin-top:2px;">From your audits</div>'
      + '</div></div>';
    const actionPanel = !anyAudit
      ? `${shWrapOpen('Start Here')}<div style="flex:1;overflow-y:auto;">${startHereGuide}</div>${shWrapClose}`
      : `${shWrapOpen('Priority Actions')}${actionHead}
      <div class="hd-scroll" style="flex:1;display:flex;flex-direction:column;margin-top:14px;">${actionBody}</div>${overflowFooter}${shWrapClose}`;

    // Weekly money readout panel — big red weekly leak total up top, then a
    // ranked list of the gap areas producing it. Same emotional language as
    // the Audit Scores card: lead with the dollar number, support with detail.
    const readout = this.weeklyReadout();
    const hasWeekData = pWeeks.length > 0 || rWeeks.length > 0;

    // Neutral per-module label (color = meaning only; no category tint).
    const modBadge = (mod) => '<span style="display:inline-block;font-size:8px;font-weight:800;letter-spacing:0.08em;color:var(--t3);flex-shrink:0;min-width:62px;">'
      + (mod || '').toUpperCase() + '</span>';

    let readoutBody;
    if (!hasWeekData) {
      readoutBody = '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:0 16px;">'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:36px;font-weight:700;color:var(--t4);line-height:1;">-- / wk</div>'
        + '<div style="font-size:11px;color:var(--t3);line-height:1.5;max-width:240px;">Enter this week\'s numbers in Profit and Revenue to see what is leaking and where.</div>'
        + '<button class="btn btn-ghost btn-sm" onclick="S.Hub._enter(\'this-week\',\'profit\')" style="margin-top:4px;">Enter This Week</button>'
        + '</div>';
    } else if (readout.items.length === 0) {
      readoutBody = '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;text-align:center;">'
        + '<svg width="34" height="34" viewBox="0 0 26 26" fill="none"><circle cx="13" cy="13" r="11" stroke="var(--green)" stroke-width="1.6"/><path d="M8 13l3.5 3.5L18 9" stroke="var(--green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        + '<div style="display:flex;align-items:baseline;gap:8px;"><div style="font-family:\'Barlow Condensed\',sans-serif;font-size:34px;font-weight:700;color:var(--green);line-height:1;">$0</div><div style="font-size:11px;color:var(--green);font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">/ wk</div></div>'
        + '<div style="font-size:11px;color:var(--green);font-weight:700;">Holding the line.</div>'
        + '<div style="font-size:10px;color:var(--t3);line-height:1.4;max-width:240px;">Every gap area with a weekly dollar metric is on target.</div>'
        + '</div>';
    } else {
      const shown = readout.items.slice(0, 50);
      const roRows = shown.map((it, i) => {
        const isLast = i === shown.length - 1;
        return '<div class="hd-row" onclick="S.Hub._enterFix(\'' + it.module + '\',\'' + esc(it.gapId) + '\')"'
          + ' style="display:flex;align-items:center;gap:10px;padding:9px 4px;'
          + (isLast ? '' : 'border-bottom:1px solid var(--b2);') + '">'
          + modBadge(it.module)
          + '<div style="flex:1;min-width:0;font-size:12px;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(it.label) + '</div>'
          + '<div style="flex-shrink:0;font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:700;color:var(--t1);">' + App.fmtCurrency(it.weekly, 0) + '<span style="font-family:\'Barlow\',sans-serif;font-size:9px;color:var(--t3);font-weight:600;margin-left:2px;">/wk</span></div>'
          + '</div>';
      }).join('');
      // Split hero: recoverable cost leak (red) and projected revenue
      // opportunity (gold) shown as two distinct figures, never pooled into one
      // "leaking" total (decision 2). Each appears only when it has dollars.
      const heroNum = (val, color, label) => '<div style="display:flex;align-items:baseline;gap:6px;">'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:34px;font-weight:700;color:' + color + ';line-height:1;">' + App.fmtCurrency(val, 0) + '</div>'
        + '<div style="font-size:9px;color:var(--t3);font-weight:700;letter-spacing:0.06em;text-transform:uppercase;line-height:1.2;">/wk<br>' + label + '</div>'
        + '</div>';
      readoutBody = ''
        + '<div style="display:flex;align-items:baseline;gap:22px;flex-wrap:wrap;">'
        +   (readout.leakTotal > 0 ? heroNum(readout.leakTotal, 'var(--red)', 'leaking') : '')
        +   (readout.oppTotal  > 0 ? heroNum(readout.oppTotal,  'var(--gold)', 'opportunity') : '')
        + '</div>'
        + '<div style="font-size:10px;color:var(--t3);margin-top:6px;line-height:1.4;">'
        +   'across ' + readout.items.length + ' gap area' + (readout.items.length === 1 ? '' : 's') + '.'
        + '</div>'
        + '<div class="hd-scroll" style="margin-top:12px;flex:1;display:flex;flex-direction:column;">' + roRows + '</div>';
    }
    const readoutPanel = `${shWrapOpen('Weekly Gaps')}${readoutBody}<div style="margin-top:auto;padding-top:12px;font-size:10px;color:var(--t4);flex-shrink:0;">From this week's numbers</div>${shWrapClose}`;

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
    // after a context sidebar (e.g. Bar Cop Audit) was swapped in.
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
    const hbSh = t => '<div class="sh" style="margin:0 0 10px;">' + esc(t) + '</div>';

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
    const climbBlock = hbSh('Bar Cop Audit')
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
        : '<div style="font-size:12px;color:var(--t3);padding:6px 0;">Needs two closed weeks</div>');

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
      + '<button class="btn btn-ghost btn-sm" onclick="' + paiGo(first.item) + '">Open the fix</button>'
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
       ⚠ AND EITHER CARD CAN BE LEGITIMATELY EMPTY. A fortnight where nothing slipped has no drag,
       and saying so is the truth, not a gap in the page. */
    const bwCard = (t, o, isGain) => {
      if (!o) return hbPanel(hbSh(t)
        + '<div style="font-size:12px;color:var(--t3);">'
        + (isGain ? 'Nothing improved this fortnight' : 'Nothing slipped this fortnight') + '</div>');
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
    const needRows = this._needsCapped(bandItems, 5).shown.map(a => hbRow(
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
      + '<span style="font-size:11px;color:var(--t3);white-space:nowrap;">'
      + (r.when ? 'Last done ' + esc(r.when) : '') + '</span>'
    )).join('');

    // ── Band 5: six operational facts, one job each, every one a door ──
    const sectionStrip = this._sectionStrip(this._stripMetrics());

    const dateLine = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const hubGrid = `<div class="hub-grid" style="display:grid;gap:18px;padding-bottom:18px;">
          <div style="display:flex;align-items:baseline;justify-content:space-between;gap:16px;flex-wrap:wrap;">
            <div style="font-size:19px;font-weight:700;color:${hbGrey};">${esc(this._greeting())}, ${esc(barName)}</div>
            <div style="font-size:12px;color:var(--t3);">${esc(dateLine)}</div>
          </div>
          <div class="hub-grid-tiles">${topCard}</div>
          <div class="hub-grid-row" style="display:grid;grid-template-columns:396px 1fr;gap:18px;align-items:stretch;">
            ${hbPanel(climbBlock)}${hbPanel(movementBlock)}
          </div>
          ${doFirstBand}
          <div class="hub-grid-row" style="display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:stretch;">
            ${bwCard('Your biggest gain', bw && bw.gain, true)}${bwCard('Your worst drag', bw && bw.drag, false)}
          </div>
          <div class="hub-grid-row" style="display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:stretch;">
            ${hbPanel(hbSh('Needs attention') + (needRows || '<div style="font-size:12px;color:var(--t2);">All clear. Nothing needs you outside your weekly close.</div>'))}
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
        .hub-app .hd-row:hover{background:var(--hover);}
        .hub-app .hd-arow{background:#0D181E;}
        .hub-app .hd-arow:hover{background:#0F1A21;}
        .hub-app .hd-step:hover{background:#13212A;}
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
            <div id="hub-topbar-group-dashboard" style="display:none;"></div>
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
       Bar Cop Audit cell's right margin to the Briefing button's width so the two right edges lined
       up; with no button to measure it would have shifted the cell by the slot's zero width, which
       is a silent layout change rather than an error. Delete the measurement with the thing it
       measured. */
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

  // Deep-link from the weekly readout into a module's Fix screen at a gap-area.
  _enterFix(module, gapId) {
    const scr = module === 'revenue' ? 'r-fix'
              : module === 'cash' ? 'c-fix'
              : 'profit-fix';
    // Gate BEFORE showApp (see _enter) so a locked Fix screen never swaps the shell.
    if (!App.canAccess(scr)) { App.showNoAccess(); return; }
    App.showApp(module || 'profit');
    if (gapId) App._fixFocus = gapId;
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
      { label:'Bar Pour Cost', val: pW?.bar?.cost_pct ?? null, disp: pW?.bar?.cost_pct!=null?App.fmtPct(pW.bar.cost_pct):null, tgt: pourT+'%', status: band(pW?.bar?.cost_pct ?? null, pourT, 'low'), screen:'dashboard', mod:'profit' },
      { label:'Food Cost', val: pW?.food?.cost_pct ?? null, disp: pW?.food?.cost_pct!=null?App.fmtPct(pW.food.cost_pct):null, tgt: foodT+'%', status: band(pW?.food?.cost_pct ?? null, foodT, 'low'), screen:'dashboard', mod:'profit' },
      { label:'Prime Cost', val: pW?.prime_cost_pct ?? null, disp: pW?.prime_cost_pct!=null?App.fmtPct(pW.prime_cost_pct):null, tgt: primeT+'%', status: band(pW?.prime_cost_pct ?? null, primeT, 'low'), screen:'dashboard', mod:'profit' },
      { label:'Check Average', val: rW?.check_avg ?? null, disp: rW?.check_avg!=null?App.fmtCurrency(rW.check_avg):null, tgt: App.fmtCurrency(caT), status: band(rW?.check_avg ?? null, caT, 'high'), screen:'r-dashboard', mod:'revenue' },
      { label:'Labor %', val: rW?.labor_pct_blended ?? null, disp: rW?.labor_pct_blended!=null?App.fmtPct(rW.labor_pct_blended):null, tgt: laborT+'%', status: band(rW?.labor_pct_blended ?? null, laborT, 'low'), screen:'r-dashboard', mod:'revenue' },
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
        text: m.label + ' at ' + m.disp + ' · target ' + m.tgt, screen: m.screen, mod: m.mod }));
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
      /* ⭐ WHERE THE EIGHT SECTIONS STAND THIS WEEK, through each dashboard's own hubSteps().
         ⛔ NOT scraped from Week In Review. That page fills `this._pdf` as a SIDE EFFECT of its
         section builders running, so reading it means rendering a page to ask a question — and The
         Rail is in the top bar, on screens that never render it. Events and Books were given
         hubSteps() in the same edit so all eight answer the same way.
         ⚠ Each call is guarded because it reaches into another screen object: one section throwing
         must cost that section's line, never the whole briefing. The Hub's own `safeSteps` does
         exactly this for its three, and the reason is the same. */
      sections: [
        { name: 'Inventory', o: S.InventoryDashboard }, { name: 'Labor', o: S.LaborDashboard },
        { name: 'Shift', o: S.ShiftDashboard },         { name: 'Profit', o: S.Dashboard },
        { name: 'Revenue', o: S.RevenueDashboard },     { name: 'Cash', o: S.CashDashboard },
        { name: 'Events', o: S.EventsDashboard },       { name: 'Books', o: S.HubBooksHome }
      ].map(d => {
        let s = null;
        try { s = (d.o && d.o.hubSteps) ? d.o.hubSteps() : null; } catch (e) { s = null; }
        return s ? { name: d.name, done: s.doneCount, total: s.total } : null;
      }).filter(Boolean),
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
    if (!window.Recovery || !window.FIX) return { items: [], total: 0, leakTotal: 0, oppTotal: 0 };
    const seen = {};
    const items = [];
    // Split honestly (decision 2): a cost gap is a recoverable LEAK; everything
    // else is projected REVENUE opportunity. labor-scheduling is a cost gap even
    // though it lives in the Revenue audit, so we categorize by gap, not module.
    const kindOf = (gapId) => (Recovery.COST_GAPS || []).indexOf(gapId) !== -1 ? 'cost' : 'revenue';

    // Profit + Revenue — live metric-based
    [['profit'], ['revenue']].forEach(([mod]) => {
      (FIX[mod] || []).forEach(g => {
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
        screen: 'dashboard', mod: 'profit'
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
      screen: 'vendor-watch', mod: 'profit'
    });

    // 6. Loss Prevention flags (last 7 days), in two honest tiers so red stays
    // reserved for the real thing. Severe (confirmed theft) is Critical and reads
    // as theft to act on; softer signals (drawer shorts, flagged spot checks) are
    // Watch, worded as items to review rather than theft. Comp-volume-by-server is
    // a windowed pattern, surfaced on the Loss Prevention page, not in this stream.
    if (window.S && S.TheftRisk && S.TheftRisk.recentFlags) {
      const wk7 = new Date(); wk7.setDate(wk7.getDate() - 6);
      const flags = S.TheftRisk.recentFlags(iso(wk7));
      const severe = flags.filter(f => f.severe).length;
      const soft = flags.length - severe;
      if (severe > 0) out.push({
        sev: 'bad',
        label: 'Theft flags to act on', value: String(severe),
        text: severe + ' theft flag' + (severe === 1 ? '' : 's') + ' in the last 7 days that need action now. Investigate them in Loss Prevention.',
        screen: 'theft-risk', mod: 'profit'
      });
      if (soft > 0) out.push({
        sev: 'warn',
        label: 'Loss-prevention flags', value: soft + ' to review',
        text: soft + ' item' + (soft === 1 ? '' : 's') + ' flagged for review in Loss Prevention over the last 7 days. Check anything that does not add up.',
        screen: 'theft-risk', mod: 'profit'
      });
    }

    return out;
  }

};
