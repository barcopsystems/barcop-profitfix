[DESIGN_SYSTEM.md](https://github.com/user-attachments/files/28178168/DESIGN_SYSTEM.md)
# Bar Cop — Profit Fix Design System
## Version 1.0 — Locked

This document defines the complete design language for all Bar Cop Fix systems.
Every future app (Food Fix, Labor Fix, Vendor Fix, etc.) must match this spec exactly.

---

## Color Tokens

```css
--bg:        #000000        /* Page background */
--surface:   #070E15        /* Cards, sidebar, topbar */
--input:     #06111c        /* All input fields */
--hover:     rgba(255,255,255,0.05)  /* Nav item hover */
--nav-act:   #0d1e2e        /* Active nav item */

--gold:      #C9A84C        /* Primary accent — on-target, CTAs */
--gold-h:    #b8943f        /* Gold hover state */
--gold-bg:   rgba(201,168,76,0.10)  /* Gold badge background */
--red:       #C03828        /* Over-target, alerts, danger */
--red-bg:    rgba(192,56,40,0.13)   /* Red badge background */
--steel:     #4888A8        /* Links, secondary info */

--w:         #ffffff        /* White text */
--t1:        rgba(200,216,232,0.88) /* Primary text */
--t2:        rgba(200,216,232,0.58) /* Secondary text */
--t3:        rgba(255,255,255,0.30) /* Labels, section headers */
--t4:        rgba(255,255,255,0.16) /* Placeholder, empty states */
--b1:        rgba(255,255,255,0.11) /* Borders — cards, inputs */
--b2:        rgba(255,255,255,0.06) /* Borders — subtle dividers */

--r:  4px   /* Card border radius */
--r2: 3px   /* Input/button border radius */
--sp: 28px  /* Screen horizontal padding */
```

---

## Typography

**Font:** Barlow (body) + Barlow Condensed (numbers/display)
**Import:** Google Fonts — weights 400, 500, 600, 700, 800 for Barlow; 600, 700, 800 for Barlow Condensed

| Use | Size | Weight | Transform | Color |
|-----|------|--------|-----------|-------|
| Nav section label | 8px | 700 | UPPERCASE + 2px spacing | `--t4` |
| Nav item label | 11px | 600 | UPPERCASE + 0.3px spacing | `--t2` / `--w` active |
| Topbar title | 12px | 800 | UPPERCASE + 2px spacing | `--w` |
| Card title | 9px | 700 | UPPERCASE + 2.5px spacing | `--t3` |
| Field label | 9px | 700 | UPPERCASE + 2px spacing | `--t3` |
| Section heading (.sh) | 9px | 700 | UPPERCASE + 2.5px spacing | `--t3` |
| Button text | 11px | 800 | UPPERCASE + 1.5px spacing | — |
| Badge text | 9px | 800 | UPPERCASE + 1.5px spacing | — |
| Table header | 9px | 700 | UPPERCASE + 2px spacing | `--t3` |
| Table cell | 12px | 400 | — | `--t2` |
| Body / form input | 13px | 400 | — | `--w` |
| Calc value (big number) | 22px | 600 | — | Barlow Condensed |
| Metric card number | 34px | 600 | — | Barlow Condensed |
| Shift result number | 56px | 600 | — | Barlow Condensed |

---

## Layout Structure

```
App Shell: flex row, 100vh, overflow hidden

├── Sidebar: 220px, collapsed 52px, transition 0.2s
│   ├── Logo area: 52px height, full logo / icon when collapsed
│   ├── Nav: scrollable, section labels + icon + label items
│   └── Footer: period info, Settings btn, Sign Out btn

└── Main: flex column, flex:1
    ├── Topbar: 50px height, toggle button + title + sub + actions
    └── Content: scrollable, padding 24px 28px 56px, max-width 980px
```

---

## Sidebar Rules

- **Always-visible icons** — SVG icons at all times (not dots)
- **Active state:** `background: #0d1e2e` — no left border, no gold bar
- **Hover state:** `background: rgba(255,255,255,0.05)`
- **Collapsed:** icons stay in same horizontal position, labels slide out, section labels hide, logo swaps to icon
- **Icon color:** `--t3` default, `--t1` on hover, `--gold` when active
- **Footer buttons:** icon + label text, icon-only when collapsed

---

## Card System

```css
.card {
  background: var(--surface);
  border: 1px solid var(--b1);
  border-radius: 4px;
  padding: 20px;
  margin-bottom: 16px;
}
.card-title {
  font-size: 9px; font-weight: 700;
  letter-spacing: 2.5px; text-transform: uppercase;
  color: var(--t3);
  margin-bottom: 16px; padding-bottom: 10px;
  border-bottom: 1px solid var(--b2);
}
```

**No info-bar instruction boxes anywhere.** All instructions live in tooltips or Help & FAQ.

---

## Form System

**Core rule:** Every field wrapper (`.f`) gets an explicit pixel width and `flex-shrink:0`. Form rows always use `gap:16px`. The `.fw` dollar/percent wrapper gets `width:100%`. Inputs inside `.f` get `width:100%`.

```css
.form-row { display:flex; align-items:flex-end; gap:16px; flex-wrap:wrap; margin-bottom:16px; }
.f        { display:flex; flex-direction:column; gap:5px; }
.fw       { position:relative; display:flex; align-items:center; width:100%; }
```

**Input style:** `background: var(--input)`, `border: 1px solid var(--b1)`, `border-radius: 3px`, `color: white`, `font-size: 13px`, `padding: 8px 10px`. Focus state: `border-color: var(--gold)`. All inputs must have `color-scheme: dark` to prevent white browser overrides.

**Field widths (use inline style, not CSS classes):**
- Date field: 150px
- Tiny (shift, xs): 72px
- Small number: 90–120px
- Dollar/percent field: 110–130px
- Medium text: 160–170px
- Large text: 200–230px
- Dropdown (product select): 200–220px

**Dollar/percent wrappers:**
- Dollar: `<div class="fw"><span class="pre">$</span><input class="pre" type="number"/></div>`
- Percent: `<div class="fw"><input class="suf" type="number"/><span class="suf">%</span></div>`

---

## Tooltip System

Every numeric input field label gets a `?` tooltip icon. No exceptions.

```javascript
function tt(id) {
  return '<span class="tt" data-tt="' + id + '">?</span>';
}
```

Tooltip icon: 14px circle, border `rgba(255,255,255,0.2)`, gold on hover.
Tooltip box: dark `#0d1c2c` background, gold title, positioned dynamically.

All tooltip definitions live in `app.js` → `TT.defs`.

---

## Buttons

```css
.btn-primary { background: #C9A84C; color: white; }
.btn-ghost   { background: transparent; border: 1px solid var(--b1); color: var(--t2); }
.btn-danger  { background: transparent; border: 1px solid rgba(192,56,40,0.4); color: var(--red); }

/* Sizes */
.btn-sm  { padding: 5px 12px; font-size: 10px; }
default  { padding: 8px 18px; font-size: 11px; }
.btn-lg  { padding: 10px 24px; font-size: 12px; }
```

Button text is always UPPERCASE, 800 weight, 1.5px letter spacing.

---

## Calc Panel

Live calculation results below forms. Dark background, horizontal layout.

```css
.calc { background: var(--input); border: 1px solid var(--b2); border-radius: 4px;
        padding: 14px 18px; display:flex; gap:28px; align-items:center; flex-wrap:wrap; }
.calc-val { font-family: 'Barlow Condensed'; font-size: 22px; font-weight: 600; }
.calc-val.good { color: var(--gold); }
.calc-val.warn { color: var(--red); }
.calc-val.dim  { color: var(--t3); }
```

---

## Metric Cards (Dashboard Top Row)

4-column grid. Center aligned. Big number is:
- **White** when on-target
- **Red** when over-target
- Supporting text (target, trend, impact $) stays gold/t3

```css
.metric-val.on-target  { color: var(--w); }
.metric-val.over-target { color: var(--red); }
```

---

## Tables

```css
.tbl-wrap { background:var(--surface); border:1px solid var(--b1); border-radius:4px; overflow:hidden; }
.tbl th   { 9px, 700, UPPERCASE, 2px spacing, var(--t3); padding: 9px 12px; }
.tbl td   { 12px, var(--t2); padding: 10px 12px; border-bottom: 1px solid var(--b2); }
```

Row hover: `background: rgba(255,255,255,0.05)`.
Value emphasis class `.val`: `color: white`.
Positive/on-target class `.pos`: `color: var(--gold)`.
Negative/over-target class `.neg`: `color: var(--red)`.

---

## Badges

```css
.badge-ok   { background: rgba(201,168,76,0.10);  color: var(--gold); }
.badge-warn { background: rgba(192,56,40,0.13);   color: var(--red);  }
.badge-dim  { background: rgba(255,255,255,0.06); color: var(--t3);   }
```

Always: 9px, 800 weight, UPPERCASE, 1.5px letter spacing, 3–8px padding.

---

## Dashboard Chart

SVG line chart, 800×220px viewBox, padding {t:28, r:60, b:40, l:48}.

- **Bar Pour Cost:** Gold (#C9A84C), 2.5px stroke, smooth bezier curves, gradient area fill underneath, open circle dots with dark fill + gold ring, value labels above each dot
- **Food Cost:** White at 40% opacity, 1.5px stroke, smooth bezier
- **Prime Cost:** White at 18% opacity, 1.5px stroke, smooth bezier
- **Target line:** Gold dashed (5,5), 35% opacity, "TGT" label on right
- **Grid lines:** White 6% opacity horizontal only
- **X labels:** 10px, Barlow, white 30%

Gradient: `linearGradient` from gold 18% opacity at top to 1% at bottom.

---

## Color Semantics

| Situation | Color |
|-----------|-------|
| On target / good / positive savings | Gold `#C9A84C` |
| Over target / bad / losing money | Red `#C03828` |
| Big metric number, on-target | White `#ffffff` |
| Big metric number, over-target | Red |
| Neutral data values | `--t2` (58% white-blue) |
| Labels and headings | `--t3` (30% white) |
| Empty/placeholder | `--t4` (16% white) |

**Cash Reconciliation over/short:**
- Within tolerance → Gold (OK)
- Over (more cash than expected) → Neutral (dim)
- Short (less cash than expected) → Red

---

## Writing Voice and Copy Rules

All written copy in the app uses one voice. This applies everywhere: screen
text, fix processes, help and FAQ content, tooltips, field labels, alerts,
button text, empty states, audit narratives, and the Claude API audit prompts
in `server/index.js`. No exceptions.

### The voice anchor

The voice is a 30-year bar and restaurant operator veteran talking to a fellow
operator. The three Fix System PDFs in `fix-system-files/` are the canonical
reference. When in doubt about how a sentence should sound, open one of those
documents and read the nearest topic. Match the tone, register, and sentence
construction.

The app uses the same voice as the PDFs but compressed. The PDFs use
storytelling, operator anecdotes, and on-ramps to make a long-form document
readable. The app strips all of that out. Every line is action-only: name the
gap, show the dollar, prescribe the fix.

### The voice in eight characteristics

1. **Specific over vague.** Numbers, names, mechanisms. "$0.27 per drink, 250
   drinks a night, 300 nights a year, $20,250 a year." Never "a significant
   amount" or "meaningful savings."
2. **System over person.** Blame the missing standard, the absent system, the
   broken process. Never the bartender, server, or manager. "The problem is
   not the bartender. The problem is a system that lets accuracy depend on
   attention during the busiest hour of the night."
3. **Mechanism named.** Tell the operator exactly what is happening, in their
   vocabulary. "Free-pour drift," "comp without sign-off," "NAP inconsistent
   across directories." Not "operational gap" or "policy challenge."
4. **Math shown.** When the answer is a calculation, walk it. "0.3-ounce
   overage at $0.90/oz = $0.27/drink x 250 drinks x 300 nights = $20,250/yr."
5. **Refusal of softening.** "Not optional. Not temporary." / "The jigger
   costs $4. The policy costs an uncomfortable conversation." No "could,"
   "might," "consider," "potentially," "best practice."
6. **Insider register.** Trust the reader to know operator terms: the rail,
   in the weeds, well/call/premium, BTG, the 3-pack, NAP, RPLH, plowhorse,
   the floor. Do not over-define.
7. **Compassion for the operator.** Always. "The owner was not incompetent,
   he was busy running a bar." Never condescend, never imply they should
   have already known.
8. **Declarative force.** Short sentences stacked. "Gone. Every year." /
   "Variance is not a rounding error. Variance is a dollar amount with a
   cause." Patterns like "Not X. Not Y. Just Z." earn force through
   repetition.

### Screen-length compression rule

The PDFs run long because they are documents. App copy is the same voice in
1/5 the words. The compression formula:

- **Tooltip:** one declarative sentence + one specific example.
- **Help answer:** 2-4 sentences, each one earns its place.
- **Fix process step:** one sentence, one action, one number if available.
- **Audit narrative:** one sentence per S{n}_NARRATIVE/FINDING/TOOL field.
- **Empty state:** one sentence telling the operator what is missing and what
  to do.

**Compression example.** Full PDF passage (~95 words):

> "Social media gives you reach. Email gives you access. Reach means your
> content might appear in someone's feed if the algorithm decides to show it
> and if the person is scrolling at that moment. Access means you land
> directly in someone's inbox with their permission, at a time of your
> choosing. One of those things drives 41 covers on a Tuesday. The other one
> drives 84 likes."

Screen version (~24 words):

> Reach hopes the algorithm shows your post. Access lands in the inbox on your
> schedule. One filled 41 seats Tuesday. The other got 84 likes.

Voice held, fluff cut.

### Banned words and phrases

**Hard rules** (apply everywhere, no exceptions):
- No emdashes. No en-dashes used as punctuation. No double hyphens used as a dash.
- Where a sentence needs a break, use a period, comma, or restructure.
- Second person. "You," "your bar." Plain declarative sentences.
- No congratulatory tone, no motivational filler. Say the thing.

**Banned: AI-corporate words.** Replace with the right operator word.

leverage, optimize, ecosystem, actionable, holistic, framework, methodology,
paradigm, drive [growth/engagement/revenue], unlock, empower, delight,
streamline, scalable, mission-critical, best-in-class, world-class, going
forward, at the end of the day, granular, stakeholder, synergy, touchpoint,
circle back, deep dive, double-click, level-set, move the needle, low-hanging
fruit, north star, rockstar, ninja, pivot (as verb), iterate (in prose),
operationalize, solutioning, ideate.

**Banned: AI-prose flourishes.** Words you only see in machine-written text or
boutique marketing. Restaurants do not need to call themselves authentic.

delve, tapestry, symphony, culinary (when excessive for ordinary food), haven,
gem, unparalleled, unwind, embark, journey, immersive, authentic (as
self-description), gastronomic, vibrant, elevate, testament, going beyond,
cannot be overstated, seamless, beacon, masterpiece, captivating, ever-evolving,
curated, robust, redefine, exquisite, signature (as marketing on every menu
item), warm corner, landscape (figurative), intersection (figurative), array
(figurative), intricate, craft (as generic descriptor), wholesome.

**Banned: hedging and softening.** The operator voice does not hedge.

a meaningful, significant, substantial, potentially, may help, could help,
consider (as a soft suggestion), we recommend, best practices, industry-leading.

### Context exceptions

Words on the banned list are sometimes the right operator word in context. The
allowed exceptions:

- **"Craft" and "signature" as drink-category labels.** "Craft cocktail,"
  "signature cocktail" in a menu or POS context are the operator's terms for
  the category. Allowed.
- **"Touch point" as a named upsell-sequence stage.** "Every server upsell
  touch point" reads operator in a coaching context. Allowed when it names a
  specific stage. Banned in marketing-register sentences ("every customer
  touchpoint matters"), and never as one word.
- **"Unlock" only in literal physical-key context.** "Unlock the door at open"
  is fine. Product-gating "submit X to unlock Y" is banned; rewrite as "with X
  attached, the audit produces Y."
- **"Framework" is banned even as a mechanism name.** Rename "four-sentence
  framework" to "four-sentence pattern" or "four-sentence template." Rename
  "3-1-1 framework" to "3-1-1 mix." Rename "coaching framework" to "coaching
  routine." Apply the new term consistently wherever the old one appears.

### Positive patterns to use

- **"Not X. Not Y. Just Z."** for cause attribution. "Not stolen. Not fraud.
  Just never counted."
- **Specific dollar over vague impact.** Always. Compute when you can.
- **Mechanism + math + fix** in that order, when the line has room.
- **"The X costs Y. The Z costs an uncomfortable conversation."** for naming
  what the fix actually requires.
- **Short force endings.** "Gone. Every year." / "Run the math."
- **Verb-first imperatives.** "Pull the report." "Drop the QR card." "Run a
  spec-check every shift."

### Where this applies

Every user-visible string the operator can read. Tooltips, help, fix layer,
audit narratives, empty states, button labels, alert text, field labels, modal
text, and the Claude API audit prompts in `server/index.js`. Any code chat
building or editing a screen reads this section first.

---

## Navigation — Screen Patterns

Every screen follows this structure:
1. Topbar: page title (800 weight, UPPERCASE) + optional subtitle in `--t3`
2. Optional top-right action buttons (Add, Export, Upload, Save)
3. Screen content in `.screen` div with `max-width: 980px`
4. No floating instruction text anywhere on the page
5. All guidance in `?` tooltip icons on field labels

---

## Data Architecture

```javascript
App.data = {
  settings: {
    bar_name, city_state,
    annual_bar_revenue, annual_food_revenue,
    targets: { bar_pour_cost_pct:22, food_cost_pct:32,
               bar_labor_cost_pct:28, food_labor_cost_pct:30, prime_cost_pct:60 },
    cash_tolerance: 10,
    onboarding_complete: false
  },
  bar_products: [],    // { id, name, category, vendor, bottle_size_oz, std_pour_oz,
                       //   cost_per_unit, menu_price, pours_per_bottle, cost_per_pour,
                       //   pour_cost_pct }
  kitchen_products: [], // { id, name, category, vendor, unit, cost_per_unit }
  recipes: [],         // { id, name, mode, category, menu_price, target_cost_pct,
                       //   ingredients, total_cost, cost_per_serving, cost_pct,
                       //   flagged, batch_yield, serving_size, plate_yield }
  weeks: [],           // { id, week_num, period_end, bar:{revenue,cogs,labor,cost_pct,
                       //   labor_pct}, food:{...}, prime_cost_pct, bar_count,
                       //   bar_variance, food_count }
  shifts: [],          // { id, date, shift, bartender, revenue, cogs, pour_cost_pct,
                       //   variance_dollar, status }
  reconciliations: [], // { id, date, shift, cashier, expected_cash, counted_cash,
                       //   over_short, tolerance, status }
  theft_scores: [],    // { id, date, scores, total, rating }
  vendor_log: [],      // { id, date, product_id, old_price, new_price, annual_impact }
  audits: []           // { id, bar_name, overall_score, sections, action_items, ... }
}
```

---

## Key Calculation Rules

| Metric | Formula |
|--------|---------|
| Bar Pour Cost % | `bar_cogs / bar_revenue × 100` (COGS only, no labor) |
| Bar Labor % | `bar_labor / bar_revenue × 100` |
| Food Cost % | `food_cogs / food_revenue × 100` (COGS only) |
| Prime Cost % | `(bar_cogs + food_cogs + bar_labor + food_labor) / (bar_rev + food_rev) × 100` |
| Pours Per Bottle | `bottle_oz / std_pour_oz` |
| Cost Per Pour | `unit_cost / pours_per_bottle` |
| Pour Cost % | `cost_per_pour / menu_price × 100` |
| Variance Pours | `actual_pours_made − pos_pours_sold` (both in same unit) |
| Actual Pours Made | `bottles_used × pours_per_bottle` |
| Variance $ | `variance_pours × cost_per_pour` |
| Annual Impact | `cost_change_per_unit × weekly_usage × 52` |
| Cash Over/Short | `counted_cash − expected_cash_from_pos` |
| Recipe Cost % | `cost_per_serving / menu_price × 100` |
| Batch Cost/Serving | `total_ingredient_cost / (yield_oz / serving_size_oz)` |

---

## File Structure

```
project/
├── server/index.js          — Express, serves public/, port 3000
├── public/
│   ├── index.html           — App shell, auth, sidebar (all nav items inline)
│   ├── style.css            — Complete design system CSS
│   ├── app.js               — Router, tooltip engine, auth, App object, all TT.defs
│   ├── db.js                — Supabase + localStorage data layer, _mergeDefaults()
│   ├── assets/
│   │   ├── logo.png         — Full horizontal logo
│   │   ├── bar-graph-icon.png — Collapsed sidebar icon
│   │   └── resources/       — All downloadable PDFs and Word docs
│   ├── components/
│   │   └── onboarding.js    — 2-step setup (bar info → targets → dashboard)
│   └── screens/             — One file per screen, all registered in S namespace
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
│       ├── settings.js
│       ├── help.js
│       ├── audit-tracker.js
│       └── resources.js
└── package.json
```

---

## Global JavaScript Conventions

```javascript
const S = {};                          // Screen namespace — populated by screen files
S.ScreenName = { render(container, actions) { ... } }

App.data                               // All user data
App.navigate(screenId)                 // Route to screen
App.save()                             // Save all data
App.saveKey(key)                       // Save one top-level key
App.fmtCurrency(n)                     // $1,234 format
App.fmtPct(n, decimals=1)              // 22.4% format — null → '—', 0 → '0.0%'
App.uid()                              // Unique ID generator

tt(id)                                 // Returns tooltip HTML span
esc(s)                                 // HTML escape string
```

Screen files load AFTER `<script>const S = {};</script>` in index.html.
app.js loads last.

---

## Running Locally

```bash
npm install
npm start
# → http://localhost:3000
```

No Supabase config = localStorage mode, skips auth, straight to onboarding.

---

## Deployment Targets

- **Web:** Vercel (Node/Express)
- **Backend:** Supabase (auth + postgres)
- **API calls:** Claude API for Audit Tracker PDF parsing (backend proxy required in production)

