# Bar Cop — Final Complete Platform Map
# Version 4.0 — The Three-Layer Platform
Rewritten: 2026-05-21

---

## WHAT THIS DOCUMENT IS

The single source of truth for the entire Bar Cop platform build. Every screen, every
data connection, every architectural decision. Hand this to any code chat and it has
everything needed to build or continue — and to build the *right* product.

Version 4.0 corrects every contradiction found in v3.0 (where build steps kept manual
entry that Control should now feed) and adds the Fix layer — the prescriptive guidance
that was the original product's whole purpose.

---

## PLATFORM PHILOSOPHY — THE THREE LAYERS

Bar Cop helps a bar/restaurant operator recover lost money. It does this in three layers:

1. **CAPTURE — the Control modules (Inventory, Labor, Shift).**
   Where the operator logs operational reality: counts, deliveries, schedules, hours,
   shifts, cash, voids. This is the input layer.

2. **DIAGNOSE — the Recovery modules + the Hub + the Audit (Profit, Revenue, Traffic).**
   Captured data becomes metrics, dollar-quantified losses, trends, and the scored
   monthly Audit. Recovery is mostly *output* — the operator reads it, rarely types
   into it.

3. **FIX — the Fix layer (woven through Recovery).**
   For every gap the diagnosis surfaces, a structured fix: the process, the Quick
   Reference rhythm, the templates, and the implementation plan. This is the
   product's namesake and its core value.

**The loop: Capture → Diagnose → Fix.** Control feeds Recovery automatically.

### Non-negotiable rules of the model

- **No double entry, ever.** If Control has the data, Recovery never asks for it.
- **Control→Recovery connections are permanent and always-on.** Never gated behind
  "has data been entered yet." Empty-data states are fine; the connection UI is always
  present.
- **The one number the app imports rather than generates: POS sales/revenue.** It is
  entered once — per shift in Shift Control — and every module reads the weekly sum.
  The POS owns transactional sales; Bar Cop owns everything operational around it.
- **Claude API is used for Audits only.** Everything else — the Fix layer, templates,
  AI-workflow guidance, all calculation — is static content or client-side computation.
  Zero per-use API cost outside the audit.
- **Traffic Recovery is standalone.** There is no Traffic Control module; Traffic
  captures its own data and its audit is screenshot-based.

**One price. Everything included. $149/month.** The recurring value is the monthly
Audit plus the always-current Recovery Scoreboard proving the system pays for itself.

---

## TECH STACK

- Frontend: Vanilla JS, `S` screen namespace, `App.data` / `App.inventoryData` /
  `App.laborData` / `App.shiftData` for state
- Backend: Express/Node at `server/index.js`
- Database: Supabase (auth + data) with localStorage fallback
- Hosting: DigitalOcean App Platform
- Payments: Stripe, single price
- Live: https://app.barcop.com

---
---

# SECTION 1 — THE HUB (COMMAND CENTER)

File: `public/screens/hub.js` · Status: built as a fixed-viewport dashboard; a polish
pass is scheduled once all 6 modules are live.

The Hub is the full-screen command center the operator lands on after login. No module
sidebar — it sits above all 6 modules. Fixed-viewport layout, dark theme, gold accents.

## Hub regions

1. **Top bar** — logo, "Recovery Platform", bar name, date, Sign Out.
2. **Rollup strip** — 4 tiles, cross-system: Overall Recovery Score (avg of 3 audit
   scores), Total Monthly Opportunity ($ recoverable across all audits), Score Trend,
   Weekly Status (how many modules have the current week entered).
3. **Alert strip** — aggregated active alerts from all 6 modules; each has a severity
   dot, description, and a "Fix It" button to the relevant screen. "All Clear" when
   empty. (Alert sources listed in Section 10.)
4. **Audit Score panel** — three score rings (Profit/Revenue/Traffic): score, trend,
   last audit date, "Run Audit" button, industry average.
5. **Key Metrics grid** — 8 metrics, each dollar-quantified, color-coded, tap to the
   relevant screen.
6. **Recovery Scoreboard** — running total of money recovered since onboarding (see
   Section 10).
7. **Priority Action Items** — top cross-system fix opportunities ranked by $ impact.
8. **Trend charts** — platform-level cost and recovery-score trends, annotated with
   fix events (Section 10).
9. **Module navigation** — six tiles: Profit, Revenue, Traffic, Inventory, Labor,
   Shift. Each: icon, name, last activity, one key metric, Enter button.
10. **Bottom bar** — "Data last updated" timestamp.

## What the Hub also owns (moved off the modules)

- **Settings** — all platform settings: Operation Profile, Profit/Revenue/Traffic
  Targets, Team & Wages, Inventory/Shift preferences, Notifications, Account.
- **Getting Started** — the unified setup checklist, which is the 30-Day Implementation
  plan from the Fix layer (Section 9).
- **Audit Center** — the three audit intake + history screens (Section 8).

Bar-name and target changes made in Hub Settings apply platform-wide instantly.

---
---

# SECTION 2 — PROFIT RECOVERY MODULE

Status: built as Excel-replacement screens; restructure required per this map.

Profit Recovery diagnoses where bar/food profit leaks and prescribes the fix. It is an
*output* module — Inventory, Labor, and Shift Control feed it; the operator types
almost nothing into it.

### Entry point
From the Hub Profit tile → Dashboard.

### Sidebar
```
OVERVIEW   ← Back to Hub · Dashboard
WEEKLY     This Week
PRODUCTS   Bar Products · Kitchen Products       (read-only views)
COSTING    Recipe Library
CONTROLS   Vendor Watch · Theft Risk · Cash Reconciliation   (read-only views / fed)
HISTORY    Reports and History
SUPPORT    Help and FAQ
```
Removed from the sidebar: Settings, Audit, Getting Started (→ Hub). **Shift Check is
removed entirely** — shift revenue is logged in Shift Control, and per-shift theft
checks are Inventory Control's Spot Check.

### Screens — final state

| Screen | File | Final behavior |
|---|---|---|
| Dashboard | dashboard.js | Diagnosis view — the 5 Profit gap-areas, each dollar-quantified; 8-week trend chart (annotated with fix events); Priority Action Items; Recovery Scoreboard slice |
| This Week | this-week.js | **Restructured** — thin weekly confirm screen: Period · Bar (Revenue, Labor, COGS) · Food (Revenue, Labor, COGS) · Review. Revenue auto-fills from Shift Control, labor from Labor Control, COGS from Inventory Control. No inventory-count or variance steps — Inventory Control owns those. Each field is editable as an override only. |
| Bar Products | bar-products.js | **Read-only view** of `ic_products` bar categories. "Manage in Inventory Control" button. Built. |
| Kitchen Products | kitchen-products.js | **Read-only view** of `ic_products` Food/Misc. Built. |
| Recipe Library | recipe-library.js | Recipe costing tool. Ingredient costs are **read-only, pulled from `ic_products`** — no manual ingredient-cost entry. |
| Vendor Watch | vendor-watch.js | **Loss-surfacing view** fed by `ic_deliveries` price changes — "vendor prices drifted up, $X/yr." No manual price-change log. |
| Theft Risk | theft-risk.js | **Auto-scored** from `ic_spot_checks` + `sc_void_comps` + cash variance, plus a manual judgment input the operator can add. |
| Cash Reconciliation | cash-recon.js | **Read-only view** of Shift Control cash data (`sc_cash_drops`, `sc_variances`). No separate manual entry. |
| Reports and History | reports.js | Historical trend output. |
| Help and FAQ | help.js | Knowledge layer + the Fix layer's Profit fix processes (Section 9). |

### The 5 Profit gap-areas (the "Parts" — drive the audit and the Fix layer)
Pour Cost · Theft & Loss · Food Cost · Vendor Control · Prime Cost. Each appears on the
Dashboard with a score, a dollar-quantified current state, and a link to its fix process.

---
---

# SECTION 3 — REVENUE RECOVERY MODULE

Status: built as Excel-replacement screens; restructure required.

### Entry point
From the Hub Revenue tile → Dashboard.

### Sidebar
```
OVERVIEW   ← Back to Hub · Dashboard
WEEKLY     This Week · Server Check
MENU       Menu Items · Menu Engineering
LABOR      RPLH Tracker
REVENUE    Check Average · Events and Catering
HISTORY    Reports and History
SUPPORT    Help and FAQ
```
Removed: Settings, Audit, Getting Started (→ Hub). **Labor Budget removed** — labor
budgeting is Labor Control's Build Schedule; RPLH Tracker keeps the analysis view.

### Screens — final state

| Screen | File | Final behavior |
|---|---|---|
| Dashboard | r-dashboard.js | Diagnosis view — the Revenue gap-areas, dollar-quantified; trend chart; action items |
| This Week | r-this-week.js | **Restructured** — thin confirm screen: Period · Revenue (bar/floor — auto-summed from Shift Control) · Covers (from Shift Control) · Labor (from Labor Control) · Review. Editable as override only. |
| Server Check | r-server-check.js | Per-server check average + covers (from POS server reports — no Control source, stays an entry/import screen). Roster auto-syncs from `lc_staff`. |
| Menu Items | r-menu-items.js | Menu item + price catalog. Manual (no Control module owns the menu). |
| Menu Engineering | r-menu-engineering.js | Live Stars/Plowhorses/Puzzles/Dogs quadrant; shows items moving between quadrants over time. |
| RPLH Tracker | r-rplh.js | Revenue-per-labor-hour analysis; labor hours **pulled from `lc_actuals`**. |
| Check Average | r-check-average.js | Check-average tool + upsell gap calculator. |
| Events and Catering | r-events.js | Event/catering pipeline + P&L. Manual (no Control source). |
| Reports and History | r-reports.js | Historical output. |
| Help and FAQ | r-help.js | Knowledge layer + Revenue fix processes. |

### Revenue gap-areas (Parts)
Menu Engineering · Pricing · Labor Cost & Scheduling · Labor Productivity (RPLH) ·
Check Average & Upsell · Events & Catering · Server Performance.

---
---

# SECTION 4 — TRAFFIC RECOVERY MODULE

Status: built (11 screens). Standalone — no Traffic Control module.

Traffic has no daily-operations Control module, so it both captures and diagnoses. This
Week (a 7-step wizard) and the scorecards are manual entry — correct, there is no
Control source. The Traffic Audit is screenshot/document based.

### Sidebar
```
OVERVIEW   ← Back to Hub · Dashboard
WEEKLY     This Week
PRESENCE   Google Business Profile · Review Tracker · Search and SEO · Website Scorecard
SOCIAL     Social Media · Delivery Platforms · Email and Loyalty
HISTORY    Reports and History
SUPPORT    Help and FAQ
```
Removed: Settings, Audit, Getting Started (→ Hub).

All 11 screens are built and complete (Dashboard, This Week, GBP, Review Tracker, Search
and SEO, Website Scorecard, Social Media, Delivery Platforms, Email and Loyalty, Reports,
Help). Tooltips and reviewed-on staleness lines are in place.

### Traffic gap-areas (Parts)
Google Business Profile · Website · Reviews · Search/SEO · Social · Delivery · Email/Loyalty.

---
---

# SECTION 5 — INVENTORY CONTROL MODULE

Status: **built** — all 16 screens live. (Spot Check, Order Sheet, Order History are
Phase-2 placeholders — see build sequence.)

Feeds Profit Recovery. `ic_products` is the platform-wide product master.

### Sidebar
```
OVERVIEW   ← Back to Hub · Dashboard
SETUP      Products · Locations · Vendors
COUNTS     Take Inventory · Count History · Spot Check
RECEIVING  Receive Delivery · Delivery History
ORDERING   Order Sheet · Order History
REPORTS    Usage Report · Variance Report · Stock Report · Top Movers
SUPPORT    Help and FAQ
```

### Screens
Dashboard (ic-dashboard) · Products (ic-product-setup) · Locations (ic-locations) ·
Vendors (ic-vendors) · Take Inventory (ic-take-inventory, uses the bottle-slider
component) · Count History (ic-count-history) · Spot Check (ic-spot-check — pre/post
shift count on chosen products, a per-shift theft check) · Receive Delivery
(ic-receive-delivery) · Delivery History (ic-delivery-history) · Order Sheet
(ic-order-sheet — auto-generated from counts vs par) · Order History (ic-order-history)
· Usage Report · Variance Report (uses the csv-mapper component for POS import) ·
Stock Report · Top Movers · Help (ic-help).

### Feeds Profit Recovery
- `ic_products` → Bar Products, Kitchen Products, Recipe Library ingredient costs
- `ic_counts` → This Week COGS, the Profit Audit bar/food cost sections
- `ic_deliveries` → Vendor Watch (price changes), period COGS
- `ic_spot_checks` → Theft Risk, the Profit Audit theft/controls section
- Below-par counts → Hub alerts; `sc_86_list` repeat 86s → par-level alerts here

---
---

# SECTION 6 — LABOR CONTROL MODULE

Status: full build required.

Feeds **Revenue Recovery and Profit Recovery**.

### Sidebar
```
OVERVIEW    ← Back to Hub · Dashboard
SCHEDULING  Build Schedule · Templates · Schedule History
ACTUALS     Log Hours · Daily View · Weekly Summary
TEAM        Staff Roster · Positions
TIPS        Tip Log · Tip Pool Calculator · Tip History
REPORTS     Labor Reports · Overtime Watch · Call-Out Log
SUPPORT     Help and FAQ
```

### Screens
Dashboard · Build Schedule (revenue-forecast-driven, live cost/labor%/RPLH/budget) ·
Templates · Schedule History · Log Hours (CSV import via csv-mapper) · Daily View ·
Weekly Summary · Staff Roster · Positions · Tip Log · Tip Pool Calculator · Tip History ·
Labor Reports · Overtime Watch · Call-Out Log · Help. (16 screens, `lc-` prefix,
`screens/labor/` folder.)

### Feeds (corrected — v3.0 omitted the Profit feeds)
- `lc_actuals` → **Revenue This Week labor** AND **Profit This Week labor** AND **Profit
  prime cost**
- `lc_actuals` → Revenue Audit (labor %, RPLH), RPLH Tracker
- `lc_roster` → Revenue Server Check roster
- `lc_schedules`/`lc_budget` ↔ Revenue context; RPLH targets sync with Hub Settings
- Overtime projections → Hub alerts

---
---

# SECTION 7 — SHIFT CONTROL MODULE

Status: full build required.

Feeds **Profit Recovery and Revenue Recovery**.

### Sidebar
```
OVERVIEW    ← Back to Hub · Dashboard
SHIFTS      Active Shift · Log a Shift · Shift History
CASH        Cash Drop · Safe Log · Variance Log
OPERATIONS  86 List · Void and Comp Log · Maintenance Log
CHECKLISTS  Opening Checklist · Closing Checklist · Templates
REPORTS     Shift Reports · Cash Reports · Operations Reports
SUPPORT     Help and FAQ
```

### Screens
Dashboard · Active Shift (mobile-first) · Log a Shift · Shift History · Cash Drop
(mobile-first) · Safe Log · Variance Log · 86 List (mobile-first) · Void and Comp Log
(mobile-first) · Maintenance Log · Opening Checklist · Closing Checklist · Templates ·
Shift Reports · Cash Reports · Operations Reports · Help. (17 screens, `sc-` prefix,
`screens/shift/` folder.)

### Log a Shift — fields (corrected: covers added)
Date · Shift type · Manager · Staff on floor · **Revenue (bar/floor/total)** ·
**Covers (guest count)** · Notes · Opening bank · Status.

### Feeds (corrected — v3.0 never wired the revenue feed)
- **`sc_shifts` revenue → the single weekly revenue source** for both Revenue This Week
  and Profit This Week (weekly sum of shift revenue; manual weekly override allowed if
  not every shift was logged)
- `sc_shifts` covers → Revenue This Week covers / check average
- `sc_cash_drops` + `sc_variances` → Profit Cash Reconciliation, Profit Audit cash section
- `sc_void_comps` → Profit Theft Risk + Profit Audit exception analysis
- `sc_maintenance` (urgent/open) → Hub alerts
- `sc_86_list` → Inventory Control par alerts

---
---

# SECTION 8 — THE AUDIT (THE DIAGNOSTIC ENGINE)

Audit Center location: the Hub. Three audits: Profit, Revenue, Traffic. The audit is
the evolved, automated, scored version of the original Fix System's 10-question
diagnostic. It is the recurring-subscription anchor and **the only feature that uses
the Claude API.**

### How audits work with Control active
The app checks which Control modules have data. Sections covered by Control data are
auto-populated as ground truth — no upload. Sections not covered show an upload prompt.

- **Profit Audit:** bar/food cost ← `ic_counts`+`ic_deliveries`; vendor ← `ic_deliveries`;
  theft/controls ← `ic_spot_checks`+`sc_void_comps`; prime cost ← `lc_actuals`; cash ←
  `sc_variances`+`sc_cash_drops`.
- **Revenue Audit:** labor ← `lc_actuals`; server performance ← `lc_roster`.
- **Traffic Audit:** screenshot/document based — no Control module, no change.

### Data tiers
Tier 1 = Control data (most accurate) · Tier 2 = partial · Tier 3 = uploads only.
Shown per section and overall. **As Control data fills in, audits rely less on Claude
document-extraction and more on structured data — audit API cost trends down over time.**

### Server side
`getExtractionPrompt` functions take a `controlData` parameter; when populated, the
prompt tells Claude to use those values as ground truth rather than estimating.

---
---

# SECTION 9 — THE FIX LAYER

The Fix layer is the prescriptive guidance that was the original Fix System's whole
purpose. It is **100% static content + client-side logic — zero API cost.** It is woven
through the Recovery modules, not a separate module.

### Components

1. **The diagnostic → the Audit.** The original 10-question diagnostic per system is
   superseded by the automated Audit (Section 8). Kept conceptually as the audit's logic.

2. **Gap-areas (Parts).** Each Recovery module is a set of gap-areas (listed in
   Sections 2–4). Each gap-area has, on the Dashboard: a score, a dollar-quantified
   current state, and a link into its **fix process**.

3. **Fix processes.** For each gap-area, a static step-by-step process — the methodology
   from the Fix System files (e.g. Profit Pour Cost: yields → written pour policy →
   weekly counts → variance review → 6-step variance investigation). Presented as a
   structured, readable workflow the operator can follow and check off.

4. **Quick Reference Cards.** Per gap-area: the weekly rhythm, the benchmarks
   (target/warning/critical), the investigation/escalation steps. Static; printable via
   the print stylesheet.

5. **Templates.** The original Word-doc tools (pour policy, theft/loss policy,
   corrective-action form, server/portion standards, vendor terms checklist, etc.).
   Built as **static in-app documents**: pre-written, the operator fills a few fields
   (bar name, jigger size, date) with plain client-side text, then prints to PDF. Not
   AI-generated. Template text is sourced from the Fix System files at build time.

6. **AI Workflow cards.** The original "AI Workflows" — copy-paste prompt cards. The app
   displays the prompt and what to paste; the operator runs it in their own AI tool.
   **The app never calls the API for these.**

7. **30-Day Implementation.** The Fix System's sequenced install plan becomes the Hub's
   **Getting Started** — a unified, ordered, checkable setup checklist across all 6
   modules.

The Fix layer lives primarily inside each module's **Help and FAQ** (expanded into a
real knowledge + fix layer) and is surfaced contextually: any flagged gap links straight
to its fix process and Quick Reference Card.

---
---

# SECTION 10 — PLATFORM-WIDE FEATURES

Capabilities a spreadsheet cannot have. All are static computation over accumulated
data — **zero API cost.**

### 1. Recovery Scoreboard (flagship)
A running, dollarized total of money recovered since onboarding, attributed to specific
fixes. The operator marks a fix as implemented (date + which gap-area); the app compares
the metric's windowed average before vs. after and reports the recovered dollars
(e.g. "pour policy signed Mar 3 → pour cost −3.1 pts → $4,200 recovered"). The operator
can set a recovery target and watch the gap close. Lives on the Hub; each module shows
its slice. **New data key: `fix_log`** (implemented-fix events).

### 2. Dollarize every metric
Every percentage on every screen carries its dollar impact. Operators think in dollars.
A shared helper converts any metric + target + revenue base into "$X/week, $Y/year."

### 3. Weekly money readout
One consolidated view (Hub) across all six gap areas: what was lost this week, where,
and the single highest-impact thing to fix. Ties Profit + Revenue + Traffic together.

### 4. Forward-looking alerts
Predictive, not just historical: projected overtime, projected month-end prime cost,
declining review velocity, recurring cash shortages, vendor price re-drift. Feed the
Hub alert strip.

### 5. Annotated trend charts
Trend charts mark when fixes were implemented (from `fix_log`) so cause and effect are
visible — "policy signed here → cost dropped."

### Module-specific
- **Guided Variance Investigation (Profit)** — the Fix System's 6-step variance process
  as a trackable workflow: open an investigation on a flagged SKU, log findings, resolve.
- **Price-Change Verification (Revenue)** — when the operator changes a price, the app
  predicts the impact, then measures actual volume/revenue after, closing the loop.
- **Cadence Nudges (Traffic)** — "haven't posted in N days," "no review ask logged this
  week," "review velocity down."

---
---

# SECTION 11 — DATA ARCHITECTURE

### Recovery keys — `user_data` table → `App.data`
```
settings · weeks · shifts(removed w/ Shift Check) · reconciliations(legacy) ·
theft_scores · vendor_log(legacy) · audits · recipes · revenue_settings ·
revenue_weeks · revenue_audits · revenue_server_checks · revenue_menu_items ·
revenue_price_log · revenue_events · revenue_rate_cards · traffic_settings ·
traffic_weeks · traffic_audits
```

### Hub / Fix-layer keys — `user_data`
```
hub_alerts_dismissed · hub_setup_progress · onboarding_complete · fix_log
```

### Control keys — separate Supabase tables (Rule 21)
```
App.inventoryData (ic_data):  ic_products · ic_locations · ic_vendors · ic_counts ·
                              ic_deliveries · ic_orders · ic_spot_checks
App.laborData (lc_data):      lc_staff · lc_positions · lc_schedules · lc_actuals ·
                              lc_tips · lc_tip_pools · lc_callouts
App.shiftData (sc_data):      sc_shifts · sc_cash_drops · sc_variances · sc_86_list ·
                              sc_void_comps · sc_maintenance · sc_checklists
```
`ic_data` / `lc_data` / `sc_data` tables and the six `DB` methods plus
`App.inventoryData/laborData/shiftData` are built.

---
---

# SECTION 12 — SERVER ENDPOINTS

```
POST /api/claude                  — Claude proxy (audits only)
POST /api/generate-profit-audit   — accepts controlData
POST /api/generate-revenue-audit  — accepts controlData
POST /api/generate-traffic-audit  — no change
POST /api/create-checkout-session · /api/billing-portal · /api/stripe-webhook
```
No `/api/parse-csv` — CSV parsing is client-side (the `csv-mapper` component). No other
new endpoints. All Control and Fix-layer data is client-side.

---
---

# SECTION 13 — SAMPLE DATA

Single coherent fake operation: **"The Anchor Bar and Kitchen"** (Austin TX, full bar +
kitchen). One `loadSample()` populates all 6 modules with cross-referencing data —
inventory usage matches Profit COGS, labor actuals match Revenue labor %, shift revenue
sums to weekly revenue, cash drops match Cash Reconciliation. Products live **only** in
`ic_products`; vendor price changes in `ic_deliveries`; cash data in `sc_*`. The sample
data also seeds `fix_log` so the Recovery Scoreboard demonstrates recovered dollars.

---
---

# SECTION 14 — MOBILE & OFFLINE

Mobile-first screens: `ic-take-inventory`, `ic-receive-delivery`, `ic-spot-check`,
`sc-active-shift`, `sc-cash-drop`, `sc-86-list`, `sc-void-comp`. Rules: 48px touch
targets, 16px+ key text, bottle slider 200px+, no horizontal scroll, auto-save during
counts. Offline: count data saved to localStorage as entered; on submit, attempt
Supabase, keep local if unreachable, prompt to sync on next load.

---
---

# SECTION 15 — BUILD SEQUENCE

### Done
- [x] Profit, Revenue, Traffic Recovery — built (Excel-replacement state)
- [x] Hub — fixed-viewport dashboard (polish pass pending)
- [x] Rule 21 Supabase tables + DB layer + App state
- [x] Inventory Control — all 16 screens
- [x] Bottle-slider + CSV-mapper components
- [x] Bar/Kitchen Products → read-only views

### Stage A — Finish Profit↔Inventory integration
1. Restructure `this-week.js` (Profit) — remove count/variance steps; COGS auto-fills
   from Inventory Control; revenue/labor wired (light up when Shift/Labor Control ship).
2. `vendor-watch.js` → loss-surfacing read-out of `ic_deliveries` price changes.
3. `recipe-library.js` → ingredient costs read-only from `ic_products`.

(`theft-risk.js` auto-scoring is in Stage C — its data sources, `sc_void_comps` and
`ic_spot_checks`, are not built until Stages B and C.)

### Stage B — Shift Control (`screens/shift/`, `sc-` prefix)
Build all 17 screens. Wire: shift revenue → weekly revenue source; cash → Cash
Reconciliation (read-only); voids → Theft Risk; maintenance → Hub alerts.

### Stage C — Inventory Control Phase 2 + Theft Risk
`ic-spot-check`, `ic-order-sheet`, `ic-order-history`. Then `theft-risk.js` — auto-scored
from `ic_spot_checks` + `sc_void_comps` + cash variance, plus a manual judgment input
(its three data sources now all exist).

### Stage D — Labor Control (`screens/labor/`, `lc-` prefix)
Build all 16 screens. Wire: `lc_actuals` → Revenue This Week labor, Profit This Week
labor, Profit prime cost, RPLH Tracker; `lc_roster` → Server Check.

### Stage E — Restructure Revenue Recovery
Restructure `r-this-week.js` (revenue from Shift Control, covers from Shift Control,
labor from Labor Control). Remove Labor Budget screen. RPLH Tracker pulls `lc_actuals`.

### Stage F — The Fix Layer
Fix processes, Quick Reference Cards, static templates, AI Workflow cards woven into
each module's Help and FAQ; gap→fix linking from dashboards.

### Stage G — Platform Features
Recovery Scoreboard + `fix_log`; dollarize-everything helper; weekly money readout;
forward-looking alerts; annotated trend charts; guided variance investigation;
price-change verification; cadence nudges.

### Stage H — Hub polish, integration, sample data
Hub polish pass (all 6 modules now live); `loadSample()` with The Anchor; audit intake
controlData wiring; PDF export on all reports; offline sync; data export/backup;
30-day cancellation retention; full cross-module testing.

---
---

# SECTION 16 — RULES FOR CODE

1. Read `DESIGN_SYSTEM.md` before building any screen.
2. No Python/ReportLab server-side — no server PDFs. Export = browser print stylesheet.
3. `stream: true` on all Claude API calls.
4. Supabase only — never a DigitalOcean managed database.
5. Flat pricing — never an add-module endpoint; all modules always active.
6. All screens in `public/screens/` (module screens in `screens/<module>/`); register
   in `app.js` `navigate()` and `index.html`.
7. Module prefixes: `ic-` Inventory, `lc-` Labor, `sc-` Shift.
8. Bottle slider is a built reusable component — import, never re-create.
9. CSV column mapping is a built reusable component (`csv-mapper`) — POS and hours
   imports use it.
10. Every report has an Export to PDF button (top-right) using the print stylesheet.
11. Mobile-critical screens (Section 14) are touch-first.
12. Auto-save during inventory counts.
13. Hub Settings is the single source of truth for config — no duplicate settings.
14. **Control→Recovery connections are permanent and always-on** — never gated behind
    whether data exists yet. Empty-data states are fine; the connection UI is always
    present. (Replaces v3.0's Rule 14, which said the opposite.)
15. Sample data is one coherent operation — The Anchor Bar and Kitchen.
16. `App.data.settings` is the global config; all modules read from it.
17. Bar-name change in Hub Settings updates everywhere instantly.
18. Cash variance tolerance in Hub Settings syncs to Shift Control and Profit Recovery.
19. RPLH targets in Hub Settings sync bidirectionally with Labor Control.
20. Staff roster in Labor Control syncs to Revenue Recovery server list.
21. **Control data lives in separate Supabase tables** (`ic_data`/`lc_data`/`sc_data`),
    never in `user_data`. State: `App.inventoryData`/`laborData`/`shiftData`.
22. **No double entry, ever.** If Control has the data, Recovery never asks for it
    manually — it imports or auto-fills.
23. **Claude API is for Audits only.** The Fix layer, templates, AI-workflow cards, and
    all calculation are static content or client-side computation — zero per-use cost.
24. **POS revenue enters once** — per shift in Shift Control — and every module reads
    the weekly sum. It is the only number Bar Cop imports rather than generates.

---
```
End of FINAL_PLATFORM_MAP.md v4.0
```
