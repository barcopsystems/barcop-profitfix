'use strict';

/* ── Profit Recovery Nav ── */
const ProfitNav = {
  html() {
    return `
      <!-- THE PROFIT AUDIT ROW MOVED TO THE AUDITS SECTION (Kyle, 2026-08-22): "the profit,
           revenue, cash audits get removed from the current recovery menus.. all 4 audit pages now
           live in one place .. the Audits link on the rail." The SCREEN is untouched and
           audit-tracker still resolves from every inbound link; only this nav row went.
           NO BACKTICKS IN HERE: this markup is inside a template literal, so one would end it.
           THE PROFIT FORECAST ROW MOVED TO THE BOOKS SECTION (Kyle, T48, 2026-08-23): the Books bar
           carries a Forecasts drop-down holding Cash, Profit and Revenue Forecast, and a page listed
           in two menus makes _railSectionForScreen resolve on first match and jump the rail. The
           SCREEN is untouched, it still renders out of this module's branch in navigate, and every
           inbound link still resolves; the Analysis group went with it because a group of none is
           not a group. Its PERMISSION area moved to books, which is a real change and is pinned in
           verify-area-access-doors block G. -->
      <div class="nav-section">Leaks</div>
      <div class="nav-item" data-screen="sales-integrity" id="nav-sales-integrity">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="7.5" cy="7.5" r="5" stroke="currentColor" stroke-width="1.3"/><path d="M11.2 11.2L15 15" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M5.5 7.8l1.6 1.6L10 6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Sales Integrity</span>
      </div>
      <!-- VENDOR TRACKER LEFT PROFIT ON 2026-08-23 and is now the Vendors group in Inventory, three
           rows instead of one (Kyle: "so it no longer is in profit at all"). The four ids are
           unchanged and every inbound link still resolves; what moved is the menu, the shell and the
           permission area. Pinned by verify-vendors-in-inventory A7, which asserts the ABSENCE here
           rather than merely dropping the row, so the removal is watched (the-loop #139).
           NO BACKTICKS IN THIS COMMENT: it is inside a template literal. -->
      <div class="nav-item" data-screen="recipe-cost-analysis" id="nav-recipe-cost-analysis">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2 13l4-5 3 3 3.5-6 2.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Recipe Summary</span>
      </div>
      <div class="nav-item" data-screen="theft-risk" id="nav-theft-risk">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M8.5 2L3 5v4.5c0 3.5 5.5 5.5 5.5 5.5s5.5-2 5.5-5.5v-4.5L8.5 2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M6 8.5l2 2L12 7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Loss Prevention</span>
      </div>
      <div class="nav-item" data-screen="cash-recon" id="nav-cash-recon">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="1.5" y="4.5" width="14" height="9" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M5 4.5V3.5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="1.3"/><circle cx="8.5" cy="9" r="1.5" stroke="currentColor" stroke-width="1.3"/></svg>
        <span class="nav-label">Over and Short</span>
      </div>
      <div class="nav-section">Experiments</div>
      <div class="nav-item" data-screen="profit-experiments" id="nav-profit-experiments">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M6.5 2v4.2L3 12.5a1.2 1.2 0 0 0 1 1.8h9a1.2 1.2 0 0 0 1-1.8L10.5 6.2V2" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M5.5 2h6M5.2 9.5h6.6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Experiments</span>
      </div>
      <div class="nav-section">Support</div>
      <div class="nav-item" data-screen="help" id="nav-help">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M7 6.5a1.5 1.5 0 0 1 3 0c0 1-1.5 1.5-1.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8.5" cy="12" r="0.6" fill="currentColor"/></svg>
        <span class="nav-label">Help and FAQ</span>
      </div>
      <div class="nav-item" data-nav="report-bug" id="nav-report-bug">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><ellipse cx="8.5" cy="9" rx="3.5" ry="4.5" stroke="currentColor" stroke-width="1.3"/><path d="M5 9H2.5M14.5 9H12M5.5 5L4 3.5M11.5 5L13 3.5M5.5 13L4 14.5M11.5 13L13 14.5M8.5 4.5V3M7 4a2 2 0 0 1 3 0" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
        <span class="nav-label">Report a Bug</span>
      </div>
    `;
  }
};

/* ── Revenue Recovery Nav ── */
const Revenue = {
  navHTML() {
    return `
      <!-- ⛔ The Revenue Audit row moved to the Audits section, 2026-08-22. Screen untouched.
           ⛔ The Revenue Forecast row moved to the Books section, T48, 2026-08-23, into the
              Forecasts drop-down beside Cash and Profit Forecast. Screen untouched, still rendered
              from this module's branch in navigate; only the row and its now-empty Analysis group
              went. Its permission area moved to books with it (verify-area-access-doors block G). -->
      <div class="nav-section">Menu and Pricing</div>
      <div class="nav-item" data-screen="r-menu-items" id="nav-r-menu-items">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M3.5 2.5h7l3.5 3.5v8.5h-10.5v-12z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M10.5 2.5v3.5h3.5M5.5 8h6M5.5 11h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Menu Builder</span>
      </div>
      <div class="nav-item" data-screen="r-menu-planning" id="nav-r-menu-planning">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2.5 3.5h12M2.5 7h12M2.5 10.5h7M2.5 14h7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M11.5 11.5l1.5 1.5 2.5-2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Menu Rundown</span>
      </div>
      <div class="nav-item" data-screen="r-menu-engineering" id="nav-r-menu-engineering">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M8.5 2l1.9 3.9 4.3.6-3.1 3 .7 4.3-3.7-2-3.7 2 .7-4.3-3.1-3 4.3-.6L8.5 2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
        <span class="nav-label">Menu Engineering</span>
      </div>
      <div class="nav-item" data-screen="r-dog-test" id="nav-r-dog-test">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M6.5 2.5v3.8L3.3 12a1.2 1.2 0 0 0 1.1 1.8h8.2a1.2 1.2 0 0 0 1.1-1.8L10.5 6.3V2.5" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M5.5 2.5h6M5.6 10h5.8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Dog Test Tracker</span>
      </div>
      <div class="nav-item" data-screen="r-server-check" id="nav-r-server-check">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M8.5 5v4l2.5 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Server Check</span>
      </div>
      <div class="nav-section">Experiments</div>
      <div class="nav-item" data-screen="r-experiments" id="nav-r-experiments">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M6.5 2v4.2L3 12.5a1.2 1.2 0 0 0 1 1.8h9a1.2 1.2 0 0 0 1-1.8L10.5 6.2V2" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M5.5 2h6M5.2 9.5h6.6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Experiments</span>
      </div>
      <div class="nav-section">Support</div>
      <div class="nav-item" data-screen="r-help" id="nav-r-help">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M7 6.5a1.5 1.5 0 0 1 3 0c0 1-1.5 1.5-1.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8.5" cy="12" r="0.6" fill="currentColor"/></svg>
        <span class="nav-label">Help and FAQ</span>
      </div>
      <div class="nav-item" data-nav="report-bug" id="nav-r-report-bug">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><ellipse cx="8.5" cy="9" rx="3.5" ry="4.5" stroke="currentColor" stroke-width="1.3"/><path d="M5 9H2.5M14.5 9H12M5.5 5L4 3.5M11.5 5L13 3.5M5.5 13L4 14.5M11.5 13L13 14.5M8.5 4.5V3M7 4a2 2 0 0 1 3 0" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
        <span class="nav-label">Report a Bug</span>
      </div>
    `;
  }
};

/* ── Cash Recovery Nav ── */
const Cash = {
  navHTML() {
    return `
      <!-- ⛔ The Cash Audit row moved to the Audits section, 2026-08-22. Screen untouched.
           ⛔⛔ FOUR MORE ROWS MOVED TO THE BOOKS SECTION, T48, 2026-08-23: Cash Forecast into the
              Forecasts drop-down, and Capital Efficiency, Cash Position and Cash Bridge into the
              Cash drop-down beside Break-Even. All four SCREENS are untouched and still render out
              of this module's branch in navigate; only the rows moved, and their permission area
              moved with them (verify-area-access-doors block G).
           ⭐ THIS IS THE CHANGE THAT ENDS THIS SECTION. What is left below is Purchasing and Trapped
              Cash, which Kyle has said go to Inventory, and Experiments, which wants a Tools section
              that does not exist yet. The Analysis group went because a group of none is not a
              group; Free Up Cash keeps its name while it still holds the two it was named for. -->
      <!-- ⛔⛔⛔ AND THE LAST TWO LEFT FOR INVENTORY (Kyle, 2026-08-23): Purchasing under Ordering,
           Trapped Cash leading Reports. THE HEADING WENT WITH THEM rather than being left over an
           empty group: an empty nav-section renders as a bare rule, a divider over nothing, and
           "Free Up Cash" named exactly the two rows that are gone.
           ⭐ THIS SECTION IS NOW EXPERIMENTS AND HELP. Kyle has already said Experiments wants a
           Tools section that does not exist yet, at which point the Cash rail row has nothing left
           to hold. Worth knowing before anything else is filed here.
           ⚠ AND ITS RAIL ROW ALREADY LANDS SOMEWHERE ELSE: _SECTION_DASH.cash is c-audit, which
           belongs to the Audits section, so pressing Cash on the rail opens its overlay rather than
           navigating. That is pre-existing and unchanged by this move.
           NO BACKTICKS IN THIS COMMENT: it is inside a template literal. -->
      <div class="nav-section">Experiments</div>
      <div class="nav-item" data-screen="c-experiments" id="nav-c-experiments">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M6.5 2v4.2L3 12.5a1.2 1.2 0 0 0 1 1.8h9a1.2 1.2 0 0 0 1-1.8L10.5 6.2V2" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M5.5 2h6M5.2 9.5h6.6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Experiments</span>
      </div>
      <div class="nav-section">Support</div>
      <div class="nav-item" data-screen="c-help" id="nav-c-help">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M7 6.5a1.5 1.5 0 0 1 3 0c0 1-1.5 1.5-1.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8.5" cy="12" r="0.6" fill="currentColor"/></svg>
        <span class="nav-label">Help and FAQ</span>
      </div>
      <div class="nav-item" data-nav="report-bug" id="nav-c-report-bug">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><ellipse cx="8.5" cy="9" rx="3.5" ry="4.5" stroke="currentColor" stroke-width="1.3"/><path d="M5 9H2.5M14.5 9H12M5.5 5L4 3.5M11.5 5L13 3.5M5.5 13L4 14.5M11.5 13L13 14.5M8.5 4.5V3M7 4a2 2 0 0 1 3 0" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
        <span class="nav-label">Report a Bug</span>
      </div>
    `;
  }
};

/* ── Events Nav ── */
const Events = {
  navHTML() {
    return `
      <!-- FOUR LINKS, FOUR GROUPS OF ONE (Kyle, 2026-08-23): "change the menu from side menu to top
           bar menu.. Bookings, Pricing, Calendar, Regulars.. each links going to their specific
           page.. hand pointer.. no drop down.. rail link lands on bookings by default."
           SectionTabs makes one bar link per GROUP, and a group holding a single destination renders
           as a link that navigates and takes the hand cursor. So the group NAMES are the four words
           he gave, in his order, and each holds exactly one page.
           THE ROW LABELS ARE DELIBERATELY UNCHANGED. The bar shows the group name; the drawer and the
           sidebar show the row label, and "Event Booking" / "Price Packages" / "Event Calendar" /
           "Track Regulars" are the long-form names the section's own help and the generated audit
           copy use throughout. Renaming them here would leave a dozen operator-facing sentences
           naming screens by words the app no longer shows. Same shape as Inventory, where the group
           "Counts" holds rows called Take Inventory and Count History.
           LANDS ON BOOKINGS BY DEFAULT came free: the rail row is a module section, so it routes
           through jumpToSection -> _SECTION_DASH.events, which is already ev-bookings.
           NO BACKTICKS IN THIS COMMENT: it lives inside a template literal. -->
      <div class="nav-section">Bookings</div>
      <div class="nav-item" data-screen="ev-bookings" id="nav-ev-bookings">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2.5 6.5h12M5.5 2v3M11.5 2v3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><rect x="2.5" y="3.5" width="12" height="11" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 10h6M5.5 12.5h3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Event Booking</span>
      </div>
      <div class="nav-section">Pricing</div>
      <div class="nav-item" data-screen="ev-pricing" id="nav-ev-pricing">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="6" stroke="currentColor" stroke-width="1.3"/><path d="M8.5 5.5v6M6.5 7.5h3.5a1 1 0 0 1 0 2H7a1 1 0 0 0 0 2h3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Price Packages</span>
      </div>
      <div class="nav-section">Calendar</div>
      <div class="nav-item" data-screen="ev-calendar" id="nav-ev-calendar">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="2" y="3.5" width="13" height="11" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 2v3M11.5 2v3M2 8h13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="6" cy="11" r="0.7" fill="currentColor"/><circle cx="8.5" cy="11" r="0.7" fill="currentColor"/><circle cx="11" cy="11" r="0.7" fill="currentColor"/></svg>
        <span class="nav-label">Event Calendar</span>
      </div>
      <div class="nav-section">Regulars</div>
      <div class="nav-item" data-screen="ev-regulars" id="nav-ev-regulars">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="6" cy="6.5" r="2.5" stroke="currentColor" stroke-width="1.3"/><path d="M2 14c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M12 5.5l1 1.2L15.5 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Track Regulars</span>
      </div>
      <div class="nav-section">Support</div>
      <div class="nav-item" data-screen="ev-help" id="nav-ev-help">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M7 6.5a1.5 1.5 0 0 1 3 0c0 1-1.5 1.5-1.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8.5" cy="12" r="0.6" fill="currentColor"/></svg>
        <span class="nav-label">Help and FAQ</span>
      </div>
      <div class="nav-item" data-nav="report-bug" id="nav-ev-report-bug">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><ellipse cx="8.5" cy="9" rx="3.5" ry="4.5" stroke="currentColor" stroke-width="1.3"/><path d="M5 9H2.5M14.5 9H12M5.5 5L4 3.5M11.5 5L13 3.5M5.5 13L4 14.5M11.5 13L13 14.5M8.5 4.5V3M7 4a2 2 0 0 1 3 0" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
        <span class="nav-label">Report a Bug</span>
      </div>
    `;
  }
};

/* ── Inventory Control Nav ── */
const Inventory = {
  navHTML() {
    return `
      <div class="nav-section">Counts</div>
      <div class="nav-item" data-screen="ic-take-inventory" id="nav-ic-take-inventory">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="3.5" y="3" width="10" height="12" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M6.5 3V1.7h4V3M6 7.5h5M6 10.5h3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Take Inventory</span>
      </div>
      <div class="nav-item" data-screen="ic-count-history" id="nav-ic-count-history">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M5 4.5h9M5 8.5h9M5 12.5h9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="2.6" cy="4.5" r="0.7" fill="currentColor"/><circle cx="2.6" cy="8.5" r="0.7" fill="currentColor"/><circle cx="2.6" cy="12.5" r="0.7" fill="currentColor"/></svg>
        <span class="nav-label">Count History</span>
      </div>
      <div class="nav-item" data-screen="ic-spot-check" id="nav-ic-spot-check">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="7.5" cy="7.5" r="4.5" stroke="currentColor" stroke-width="1.3"/><path d="M11 11l3 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Spot Check</span>
      </div>
      <div class="nav-section">Receiving</div>
      <div class="nav-item" data-screen="ic-receive-delivery" id="nav-ic-receive-delivery">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="1.5" y="5" width="9" height="7" rx="1" stroke="currentColor" stroke-width="1.3"/><path d="M10.5 7.5h2.5l2 2.5v2h-4.5" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="4.5" cy="13" r="1.3" stroke="currentColor" stroke-width="1.3"/><circle cx="12" cy="13" r="1.3" stroke="currentColor" stroke-width="1.3"/></svg>
        <span class="nav-label">Receive Delivery</span>
      </div>
      <div class="nav-item" data-screen="ic-delivery-history" id="nav-ic-delivery-history">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M5 4.5h9M5 8.5h9M5 12.5h9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="2.6" cy="4.5" r="0.7" fill="currentColor"/><circle cx="2.6" cy="8.5" r="0.7" fill="currentColor"/><circle cx="2.6" cy="12.5" r="0.7" fill="currentColor"/></svg>
        <span class="nav-label">Delivery History</span>
      </div>
      <div class="nav-section">Ordering</div>
      <div class="nav-item" data-screen="ic-order-sheet" id="nav-ic-order-sheet">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2 2.5h2l1.7 8h7l1.6-6H5.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6.5" cy="14" r="1.2" stroke="currentColor" stroke-width="1.3"/><circle cx="12" cy="14" r="1.2" stroke="currentColor" stroke-width="1.3"/></svg>
        <span class="nav-label">Order Sheet</span>
      </div>
      <div class="nav-item" data-screen="ic-order-history" id="nav-ic-order-history">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M5 4.5h9M5 8.5h9M5 12.5h9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="2.6" cy="4.5" r="0.7" fill="currentColor"/><circle cx="2.6" cy="8.5" r="0.7" fill="currentColor"/><circle cx="2.6" cy="12.5" r="0.7" fill="currentColor"/></svg>
        <span class="nav-label">Order History</span>
      </div>
      <div class="nav-item" data-screen="ic-par-suggestions" id="nav-ic-par-suggestions">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M3 12V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v7" stroke="currentColor" stroke-width="1.3"/><path d="M2 12h13M6.5 8h4M5.5 10h6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Dynamic Pars</span>
      </div>
      <!-- PURCHASING MOVED HERE FROM CASH RECOVERY (Kyle, 2026-08-23): "purchasing moves under
           dynamic pars". It belongs under Ordering rather than Reports because it answers the
           question you ask WHILE ordering, are you buying ahead of your sales, and its own header
           says the order is placed in the Order Sheet two rows up. It reads CashEngine and writes
           nothing. The SCREEN did not move file; what moved is the menu, the shell (_MODULE_EXCEPTIONS),
           the render registration (icTitles/icScreens) and the permission area (SCREEN_GROUPS), all
           four of which have to travel together or navigate lands on "Coming soon."
           NO BACKTICKS IN THIS COMMENT: it is inside a template literal. -->
      <div class="nav-item" data-screen="c-purchasing" id="nav-c-purchasing">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M8.5 2l6 3v7l-6 3-6-3V5l6-3z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M2.5 5l6 3 6-3M8.5 8v7" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
        <span class="nav-label">Purchasing</span>
      </div>
      <!-- VENDORS MOVED HERE FROM PROFIT (Kyle, 2026-08-23): "Vendors will become a link in the top
           bar right after ordering.. and it will be a drop down link like the others.. that has the
           three vendor tracker pages.. so the drop down is Scorecard, Price Changes,
           Discrepancies... so it no longer is in profit at all."
           THE POSITION IS PART OF THE ASK, not a detail: immediately after Ordering, because these
           three read what receiving produces. The screen's own help already said so. Price changes
           are captured when a delivery is received, and discrepancies are filed in Receive Delivery
           and chased from Delivery History. The nav had it filed under Profit's "Leaks".
           THREE ROWS MEANS IT IS A DROP-DOWN. SectionTabs only makes a link navigate on click when
           its group holds ONE destination, so this opens a menu and keeps the arrow, which is what
           "like the others" means.
           ONE SOURCE, THREE SURFACES: this markup is the top-bar drop-down, the section sidebar AND
           the mobile drawer. The ids are unchanged, so every existing inbound link still lands; what
           moved is the menu, the shell (App._moduleOf) and the permission area (DB.SCREEN_GROUPS),
           and those three have to move together.
           NO BACKTICKS IN THIS COMMENT, EVER. It lives inside a template literal, so one backtick
           here ends the literal and takes the whole nav file down with it. -->
      <div class="nav-section">Vendors</div>
      <div class="nav-item" data-screen="vendor-scorecard" id="nav-vendor-scorecard">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2.5 8.2V3.2A.7.7 0 0 1 3.2 2.5H8.2L14.2 8.5 8.5 14.2 2.5 8.2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="5.4" cy="5.4" r="1" stroke="currentColor" stroke-width="1.2"/></svg>
        <span class="nav-label">Scorecard</span>
      </div>
      <div class="nav-item" data-screen="vendor-watch" id="nav-vendor-watch">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2 11.5l4-4 3 3 5.5-6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.5 4.5h4v4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Price Changes</span>
      </div>
      <div class="nav-item" data-screen="vendor-discrepancy" id="nav-vendor-discrepancy">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M8.5 2.2l6.3 11a.8.8 0 0 1-.7 1.2H2.9a.8.8 0 0 1-.7-1.2l6.3-11z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M8.5 6.5v3.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8.5" cy="12" r="0.7" fill="currentColor"/></svg>
        <span class="nav-label">Discrepancies</span>
      </div>
      <!-- OPERATIONS BECAME "LOGS" AND GAINED THE TWO SHIFT LOGS (Kyle, 2026-08-23): "operations
           gets changed to Logs and Void/Comp Logs and Waste/Spills Log get moved there in 1st and
           2nd position in list above the current 3 .. so they are in a more prominent place that a
           user might log them more often".
           EVERY ROW HERE IS LITERALLY A LOG, so the group finally says what it holds; "Operations"
           named nothing and collided with Shift's own group of that name.
           AND THE MEASUREMENT IS STRONGER THAN THE PROMINENCE ARGUMENT: Inventory's own Variance
           Report reads BOTH sc_waste and sc_void_comps. Waste is subtracted from "used" so real
           waste does not read as theft variance, and a comp that links an inventory product does
           the same. They were already inventory-variance inputs; the nav was what was out of step.
           WHAT DOES NOT CHANGE: sc_void_comps still feeds Theft Risk and the Profit Audit. Moving a
           nav row does not move a consumer, exactly as with the four audits.
           NO BACKTICKS IN THIS COMMENT: it is inside a template literal. -->
      <div class="nav-section">Logs</div>
      <div class="nav-item" data-screen="sc-void-comp" id="nav-sc-void-comp">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M4 2.5h9v12l-2-1.3-2.5 1.3-2.5-1.3-2 1.3z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M6.5 6.5l4 4M10.5 6.5l-4 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Void and Comp Log</span>
      </div>
      <div class="nav-item" data-screen="sc-waste" id="nav-sc-waste">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M3 5h11M5 5l1 9h5l1-9M7 3h3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Waste / Spill Log</span>
      </div>
      <div class="nav-item" data-screen="ic-transfers" id="nav-ic-transfers">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2.5 5.5h10l-2.5-2.5M14.5 11.5h-10l2.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Transfer Log</span>
      </div>
      <div class="nav-item" data-screen="ic-adjustments" id="nav-ic-adjustments">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="2.5" y="2.5" width="12" height="12" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M5 8.5h7M8.5 5v7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Adjustment Log</span>
      </div>
      <div class="nav-item" data-screen="ic-empties" id="nav-ic-empties">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M5.5 2.5h6L13 6v8.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6l1.5-3.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M5.5 9.5h6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Empties Log</span>
      </div>
      <!-- TRAPPED CASH MOVED HERE FROM CASH RECOVERY (Kyle, 2026-08-23): "trapped cash moves into
           reports as the 1st one in the list". It is a pure read, its own header says it diagnoses
           and writes nothing, and it is ranked by the dollars you can free, so it leads a group of
           reads.
           AND THE STOCK REPORT LOST ITS DEAD STOCK TAB IN THE SAME EDIT: "the dead stock tab gets
           taken out of the stock report section so no duplicate". The two agreed to the cent, same
           five products, and that only became visible once they sat in one menu. One question, one
           row. NO BACKTICKS IN THIS COMMENT: it is inside a template literal. -->
      <div class="nav-section">Reports</div>
      <div class="nav-item" data-screen="c-trapped" id="nav-c-trapped">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="2.5" y="6.5" width="12" height="8" rx="1.3" stroke="currentColor" stroke-width="1.3"/><path d="M5.2 6.5V4.8a3.3 3.3 0 0 1 6.6 0V6.5" stroke="currentColor" stroke-width="1.3"/><circle cx="8.5" cy="10.3" r="1.4" stroke="currentColor" stroke-width="1.2"/></svg>
        <span class="nav-label">Trapped Cash</span>
      </div>
      <div class="nav-item" data-screen="ic-report-usage" id="nav-ic-report-usage">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2 13l4-5 3 3 3.5-6 2.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Usage Report</span>
      </div>
      <div class="nav-item" data-screen="ic-report-variance" id="nav-ic-report-variance">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2 13h11M4 13V8M7.5 13V4M11 13V9.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Variance Report</span>
      </div>
      <div class="nav-item" data-screen="ic-report-stock" id="nav-ic-report-stock">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="2.5" y="8" width="3" height="5" stroke="currentColor" stroke-width="1.3"/><rect x="7" y="4" width="3" height="9" stroke="currentColor" stroke-width="1.3"/><rect x="11.5" y="10" width="3" height="3" stroke="currentColor" stroke-width="1.3"/></svg>
        <span class="nav-label">Stock Report</span>
      </div>
      <div class="nav-section">Setup</div>
      <div class="nav-item" data-screen="ic-vendors" id="nav-ic-vendors">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M8.5 2L3 4.5v4c0 3.5 5.5 6.5 5.5 6.5s5.5-3 5.5-6.5v-4L8.5 2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
        <span class="nav-label">List Vendors</span>
      </div>
      <div class="nav-item" data-screen="ic-product-setup" id="nav-ic-product-setup">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2.5 5L8.5 2l6 3v7l-6 3-6-3V5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M2.5 5l6 3 6-3M8.5 8v7" stroke="currentColor" stroke-width="1.3"/></svg>
        <span class="nav-label">Add Products</span>
      </div>
      <div class="nav-item" data-screen="ic-locations" id="nav-ic-locations">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M8.5 15s5-4.2 5-8a5 5 0 0 0-10 0c0 3.8 5 8 5 8z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="8.5" cy="7" r="1.8" stroke="currentColor" stroke-width="1.3"/></svg>
        <span class="nav-label">Set Locations</span>
      </div>
      <div class="nav-item" data-screen="ic-prep-batches" id="nav-ic-prep-batches">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M4 4h9v3a4.5 4.5 0 0 1-4.5 4.5A4.5 4.5 0 0 1 4 7V4z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M2.5 14h12M7 11.5v2.5M10 11.5v2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Prep Batches</span>
      </div>
      <div class="nav-section">Support</div>
      <div class="nav-item" data-screen="ic-help" id="nav-ic-help">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M7 6.5a1.5 1.5 0 0 1 3 0c0 1-1.5 1.5-1.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8.5" cy="12" r="0.6" fill="currentColor"/></svg>
        <span class="nav-label">Help and FAQ</span>
      </div>
      <div class="nav-item" data-nav="report-bug" id="nav-ic-report-bug">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><ellipse cx="8.5" cy="9" rx="3.5" ry="4.5" stroke="currentColor" stroke-width="1.3"/><path d="M5 9H2.5M14.5 9H12M5.5 5L4 3.5M11.5 5L13 3.5M5.5 13L4 14.5M11.5 13L13 14.5M8.5 4.5V3M7 4a2 2 0 0 1 3 0" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
        <span class="nav-label">Report a Bug</span>
      </div>
    `;
  }
};

/* ── Labor Control Nav ── */
const Labor = {
  navHTML() {
    return `
      <div class="nav-section">Scheduling</div>
      <div class="nav-item" data-screen="lc-build-schedule" id="nav-lc-build-schedule">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="2" y="3.5" width="13" height="11" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 2v3M11.5 2v3M2 8h13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Build Schedule</span>
      </div>
      <div class="nav-item" data-screen="lc-schedule-history" id="nav-lc-schedule-history">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M5 4.5h9M5 8.5h9M5 12.5h9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="2.6" cy="4.5" r="0.7" fill="currentColor"/><circle cx="2.6" cy="8.5" r="0.7" fill="currentColor"/><circle cx="2.6" cy="12.5" r="0.7" fill="currentColor"/></svg>
        <span class="nav-label">Schedule History</span>
      </div>
      <div class="nav-item" data-screen="lc-overtime-watch" id="nav-lc-overtime-watch">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="9" r="5.5" stroke="currentColor" stroke-width="1.3"/><path d="M8.5 6v3.2l2.2 1.3M6.5 2.5h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Overtime Watch</span>
      </div>
      <div class="nav-item" data-screen="lc-time-off" id="nav-lc-time-off">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="2" y="3.5" width="13" height="11" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 2v3M11.5 2v3M2 8h13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M6.5 11.5l4-2.5M6.5 9l4 2.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
        <span class="nav-label">Time Off Log</span>
      </div>
      <div class="nav-item" data-screen="lc-callout-log" id="nav-lc-callout-log">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M8.5 2L15.5 14.5H1.5L8.5 2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M8.5 7v3.4M8.5 12v.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Call-Out Log</span>
      </div>
      <div class="nav-section">Hours and Tips</div>
      <div class="nav-item" data-screen="lc-log-hours" id="nav-lc-log-hours">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M8.5 5v4l2.5 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Log Hours</span>
      </div>
      <div class="nav-item" data-screen="lc-reports" id="nav-lc-reports">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M5 4.5h9M5 8.5h9M5 12.5h9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="2.6" cy="4.5" r="0.7" fill="currentColor"/><circle cx="2.6" cy="8.5" r="0.7" fill="currentColor"/><circle cx="2.6" cy="12.5" r="0.7" fill="currentColor"/></svg>
        <span class="nav-label">Labor History</span>
      </div>
      <div class="nav-item" data-screen="lc-tip-log" id="nav-lc-tip-log">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M8.5 2v13M5.5 5h5a2 2 0 0 1 0 4H6a2 2 0 0 0 0 4h6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Tip Tracking</span>
      </div>
      <div class="nav-item" data-screen="lc-tip-history" id="nav-lc-tip-history">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M5 4.5h9M5 8.5h9M5 12.5h9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="2.6" cy="4.5" r="0.7" fill="currentColor"/><circle cx="2.6" cy="8.5" r="0.7" fill="currentColor"/><circle cx="2.6" cy="12.5" r="0.7" fill="currentColor"/></svg>
        <span class="nav-label">Tip History</span>
      </div>
      <div class="nav-section">Payroll</div>
      <div class="nav-item" data-screen="lc-pay-periods" id="nav-lc-pay-periods">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="2" y="3.5" width="13" height="11" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M2 7h13M6 11h2M10 11h2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Pay Periods</span>
      </div>
      <div class="nav-item" data-screen="lc-payroll-export" id="nav-lc-payroll-export">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M4 2.5h6l3 3v9H4z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M10 2.5v3h3M8.5 7.5v4.5M6.5 10l2 2 2-2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Payroll Export</span>
      </div>
      <div class="nav-section">Setup</div>
      <div class="nav-item" data-screen="lc-positions" id="nav-lc-positions">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="5.5" r="3" stroke="currentColor" stroke-width="1.3"/><path d="M3 14.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Add Positions</span>
      </div>
      <div class="nav-item" data-screen="lc-staff-roster" id="nav-lc-staff-roster">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="6" cy="6" r="2.6" stroke="currentColor" stroke-width="1.3"/><path d="M1.8 14c0-2.6 1.9-4.2 4.2-4.2s4.2 1.6 4.2 4.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M11.5 4.2a2.4 2.4 0 0 1 0 4.6M12 14c0-2.4-1.3-3.9-3-4.1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Staff Roster</span>
      </div>
      <div class="nav-item" data-screen="lc-training" id="nav-lc-training">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M8.5 2.5l6 2.7-6 2.7-6-2.7 6-2.7z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M4.5 7v3.5c0 1.1 1.8 2 4 2s4-0.9 4-2V7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M14.5 5.2v3.3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Training</span>
      </div>
      <div class="nav-section">Support</div>
      <div class="nav-item" data-screen="lc-help" id="nav-lc-help">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M7 6.5a1.5 1.5 0 0 1 3 0c0 1-1.5 1.5-1.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8.5" cy="12" r="0.6" fill="currentColor"/></svg>
        <span class="nav-label">Help and FAQ</span>
      </div>
      <div class="nav-item" data-nav="report-bug" id="nav-lc-report-bug">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><ellipse cx="8.5" cy="9" rx="3.5" ry="4.5" stroke="currentColor" stroke-width="1.3"/><path d="M5 9H2.5M14.5 9H12M5.5 5L4 3.5M11.5 5L13 3.5M5.5 13L4 14.5M11.5 13L13 14.5M8.5 4.5V3M7 4a2 2 0 0 1 3 0" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
        <span class="nav-label">Report a Bug</span>
      </div>
    `;
  }
};

/* ── Shift Control Nav ── */
const Shift = {
  navHTML() {
    return `
      <div class="nav-section">Cash</div>
      <div class="nav-item" data-screen="sc-cash-control" id="nav-sc-cash-control">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2.5 4h12v9h-12z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="8.5" cy="8.5" r="2.2" stroke="currentColor" stroke-width="1.3"/><path d="M5 8.5h0.7M11.3 8.5H12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Cash Control</span>
      </div>
      <div class="nav-item" data-screen="sc-cash-history" id="nav-sc-cash-history">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M5 4.5h9M5 8.5h9M5 12.5h9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="2.6" cy="4.5" r="0.7" fill="currentColor"/><circle cx="2.6" cy="8.5" r="0.7" fill="currentColor"/><circle cx="2.6" cy="12.5" r="0.7" fill="currentColor"/></svg>
        <span class="nav-label">Cash History</span>
      </div>
      <div class="nav-section">Operations</div>
      <div class="nav-item" data-screen="sc-walked-tabs" id="nav-sc-walked-tabs">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M3.5 14.5l3.5-8 3 4 3.5-6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="13.5" cy="4.5" r="1.3" stroke="currentColor" stroke-width="1.3"/></svg>
        <span class="nav-label">Walked Tabs</span>
      </div>
      <!-- ⛔ VOID AND COMPS + WASTE AND SPILLS LEFT FOR INVENTORY'S "Logs" GROUP (Kyle, 2026-08-23).
           Both write against inventory products and BOTH are read by Inventory's own Variance
           Report, so they were already inventory-variance inputs and this menu was the thing out of
           step. The SCREENS are untouched and every inbound link still resolves; their shell, render
           registration, permission area and STAFF_TILES landing all moved with the rows.
           ⚠ THIS GROUP IS DOWN TO ONE ROW. "Operations" over a single "Walked Tabs" is a heading
           that names less than the row under it; Kyle has not ruled on renaming or folding it into
           the unnamed group below, so it is left as it is rather than guessed at.
           NO BACKTICKS IN THIS COMMENT: it is inside a template literal. -->
      <!-- ⭐⭐ THE TRACKERS THAT HOLD NO MONEY, IN KYLE'S ORDER, BEHIND THEIR OWN DIVIDER.
           He asked for it exactly: "after waste and spills put another divider line... then have
           put links in this order Incidents then Maintenance... then Licensing."
           Licensing moved here from Books at build piece 5. His reasoning: "it kinda made sense
           being in books when it was under enter cash outflows and operating expenses.. but now
           sitting under money out.. it doesn't really seem to fit in books.. it has nothing to do
           with books really." Once it holds no money nothing in Books reads a permit record —
           its only consumers are the Hub's alert panel and the Audit's operational exposures. -->
      <div class="nav-section"></div>
      <div class="nav-item" data-screen="sc-incidents" id="nav-sc-incidents">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M7.4 3.2 1.9 12.8a1.25 1.25 0 0 0 1.1 1.9h11a1.25 1.25 0 0 0 1.1-1.9L9.6 3.2a1.25 1.25 0 0 0-2.2 0z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M8.5 7v2.8M8.5 11.8v.3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Incidents</span>
      </div>
      <div class="nav-item" data-screen="sc-maintenance" id="nav-sc-maintenance">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M10.8 2.5a3 3 0 0 0-4 4l-4.3 4.3 2 2L8.8 8.5a3 3 0 0 0 4-4l-2 2-2-2 2-2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
        <span class="nav-label">Maintenance</span>
      </div>
      <div class="nav-item" data-screen="sc-licensing" id="nav-sc-licensing">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M8.5 2.2 3 4.4v4.1c0 3 2.3 5.2 5.5 6.3 3.2-1.1 5.5-3.3 5.5-6.3V4.4z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M6.3 8.4l1.7 1.7 3-3.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Licensing</span>
      </div>
      <div class="nav-section">Checklists</div>
      <div class="nav-item" data-screen="sc-checklists" id="nav-sc-checklists">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="2.5" y="2.5" width="12" height="12" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 8.5l2 2 4-4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Run Checklists</span>
      </div>
      <div class="nav-item" data-screen="sc-checklist-templates" id="nav-sc-checklist-templates">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="5" y="5" width="9.5" height="9.5" rx="1.3" stroke="currentColor" stroke-width="1.3"/><path d="M2.5 11.5V3.8A1.3 1.3 0 0 1 3.8 2.5H11.5" stroke="currentColor" stroke-width="1.3"/></svg>
        <span class="nav-label">Build Checklists</span>
      </div>
      <div class="nav-item" data-screen="sc-preshift" id="nav-sc-preshift">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M3 6.5v4l7 3V3.5l-7 3z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M3 6.5H2.2A.7.7 0 0 0 1.5 7.2v2.6a.7.7 0 0 0 .7.7H3M12 6c1 .5 1 4 0 4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Pre-Shift Briefing</span>
      </div>
      <div class="nav-section">Setup</div>
      <div class="nav-item" data-screen="sc-drawers" id="nav-sc-drawers">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="2" y="5" width="13" height="8" rx="1.3" stroke="currentColor" stroke-width="1.3"/><path d="M5 5V3.5h7V5M5.5 9h6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Add Registers</span>
      </div>
      <div class="nav-section">Support</div>
      <div class="nav-item" data-screen="sc-help" id="nav-sc-help">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M7 6.5a1.5 1.5 0 0 1 3 0c0 1-1.5 1.5-1.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8.5" cy="12" r="0.6" fill="currentColor"/></svg>
        <span class="nav-label">Help and FAQ</span>
      </div>
      <div class="nav-item" data-nav="report-bug" id="nav-sc-report-bug">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><ellipse cx="8.5" cy="9" rx="3.5" ry="4.5" stroke="currentColor" stroke-width="1.3"/><path d="M5 9H2.5M14.5 9H12M5.5 5L4 3.5M11.5 5L13 3.5M5.5 13L4 14.5M11.5 13L13 14.5M8.5 4.5V3M7 4a2 2 0 0 1 3 0" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
        <span class="nav-label">Report a Bug</span>
      </div>
    `;
  }
};
