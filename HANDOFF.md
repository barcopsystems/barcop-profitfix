[HANDOFF.md](https://github.com/user-attachments/files/28057837/HANDOFF.md)
# Bar Cop Recovery Platform — HANDOFF.md
Updated: May 20, 2026

---

## Live App

| Item | Value |
|---|---|
| URL | https://app.barcop.com |
| GitHub | https://github.com/barcopsystems/barcop-profitfix |
| Hosting | DigitalOcean App Platform (auto-deploys from GitHub main branch) |
| Database | Supabase — https://plpikfpintruksclkwyb.supabase.co |
| Supabase anon key | sb_publishable_2tv02ZIL_HKQitRV1ST-rQ_9a8Gjw_u |
| Anthropic API key | DigitalOcean env var: ANTHROPIC_API_KEY |

NOTE: App was previously hosted on Railway. It is now on DigitalOcean App Platform.
The Anthropic audit API calls use streaming (stream: true) to stay alive past the
60-second DigitalOcean HTTP timeout. Do not revert to blocking calls.

---

## How to Deploy Updates

1. Edit files locally or in this chat
2. Commit changes to GitHub (main branch)
3. DigitalOcean auto-redeploys in about 2 minutes
4. Verify deployment in DigitalOcean App Platform dashboard

---

## Stack

- Frontend: Vanilla JS, single-page app. S namespace holds all screens.
  App.data holds all user data. App.navigate(screenId) routes between screens.
  App.showHub() renders the full-screen Recovery Hub (no sidebar).
  App.showApp(module) reveals the sidebar shell when entering a module.
- Backend: Node/Express at server/index.js — proxies Anthropic API, handles Stripe webhooks
- Auth: Supabase auth with localStorage fallback (no Supabase = local mode, skips auth)
- DB: Supabase postgres with RLS, localStorage fallback
- Deployment: DigitalOcean App Platform, Dockerfile build

---

## Rules That Cannot Be Broken

- Zero em dashes anywhere in any text, tooltips, prompts, or UI copy
- Zero AI language or phrases ("leverage", "utilize", "dive into", etc.)
- 30-year restaurant operator tone and voice throughout
- All three modules must look and function identically — same colors, same layouts,
  same button styles. Only page content and data changes between modules
- Follow DESIGN_SYSTEM.md exactly for all colors, typography, spacing, and components

---

## Data Architecture

App.data = {
  settings: {},            // bar info, cost targets, cash tolerance
  bar_products: [],
  kitchen_products: [],
  recipes: [],
  weeks: [],               // Profit weekly entries
  shifts: [],
  reconciliations: [],
  theft_scores: [],
  vendor_log: [],
  audits: [],              // Profit audits
  revenue_weeks: [],       // Revenue weekly entries
  revenue_servers: [],
  revenue_menu_items: [],
  revenue_audits: [],
  traffic_weeks: [],       // Traffic weekly entries
  traffic_audits: [],
}

Profit and Revenue share: bar_products, kitchen_products, settings.targets
Traffic is completely standalone — no shared data with Profit or Revenue.

---

## Module Status

### Profit Recovery — COMPLETE

All 14 screens built and working:
- dashboard.js
- this-week.js (multi-step weekly entry wizard)
- shift-check.js
- bar-products.js (CSV/Excel import, bulk delete, incomplete indicators)
- kitchen-products.js
- recipe-library.js (auto-repricing on vendor price changes, flagged alerts)
- vendor-watch.js
- theft-risk.js
- cash-recon.js
- reports.js
- audit-tracker.js (HTML rendering — calls /api/generate-audit, renders scored audit in-app)
- getting-started.js (30-task checklist, cost targets pre-checked as first completed step)
- help.js
- settings.js
- resources.js (17 downloadable PDFs and Word docs in public/assets/resources/)

### Revenue Recovery — COMPLETE

All 11 screens built and working in public/screens/revenue/:
- r-dashboard.js
- r-this-week.js (6-step wizard: revenue, labor, RPLH, server performance, review/save)
- r-server-check.js
- r-menu-items.js
- r-menu-engineering.js (4-quadrant matrix + price sensitivity calculator)
- r-labor-budget.js
- r-rplh-tracker.js
- r-check-average.js
- r-reports.js
- r-audit.js (HTML rendering — calls /api/generate-revenue-audit)
- r-getting-started.js
- r-resources.js
- r-help.js
- r-settings.js (targets, server roster, wages)

### Traffic Recovery — PARTIALLY COMPLETE

Nav, routing, and app.js module switching are wired.
Server side is done: /api/generate-traffic-audit endpoint exists, streaming enabled,
Stripe price ID price_1TYCjnGow04S066UXTK6d9C6 is mapped to traffic module.

Screens in public/screens/traffic/ — status:

| File | Screen Name | Status |
|---|---|---|
| t-dashboard.js | Dashboard | BUILT (complete) |
| t-this-week.js | This Week — Weekly Entry | BUILT (complete) |
| t-audit.js | Traffic Audit | BUILT — HTML rendering, calls /api/generate-traffic-audit |
| t-getting-started.js | Getting Started | BUILT (complete) |
| t-reports.js | Reports and History | BUILT (complete) |
| t-settings.js | Settings | BUILT (complete) |
| t-help.js | Help and FAQ | BUILT (complete) |
| t-resources.js | Resources | BUILT — placeholder, no PDFs uploaded yet |
| t-gbp.js | Google Business Profile | PLACEHOLDER — needs full build |
| t-reviews.js | Review Tracker | PLACEHOLDER — needs full build |
| t-search.js | Search and SEO | PLACEHOLDER — needs full build |
| t-website.js | Website Scorecard | PLACEHOLDER — needs full build |
| t-social.js | Social Media | PLACEHOLDER — needs full build |
| t-delivery.js | Delivery Platforms | PLACEHOLDER — needs full build |
| t-email.js | Email and Loyalty | PLACEHOLDER — needs full build |

---

## What Still Needs to Be Built — Traffic Placeholders

These 7 screens exist as "Coming Soon" stubs and need full builds.
Each follows the same pattern as the Revenue tracker screens.
Build them in this order (highest operator value first):

### 1. t-gbp.js — Google Business Profile Tracker
Track GBP listing completeness, photo count, posts per month, review response rate.
Data fields: listing_complete, photos_count, posts_this_month, response_rate_pct,
hours_accurate, menu_linked, website_linked, last_updated.
Scored against Audit Section 1 (GBP) thresholds.
Show: live badge (Open/Closed status display), completeness checklist, post history table.

### 2. t-reviews.js — Review Response Tracker
Track Google and Yelp star ratings, new reviews per week, response rate, response time.
Data fields: google_rating, google_review_count, yelp_rating, yelp_review_count,
tripadvisor_rating, response_rate_pct, avg_response_hours, weekly_new_reviews.
Show: rating trend chart, response rate badge, review log table with responded/not flags.

### 3. t-website.js — Website Conversion Scorecard
Track monthly sessions, bounce rate, menu page views, online order clicks, mobile score.
Data fields: monthly_sessions, bounce_rate_pct, menu_page_views, order_clicks,
mobile_score (0-100), page_load_seconds, has_ssl, menu_is_current, online_ordering_live.
Show: conversion funnel diagram, checklist of quick wins, monthly trend table.

### 4. t-search.js — Search Rank Tracker
Track Google Maps Pack position for key search terms, NAP consistency, keyword rankings.
Data fields: maps_pack_position (1-3, or "Not Listed"), primary_keyword, secondary_keyword,
nap_consistent (bool), citation_count, last_checked_date.
Show: rank history table, NAP audit checklist, citation count tracker.

### 5. t-social.js — Social Media Tracker
Track Instagram and Facebook followers, post frequency, engagement rate, top post type.
Data fields: ig_followers, fb_followers, posts_per_week, ig_engagement_rate_pct,
fb_engagement_rate_pct, best_post_type (food/event/behind-scenes/promo).
Show: follower trend chart, posting cadence calendar view (simple grid), engagement summary.

### 6. t-delivery.js — Delivery Platform Tracker
Track DoorDash, Uber Eats, and Grubhub ratings, order volume, and commission rates.
Data fields per platform: active (bool), rating, weekly_orders, avg_order_value,
commission_pct, monthly_revenue, monthly_fees.
Show: per-platform card with P&L calculation (revenue minus fees), profitability badge.

### 7. t-email.js — Email and Loyalty Tracker
Track email list size, send frequency, open rate, click rate, loyalty program members.
Data fields: list_size, sends_per_month, avg_open_rate_pct, avg_click_rate_pct,
loyalty_members, loyalty_redemption_rate_pct, last_send_date.
Show: list growth chart, open rate trend, campaign log table.

---

## Remaining Work After Traffic Screens

1. Add resources PDFs to public/assets/resources/ for traffic module (files TBD)
2. Swap Stripe sandbox keys for live keys and run final end-to-end payment test
3. Demo mode — a read-only walkthrough with pre-loaded sample data for each module
4. Final cross-module QA pass — verify shared data between Profit and Revenue is
   syncing correctly (bar_products, kitchen_products, targets)
5. Launch

---

## File Structure

project/
├── server/
│   └── index.js               Express server, API proxy, Stripe webhooks, audit endpoints
├── public/
│   ├── index.html             App shell — all nav items, all script tags
│   ├── style.css              Complete design system CSS (matches DESIGN_SYSTEM.md)
│   ├── app.js                 Router, tooltip engine, auth, App object, all TT.defs
│   ├── db.js                  Supabase + localStorage data layer
│   ├── assets/
│   │   ├── logo.png
│   │   ├── bar-graph-icon.png
│   │   └── resources/         Downloadable PDFs and Word docs (Profit + Revenue populated)
│   ├── components/
│   │   └── onboarding.js      2-step setup (bar info and targets → dashboard)
│   └── screens/
│       ├── dashboard.js
│       ├── this-week.js
│       ├── shift-check.js
│       ├── bar-products.js
│       ├── kitchen-products.js
│       ├── recipe-library.js
│       ├── vendor-watch.js
│       ├── theft-risk.js
│       ├── cash-recon.js
│       ├── reports.js
│       ├── audit-tracker.js
│       ├── getting-started.js
│       ├── help.js
│       ├── settings.js
│       ├── resources.js
│       ├── revenue/
│       │   ├── r-dashboard.js
│       │   ├── r-this-week.js
│       │   ├── r-server-check.js
│       │   ├── r-menu-items.js
│       │   ├── r-menu-engineering.js
│       │   ├── r-labor-budget.js
│       │   ├── r-rplh-tracker.js
│       │   ├── r-check-average.js
│       │   ├── r-reports.js
│       │   ├── r-audit.js
│       │   ├── r-getting-started.js
│       │   ├── r-resources.js
│       │   ├── r-help.js
│       │   └── r-settings.js
│       └── traffic/
│           ├── t-dashboard.js      (COMPLETE)
│           ├── t-this-week.js      (COMPLETE)
│           ├── t-audit.js          (COMPLETE)
│           ├── t-getting-started.js(COMPLETE)
│           ├── t-reports.js        (COMPLETE)
│           ├── t-settings.js       (COMPLETE)
│           ├── t-help.js           (COMPLETE)
│           ├── t-resources.js      (COMPLETE — no PDFs yet)
│           ├── t-gbp.js            (PLACEHOLDER — build next)
│           ├── t-reviews.js        (PLACEHOLDER)
│           ├── t-website.js        (PLACEHOLDER)
│           ├── t-search.js         (PLACEHOLDER)
│           ├── t-social.js         (PLACEHOLDER)
│           ├── t-delivery.js       (PLACEHOLDER)
│           └── t-email.js          (PLACEHOLDER)
├── Dockerfile
├── package.json
├── vercel.json
├── DESIGN_SYSTEM.md
├── SUPABASE_SETUP.sql
└── HANDOFF.md

---

## Key API Endpoints (server/index.js)

POST /api/generate-audit            Profit audit — streaming Anthropic call, returns JSON
POST /api/generate-revenue-audit    Revenue audit — streaming, returns JSON
POST /api/generate-traffic-audit    Traffic audit — streaming, returns JSON
POST /api/stripe/webhook            Stripe webhook handler
POST /api/create-checkout-session   New subscription checkout
GET  /api/subscription-status       Check active modules for logged-in user

---

## Supabase Tables

users                  Auth users (managed by Supabase Auth)
user_data              JSONB blob per user — stores full App.data object
subscriptions          user_id, active_modules[], stripe_customer_id, stripe_subscription_id

---

## How to Start a New Build Session

The cleanest way to continue without uploading a zip:

1. Open new chat
2. Paste this message:
   "Continuing Bar Cop Recovery app build.
    GitHub repo: https://github.com/barcopsystems/barcop-profitfix
    Read HANDOFF.md in the root for full context. The repo is public.
    Today I want to build: [specific screen or task]."
3. Claude fetches DESIGN_SYSTEM.md and HANDOFF.md, then reads only the
   specific screen files relevant to what is being built that session.

No zip uploads needed — the repo is public and all files are accessible via
raw.githubusercontent.com URLs.
