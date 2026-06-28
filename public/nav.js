'use strict';

/* ── Profit Recovery Nav ── */
const ProfitNav = {
  html() {
    return `
      ${App.sectionSelectorHTML()}
      <div class="nav-section">Analysis</div>
      <div class="nav-item" data-screen="audit-tracker" id="nav-audit-tracker">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 8.5l2 2L12 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Profit Audit</span>
      </div>
      <div class="nav-item" data-screen="recovery-playbook" id="nav-recovery-playbook">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M8.5 4C7 2.9 4.7 2.6 2.7 3.1v9c2-.5 4.3-.2 5.8.9 1.5-1.1 3.8-1.4 5.8-.9v-9C12.3 2.6 10 2.9 8.5 4z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M8.5 4v9" stroke="currentColor" stroke-width="1.3"/></svg>
        <span class="nav-label">Profit Playbook</span>
      </div>
      <div class="nav-item" data-screen="profit-fix" id="nav-profit-fix">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M10.8 2.5a3 3 0 0 0-4 4l-4.3 4.3 2 2L8.8 8.5a3 3 0 0 0 4-4l-2 2-2-2 2-2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
        <span class="nav-label">Profit Fix</span>
      </div>
      <div class="nav-section">Weekly</div>
      <div class="nav-item" data-screen="this-week" id="nav-this-week">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="2" y="3.5" width="13" height="11" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 2v3M11.5 2v3M2 8h13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">This Week</span>
      </div>
      <div class="nav-item" data-screen="profit-forecast" id="nav-profit-forecast">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2 12l4-4 3 3 6-7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M11.5 4h3.5v3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Profit Forecast</span>
      </div>
      <div class="nav-section">Leaks</div>
      <div class="nav-item" data-screen="sales-integrity" id="nav-sales-integrity">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="7.5" cy="7.5" r="5" stroke="currentColor" stroke-width="1.3"/><path d="M11.2 11.2L15 15" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M5.5 7.8l1.6 1.6L10 6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Sales Integrity</span>
      </div>
      <div class="nav-item" data-screen="vendor-tracker" id="nav-vendor-tracker">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2.5 8.2V3.2A.7.7 0 0 1 3.2 2.5H8.2L14.2 8.5 8.5 14.2 2.5 8.2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="5.4" cy="5.4" r="1" stroke="currentColor" stroke-width="1.2"/></svg>
        <span class="nav-label">Vendor Tracker</span>
      </div>
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
      ${App.sectionSelectorHTML()}
      <div class="nav-section">Analysis</div>
      <div class="nav-item" data-screen="r-audit" id="nav-r-audit">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 8.5l2 2L12 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Revenue Audit</span>
      </div>
      <div class="nav-item" data-screen="r-playbook" id="nav-r-playbook">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M8.5 4C7 2.9 4.7 2.6 2.7 3.1v9c2-.5 4.3-.2 5.8.9 1.5-1.1 3.8-1.4 5.8-.9v-9C12.3 2.6 10 2.9 8.5 4z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M8.5 4v9" stroke="currentColor" stroke-width="1.3"/></svg>
        <span class="nav-label">Revenue Playbook</span>
      </div>
      <div class="nav-item" data-screen="r-fix" id="nav-r-fix">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M10.8 2.5a3 3 0 0 0-4 4l-4.3 4.3 2 2L8.8 8.5a3 3 0 0 0 4-4l-2 2-2-2 2-2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
        <span class="nav-label">Revenue Fix</span>
      </div>
      <div class="nav-section">Weekly</div>
      <div class="nav-item" data-screen="r-this-week" id="nav-r-this-week">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="2" y="3.5" width="13" height="11" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 2v3M11.5 2v3M2 8h13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">This Week</span>
      </div>
      <div class="nav-item" data-screen="r-forecast" id="nav-r-forecast">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2.5 11l3-3.5 2.5 2.5L11 5.5l3.5 3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.5 14h12M3 2v2M8.5 2v2M14 2v2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Revenue Forecast</span>
      </div>
      <div class="nav-section">Menu and Pricing</div>
      <div class="nav-item" data-screen="r-menu-items" id="nav-r-menu-items">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M3.5 2.5h7l3.5 3.5v8.5h-10.5v-12z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M10.5 2.5v3.5h3.5M5.5 8h6M5.5 11h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Menu Items</span>
      </div>
      <div class="nav-item" data-screen="r-menu-engineering" id="nav-r-menu-engineering">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M8.5 2l1.9 3.9 4.3.6-3.1 3 .7 4.3-3.7-2-3.7 2 .7-4.3-3.1-3 4.3-.6L8.5 2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
        <span class="nav-label">Menu Engineering</span>
      </div>
      <div class="nav-item" data-screen="r-price-calc" id="nav-r-price-calc">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="3" y="2" width="11" height="13" rx="1.5" stroke="currentColor" stroke-width="1.3"/><rect x="5" y="4" width="7" height="2.5" rx="0.5" stroke="currentColor" stroke-width="1.1"/><path d="M5.5 9h.01M8.5 9h.01M11 9h.01M5.5 11.5h.01M8.5 11.5h.01M11 11.5h.01" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
        <span class="nav-label">Price Calculator</span>
      </div>
      <div class="nav-item" data-screen="r-dog-test" id="nav-r-dog-test">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M6.5 2.5v3.8L3.3 12a1.2 1.2 0 0 0 1.1 1.8h8.2a1.2 1.2 0 0 0 1.1-1.8L10.5 6.3V2.5" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M5.5 2.5h6M5.6 10h5.8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Dog Test Tracker</span>
      </div>
      <div class="nav-item" data-screen="r-server-check" id="nav-r-server-check">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M8.5 5v4l2.5 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Server Check</span>
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
      ${App.sectionSelectorHTML()}
      <div class="nav-section">Analysis</div>
      <div class="nav-item" data-screen="c-audit" id="nav-c-audit">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 8.5l2 2L12 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Cash Audit</span>
      </div>
      <div class="nav-item" data-screen="c-playbook" id="nav-c-playbook">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M8.5 4C7 2.9 4.7 2.6 2.7 3.1v9c2-.5 4.3-.2 5.8.9 1.5-1.1 3.8-1.4 5.8-.9v-9C12.3 2.6 10 2.9 8.5 4z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M8.5 4v9" stroke="currentColor" stroke-width="1.3"/></svg>
        <span class="nav-label">Cash Playbook</span>
      </div>
      <div class="nav-item" data-screen="c-fix" id="nav-c-fix">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M10.8 2.5a3 3 0 0 0-4 4l-4.3 4.3 2 2L8.8 8.5a3 3 0 0 0 4-4l-2 2-2-2 2-2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
        <span class="nav-label">Cash Fix</span>
      </div>
      <div class="nav-section">Free Up Cash</div>
      <div class="nav-item" data-screen="c-trapped" id="nav-c-trapped">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="2.5" y="6.5" width="12" height="8" rx="1.3" stroke="currentColor" stroke-width="1.3"/><path d="M5.2 6.5V4.8a3.3 3.3 0 0 1 6.6 0V6.5" stroke="currentColor" stroke-width="1.3"/><circle cx="8.5" cy="10.3" r="1.4" stroke="currentColor" stroke-width="1.2"/></svg>
        <span class="nav-label">Trapped Cash</span>
      </div>
      <div class="nav-item" data-screen="c-capital" id="nav-c-capital">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2.5 14.5V8M7 14.5V4M11.5 14.5V10M2.5 14.5h12.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 3.5l2.5-1.5 1 2.6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Capital Efficiency</span>
      </div>
      <div class="nav-item" data-screen="c-purchasing" id="nav-c-purchasing">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M8.5 2l6 3v7l-6 3-6-3V5l6-3z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M2.5 5l6 3 6-3M8.5 8v7" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
        <span class="nav-label">Purchasing</span>
      </div>
      <div class="nav-section">Cash Flow</div>
      <div class="nav-item" data-screen="c-forecast" id="nav-c-forecast">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2.5 11l3-3.5 2.5 2.5L11 5.5l3.5 3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.5 14h12M3 2v2M8.5 2v2M14 2v2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Cash Forecast</span>
      </div>
      <div class="nav-item" data-screen="c-position" id="nav-c-position">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="2" y="4.5" width="13" height="9" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M2 7.2h13" stroke="currentColor" stroke-width="1.2"/><path d="M11 10.3h2.3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Cash Position</span>
      </div>
      <div class="nav-item" data-screen="c-bridge" id="nav-c-bridge">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2 11c2-5 11-5 13 0" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M2 11v2.5M15 11v2.5M6.5 9v4.5M10.5 9v4.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
        <span class="nav-label">Cash Bridge</span>
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
      ${App.sectionSelectorHTML()}
      <div class="nav-section">Bookings</div>
      <div class="nav-item" data-screen="ev-bookings" id="nav-ev-bookings">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2.5 6.5h12M5.5 2v3M11.5 2v3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><rect x="2.5" y="3.5" width="12" height="11" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 10h6M5.5 12.5h3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Event Booking</span>
      </div>
      <div class="nav-item" data-screen="ev-pricing" id="nav-ev-pricing">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="6" stroke="currentColor" stroke-width="1.3"/><path d="M8.5 5.5v6M6.5 7.5h3.5a1 1 0 0 1 0 2H7a1 1 0 0 0 0 2h3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Price Packages</span>
      </div>
      <div class="nav-item" data-screen="ev-calendar" id="nav-ev-calendar">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="2" y="3.5" width="13" height="11" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 2v3M11.5 2v3M2 8h13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="6" cy="11" r="0.7" fill="currentColor"/><circle cx="8.5" cy="11" r="0.7" fill="currentColor"/><circle cx="11" cy="11" r="0.7" fill="currentColor"/></svg>
        <span class="nav-label">Event Calendar</span>
      </div>
      <div class="nav-section">Guests</div>
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
      ${App.sectionSelectorHTML()}
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
      <div class="nav-section">Operations</div>
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
      <div class="nav-section">Reports</div>
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
      <div class="nav-item" data-screen="ic-report-movers" id="nav-ic-report-movers">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2 11l3.5-3.5 2.5 2.5L13 4M10 4h3v3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Movement</span>
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
      ${App.sectionSelectorHTML()}
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
      ${App.sectionSelectorHTML()}
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
      <div class="nav-item" data-screen="sc-void-comp" id="nav-sc-void-comp">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M4 2.5h9v12l-2-1.3-2.5 1.3-2.5-1.3-2 1.3z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M6.5 6.5l4 4M10.5 6.5l-4 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Void and Comps</span>
      </div>
      <div class="nav-item" data-screen="sc-waste" id="nav-sc-waste">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M3 5h11M5 5l1 9h5l1-9M7 3h3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Waste and Spills</span>
      </div>
      <div class="nav-item" data-screen="sc-maintenance" id="nav-sc-maintenance">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M10.8 2.5a3 3 0 0 0-4 4l-4.3 4.3 2 2L8.8 8.5a3 3 0 0 0 4-4l-2 2-2-2 2-2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
        <span class="nav-label">Maintenance</span>
      </div>
      <div class="nav-item" data-screen="sc-incidents" id="nav-sc-incidents">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M8.5 2L14 4.2v4.3c0 3.4-2.4 5.4-5.5 6.5C5.4 15.9 3 13.9 3 10.5V4.2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M8.5 6v3M8.5 11v.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Incidents</span>
      </div>
      <div class="nav-section">Checklists</div>
      <div class="nav-item" data-screen="sc-checklists" id="nav-sc-checklists">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="2.5" y="2.5" width="12" height="12" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 8.5l2 2 4-4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Opening / Closing</span>
      </div>
      <div class="nav-item" data-screen="sc-checklist-templates" id="nav-sc-checklist-templates">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="5" y="5" width="9.5" height="9.5" rx="1.3" stroke="currentColor" stroke-width="1.3"/><path d="M2.5 11.5V3.8A1.3 1.3 0 0 1 3.8 2.5H11.5" stroke="currentColor" stroke-width="1.3"/></svg>
        <span class="nav-label">Saved Templates</span>
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
