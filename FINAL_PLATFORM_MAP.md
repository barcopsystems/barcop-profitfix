[FINAL_PLATFORM_MAP.md](https://github.com/user-attachments/files/28112929/FINAL_PLATFORM_MAP.md)
# Bar Cop — Final Complete Platform Map
# Version 3.0 — Hub as Command Center
Created: May 21, 2026

---

## WHAT THIS DOCUMENT IS

This is the single source of truth for the entire Bar Cop platform build.
Every screen. Every function. Every data connection. Every architectural decision.
Hand this to Claude Code at any point and it has everything needed to build or continue.

---

## PLATFORM PHILOSOPHY

**Bar Cop is one platform with two sides:**
- Recovery — monthly diagnostic. Scores operational health. Identifies gaps.
- Control — daily operations. Tracks everything. Feeds Recovery automatically.

**The Hub is the command center.** It is not a landing page. It is not a marketing screen.
It is where operators manage their entire operation — alerts, settings, audit scores,
weekly status, key metrics, and navigation to working screens.

**Modules are where work gets done.** They contain only operational screens.
No dashboards. No settings. No audit screens. No getting started checklists.
Those all live on the Hub.

**One price. Everything included. $149/month.**

---

## TECH STACK

- Frontend: Vanilla JS, S namespace, App.data for state
- Backend: Express/Node at server/index.js
- Database: Supabase (auth + data) with localStorage fallback
- Hosting: DigitalOcean App Platform, $12/month
- Payments: Stripe, single price price_1TZA54Gow04S066UjWZIRAlL
- Repo: https://github.com/barcopsystems/barcop-profitfix
- Live: https://app.barcop.com

---

---

# SECTION 1 — THE HUB (COMMAND CENTER)

## File: public/screens/hub.js
## Status: Complete rebuild required

---

## HUB — LAYOUT OVERVIEW

The Hub is a full-screen scrollable page. No sidebar. No topbar shell.
Logo and bar name at top. Everything below organized into clear sections.
Dark theme. Gold accents. Same design language as modules.

User lands here on every login after onboarding is complete.
User returns here from any module via the "Hub" nav item in every module sidebar.

---

## HUB — SECTIONS (top to bottom)

### 1. Header
- Bar Cop logo (left)
- Bar name (center, large)
- City/State (below bar name, small)
- Sign out button (right)
- Current date (right, below sign out)

### 2. Alert Strip
The most important section. Aggregates all active alerts from all 6 modules.
Appears only when alerts exist. Hidden when everything is clear.

Alert types and sources:
- PROFIT: Pour cost above target (from latest week data)
- PROFIT: Cash variance unresolved (from sc_variances)
- PROFIT: Audit due this month (from audits — if no audit in last 28 days)
- INVENTORY: Items below par (from ic_products vs ic_counts)
- INVENTORY: Price change spike — product up more than 10% (from ic_deliveries)
- INVENTORY: No count in 14+ days
- LABOR: Overtime alert — staff member projected over 40 hours (from lc_schedules + lc_actuals)
- LABOR: Schedule not published for current week (from lc_schedules)
- REVENUE: Check average below target 3+ weeks running (from revenue_weeks)
- REVENUE: Audit due this month
- TRAFFIC: Google rating below 4.0 (from traffic_weeks)
- TRAFFIC: No reviews responded to in 14+ days (from traffic_weeks)
- TRAFFIC: Audit due this month
- SHIFT: Open cash variance unresolved (from sc_variances)
- SHIFT: Maintenance issue marked urgent and open (from sc_maintenance)

Each alert: icon | severity color (red/yellow) | short description | "Fix It" button that navigates directly to the relevant screen

Green "All Clear" state when no alerts active — simple message confirming everything is on track.

### 3. Audit Score Panel
Three audit scores side by side. The health report of the entire operation.

Per audit (Profit / Revenue / Traffic):
- Score ring (same as current hub design)
- Score number
- Score label (Needs Work / On Track / Strong)
- Trend vs last audit (+/- points)
- Last audit date
- "Run Audit" button → navigates to audit intake screen in that module
- Industry average shown below ring

If no audit run yet: ring shows "No Data" state with "Run First Audit" button.

### 4. Weekly Status Bar
Did This Week get entered for each tracking module?
Horizontal row of status indicators — one per module that has weekly entry.

Modules with weekly entry: Profit | Revenue | Traffic | (Inventory counts tracked separately)

Per module:
- Module name
- Status: Done (green checkmark + date) | Due (yellow — current period) | Overdue (red — missed a week)
- "Enter Now" button if due or overdue → navigates directly to that module's This Week screen

This is the single biggest driver of platform engagement. Operators see exactly what needs to be entered without hunting through modules.

### 5. Key Metrics Grid
The 8 numbers a good operator checks every morning.
Auto-populated from the most recent data across all modules.

Grid layout (2 rows × 4 columns):

Row 1 — Financial Health:
- Bar Pour Cost % (vs target, color coded)
- Food Cost % (vs target)
- Prime Cost % (vs target)
- Check Average (vs target)

Row 2 — Operational Health:
- Labor % (vs target, from latest Revenue week or Labor Control actuals)
- Google Rating (vs 4.3 benchmark)
- Inventory Value (total current on-hand value from ic_counts)
- Open Cash Variances (count — red if any exist)

Each metric: label | value | target | status indicator
Tap any metric → navigates to the relevant screen for that metric.

"No data yet" state for metrics not yet populated.

### 6. Trend Charts
Two charts showing platform-level trends over the last 8 weeks.

Chart 1 — Cost Trends:
Bar pour cost % | Food cost % | Prime cost %
Line chart. Target lines shown as dashed horizontal lines. Gold/red/blue lines.

Chart 2 — Recovery Scores:
Profit audit score | Revenue audit score | Traffic audit score over time
Line chart. Target line at 65. Only shows data points where audits were run.

Charts only render when sufficient data exists (2+ weeks). Otherwise shows "Enter more data to see trends" state.

### 7. Module Navigation
Six module tiles in two rows of three. Clean. Minimal. No marketing copy.

Row 1 — Recovery: Profit | Revenue | Traffic
Row 2 — Control: Inventory | Labor | Shift

Per tile:
- Module icon
- Module name
- Last activity (e.g. "Last count: 3 days ago" or "Week 12 entered")
- One key metric (most relevant number for that module)
- "Enter" button

Tiles are always active — no locked states, no upgrade buttons.

### 8. Platform Settings
Moved entirely from individual modules to the Hub.
Organized into collapsible sections.

**Operation Profile**
- Bar/Restaurant Name
- City, State
- Bar Type (Bar Only / Bar and Kitchen / Restaurant with Bar)
- Annual Bar Revenue
- Annual Food Revenue

**Profit Targets**
- Bar Pour Cost % target
- Food Cost % target
- Bar Labor % target
- Food Labor % target
- Prime Cost % target
- Cash Over/Short Tolerance

**Revenue Targets**
- Check Average target
- Bar Labor % target
- Kitchen Labor % target
- Floor Labor % target
- Lunch RPLH target
- Dinner RPLH target
- Bar RPLH target
- Event Close Rate target

**Traffic Targets**
- Google Rating target
- Review Velocity target (new reviews/month)
- Response Rate target
- Monthly Website Sessions target
- Social Posts/Month target

**Team and Wages** (used by Labor Control)
- Average Bar Staff Hourly Wage
- Average Kitchen Staff Hourly Wage
- Average Floor Staff Hourly Wage
- Tip Pool Method (Hours Worked / Points / Percentage / Custom)
- Minimum Wage Jurisdiction (state/city)

**Inventory Preferences** (used by Inventory Control)
- Low Stock Alert Threshold (% below par)
- Price Change Alert Threshold (% increase to flag)
- Count Frequency Reminder (Weekly / Bi-Weekly / Monthly)

**Shift Preferences** (used by Shift Control)
- Cash Variance Tolerance (syncs with Profit Targets cash tolerance)
- Default Shift Types
- Require Checklist Before Shift Close (toggle)
- Void/Comp Alert Threshold

**Notifications**
- Which alert types to show on Hub
- Alert sensitivity (show all / show red only)

**Account**
- Email address (display only)
- Change Password link
- Billing Portal link (opens Stripe portal)
- Data Export button (downloads all App.data as JSON)
- Subscription Status and renewal date

Save button per section. Changes apply platform-wide immediately.
Bar name change updates Hub header, module topbars, and audit reports simultaneously.

### 9. Getting Started / Setup Progress
Visible to new users until all setup steps are complete.
Hidden for fully set up users (or collapsible).

Unified setup checklist across all 6 modules.
Progress bar showing overall completion %.

Setup steps in order:
1. Complete Operation Profile in Settings ← must be first
2. Set Profit Targets
3. Set Revenue Targets
4. Set Traffic Targets
5. Add products in Inventory Control
6. Set par levels for all products
7. Add vendor contacts
8. Add staff to roster
9. Set wage rates
10. Customize opening and closing checklists
11. Enter first week of Profit data (This Week)
12. Enter first week of Revenue data (This Week)
13. Enter first week of Traffic data (This Week)
14. Take first inventory count
15. Run first Profit Audit
16. Run first Revenue Audit
17. Run first Traffic Audit

Each step: checkmark when complete | direct link to the relevant screen to complete it
Steps unlock in logical order — can't run an audit before entering data.

### 10. Audit Center
The three audit intake and history screens move here from individual modules.
Accessible from the Hub directly. No need to enter a module to run an audit.

Three tabs: Profit Audit | Revenue Audit | Traffic Audit

Per audit tab:
- Current score (if audit exists)
- Audit history list (date, score, tier, trend)
- "Run New Audit" button → opens audit intake form inline or as modal
- Download any past audit as PDF (future — when PDF export is added)

Audit intake form on Hub:
- Annual revenue fields (pre-filled from Settings)
- Control data availability indicator: "Your Inventory Control data covers sections 1, 3, and 5. Upload supplemental files for sections 2 and 4."
- File upload fields (only shows fields for sections not covered by Control data)
- Notes field
- Run Audit button

---

## HUB — WHAT IS REMOVED FROM INDIVIDUAL MODULES

When Hub is rebuilt the following are removed from all 6 modules:

REMOVED from all modules:
- Settings screens (all settings move to Hub)
- Getting Started / Setup checklists (move to Hub)
- Audit screens (Profit Audit, Revenue Audit, Traffic Audit all move to Hub)

KEPT in modules:
- All operational working screens
- Module dashboards (simplified — the landing view when you enter a module; the Hub shows platform-level metrics, the module dashboard shows module-specific detail like the 8-week trend chart and weekly summary)
- Help and FAQ screens (expanded — see below)
- Reports screens

## HUB — HELP AND FAQ AS THE KNOWLEDGE LAYER

Resources screens are removed from every module across the platform — the three Recovery
modules (Profit, Revenue, Traffic) and the three Control modules (Inventory, Labor, Shift).
Help and FAQ replaces Resources as the in-app knowledge layer.

Each module's Help and FAQ screen is expanded to be genuinely useful:
- Contextual explanation of every metric the module tracks
- What each benchmark means and where it comes from
- What to do when a number is off target

The only downloadable asset kept anywhere in the platform: each module's Help
screen may include a single one-page Quick Reference Card PDF — key benchmarks and what
the numbers mean, in a print-and-post format. No other downloadable files anywhere.

---

## HUB — ONBOARDING FLOW

First-time users go through a streamlined onboarding before landing on the Hub.

Step 1 — Welcome
Bar Cop logo. "Let's set up your operation." Single next button.

Step 2 — Operation Profile
Bar name, city/state, bar type. Required. Can't proceed without these.

Step 3 — What do you want to focus on first?
Three options with descriptions:
- "Start with Profit Recovery — track pour cost, food cost, and waste"
- "Start with full platform setup — set up everything now"
- "Show me around first — I'll configure later"

Option 1: takes them to Profit targets setup, then lands on Hub with Profit module highlighted.
Option 2: walks through all targets in sequence, then Hub.
Option 3: lands on Hub with Getting Started section expanded and step 1 highlighted.

Step 4 — (If option 1 or 2) Relevant targets
Pre-filled with industry benchmarks. User confirms or adjusts.

Step 5 — Done
"Your Bar Cop platform is ready." → lands on Hub.

Onboarding complete flag set. Hub shows Getting Started section for remaining setup steps.

---

---

# SECTION 2 — PROFIT RECOVERY MODULE

## Status: Complete — minor updates needed when Control is built

### Entry Point
From Hub module tile → lands directly on Dashboard screen (no separate module hub).

### Sidebar
```
OVERVIEW
  ← Back to Hub
  Dashboard

WEEKLY
  This Week
  Shift Check

PRODUCTS
  Bar Products
  Kitchen Products

COSTING
  Recipe Library
  Vendor Watch

CONTROLS
  Theft Risk
  Cash Reconciliation

HISTORY
  Reports and History

SUPPORT
  Help and FAQ
```

Note: Settings removed (moved to Hub). Audit removed (moved to Hub). Getting Started removed (moved to Hub).

### All Screens — Final State

| Screen | File | Status | Change When Control Built |
|---|---|---|---|
| Dashboard | dashboard.js | Complete | No change |
| This Week | this-week.js | Complete | Add "Import from Inventory Control" button |
| Shift Check | shift-check.js | Complete | No change |
| Bar Products | bar-products.js | Complete | Becomes read-only view of ic_products |
| Kitchen Products | kitchen-products.js | Complete | Becomes read-only view of ic_products |
| Recipe Library | recipe-library.js | Complete | Ingredient costs pull from ic_products |
| Vendor Watch | vendor-watch.js | Complete | Add auto-feed indicator from ic_deliveries |
| Theft Risk | theft-risk.js | Complete | No change |
| Cash Reconciliation | cash-recon.js | Complete | Add auto-feed from sc_cash_drops |
| Reports | reports.js | Complete | No change |
| Help and FAQ | help.js | Complete | No change |

### Removed Screens (moved to Hub)
- settings.js → Hub Settings
- audit-tracker.js → Hub Audit Center
- getting-started.js → Hub Getting Started

### Dashboard — Final State
Summary cards: Bar Pour Cost % | Food Cost % | Prime Cost % | Weekly Variance $
Alert strip: cost above target with weekly dollar impact
8-week trend chart (stays here — module-level detail chart)
This Week Summary table
Quick Actions: Enter This Week | Run Profit Audit (links to Hub Audit Center)

---

---

# SECTION 3 — REVENUE RECOVERY MODULE

## Status: Complete — minor updates needed when Control is built

### Entry Point
From Hub module tile → lands directly on Dashboard.

### Sidebar
```
OVERVIEW
  ← Back to Hub
  Dashboard

WEEKLY
  This Week
  Server Check

MENU
  Menu Items
  Menu Engineering

LABOR
  Labor Budget
  RPLH Tracker
  Check Average

EVENTS
  Events and Catering

HISTORY
  Reports and History

SUPPORT
  Help and FAQ
```

Note: Settings removed. Audit removed. Getting Started removed.

### All Screens — Final State

| Screen | File | Status | Change When Control Built |
|---|---|---|---|
| Dashboard | r-dashboard.js | Complete | No change |
| This Week | r-this-week.js | Complete | Add "Import from Labor Control" button |
| Server Check | r-server-check.js | Complete | Staff list syncs from lc_staff |
| Menu Items | r-menu-items.js | Complete | No change |
| Menu Engineering | r-menu-engineering.js | Complete | No change |
| Labor Budget | r-labor-budget.js | Complete | Syncs with lc_budget |
| RPLH Tracker | r-rplh.js | Complete | No change |
| Check Average | r-check-average.js | Complete | No change |
| Events and Catering | r-events.js | Complete | No change |
| Reports | r-reports.js | Complete | No change |
| Help and FAQ | r-help.js | Complete | No change |

### Removed Screens (moved to Hub)
- r-settings.js → Hub Settings
- r-audit.js → Hub Audit Center
- r-getting-started.js → Hub Getting Started

---

---

# SECTION 4 — TRAFFIC RECOVERY MODULE

## Status: Partially built — 7 screens need building

### Entry Point
From Hub module tile → lands directly on Dashboard.

### Sidebar
```
OVERVIEW
  ← Back to Hub
  Dashboard

WEEKLY
  This Week

PRESENCE
  Google Business Profile
  Review Tracker
  Search and SEO
  Website Scorecard

SOCIAL AND DELIVERY
  Social Media
  Delivery Platforms
  Email and Loyalty

HISTORY
  Reports and History

SUPPORT
  Help and FAQ
```

Note: Settings removed. Audit removed. Getting Started removed.

### All Screens — Final State

| Screen | File | Status | Notes |
|---|---|---|---|
| Dashboard | t-dashboard.js | Complete | No change |
| This Week | t-this-week.js | Complete | 7-step wizard, all channel metrics captured |
| Google Business Profile | t-gbp.js | Complete | Scorecard plus profile completeness checklist |
| Review Tracker | t-reviews.js | Complete | Scorecard with velocity and response charts |
| Search and SEO | t-search.js | Complete | Local SEO assessment scorecard |
| Website Scorecard | t-website.js | Complete | Scorecard with sessions and bounce charts |
| Social Media | t-social.js | Complete | Scorecard with follower and posts charts |
| Delivery Platforms | t-delivery.js | Complete | Per-platform scorecard |
| Email and Loyalty | t-email.js | Complete | Scorecard with open rate and list charts |
| Reports | t-reports.js | Complete | Trend charts plus filterable history table |
| Help and FAQ | t-help.js | Complete | Expanded knowledge layer plus Quick Reference Card |

### Removed Screens (moved to Hub)
- t-settings.js → Hub Settings
- t-audit.js → Hub Audit Center
- t-getting-started.js → Hub Getting Started

### Traffic Screen Specs

#### This Week — additions needed
Add these fields to the weekly entry form (save to traffic_weeks):
- Yelp rating (0.0–5.0)
- Yelp review count (number)
- DoorDash active (yes/no) + rating if active
- Uber Eats active (yes/no) + rating if active
- Grubhub active (yes/no) + rating if active
- Email list size (number)
- Emails sent this month (number)
- Email open rate % (number)
- Loyalty program active (yes/no)
- Loyalty member count (number — optional)

#### Google Business Profile (t-gbp.js)
Scorecard reading latest traffic_weeks entry + traffic_settings targets.

Profile status section (yes/no toggles — saved to traffic_settings.profile, not weekly records):
Listing claimed | Hours complete | Phone present | Website linked | Menu link active | Category set | Attributes complete | Q&A populated

Tracked metrics (from traffic_weeks):
Photo count (benchmark 100+) | GBP posts this month (benchmark 8+) | Google review count | Google rating

Completeness score: auto-calculated from checklist. Shown as % with color.

Benchmark status per metric. Action tips for anything below benchmark.

#### Review Tracker (t-reviews.js)
Scorecard over traffic_weeks data.

Metrics displayed from latest week:
New reviews this week | Total Google reviews | Google rating | Response rate % | Yelp rating | Yelp review count | Most recent review age (days) | Negative patterns noted

Trend: review velocity chart over last 8 weeks. Response rate trend.

Benchmark comparisons. Action tips.

#### Search and SEO (t-search.js)
Scorecard with manual assessment fields (saved to traffic_settings.profile, not weekly records):
Maps pack confirmed (yes/no) | Primary keyword | NAP consistent (yes/no) | Business name on Google | Address on Google | Phone on Google | Website titles assessed (yes/no) | Citation count estimate

Action tips: inconsistent NAP, not in maps pack, low citations.

#### Website Scorecard (t-website.js)
Scorecard reading traffic_weeks data.

Metrics: website exists | mobile optimized | monthly sessions | bounce rate | menu page in top 3 | online ordering | reservation system | avg session duration | traffic source breakdown

Benchmarks per metric. Trend charts for sessions and bounce rate.

#### Social Media (t-social.js)
Scorecard reading traffic_weeks data.

Metrics: IG followers | IG posts this month | IG engagement rate | FB followers | FB posts this month | content mix assessment | stories used | reels used

Follower trend chart. Posts per month trend.

#### Delivery Platforms (t-delivery.js)
Scorecard reading traffic_weeks data.

Per platform (DoorDash / Uber Eats / Grubhub):
Active status | Rating | Photo count | Menu complete | Promo active

Overall: platform count | average rating across platforms

Action tips: not on any platform, low ratings, incomplete menus.

#### Email and Loyalty (t-email.js)
Scorecard reading traffic_weeks data.

Metrics: list size | last send date | send frequency | open rate | growth mechanism | loyalty program active | member count

Benchmarks. Open rate trend. Action tips.

#### Reports — Traffic (t-reports.js)
Trend charts from traffic_weeks history.

Charts: Google rating over time | Review velocity | Website sessions | IG followers | Delivery platform ratings

Summary table: all metrics by week, filterable by date range. Export to PDF.

#### Help — Traffic (t-help.js)
Expanded knowledge layer for Traffic Recovery. Replaces the removed Resources screen.

Contextual explanation of every Traffic metric, what each benchmark means, and what to do when a number is off target. Covers: Google rating and review velocity, response rate, GBP completeness, website sessions and bounce rate, social posting cadence, delivery platform ratings, email open rate, NAP consistency, local SEO, score calculation, the Traffic Audit, and file submission for the audit.

FAQ accordion format. May include a single one-page Quick Reference Card PDF download — the only downloadable asset on the screen.

---

---

# SECTION 5 — INVENTORY CONTROL MODULE

## Status: Full build required

### Entry Point
From Hub module tile → lands directly on Inventory Dashboard.

### Sidebar
```
OVERVIEW
  ← Back to Hub
  Dashboard

SETUP
  Products
  Locations
  Vendors

COUNTS
  Take Inventory
  Count History
  Spot Check

RECEIVING
  Receive Delivery
  Delivery History

ORDERING
  Order Sheet
  Order History

REPORTS
  Usage Report
  Variance Report
  Stock Report
  Top Movers

SUPPORT
  Help and FAQ
```

Note: Settings removed (moved to Hub). Getting Started removed (moved to Hub).

### All Screens

| Screen | File | Feeds To |
|---|---|---|
| Dashboard | ic-dashboard.js | — |
| Products | ic-product-setup.js | Profit: Bar/Kitchen Products |
| Locations | ic-locations.js | — |
| Vendors | ic-vendors.js | Profit: Vendor Watch |
| Take Inventory | ic-take-inventory.js | Profit: This Week COGS |
| Count History | ic-count-history.js | — |
| Spot Check | ic-spot-check.js | — |
| Receive Delivery | ic-receive-delivery.js | Profit: Vendor Watch, COGS |
| Delivery History | ic-delivery-history.js | — |
| Order Sheet | ic-order-sheet.js | — |
| Order History | ic-order-history.js | — |
| Usage Report | ic-report-usage.js | — |
| Variance Report | ic-report-variance.js | — |
| Stock Report | ic-report-stock.js | — |
| Top Movers | ic-report-movers.js | — |
| Help and FAQ | ic-help.js | — |

### Key Architecture: Product Master

ic_products is the master product list for the entire platform.
- Profit Recovery Bar Products reads from ic_products (bar categories)
- Profit Recovery Kitchen Products reads from ic_products (food/kitchen categories)
- Recipe Library ingredient costs pull from ic_products unit costs
- When ic_products doesn't exist yet, bar_products and kitchen_products work as before
- On Control activation: migration prompt offers to import existing bar_products and kitchen_products into ic_products

### Bottle Slider — Component Spec

Reusable component. Used in Take Inventory and Spot Check.

Visual: SVG bottle silhouette (generic spirit bottle shape), vertically oriented
Fill: colored rectangle that grows from bottom of bottle interior
Drag handle: horizontal line at fill level
Value: decimal 0.1 to 1.0, displayed large above or below bottle
Snaps to 0.1 increments on release
Fine tune: tap top half = +0.1, tap bottom half = -0.1

Colors by category:
- Liquor/Spirits: amber #C9A84C
- Wine: burgundy #8B1A1A
- Bottle Beer: amber #C9A84C
- Draft Beer: gold #E8C84A
- Food/Misc: blue-grey #4888A8

Full bottles: separate integer counter with +/- buttons above slider
Total on-hand = full bottles + partial (displayed prominently)

Touch events: touchstart, touchmove, touchend
Mouse events: mousedown, mousemove, mouseup
Keyboard: arrow up/down for accessibility

Manual override: tap the decimal value to type directly

### Screen Specs

#### Dashboard (ic-dashboard.js)
Cards: Total inventory value | Items below par (with count) | Last count date | Open deliveries

Alert strip: products below par, each with "Add to Order" tap

This period: Bar COGS from deliveries | Variance status | Top 3 movers

Quick actions: Start Count | Receive Delivery | Generate Order Sheet

#### Products (ic-product-setup.js)
Category tabs: Liquor | Wine | Bottle Beer | Draft Beer | Food | Misc

Fields: Product Name | Brand | Category | Sub-category | Primary Vendor | Container Size | Pour Size | Unit Cost | Menu Price | Par Level | Reorder Point | Primary Location | Secondary Location | Active toggle | Notes

Auto-calculated: Cost Per Pour | Pour Cost % | Pours Per Container

Sync indicator: "Synced to Profit Recovery ✓"

Bulk CSV import with column mapping. Mapping remembered per file format.

#### Locations (ic-locations.js)
User-defined. Suggested defaults: Front Bar | Back Bar | Walk-In Cooler | Dry Storage | Office Storage

Add/edit/archive/reorder. Click location to see all products and current counts.

#### Vendors (ic-vendors.js)
Fields: Name | Rep | Phone | Email | Delivery Days | Payment Terms | Account # | Notes

Products list per vendor. Price history last 5 changes. Auto-feeds Vendor Watch.

#### Take Inventory (ic-take-inventory.js)
Count types: Full | Bar Only | Kitchen Only | Custom (select locations)

Per product: bottle slider + full bottles counter + notes
Group by location. Swipe between locations.
Progress indicator. Save draft. Resume later.

On submit: calculates usage, pours made, generates variance report, prompts to update Profit Recovery COGS.

#### Count History (ic-count-history.js)
Table: Date | Type | Counted By | Total Value | Variance vs Prior | Status

Click any count: full detail, export to PDF, side-by-side comparison.

#### Spot Check (ic-spot-check.js)
Select up to 20 products. Save as named template.
Pre-shift count → post-shift count (bottle slider) → POS sales entry (manual or CSV)

Results: units used | pours made | POS sales | variance | status
Status: OK (under 5%) | Watch (5–15%) | Flag (over 15% — red, requires note)

History: all spot checks saved. Filter by date, product.

#### Receive Delivery (ic-receive-delivery.js)
Fields: Vendor | Date | Invoice # | Driver | Notes

Line items: Product | Container size | Qty received | Price per unit (pre-fills, editable) | Price change flag | Extended total

On save: updates on-hand counts | pushes price changes to Vendor Watch | adds to period COGS | logs discrepancies

#### Delivery History (ic-delivery-history.js)
All deliveries: date | vendor | items | total | discrepancy flag. Export to PDF.

#### Order Sheet (ic-order-sheet.js)
Auto-generated from counts vs par.
Grouped by vendor. Editable quantities. Add manual items.
Export to PDF. Mark as ordered → logs to history.

#### Order History (ic-order-history.js)
All orders: date | vendors | estimated cost | items. Compare to delivery history.

#### Usage Report (ic-report-usage.js)
Sub-tabs: Usage Data | Usage Totals | Stock Values | Most Used | Least Used | Usage History | Stock Check

Usage Data columns: Product | Starting Stock | Purchases | Bottles Used | Ending Stock | Pours Made | Usage Cost | Theoretical Sales | Theoretical Profit

Most Used: top 10 by bottles used and usage cost. Sales flow chart visualization.

Filters: category | date range | location. Export all views to PDF.

#### Variance Report (ic-report-variance.js)
Two tabs: Sales Variance | Usage Variance

Sales Variance: Product | Register Sales | Theoretical Sales | Sales Variance | Variance % | Actual Cost % | Actual Profit | Status

POS CSV Import:
- Upload CSV from Toast, Square, Aloha, Lightspeed, or any system
- Column mapping screen: Product Name | Quantity Sold | Sales Amount
- Exact and case-insensitive matching
- Manual mapping for unmatched products
- Mappings saved permanently per POS format

Usage Variance: Product | Ounces Sold | Ounces Used | Pours Made | Bottles Used | Ounce Variance | Variance % | Status

Status colors: Green under 5% | Yellow 5–15% | Red over 15%

Export to PDF with status colors preserved.

#### Stock Report (ic-report-stock.js)
Total value by category | by location | vs last count | lowest value products | highest value products. Export to PDF.

#### Top Movers (ic-report-movers.js)
Top 10 and bottom 10 by bottles used and usage cost. Trend vs prior period. Sales flow chart. Export to PDF.

#### Help (ic-help.js)
FAQ: how counts work | bottle slider | CSV import | feeding Profit Recovery | setting par levels | spot check | order sheet

---

---

# SECTION 6 — LABOR CONTROL MODULE

## Status: Full build required

### Entry Point
From Hub module tile → lands directly on Labor Dashboard.

### Sidebar
```
OVERVIEW
  ← Back to Hub
  Dashboard

SCHEDULING
  Build Schedule
  Templates
  Schedule History

ACTUALS
  Log Hours
  Daily View
  Weekly Summary

TEAM
  Staff Roster
  Positions

TIPS
  Tip Log
  Tip Pool Calculator
  Tip History

REPORTS
  Labor Reports
  Overtime Watch
  Call-Out Log

SUPPORT
  Help and FAQ
```

Note: Settings removed. Wage rates moved to Hub Settings (Team and Wages section). Getting Started removed.

### All Screens

| Screen | File | Feeds To |
|---|---|---|
| Dashboard | lc-dashboard.js | — |
| Build Schedule | lc-schedule-build.js | Revenue: This Week labor |
| Templates | lc-templates.js | — |
| Schedule History | lc-schedule-history.js | — |
| Log Hours | lc-log-hours.js | Revenue: This Week labor |
| Daily View | lc-daily-view.js | — |
| Weekly Summary | lc-weekly-summary.js | Revenue: This Week labor |
| Staff Roster | lc-roster.js | Revenue: Server Check |
| Positions | lc-positions.js | — |
| Tip Log | lc-tip-log.js | — |
| Tip Pool Calculator | lc-tip-pool.js | — |
| Tip History | lc-tip-history.js | — |
| Labor Reports | lc-reports.js | — |
| Overtime Watch | lc-overtime.js | Hub: alerts |
| Call-Out Log | lc-callout.js | — |
| Help and FAQ | lc-help.js | — |

### Screen Specs

#### Dashboard (lc-dashboard.js)
Cards: This week labor % vs target | This week RPLH vs target | Overtime alerts count | Call-outs this month

Alert strip: anyone projected over 40 hours (tap to adjust schedule)

Schedule status: published this week? If not, prompt.

Quick actions: Build Schedule | Log Hours | Record Call-Out

#### Build Schedule (lc-schedule-build.js)
Week selector. Department tabs: All | Bar | Kitchen | Floor

Grid: staff rows × day columns. Tap cell → add shift (start, end, position, notes)

Live calculations as shifts added:
- Hours per staff (red if approaching 40)
- Cost by department (hours × wage from Hub Settings)
- Labor % projection (scheduled cost ÷ revenue forecast)
- RPLH projection (revenue forecast ÷ scheduled hours)
- Budget meter vs Hub Settings labor % target

Revenue forecast: enter weekly total or by day

Actions: Copy last week | Apply template | Publish | Export to PDF

#### Templates (lc-templates.js)
Save schedules as named templates. Apply when starting new week.

#### Schedule History (lc-schedule-history.js)
All past weeks: date | hours | cost | scheduled vs actual. Click for full detail.

#### Log Hours (lc-log-hours.js)
Per entry: staff | date | clock in | clock out | position | department | break toggle | notes

Bulk CSV import from 7shifts, HotSchedules, Toast timeclock. Column mapping.

#### Daily View (lc-daily-view.js)
Who worked today. Hours, department, cost. Scheduled vs actual. Flag variances.

#### Weekly Summary (lc-weekly-summary.js)
Scheduled vs actual by department.

Columns: Department | Sched Hours | Actual Hours | Variance | Sched Cost | Actual Cost | Variance $ | Labor %

On save: prompt "Send to Revenue Recovery This Week?" If yes: labor data auto-populates Revenue This Week.

#### Staff Roster (lc-roster.js)
All staff: name | position | department | hire date | status

Floor staff sync from Revenue Recovery server list. Bar/kitchen added here.

#### Positions (lc-positions.js)
Positions with department assignment.

Defaults: Bartender | Barback | Server | Host | Food Runner | Line Cook | Prep Cook | Dishwasher | Manager | Busser

Add custom positions.

#### Tip Log (lc-tip-log.js)
Daily tip recording: Date | Staff | Shift | Credit tips | Cash tips | Total

#### Tip Pool Calculator (lc-tip-pool.js)
Methods from Hub Settings: Hours Worked | Points | Percentage Split | Custom

Enter total pool → app calculates distribution → save to history

#### Tip History (lc-tip-history.js)
Per staff member tip history. Filter by date, staff, shift.

#### Labor Reports (lc-reports.js)
Labor cost by department over any date range | Labor % trend | RPLH trend | Scheduled vs actual over time | Department efficiency. Export to PDF.

#### Overtime Watch (lc-overtime.js)
Real-time: anyone approaching 40 hours. Current hours | remaining scheduled | projected total.

Tap any name → go to their schedule to adjust.

Alerts at thresholds from Hub Settings.

Also feeds Hub alert strip automatically.

#### Call-Out Log (lc-callout.js)
Fields: Date | Staff | Scheduled shift | Type (Called Out / No Call No Show / Late / Left Early) | Coverage | Notes

Reports: by staff member | by day of week | coverage cost

#### Help (lc-help.js)
FAQ: schedule builder | tip pool methods | importing hours | connecting to Revenue Recovery | overtime rules

---

---

# SECTION 7 — SHIFT CONTROL MODULE

## Status: Full build required

### Entry Point
From Hub module tile → lands directly on Shift Dashboard.

### Sidebar
```
OVERVIEW
  ← Back to Hub
  Dashboard

SHIFTS
  Active Shift
  Log a Shift
  Shift History

CASH
  Cash Drop
  Safe Log
  Variance Log

OPERATIONS
  86 List
  Void and Comp Log
  Maintenance Log

CHECKLISTS
  Opening Checklist
  Closing Checklist
  Templates

REPORTS
  Shift Reports
  Cash Reports
  Operations Reports

SUPPORT
  Help and FAQ
```

Note: Settings removed. Getting Started removed.

### All Screens

| Screen | File | Feeds To |
|---|---|---|
| Dashboard | sc-dashboard.js | — |
| Active Shift | sc-active-shift.js | — |
| Log a Shift | sc-log-shift.js | — |
| Shift History | sc-shift-history.js | — |
| Cash Drop | sc-cash-drop.js | Profit: Cash Reconciliation |
| Safe Log | sc-safe-log.js | — |
| Variance Log | sc-variance-log.js | Profit: Cash Reconciliation |
| 86 List | sc-86-list.js | Inventory: par alerts |
| Void and Comp Log | sc-void-comp.js | Profit: Exception analysis |
| Maintenance Log | sc-maintenance.js | Hub: alerts |
| Opening Checklist | sc-opening-checklist.js | — |
| Closing Checklist | sc-closing-checklist.js | — |
| Templates | sc-checklist-templates.js | — |
| Shift Reports | sc-reports-shift.js | — |
| Cash Reports | sc-reports-cash.js | — |
| Operations Reports | sc-reports-ops.js | — |
| Help and FAQ | sc-help.js | — |

### Screen Specs

#### Dashboard (sc-dashboard.js)
Cards: Shifts logged this week | Open cash variances | Active 86 items | Open maintenance issues

Alert strip: unresolved variances over tolerance | urgent maintenance issues

Today status: opening checklist done? Closing pending?

Quick actions: Start Shift | Cash Drop | Add 86 Item | Log Void/Comp

#### Active Shift (sc-active-shift.js)
Live shift view. Open at start of shift. Stays open during service.

Shows: current shift info | opening checklist status | running cash drop total | 86 items this shift | voids/comps this shift

Quick-add buttons for all actions. Everything auto-attaches to current shift report.

#### Log a Shift (sc-log-shift.js)
Fields: Date | Shift type | Manager | Staff on floor | Revenue (bar/floor/total) | Notes | Opening bank | Status

On close: cash drops, checklist completion, void/comp log, incidents all auto-attach.

#### Shift History (sc-shift-history.js)
All shifts: date | manager | type | revenue | checklist status | cash variance | incidents. Export to PDF.

#### Cash Drop (sc-cash-drop.js)
Fields: Date/time (auto) | Shift | Amount | Manager | Notes

Running total for shift. Variance flag vs POS cash sales.

Auto-feeds Profit Recovery Cash Reconciliation.

#### Safe Log (sc-safe-log.js)
Opening count | drops added | closing count | variance. Optional denomination breakdown.

#### Variance Log (sc-variance-log.js)
All variances over tolerance: Date | Shift | Manager | Amount | Over/Short | Notes | Status

Open vs resolved. Resolution note required to close.

Feeds Profit Recovery cash reconciliation patterns. Also feeds Hub alert strip.

#### 86 List (sc-86-list.js)
Add item: name | date/time | reason | expected back | who added

Active list: current 86s. One tap to mark back in stock.

Intelligence: same item 86'd 3+ times in 30 days → alert "Consider adjusting par level" → links to ic-product-setup

History: all 86s logged permanently.

#### Void and Comp Log (sc-void-comp.js)
Real-time authorization and logging.

Fields: Type (Void/Comp/Manager Discount/Employee Meal) | Item description | Amount | Reason code | Authorized by | Staff member | Notes

Daily summary on Hub. Alert if total exceeds threshold from Hub Settings.

Auto-feeds Profit Recovery exception analysis.

#### Maintenance Log (sc-maintenance.js)
Fields: Date/time | Equipment/location | Issue | Priority (Urgent/Non-Urgent/Cosmetic) | Status | Vendor called | Resolution notes | Cost

Active urgent issues feed Hub alert strip.

History: all resolved issues with dates and costs.

#### Opening Checklist (sc-opening-checklist.js)
Customizable. Default items:
Cash drawers verified | POS online | Bar stocked | Walk-in temps checked | Restrooms clean | Floor setup complete | Side work assigned | Pre-shift briefing done | 86 list communicated

Add/remove/reorder items. Timestamp per item. Manager sign-off.

#### Closing Checklist (sc-closing-checklist.js)
Default items:
Cash counted and dropped | POS closed and Z-tape run | Liquor secured | Walk-in secured | Equipment off | Cleaning complete | Trash out | Floors done | Doors locked | Alarm set

#### Templates (sc-checklist-templates.js)
Save checklists as named templates. Apply to any shift.

#### Shift Reports (sc-reports-shift.js)
Shifts per week by manager | Revenue by shift type | Checklist completion rate | Average shift revenue trend. Export to PDF.

#### Cash Reports (sc-reports-cash.js)
Cash variance by shift | Variance by manager | Safe reconciliation summary | Cash handled vs total variance rate. Export to PDF.

#### Operations Reports (sc-reports-ops.js)
Void and comp totals by date/manager/reason | 86 frequency by item | Maintenance cost by equipment | Incident count by type. Export to PDF.

#### Help (sc-help.js)
FAQ: active shift screen | cash drop flow | void authorization | 86 list | connecting to Profit Recovery | checklist customization

---

---

# SECTION 8 — AUDIT ARCHITECTURE

## Audit Center location: Hub (not inside individual modules)

### How Audits Change When Control Is Active

**Current behavior (no Control):**
User uploads documents → Claude extracts data → scores audit → displays results

**Future behavior (with Control active):**
App checks which Control modules are active and what data exists.
Sections covered by Control data = auto-populated, no upload needed.
Sections not covered by Control data = upload prompt.

**Profit Audit — Control data sources:**
- Bar cost section: pulls from ic_counts and ic_deliveries (actual calculated pour cost)
- Vendor section: pulls from ic_deliveries price history (real data not uploaded invoices)
- Theft/Controls section: pulls from ic_spot_checks and sc_void_comps (actual variance and exception data)
- Prime cost: pulls from lc_actuals weekly labor data
- Cash controls: pulls from sc_variances and sc_cash_drops

**Revenue Audit — Control data sources:**
- Labor section: pulls from lc_actuals (real labor % and RPLH)
- Server performance: pulls from lc_roster for server list

**Traffic Audit:**
No Control module for traffic. Always document/screenshot based. No change.

### Audit Intake UI (on Hub)

For each audit, intake shows two sections:

**Section A — Data from your Bar Cop account**
Lists what Control data is available and what period it covers.
Green checkmarks for sections with sufficient data.
"Your Inventory Control data covers Pour Cost and Vendor sections."

**Section B — Supplemental uploads**
Only shows upload fields for sections not covered by Control data.
"Upload your POS exception report to improve your Controls score."
If all sections covered by Control: "All sections have data. Add notes below or run the audit now."

### Audit Data Tier System (unchanged)
- Tier 1: Control data available for this section (most accurate)
- Tier 2: Partial data — some Control, some uploaded
- Tier 3: Uploaded documents only (estimated)

Tier shown per section in audit output. Overall tier shown in audit header.

### Audit Prompts — Server Side Update Needed
When Control data exists, server sends structured JSON data as primary input instead of relying on document extraction.

getExtractionPrompt functions need new parameter: controlData object
When controlData fields are populated, prompt tells Claude to use those values as ground truth rather than estimating from documents.

---

---

# SECTION 9 — DATA ARCHITECTURE

## Complete App.data Key Reference

### Recovery Keys (existing — do not change)
```
settings                    — global operation profile and all targets
bar_products                — stays until ic_products migration
kitchen_products            — stays until ic_products migration
recipes                     — recipe library
weeks                       — profit weekly data
shifts                      — shift check entries
reconciliations             — cash reconciliation entries
theft_scores                — theft risk scores
vendor_log                  — vendor price change log
audits                      — profit audit history
getting_started_profit      — profit checklist state (moves to hub)
revenue_settings            — revenue module settings (targets move to settings)
revenue_weeks               — revenue weekly data
revenue_audits              — revenue audit history
revenue_server_checks       — server check entries
revenue_menu_items          — menu items
revenue_price_log           — menu price change log
revenue_events              — events and catering records
revenue_rate_cards          — private dining rate cards
getting_started_revenue     — revenue checklist state (moves to hub)
traffic_settings            — traffic targets + digital-presence profile state (move to settings)
traffic_weeks               — traffic weekly data
traffic_audits              — traffic audit history
getting_started_traffic     — traffic checklist state (moves to hub)
```

### New Hub Keys
```
hub_alerts_dismissed        — which alerts user has acknowledged
hub_setup_progress          — overall setup completion state
onboarding_complete         — existing flag, keep as-is
```

### New Control Keys
```
ic_products                 — master product list (replaces bar_products + kitchen_products)
ic_locations                — user-defined storage locations
ic_vendors                  — vendor contacts and history
ic_counts                   — inventory count history
ic_deliveries               — delivery receiving records
ic_orders                   — order sheet history
ic_spot_checks              — spot check records
lc_staff                    — staff roster
lc_positions                — position definitions
lc_schedules                — weekly schedules
lc_actuals                  — actual hours worked
lc_tips                     — tip log entries
lc_tip_pools                — tip pool calculations
lc_callouts                 — call-out log
sc_shifts                   — shift reports
sc_cash_drops               — cash drop log
sc_variances                — cash variance log
sc_86_list                  — 86 item log
sc_void_comps               — void and comp log
sc_maintenance              — maintenance log
sc_checklists               — checklist completion records
```

---

---

# SECTION 10 — SERVER ENDPOINTS

## Existing (keep as-is)
```
POST /api/claude                     — Claude API proxy
POST /api/generate-profit-audit      — Profit audit (update to accept controlData)
POST /api/generate-revenue-audit     — Revenue audit (update to accept controlData)
POST /api/generate-traffic-audit     — Traffic audit (no change)
POST /api/create-checkout-session    — Stripe checkout
POST /api/billing-portal             — Stripe billing portal
POST /api/stripe-webhook             — Stripe webhook handler
```

## New Endpoints Needed
```
POST /api/parse-csv                  — POS and timeclock CSV parsing
                                       Accepts multipart CSV upload
                                       Returns parsed rows with column mapping suggestions
                                       Stores column mapping by format hash
```

No other new server endpoints needed.
All Control data saves client-side to Supabase via existing DB.writeData pattern.

---

---

# SECTION 11 — SAMPLE DATA

## Current State
Sample data populates Profit and Revenue Recovery with fake weekly data, products, and audit records. Inconsistent across modules.

## Required Rebuild
Single coherent fake operation: "The Anchor Bar and Kitchen"
All numbers consistent across all 6 modules. Every metric tells the same story.

### The Anchor Bar and Kitchen — Fake Operation Profile
- Bar type: Full bar and kitchen, casual dining
- Location: Austin, TX
- Annual bar revenue: $624,000
- Annual food revenue: $374,400
- Bar pour cost: running in the mid-20s%, above the 22% target
- Food cost: running in the mid-30s%, above the 32% target
- Prime cost: in the low 60s%, near the 60% target
- Check average: in the low-30s dollars, below the $35 target
- Google rating: 4.1 (below 4.3 target)
- Labor %: 31% blended

### Sample Data Required Per Module
Profit Recovery: 12 weeks of weekly data, 15 bar products, 8 kitchen products, 6 recipes, 3 vendor price changes, 2 theft risk scores, 4 cash reconciliations, 1 complete profit audit with full scores

Revenue Recovery: 8 weeks of weekly data, 5 servers with check average history, 12 menu items, 3 events, 1 complete revenue audit with full scores

Traffic Recovery: 8 weeks of tracking data, GBP partially complete, 3.4 stars Yelp, low review velocity, no delivery platforms, small email list, 1 complete traffic audit with full scores

Inventory Control: 25 products across 4 locations, 3 vendors, 2 completed counts with variance, 3 deliveries with 1 price change, 1 order sheet

Labor Control: 8 staff members, 2 weeks of schedules, 1 week of actuals, tip pool example

Shift Control: 5 shift reports, 3 cash drops, 1 variance, 2 active 86 items, 1 maintenance issue

All numbers cross-reference correctly. Inventory count usage matches Profit Recovery COGS. Labor actuals match Revenue Recovery labor %. Cash drops match Cash Reconciliation.

### loadSample() Function
Single function in settings.js that populates all of the above in one call.
"Load Sample Data" button on Hub Settings → Account section.
"Clear Sample Data" button available after loading.

---

---

# SECTION 12 — DATA EXPORT AND CANCELLATION

## Data Export
"Download Backup" button in Hub Settings → Account section.

Exports complete App.data as formatted JSON file.
Filename: barcop-backup-[bar-name]-[date].json

Available at any time. Not just on cancellation.

## Cancellation Flow
When Stripe subscription is cancelled:
1. Webhook fires customer.subscription.deleted
2. subscription_status set to 'canceled' in Supabase
3. On next login: cancellation screen shown instead of Hub

Cancellation screen:
- "Your subscription has been cancelled"
- "Your data will be retained for 30 days (until [date])"
- "Download your data before access ends" button → triggers data export
- "Reactivate" button → opens Stripe checkout
- Data access: read-only for 30 days, then locked

Reactivation:
If customer reactivates within 30 days → full data restored, subscription_status set back to active
If after 30 days → data deleted from Supabase, fresh start on reactivation

---

---

# SECTION 13 — MOBILE DESIGN REQUIREMENTS FOR CONTROL

Inventory Control and Shift Control are used on phones in the field.
These screens must be designed mobile-first, not desktop-first.

## Mobile-Critical Screens
- ic-take-inventory.js — counting on phone walking the bar
- ic-receive-delivery.js — receiving on phone at the back door
- ic-spot-check.js — spot checking on phone during service
- sc-active-shift.js — managing shift on phone on the floor
- sc-cash-drop.js — logging drops on phone
- sc-86-list.js — updating 86s on phone mid-service
- sc-void-comp.js — authorizing voids on phone

## Mobile Design Rules for These Screens
- Minimum touch target: 48px height for all interactive elements
- Product name and key number displayed large (minimum 16px)
- Bottle slider: minimum 200px height for accurate touch interaction
- +/- buttons on counters: minimum 44px × 44px
- No horizontal scrolling
- One action per screen tap — no nested menus during active operations
- Swipe gestures for navigation between locations or products
- Auto-save every action — no "save" button required during active counting
- Offline capable — save to localStorage if Supabase unreachable, sync when back online (this is important for walk-in cooler counts where wifi may be weak)

## Offline Sync for Inventory Counts
Count data saved to localStorage as it is entered.
On submit: attempt Supabase write.
If Supabase unavailable: keep in localStorage, show "Saved locally — will sync when online" message.
On next app load: detect unsynced count, prompt to sync.

---

---

# SECTION 14 — BUILD SEQUENCE

## Current State Checklist
- [x] Profit Recovery — complete
- [x] Revenue Recovery — complete
- [x] Traffic Recovery — complete
- [ ] Hub — needs full rebuild as command center
- [ ] Inventory Control — full build
- [ ] Labor Control — full build
- [ ] Shift Control — full build

## Recommended Build Order

### Stage 1 — Finish Recovery (do this now)
1. Finish 7 Traffic screens + help — DONE
2. Add missing fields to t-this-week.js — DONE
3. Fix & vs and inconsistency in nav labels — DONE
4. Populate sample audit data for Profit and Revenue in loadSample() — DONE
5. Add audit validation — reject if no real data submitted — DONE

### Stage 2 — Rebuild Hub
6. Rebuild hub.js as full command center
7. Move all settings from module settings screens to Hub settings
8. Move all Getting Started checklists to Hub
9. Move all audit screens to Hub Audit Center
10. Update onboarding to new platform setup flow
11. Remove settings/audit/getting-started screens from all 6 modules
12. Update all module sidebars to remove those items and add ← Back to Hub
13. Delete resources.js, r-resources.js, and t-resources.js from the repo and remove their script tags from index.html — Resources is removed platform-wide; the Control modules are built without Resources screens from the start

### Stage 3 — Inventory Control Phase 1

> ## ⛔ STOP — GATE BEFORE STAGE 3
> Do NOT write a single Control module screen (anything prefixed ic-, lc-, sc-)
> until the Rule 21 Supabase tables exist. See SECTION 15 → RULE 21.
>
> Required first, in order:
> 1. The chat MUST pause here and walk the user through running the Rule 21 SQL
>    (the `CREATE TABLE ic_data / lc_data / sc_data` blocks plus RLS policies) in
>    the Supabase dashboard: supabase.com → the project → SQL Editor → new query →
>    paste the SQL from Rule 21 → Run. Confirm all three tables were created.
> 2. Add that same SQL to SUPABASE_SETUP.sql in the repo.
> 3. Add the six DB methods (readInventoryData/writeInventoryData, etc.) and the
>    App.inventoryData / App.laborData / App.shiftData state objects, per Rule 21.
>
> Only after the user confirms the tables exist may screen-building (step 13+) begin.
> Building Control screens against the old user_data JSON blob is the one mistake
> this plan must not make. This is a hard gate, not a suggestion.

13. ic-product-setup.js with Profit Recovery sync
14. ic-locations.js
15. ic-vendors.js
16. ic-take-inventory.js with bottle slider component
17. ic-count-history.js
18. ic-receive-delivery.js
19. ic-delivery-history.js
20. ic-report-usage.js
21. ic-report-variance.js with CSV import component
22. ic-report-stock.js
23. ic-report-movers.js
24. ic-dashboard.js
25. ic-help.js
26. Update bar-products.js and kitchen-products.js for read-only mode
27. Update this-week.js with Import from Inventory Control button
28. Update vendor-watch.js with auto-feed indicator

### Stage 4 — Shift Control
29. sc-active-shift.js (mobile first)
30. sc-log-shift.js
31. sc-cash-drop.js (mobile first)
32. sc-safe-log.js
33. sc-variance-log.js
34. sc-86-list.js (mobile first)
35. sc-void-comp.js (mobile first)
36. sc-maintenance.js
37. sc-opening-checklist.js
38. sc-closing-checklist.js
39. sc-checklist-templates.js
40. sc-reports-shift.js, sc-reports-cash.js, sc-reports-ops.js
41. sc-shift-history.js
42. sc-dashboard.js
43. sc-help.js
44. Update cash-recon.js with auto-feed from Shift Control

### Stage 5 — Inventory Control Phase 2
45. ic-spot-check.js
46. ic-order-sheet.js
47. ic-order-history.js

### Stage 6 — Labor Control
48. lc-roster.js
49. lc-positions.js
50. lc-schedule-build.js
51. lc-templates.js
52. lc-schedule-history.js
53. lc-log-hours.js with CSV import
54. lc-daily-view.js
55. lc-weekly-summary.js with Revenue Recovery auto-feed
56. lc-tip-log.js
57. lc-tip-pool.js
58. lc-tip-history.js
59. lc-reports.js
60. lc-overtime.js
61. lc-callout.js
62. lc-dashboard.js
63. lc-help.js
64. Update r-this-week.js with Import from Labor Control button
65. Update RPLH bidirectional sync between Labor Control and Revenue Settings

### Stage 7 — Integration and Polish
66. Rebuild loadSample() with complete coherent fake operation across all 6 modules
67. Update audit intake screens on Hub to check for Control data availability
68. Update server-side audit prompts to accept controlData parameter
69. Add PDF export to all Control reports
70. Add offline sync for inventory counts
71. Add data export / backup function to Hub Settings
72. Implement 30-day data retention on cancellation
73. Full cross-module integration testing
74. Data migration: bar_products → ic_products with no data loss

---

---

# SECTION 15 — RULES FOR CODE

1. Read DESIGN_SYSTEM.md before building any screen
2. Never add Python or ReportLab to the Dockerfile — no PDFs server-side
3. Always use stream: true on Claude API calls — never blocking
4. Never create DigitalOcean managed databases — Supabase only
5. Never add /api/add-module endpoint — flat pricing, all modules always active
6. All screens in public/screens/ — register in app.js navigate() and index.html
7. Module prefixes: ic- (Inventory), lc- (Labor), sc- (Shift)
8. Bottle slider is a reusable component — build once, import everywhere
9. CSV column mapping is a reusable component — POS import and hours import use same pattern
10. Every report gets Export to PDF button — top right, consistent placement
11. Mobile-critical screens (listed in Section 13) must be designed touch-first
12. Auto-save during inventory counts — never lose a count to a network issue
13. Hub settings is the single source of truth — no duplicate settings in modules
14. When Control is not yet activated, Recovery works exactly as before — no breaking changes
15. Sample data must be consistent across all modules — The Anchor Bar and Kitchen
16. Settings object in App.data is the global config — all modules read from it
17. Bar name change in Hub Settings updates everywhere instantly
18. Cash variance tolerance in Hub Settings syncs to Shift Control and Profit Recovery simultaneously
19. RPLH targets in Hub Settings sync bidirectionally with Labor Control
20. Staff roster in Labor Control syncs to Revenue Recovery server list
21. Control data goes in separate Supabase tables — NOT in the user_data JSON column (see Rule 21 details below)

---

## RULE 21 — SUPABASE TABLE ARCHITECTURE FOR CONTROL DATA (CRITICAL)

This must be done BEFORE building any Control module screens (Stage 3+).
Do NOT add Control data keys to the existing user_data table.
Do NOT add ic_, lc_, or sc_ keys to App.data or writeData().

### Why
The existing user_data table stores all Recovery data as one JSON object per user.
This works fine for Recovery. Adding Control data (inventory counts, schedules, shift logs)
to the same JSON object would make it too large, slow to read/write, and hard to maintain.

### What to do instead
Create three separate Supabase tables for Control data.
Each table follows the exact same pattern as user_data.

### SQL to run in Supabase before Stage 3 starts
Add this to SUPABASE_SETUP.sql in the repo AND run it in the Supabase SQL editor:

```sql
-- Inventory Control data table
CREATE TABLE ic_data (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL UNIQUE,
  data jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE ic_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own inventory data"
  ON ic_data FOR ALL USING (auth.uid() = user_id);

-- Labor Control data table
CREATE TABLE lc_data (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL UNIQUE,
  data jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE lc_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own labor data"
  ON lc_data FOR ALL USING (auth.uid() = user_id);

-- Shift Control data table
CREATE TABLE sc_data (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL UNIQUE,
  data jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE sc_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own shift data"
  ON sc_data FOR ALL USING (auth.uid() = user_id);
```

### DB layer additions (add to db.js)
Add these 6 methods to db.js following the exact same pattern as readData() and writeData():

```javascript
// Inventory Control
async readInventoryData() { /* same pattern as readData() but reads ic_data table */ }
async writeInventoryData(data) { /* same pattern as writeData() but writes ic_data table */ }

// Labor Control
async readLaborData() { /* same pattern as readData() but reads lc_data table */ }
async writeLaborData(data) { /* same pattern as writeData() but writes lc_data table */ }

// Shift Control
async readShiftData() { /* same pattern as readData() but reads sc_data table */ }
async writeShiftData(data) { /* same pattern as writeData() but writes sc_data table */ }
```

### App state for Control data
Add three separate state objects to App alongside App.data:

```javascript
App.inventoryData = null;  // ic_ keys live here
App.laborData = null;      // lc_ keys live here
App.shiftData = null;      // sc_ keys live here
```

Load them in App.init() the same way App.data is loaded:
```javascript
App.inventoryData = await DB.readInventoryData();
App.laborData = await DB.readLaborData();
App.shiftData = await DB.readShiftData();
```

### What goes where
```
App.data (user_data table) — all Recovery keys, settings, unchanged
App.inventoryData (ic_data table) — ic_products, ic_locations, ic_vendors, ic_counts, ic_deliveries, ic_orders, ic_spot_checks
App.laborData (lc_data table) — lc_staff, lc_positions, lc_schedules, lc_actuals, lc_tips, lc_tip_pools, lc_callouts
App.shiftData (sc_data table) — sc_shifts, sc_cash_drops, sc_variances, sc_86_list, sc_void_comps, sc_maintenance, sc_checklists
```

### Recovery still reads from App.data — no changes to existing Recovery code
The only Recovery screens that change are:
- bar-products.js reads from App.inventoryData.ic_products (when it exists)
- kitchen-products.js reads from App.inventoryData.ic_products (when it exists)
- this-week.js reads from App.inventoryData.ic_counts for COGS import (when it exists)
- vendor-watch.js reads from App.inventoryData.ic_deliveries for auto-feed (when it exists)
- cash-recon.js reads from App.shiftData.sc_cash_drops for auto-feed (when it exists)
- r-this-week.js reads from App.laborData.lc_actuals for import (when it exists)

All of these are additive — if the Control data doesn't exist yet, the Recovery screen works exactly as before. No breaking changes.
