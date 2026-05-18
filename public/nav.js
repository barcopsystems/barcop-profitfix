'use strict';

/* ── Profit Recovery Nav ── */
const ProfitNav = {
  html() {
    return `
      <div class="nav-section">Overview</div>
      <div class="nav-item" id="nav-hub" data-nav="hub">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2 8.5L8.5 2 15 8.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 7v6.5a.5.5 0 0 0 .5.5H7v-4h3v4h2.5a.5.5 0 0 0 .5-.5V7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Recovery Hub</span>
      </div>
      <div class="nav-item" data-screen="dashboard" id="nav-dashboard">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="2" y="2" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="9.5" y="2" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="2" y="9.5" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="9.5" y="9.5" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/></svg>
        <span class="nav-label">Dashboard</span>
      </div>
      <div class="nav-section">Audit</div>
      <div class="nav-item" data-screen="audit-tracker" id="nav-audit-tracker">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 8.5l2 2L12 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Profit Audit</span>
      </div>
      <div class="nav-section">Weekly</div>
      <div class="nav-item" data-screen="this-week" id="nav-this-week">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="2" y="3.5" width="13" height="11" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 2v3M11.5 2v3M2 8h13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">This Week</span>
      </div>
      <div class="nav-item" data-screen="shift-check" id="nav-shift-check">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M8.5 5v4l2.5 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Shift Check</span>
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
      <div class="nav-item" data-screen="recipe-library" id="nav-recipe-library">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M3.5 2.5h7l3.5 3.5v8.5h-10.5v-12z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M10.5 2.5v3.5h3.5M5.5 8h6M5.5 11h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Recipe Library</span>
      </div>
      <div class="nav-item" data-screen="vendor-watch" id="nav-vendor-watch">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2.5 4.5l6-2 6 2v5.5c0 3.5-6 5.5-6 5.5s-6-2-6-5.5v-5.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M6 8.5l2 2 3.5-3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Vendor Watch</span>
      </div>
      <div class="nav-section">Controls</div>
      <div class="nav-item" data-screen="theft-risk" id="nav-theft-risk">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M8.5 2L3 5v4.5c0 3.5 5.5 5.5 5.5 5.5s5.5-2 5.5-5.5v-4.5L8.5 2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M6 8.5l2 2L12 7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Theft Risk</span>
      </div>
      <div class="nav-item" data-screen="cash-recon" id="nav-cash-recon">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="1.5" y="4.5" width="14" height="9" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M5 4.5V3.5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="1.3"/><circle cx="8.5" cy="9" r="1.5" stroke="currentColor" stroke-width="1.3"/></svg>
        <span class="nav-label">Cash Reconciliation</span>
      </div>
      <div class="nav-section">History</div>
      <div class="nav-item" data-screen="reports" id="nav-reports">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2 13l4-5 3 3 3.5-6 2.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Reports &amp; History</span>
      </div>
      <div class="nav-section">Support</div>
      <div class="nav-item" data-screen="getting-started" id="nav-getting-started">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2.5 8.5l4 4 8-8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Getting Started</span>
      </div>
      <div class="nav-section">Resources</div>
      <div class="nav-item" data-screen="resources" id="nav-resources">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M3.5 2.5h7l3.5 3.5v8.5h-10.5v-12z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M10.5 2.5v3.5h3.5M5.5 7h6M5.5 10h4M5.5 13h2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Resources</span>
      </div>
      <div class="nav-item" data-screen="help" id="nav-help">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M7 6.5a1.5 1.5 0 0 1 3 0c0 1-1.5 1.5-1.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8.5" cy="12" r="0.6" fill="currentColor"/></svg>
        <span class="nav-label">Help &amp; FAQ</span>
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
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2 8.5L8.5 2 15 8.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 7v6.5a.5.5 0 0 0 .5.5H7v-4h3v4h2.5a.5.5 0 0 0 .5-.5V7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Recovery Hub</span>
      </div>
      <div class="nav-item" data-screen="r-dashboard" id="nav-r-dashboard">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="2" y="2" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="9.5" y="2" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="2" y="9.5" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="9.5" y="9.5" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/></svg>
        <span class="nav-label">Dashboard</span>
      </div>
      <div class="nav-section">Audit</div>
      <div class="nav-item" data-screen="r-audit" id="nav-r-audit">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 8.5l2 2L12 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Revenue Audit</span>
      </div>
      <div class="nav-section">Weekly</div>
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
      <div class="nav-section">Labor</div>
      <div class="nav-item" data-screen="r-labor-budget" id="nav-r-labor-budget">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><rect x="1.5" y="4.5" width="14" height="9" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M5 4.5V3.5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="1.3"/><circle cx="8.5" cy="9" r="1.5" stroke="currentColor" stroke-width="1.3"/></svg>
        <span class="nav-label">Labor Budget</span>
      </div>
      <div class="nav-item" data-screen="r-rplh" id="nav-r-rplh">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2 13l4-5 3 3 3.5-6 2.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">RPLH Tracker</span>
      </div>
      <div class="nav-section">Revenue</div>
      <div class="nav-item" data-screen="r-check-average" id="nav-r-check-average">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M8.5 2v13M4 5.5h7a2 2 0 0 1 0 4H6a2 2 0 0 0 0 4h7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Check Average</span>
      </div>
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
      <div class="nav-item" data-screen="r-getting-started" id="nav-r-getting-started">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2.5 8.5l4 4 8-8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="nav-label">Getting Started</span>
      </div>
      <div class="nav-section">Resources</div>
      <div class="nav-item" data-screen="r-resources" id="nav-r-resources">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M3.5 2.5h7l3.5 3.5v8.5h-10.5v-12z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M10.5 2.5v3.5h3.5M5.5 7h6M5.5 10h4M5.5 13h2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span class="nav-label">Resources</span>
      </div>
      <div class="nav-item" data-screen="r-help" id="nav-r-help">
        <svg class="nav-icon" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M7 6.5a1.5 1.5 0 0 1 3 0c0 1-1.5 1.5-1.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8.5" cy="12" r="0.6" fill="currentColor"/></svg>
        <span class="nav-label">Help and FAQ</span>
      </div>
    `;
  }
};
