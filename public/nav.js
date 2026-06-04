'use strict';

/* ── Profit Recovery Nav ── */
const ProfitNav = {
  html() {
    return `
      <div class="nav-section">Overview</div>
      <div class="nav-item" id="nav-hub" data-nav="hub">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M11 3.5L5 8.5l6 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Back to Hub</span>
      </div>
      <div class="nav-item" data-screen="dashboard" id="nav-dashboard">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="2" y="2" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="9.5" y="2" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="2" y="9.5" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="9.5" y="9.5" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/></svg>
        <span class="nav-label">Dashboard</span>
      </div>
      <div class="nav-section">Analysis</div>
      <div class="nav-item" data-screen="audit-tracker" id="nav-audit-tracker">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 8.5l2 2L12 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Profit Audit</span>
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
      <div class="nav-section">Products</div>
      <div class="nav-item" data-screen="bar-products" id="nav-bar-products">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M5.5 2.5h6l1 4H4.5l1-4z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M4.5 6.5v8h8v-8" stroke="currentColor" stroke-width="1.3"/><path d="M6.5 10.5h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Bar Products</span>
      </div>
      <div class="nav-item" data-screen="kitchen-products" id="nav-kitchen-products">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M3 4.5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v2H3v-2z" stroke="currentColor" stroke-width="1.3"/><path d="M2.5 6.5h12v6a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-6z" stroke="currentColor" stroke-width="1.3"/><path d="M6.5 10h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Kitchen Products</span>
      </div>
      <div class="nav-section">Costing</div>
      <div class="nav-item" data-screen="recipe-cost-analysis" id="nav-recipe-cost-analysis">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2 13l4-5 3 3 3.5-6 2.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Recipe Cost Analysis</span>
      </div>
      <div class="nav-item" data-screen="vendor-watch" id="nav-vendor-watch">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2.5 4.5l6-2 6 2v5.5c0 3.5-6 5.5-6 5.5s-6-2-6-5.5v-5.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M6 8.5l2 2 3.5-3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Vendor Watch</span>
      </div>
      <div class="nav-item" data-screen="vendor-scorecard" id="nav-vendor-scorecard">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="2.5" y="2.5" width="12" height="12" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M5 11.5V8M8.5 11.5V5.5M12 11.5V9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
        <span class="nav-label">Vendor Scorecard</span>
      </div>
      <div class="nav-item" data-screen="vendor-discrepancy" id="nav-vendor-discrepancy">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M4 2h6l3.5 3.5V15H4V2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M10 2v3.5h3.5" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M8.5 7v3.5M8.5 12.2v.1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
        <span class="nav-label">Vendor Discrepancies</span>
      </div>
      <div class="nav-section">Controls</div>
      <div class="nav-item" data-screen="theft-risk" id="nav-theft-risk">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M8.5 2L3 5v4.5c0 3.5 5.5 5.5 5.5 5.5s5.5-2 5.5-5.5v-4.5L8.5 2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M6 8.5l2 2L12 7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Theft Risk</span>
      </div>
      <div class="nav-item" data-screen="pour-test" id="nav-pour-test">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M5.5 2.5h6l-0.5 4H6l-0.5-4z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M6 6.5l-1.5 7a1 1 0 0 0 1 1.2h6a1 1 0 0 0 1-1.2L11 6.5" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M5.5 10.5h6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Pour Test</span>
      </div>
      <div class="nav-item" data-screen="yield-test" id="nav-yield-test">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="9" r="5" stroke="currentColor" stroke-width="1.3"/><path d="M3 9h11" stroke="currentColor" stroke-width="1.3"/><path d="M8.5 2v3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Yield Test</span>
      </div>
      <div class="nav-item" data-screen="cash-recon" id="nav-cash-recon">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="1.5" y="4.5" width="14" height="9" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M5 4.5V3.5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="1.3"/><circle cx="8.5" cy="9" r="1.5" stroke="currentColor" stroke-width="1.3"/></svg>
        <span class="nav-label">Cash Reconciliation</span>
      </div>
      <div class="nav-section">History</div>
      <div class="nav-item" data-screen="reports" id="nav-reports">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2 13l4-5 3 3 3.5-6 2.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Reports and History</span>
      </div>
      <div class="nav-section">Support</div>
      <div class="nav-item" data-screen="help" id="nav-help">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M7 6.5a1.5 1.5 0 0 1 3 0c0 1-1.5 1.5-1.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8.5" cy="12" r="0.6" fill="currentColor"/></svg>
        <span class="nav-label">Help and FAQ</span>
      </div>
    `;
  }
};

/* ── Revenue Recovery Nav ── */
const Revenue = {
  navHTML() {
    return `
      <div class="nav-section">Overview</div>
      <div class="nav-item" id="nav-hub" data-nav="hub">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M11 3.5L5 8.5l6 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Back to Hub</span>
      </div>
      <div class="nav-item" data-screen="r-dashboard" id="nav-r-dashboard">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="2" y="2" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="9.5" y="2" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="2" y="9.5" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="9.5" y="9.5" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/></svg>
        <span class="nav-label">Dashboard</span>
      </div>
      <div class="nav-section">Analysis</div>
      <div class="nav-item" data-screen="r-audit" id="nav-r-audit">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 8.5l2 2L12 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Revenue Audit</span>
      </div>
      <div class="nav-item" data-screen="r-fix" id="nav-r-fix">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M10.8 2.5a3 3 0 0 0-4 4l-4.3 4.3 2 2L8.8 8.5a3 3 0 0 0 4-4l-2 2-2-2 2-2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
        <span class="nav-label">Revenue Fix</span>
      </div>
      <div class="nav-section">Weekly</div>
      <div class="nav-item" data-screen="r-forecast" id="nav-r-forecast">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2.5 11l3-3.5 2.5 2.5L11 5.5l3.5 3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.5 14h12M3 2v2M8.5 2v2M14 2v2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Revenue Forecast</span>
      </div>
      <div class="nav-item" data-screen="r-this-week" id="nav-r-this-week">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="2" y="3.5" width="13" height="11" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 2v3M11.5 2v3M2 8h13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">This Week</span>
      </div>
      <div class="nav-item" data-screen="r-server-check" id="nav-r-server-check">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M8.5 5v4l2.5 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Server Check</span>
      </div>
      <div class="nav-section">Menu</div>
      <div class="nav-item" data-screen="r-menu-items" id="nav-r-menu-items">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M3.5 2.5h7l3.5 3.5v8.5h-10.5v-12z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M10.5 2.5v3.5h3.5M5.5 8h6M5.5 11h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Menu Items</span>
      </div>
      <div class="nav-item" data-screen="r-menu-engineering" id="nav-r-menu-engineering">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="2" y="2" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="9" y="2" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="2" y="9" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.3"/></svg>
        <span class="nav-label">Menu Engineering</span>
      </div>
      <div class="nav-item" data-screen="r-pricing" id="nav-r-pricing">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M8.5 1.8v13.4M11.7 4.4H6.9a2.1 2.1 0 0 0 0 4.2h3.2a2.1 2.1 0 0 1 0 4.2H5.3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Price Calculator</span>
      </div>
      <div class="nav-item" data-screen="r-dog-test" id="nav-r-dog-test">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 8.5l2 2 4-4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Dog Test Tracker</span>
      </div>
      <div class="nav-section">Labor</div>
      <div class="nav-item" data-screen="r-rplh" id="nav-r-rplh">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2 13l4-5 3 3 3.5-6 2.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">RPLH Tracker</span>
      </div>
      <div class="nav-section">Revenue</div>
      <div class="nav-item" data-screen="r-events" id="nav-r-events">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2.5 6.5h12M5.5 2v3M11.5 2v3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><rect x="2.5" y="3.5" width="12" height="11" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 10h6M5.5 12.5h3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Events and Catering</span>
      </div>
      <div class="nav-section">History</div>
      <div class="nav-item" data-screen="r-reports" id="nav-r-reports">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2 13l4-5 3 3 3.5-6 2.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Reports and History</span>
      </div>
      <div class="nav-section">Support</div>
      <div class="nav-item" data-screen="r-help" id="nav-r-help">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M7 6.5a1.5 1.5 0 0 1 3 0c0 1-1.5 1.5-1.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8.5" cy="12" r="0.6" fill="currentColor"/></svg>
        <span class="nav-label">Help and FAQ</span>
      </div>
    `;
  }
};

/* ── Traffic Recovery Nav ── */
const Traffic = {
  navHTML() {
    return `
      <div class="nav-section">Overview</div>
      <div class="nav-item" id="nav-hub" data-nav="hub">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M11 3.5L5 8.5l6 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Back to Hub</span>
      </div>
      <div class="nav-item" data-screen="t-dashboard" id="nav-t-dashboard">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="2" y="2" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="9.5" y="2" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="2" y="9.5" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="9.5" y="9.5" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/></svg>
        <span class="nav-label">Dashboard</span>
      </div>
      <div class="nav-section">Analysis</div>
      <div class="nav-item" data-screen="t-audit" id="nav-t-audit">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 8.5l2 2L12 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Traffic Audit</span>
      </div>
      <div class="nav-item" data-screen="t-fix" id="nav-t-fix">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M10.8 2.5a3 3 0 0 0-4 4l-4.3 4.3 2 2L8.8 8.5a3 3 0 0 0 4-4l-2 2-2-2 2-2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
        <span class="nav-label">Traffic Fix</span>
      </div>
      <div class="nav-section">Weekly</div>
      <div class="nav-item" data-screen="t-this-week" id="nav-t-this-week">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="2" y="3.5" width="13" height="11" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 2v3M11.5 2v3M2 8h13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">This Week</span>
      </div>
      <div class="nav-section">Digital Presence</div>
      <div class="nav-item" data-screen="t-gbp" id="nav-t-gbp">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="7" r="3" stroke="currentColor" stroke-width="1.3"/><path d="M8.5 2v1M8.5 12v3M2 7h1M14 7h1M4.1 3.6l.7.7M12.2 11.7l.7.7M4.1 10.4l.7-.7M12.2 5.3l.7-.7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Google Business Profile</span>
      </div>
      <div class="nav-item" data-screen="t-reviews" id="nav-t-reviews">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M8.5 2l1.8 3.6L14.5 6.2l-3 2.9.7 4.1L8.5 11.2 5.8 13.2l.7-4.1-3-2.9 4.2-.6L8.5 2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
        <span class="nav-label">Review Tracker</span>
      </div>
      <div class="nav-item" data-screen="t-search" id="nav-t-search">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="7.5" cy="7.5" r="4.5" stroke="currentColor" stroke-width="1.3"/><path d="M11 11l3 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Search and SEO</span>
      </div>
      <div class="nav-item" data-screen="t-website" id="nav-t-website">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="1.5" y="3" width="14" height="11" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M1.5 7h14" stroke="currentColor" stroke-width="1.3"/><circle cx="4" cy="5" r="0.7" fill="currentColor"/><circle cx="6.5" cy="5" r="0.7" fill="currentColor"/></svg>
        <span class="nav-label">Website Scorecard</span>
      </div>
      <div class="nav-section">Social and Delivery</div>
      <div class="nav-item" data-screen="t-social" id="nav-t-social">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="4.5" cy="8.5" r="2" stroke="currentColor" stroke-width="1.3"/><circle cx="12.5" cy="4" r="2" stroke="currentColor" stroke-width="1.3"/><circle cx="12.5" cy="13" r="2" stroke="currentColor" stroke-width="1.3"/><path d="M6.4 7.6l4.2-2.1M6.4 9.4l4.2 2.1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Social Media</span>
      </div>
      <div class="nav-item" data-screen="t-delivery" id="nav-t-delivery">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="1.5" y="5.5" width="10" height="8" rx="1" stroke="currentColor" stroke-width="1.3"/><path d="M11.5 8h2l2 2.5v3h-4" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="4.5" cy="13.5" r="1.3" stroke="currentColor" stroke-width="1.3"/><circle cx="13" cy="13.5" r="1.3" stroke="currentColor" stroke-width="1.3"/><path d="M4.5 5.5V3.5a2 2 0 0 1 2-2h3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Delivery Platforms</span>
      </div>
      <div class="nav-item" data-screen="t-email" id="nav-t-email">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="1.5" y="3.5" width="14" height="10" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M1.5 6.5l7 4.5 7-4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Email and Loyalty</span>
      </div>
      <div class="nav-section">Guests and Planning</div>
      <div class="nav-item" data-screen="t-regulars" id="nav-t-regulars">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="6" cy="6.5" r="2.5" stroke="currentColor" stroke-width="1.3"/><path d="M2 14c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M12 5.5l1 1.2L15.5 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">VIP Regulars</span>
      </div>
      <div class="nav-item" data-screen="t-initiatives" id="nav-t-initiatives">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M3 13l3-4 3 2 5-7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 4h3v3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Slow-Night Initiatives</span>
      </div>
      <div class="nav-item" data-screen="t-holidays" id="nav-t-holidays">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="2" y="3.5" width="13" height="11" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 2v3M11.5 2v3M2 8h13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="6" cy="11" r="0.7" fill="currentColor"/><circle cx="8.5" cy="11" r="0.7" fill="currentColor"/><circle cx="11" cy="11" r="0.7" fill="currentColor"/></svg>
        <span class="nav-label">Holiday and Events</span>
      </div>
      <div class="nav-item" data-screen="t-inquiries" id="nav-t-inquiries">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M3 4h11v8H6l-3 3V4z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M6 7h5M6 9.5h3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Group Inquiries</span>
      </div>
      <div class="nav-section">History</div>
      <div class="nav-item" data-screen="t-reports" id="nav-t-reports">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2 13l4-5 3 3 3.5-6 2.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Reports and History</span>
      </div>
      <div class="nav-section">Support</div>
      <div class="nav-item" data-screen="t-help" id="nav-t-help">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M7 6.5a1.5 1.5 0 0 1 3 0c0 1-1.5 1.5-1.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8.5" cy="12" r="0.6" fill="currentColor"/></svg>
        <span class="nav-label">Help and FAQ</span>
      </div>
    `;
  }
};

/* ── Inventory Control Nav ── */
const Inventory = {
  navHTML() {
    return `
      <div class="nav-section">Overview</div>
      <div class="nav-item" id="nav-hub" data-nav="hub">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M11 3.5L5 8.5l6 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Back to Hub</span>
      </div>
      <div class="nav-item" data-screen="ic-dashboard" id="nav-ic-dashboard">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="2" y="2" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="9.5" y="2" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="2" y="9.5" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="9.5" y="9.5" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/></svg>
        <span class="nav-label">Dashboard</span>
      </div>
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
      <div class="nav-item" data-screen="ic-product-setup" id="nav-ic-product-setup">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2.5 5L8.5 2l6 3v7l-6 3-6-3V5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M2.5 5l6 3 6-3M8.5 8v7" stroke="currentColor" stroke-width="1.3"/></svg>
        <span class="nav-label">Add Products</span>
      </div>
      <div class="nav-item" data-screen="ic-locations" id="nav-ic-locations">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M8.5 15s5-4.2 5-8a5 5 0 0 0-10 0c0 3.8 5 8 5 8z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="8.5" cy="7" r="1.8" stroke="currentColor" stroke-width="1.3"/></svg>
        <span class="nav-label">Set Locations</span>
      </div>
      <div class="nav-item" data-screen="ic-vendors" id="nav-ic-vendors">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M8.5 2L3 4.5v4c0 3.5 5.5 6.5 5.5 6.5s5.5-3 5.5-6.5v-4L8.5 2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
        <span class="nav-label">List Vendors</span>
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
      <div class="nav-section">Overview</div>
      <div class="nav-item" id="nav-hub" data-nav="hub">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M11 3.5L5 8.5l6 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Back to Hub</span>
      </div>
      <div class="nav-item" data-screen="lc-dashboard" id="nav-lc-dashboard">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="2" y="2" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="9.5" y="2" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="2" y="9.5" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="9.5" y="9.5" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/></svg>
        <span class="nav-label">Dashboard</span>
      </div>
      <div class="nav-section">Scheduling</div>
      <div class="nav-item" data-screen="lc-build-schedule" id="nav-lc-build-schedule">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="2" y="3.5" width="13" height="11" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 2v3M11.5 2v3M2 8h13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Build Schedule</span>
      </div>
      <div class="nav-item" data-screen="lc-schedule-history" id="nav-lc-schedule-history">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M5 4.5h9M5 8.5h9M5 12.5h9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="2.6" cy="4.5" r="0.7" fill="currentColor"/><circle cx="2.6" cy="8.5" r="0.7" fill="currentColor"/><circle cx="2.6" cy="12.5" r="0.7" fill="currentColor"/></svg>
        <span class="nav-label">Schedule History</span>
      </div>
      <div class="nav-item" data-screen="lc-schedule-templates" id="nav-lc-schedule-templates">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="5" y="5" width="9.5" height="9.5" rx="1.3" stroke="currentColor" stroke-width="1.3"/><path d="M2.5 11.5V3.8A1.3 1.3 0 0 1 3.8 2.5H11.5" stroke="currentColor" stroke-width="1.3"/></svg>
        <span class="nav-label">Saved Templates</span>
      </div>
      <div class="nav-section">Actuals</div>
      <div class="nav-item" data-screen="lc-log-hours" id="nav-lc-log-hours">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M8.5 5v4l2.5 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Log Hours</span>
      </div>
      <div class="nav-item" data-screen="lc-daily-view" id="nav-lc-daily-view">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="2.5" y="3" width="12" height="12" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 1.7v2.6M11.5 1.7v2.6M2.5 7h12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8.5" cy="11" r="1.6" stroke="currentColor" stroke-width="1.3"/></svg>
        <span class="nav-label">Daily Snapshot</span>
      </div>
      <div class="nav-item" data-screen="lc-weekly-summary" id="nav-lc-weekly-summary">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2 13l4-5 3 3 3.5-6 2.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Weekly Summary</span>
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
      <div class="nav-section">Tips</div>
      <div class="nav-item" data-screen="lc-tip-log" id="nav-lc-tip-log">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M8.5 2v13M5.5 5h5a2 2 0 0 1 0 4H6a2 2 0 0 0 0 4h6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Tip Log</span>
      </div>
      <div class="nav-item" data-screen="lc-tip-pool" id="nav-lc-tip-pool">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="3" y="2.5" width="11" height="12" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 5.5h6M5.5 8.5h6M5.5 11.5h3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Pool Calculator</span>
      </div>
      <div class="nav-item" data-screen="lc-tip-history" id="nav-lc-tip-history">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M5 4.5h9M5 8.5h9M5 12.5h9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="2.6" cy="4.5" r="0.7" fill="currentColor"/><circle cx="2.6" cy="8.5" r="0.7" fill="currentColor"/><circle cx="2.6" cy="12.5" r="0.7" fill="currentColor"/></svg>
        <span class="nav-label">Tip History</span>
      </div>
      <div class="nav-section">Reports</div>
      <div class="nav-item" data-screen="lc-reports" id="nav-lc-reports">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2 13l4-5 3 3 3.5-6 2.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Labor Reports</span>
      </div>
      <div class="nav-item" data-screen="lc-overtime-watch" id="nav-lc-overtime-watch">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="9" r="5.5" stroke="currentColor" stroke-width="1.3"/><path d="M8.5 6v3.2l2.2 1.3M6.5 2.5h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Overtime Watch</span>
      </div>
      <div class="nav-item" data-screen="lc-callout-log" id="nav-lc-callout-log">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M8.5 2L15.5 14.5H1.5L8.5 2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M8.5 7v3.4M8.5 12v.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Call-Out Log</span>
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
      <div class="nav-item" data-screen="lc-wage-settings" id="nav-lc-wage-settings">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="6" stroke="currentColor" stroke-width="1.3"/><path d="M8.5 5.5v6M6.5 7.5h3.5a1 1 0 0 1 0 2H7a1 1 0 0 0 0 2h3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Wage Policies</span>
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
      <div class="nav-section">Overview</div>
      <div class="nav-item" id="nav-hub" data-nav="hub">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M11 3.5L5 8.5l6 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Back to Hub</span>
      </div>
      <div class="nav-item" data-screen="sc-dashboard" id="nav-sc-dashboard">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="2" y="2" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="9.5" y="2" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="2" y="9.5" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="9.5" y="9.5" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/></svg>
        <span class="nav-label">Dashboard</span>
      </div>
      <div class="nav-section">Setup</div>
      <div class="nav-item" data-screen="sc-drawers" id="nav-sc-drawers">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="2" y="5" width="13" height="8" rx="1.3" stroke="currentColor" stroke-width="1.3"/><path d="M5 5V3.5h7V5M5.5 9h6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Drawers / Registers</span>
      </div>
      <div class="nav-item" data-screen="sc-cash-settings" id="nav-sc-cash-settings">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="6" stroke="currentColor" stroke-width="1.3"/><path d="M8.5 5.5v6M6.5 7.5h3.5a1 1 0 0 1 0 2H7a1 1 0 0 0 0 2h3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Cash Tolerances</span>
      </div>
      <div class="nav-item" data-screen="sc-comp-settings" id="nav-sc-comp-settings">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M8.5 2L3 5v4.5c0 3.5 5.5 5.5 5.5 5.5s5.5-2 5.5-5.5v-4.5L8.5 2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M7 8.5l1.5 1.5L11 7.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Comp Authorization</span>
      </div>
      <div class="nav-item" data-screen="sc-checklist-templates" id="nav-sc-checklist-templates">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="5" y="5" width="9.5" height="9.5" rx="1.3" stroke="currentColor" stroke-width="1.3"/><path d="M2.5 11.5V3.8A1.3 1.3 0 0 1 3.8 2.5H11.5" stroke="currentColor" stroke-width="1.3"/></svg>
        <span class="nav-label">Checklist Templates</span>
      </div>
      <div class="nav-section">Shifts</div>
      <div class="nav-item" data-screen="sc-active-shift" id="nav-sc-active-shift">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M7 5.5l4.5 3-4.5 3z" fill="currentColor"/></svg>
        <span class="nav-label">Active Shift</span>
      </div>
      <div class="nav-item" data-screen="sc-shift-history" id="nav-sc-shift-history">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M5 4.5h9M5 8.5h9M5 12.5h9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="2.6" cy="4.5" r="0.7" fill="currentColor"/><circle cx="2.6" cy="8.5" r="0.7" fill="currentColor"/><circle cx="2.6" cy="12.5" r="0.7" fill="currentColor"/></svg>
        <span class="nav-label">Shift History</span>
      </div>
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
      <div class="nav-item" data-screen="sc-86-list" id="nav-sc-86-list">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M4 4l9 9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">86 List</span>
      </div>
      <div class="nav-item" data-screen="sc-void-comp" id="nav-sc-void-comp">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M4 2.5h9v12l-2-1.3-2.5 1.3-2.5-1.3-2 1.3z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M6.5 6.5l4 4M10.5 6.5l-4 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Void and Comp Log</span>
      </div>
      <div class="nav-item" data-screen="sc-waste" id="nav-sc-waste">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M3 5h11M5 5l1 9h5l1-9M7 3h3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Waste and Spill Log</span>
      </div>
      <div class="nav-item" data-screen="sc-maintenance" id="nav-sc-maintenance">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M10.8 2.5a3 3 0 0 0-4 4l-4.3 4.3 2 2L8.8 8.5a3 3 0 0 0 4-4l-2 2-2-2 2-2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
        <span class="nav-label">Maintenance Log</span>
      </div>
      <div class="nav-item" data-screen="sc-walked-tabs" id="nav-sc-walked-tabs">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M3.5 14.5l3.5-8 3 4 3.5-6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="13.5" cy="4.5" r="1.3" stroke="currentColor" stroke-width="1.3"/></svg>
        <span class="nav-label">Walked Tabs</span>
      </div>
      <div class="nav-item" data-screen="sc-incident-log" id="nav-sc-incident-log">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M8.5 2L15.5 14.5H1.5L8.5 2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="8.5" cy="10.5" r="0.8" fill="currentColor"/><path d="M8.5 6v3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Incident Log</span>
      </div>
      <div class="nav-section">Checklists</div>
      <div class="nav-item" data-screen="sc-opening-checklist" id="nav-sc-opening-checklist">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="2.5" y="2.5" width="12" height="12" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 8.5l2 2 4-4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Opening Checklist</span>
      </div>
      <div class="nav-item" data-screen="sc-closing-checklist" id="nav-sc-closing-checklist">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="3" y="7.5" width="11" height="7" rx="1.3" stroke="currentColor" stroke-width="1.3"/><path d="M5.3 7.5V5.5a3.2 3.2 0 0 1 6.4 0v2" stroke="currentColor" stroke-width="1.3"/></svg>
        <span class="nav-label">Closing Checklist</span>
      </div>
      <div class="nav-section">Reports</div>
      <div class="nav-item" data-screen="sc-reports-shift" id="nav-sc-reports-shift">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2 13l4-5 3 3 3.5-6 2.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Shift Reports</span>
      </div>
      <div class="nav-item" data-screen="sc-reports-cash" id="nav-sc-reports-cash">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2 13h11M4 13V8M7.5 13V4M11 13V9.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Cash Reports</span>
      </div>
      <div class="nav-item" data-screen="sc-reports-ops" id="nav-sc-reports-ops">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="2.5" y="8" width="3" height="5" stroke="currentColor" stroke-width="1.3"/><rect x="7" y="4" width="3" height="9" stroke="currentColor" stroke-width="1.3"/><rect x="11.5" y="10" width="3" height="3" stroke="currentColor" stroke-width="1.3"/></svg>
        <span class="nav-label">Operations Reports</span>
      </div>
      <div class="nav-section">Support</div>
      <div class="nav-item" data-screen="sc-help" id="nav-sc-help">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M7 6.5a1.5 1.5 0 0 1 3 0c0 1-1.5 1.5-1.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8.5" cy="12" r="0.6" fill="currentColor"/></svg>
        <span class="nav-label">Help and FAQ</span>
      </div>
    `;
  }
};
