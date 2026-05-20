# Bar Cop Recovery Platform — HANDOFF.md
Updated: May 20, 2026

## Live App
| Item | Value |
|---|---|
| URL | https://app.barcop.com |
| GitHub | https://github.com/barcopsystems/barcop-profitfix |
| Hosting | DigitalOcean App Platform (auto-deploys from GitHub main branch) |
| Database | Supabase — https://plpikfpintruksclkwyb.supabase.co |
| Supabase anon key | sb_publishable_2tv02ZIL_HKQitRV1ST-rQ_9a8Gjw_u |
| Anthropic API key | DigitalOcean env var: ANTHROPIC_API_KEY |
| Stripe | Test mode — single product "Bar Cop" at $149/mo |
| Stripe Price ID | price_1TZA54Gow04S066UjWZIRAlL |

NOTE: App was previously on Railway — now on DigitalOcean App Platform. Anthropic audit API calls use streaming (stream: true) to stay alive past the 60-second DigitalOcean HTTP timeout. Do not revert to blocking calls.

## How to Deploy Updates
1. Edit files in GitHub directly or via this chat
2. Commit changes to main branch
3. DigitalOcean auto-redeploys in about 2 minutes
4. Verify in DigitalOcean App Platform dashboard

## Stack
- Frontend: Vanilla JS, single-page app. App namespace holds all core logic. S namespace holds all screens. App.navigate(screenId) routes between screens. App.showHub() renders the full-screen Recovery Hub. App.showApp(module) reveals the sidebar shell when entering a module.
- Backend: Express server at server/index.js — Claude API proxy, audit generation endpoints, Stripe webhook
- Hosting: DigitalOcean App Platform $12/month
- Database: Supabase (auth + data persistence) with localStorage fallback
- Payments: Stripe subscriptions

## Pricing Model
Single price: $149/month gives full access to all 3 recovery modules. No tiers, no upgrades, no locked content. Every subscriber gets profit, revenue, and traffic on signup.

Webhook sets: subscription_plan: 'full_access', active_modules: ['profit','revenue','traffic']

## File Structure
```
/
├── Dockerfile              (Node 20 slim — no Python, no ReportLab)
├── DESIGN_SYSTEM.md        (colors, typography, component patterns — read this)
├── HANDOFF.md              (this file)
├── SUPABASE_SETUP.sql
├── package.json
├── server/
│   └── index.js            (Express server — API proxy, audits, Stripe)
└── public/
    ├── index.html
    ├── app.js              (App core, TT tooltip engine, wireAuth, boot)
    ├── db.js               (Supabase client, auth, data read/write)
    ├── assets/
    │   └── logo.png
    └── screens/
        ├── hub.js                    (Recovery Hub — all 3 modules always active)
        ├── onboarding.js
        ├── profit-nav.js
        ├── dashboard.js
        ├── this-week.js
        ├── shift-check.js
        ├── bar-products.js
        ├── kitchen-products.js
        ├── recipe-library.js
        ├── vendor-watch.js
        ├── theft-risk.js
        ├── cash-recon.js
        ├── reports.js
        ├── settings.js
        ├── help.js
        ├── audit-tracker.js          (Profit audit — in-app HTML output)
        ├── resources.js
        ├── getting-started.js
        ├── revenue.js                (Revenue nav)
        ├── revenue-dashboard.js
        ├── revenue-this-week.js
        ├── revenue-server-check.js
        ├── revenue-menu-items.js
        ├── revenue-menu-engineering.js
        ├── revenue-labor-budget.js
        ├── revenue-rplh.js
        ├── revenue-check-average.js
        ├── revenue-events.js
        ├── revenue-reports.js
        ├── revenue-getting-started.js
        ├── revenue-resources.js
        ├── revenue-help.js
        ├── revenue-settings.js
        ├── revenue-audit.js          (Revenue audit — in-app HTML output)
        ├── traffic.js                (Traffic nav)
        ├── traffic-dashboard.js
        ├── traffic-this-week.js
        ├── traffic-audit.js          (Traffic audit — in-app HTML output)
        ├── traffic-gbp.js
        ├── traffic-reviews.js
        ├── traffic-search.js
        ├── traffic-website.js
        ├── traffic-social.js
        ├── traffic-delivery.js
        ├── traffic-email.js
        ├── traffic-reports.js
        ├── traffic-getting-started.js
        ├── traffic-resources.js
        ├── traffic-help.js
        └── traffic-settings.js
```

## Module Build Status

### Profit Recovery — COMPLETE
All 14 screens built and working: dashboard, weekly entry, shift check, bar products, kitchen products, recipe library, vendor watch, theft risk, cash reconciliation, reports, settings, help, audit tracker, resources, getting started.

Audit: In-app HTML output. User uploads POS reports/invoices, Claude extracts JSON, app renders scored audit inline. No PDFs.

### Revenue Recovery — COMPLETE
All screens built and working: dashboard, this week, server check, menu items, menu engineering, labor budget, RPLH tracker, check average, events and catering, reports, settings, help, resources, getting started.

Audit: In-app HTML output via /api/generate-revenue-audit.

### Traffic Recovery — IN PROGRESS
Screens built: dashboard, this week, audit, settings.
Screens remaining: GBP, Reviews, Search/SEO, Website Scorecard, Social Media, Delivery Platforms, Email and Loyalty, Reports, Getting Started, Resources, Help.

Audit: In-app HTML output via /api/generate-traffic-audit. Audit screen exists but sample data needs realistic scored output populated.

## Current Task
Finish remaining Traffic Recovery screens. Each screen follows the same pattern as the completed Revenue screens — data entry, tracking, benchmarks, and actionable guidance. Read DESIGN_SYSTEM.md for styling rules before building any screen.

Traffic screens to build (in priority order):
1. traffic-gbp.js — Google Business Profile tracker and scorecard
2. traffic-reviews.js — Review tracker (Google + Yelp velocity, response rate)
3. traffic-search.js — Search and SEO scorecard
4. traffic-website.js — Website scorecard (sessions, bounce rate, mobile)
5. traffic-social.js — Social media tracker (IG + FB posts, followers, engagement)
6. traffic-delivery.js — Delivery platform tracker (DoorDash, Uber Eats, Grubhub)
7. traffic-email.js — Email and loyalty tracker
8. traffic-reports.js — Reports and history
9. traffic-getting-started.js — 30-day setup checklist
10. traffic-resources.js — Resources library
11. traffic-help.js — Help and FAQ

## Audit Architecture (all 3 modules)
- User fills in annual revenue in Settings
- User uploads files (POS reports, screenshots, invoices) on the audit screen
- App sends files + app data (weeks, settings) to /api/generate-[module]-audit
- Server sends everything to Claude API with a detailed extraction prompt
- Claude returns JSON with scored sections
- App renders the JSON as a styled in-app HTML audit report
- No PDFs anywhere

## Stripe Webhook Flow
1. Customer pays at Stripe checkout
2. Webhook fires checkout.session.completed
3. Server creates Supabase user if new (email_confirm: true, no password — customer uses Forgot Password to set it)
4. Supabase subscriptions row upserted with active_modules: ['profit','revenue','traffic'], subscription_plan: 'full_access'
5. Customer gets password reset email, sets password, logs in to full app

## Data Structure (App.data keys)
- settings — bar name, targets, annual revenue
- weeks, shifts, reconciliations, theft_scores, vendor_log — Profit module
- audits — Profit audit history
- revenue_settings, revenue_weeks, revenue_audits, revenue_server_checks, revenue_menu_items, revenue_events — Revenue module
- traffic_settings, traffic_weeks, traffic_audits — Traffic module
- getting_started_profit, getting_started_revenue, getting_started_traffic — checklist state

## Important Rules
- Do NOT add Python or ReportLab to the Dockerfile — PDFs are gone, everything is in-app HTML
- Do NOT revert Claude API calls to blocking — must use stream: true
- Do NOT create DigitalOcean managed databases — Supabase handles all data
- Do NOT add the /api/add-module endpoint back — pricing is now single flat rate
- Always read DESIGN_SYSTEM.md before building any new screen
- All screens go in public/screens/ and must be registered in app.js navigate() and in index.html script tags
