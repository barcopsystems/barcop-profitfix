'use strict';

/* ── Profit Recovery — Sales Integrity (per-server loss-pattern review) ────────
   The deep theft read Loss Prevention can't do off captured events alone. The
   operator drops a POS per-server sales report; Bar Cop benchmarks every server
   against the floor and flags the ones whose numbers don't add up: no-sale
   drawer opens, void abuse, abnormal cash mix, low average check, comps, refunds.

   HONESTY: this catches the REGISTER/CASH half of theft (what shows in the sales
   data). The PRODUCT half (overpouring, free pours, bottle theft) never reaches a
   sales report and is caught by pour cost + inventory variance + spot checks. The
   report flags PATTERNS to investigate with a dollar exposure, never a verdict; a
   flag opens a Loss Prevention investigation. One outlier is noise, two-plus
   stacking is a pattern, so a server flags on a composite, not a single signal. */

S.SalesIntegrity = {
  editId: null,
  _draft: null,

  // ── CSV mapping. Server is the only hard requirement; every other column is
  //    optional and its signal is computed only when the column is present. ──
  /* ⚠⚠ THESE TWELVE ARRAYS WERE HAND-ROLLED, AND THAT IS THE WHOLE ROOT CAUSE OF THIS BLOCK.
     `PosIngest.FIELDS` already carried a far richer vocabulary for every one of these concepts, and
     it binds CORRECTLY on the very files this door got wrong (Clover "Total", Square "Amount",
     Toast "Revenue", "Total Hours"). Twelve mis-bindings, every one verified by running the real
     `_autoMap` on a real named export. The worst, in order:
       · `cash`/`card` took the TIP columns on any cash-out report (TouchBistro, Toast, SpotOn,
         Micros). `cash_ratio` then measures a TIP mix, so a bartender DECLARING HER CASH TIPS
         HONESTLY was printed as High Risk / Cash Skimming. Same shape as the "Tips Declared" bound
         to Expected Cash burn;
       · `net_sales` took the leftmost header merely containing "sales" — Aloha SVR gave "Charge
         Sales" (every server understated by the whole cash half), Revel/Lightspeed gave "Sales Tax"
         (every ratio ~10x);
       · COUNT columns landed in DOLLAR fields: "Refund Count" as refund dollars (0.074% against a
         true 35.8%), "Discount Count" / "Comp Count" as comp dollars, "No Sale Amount" as an OPEN
         COUNT (the card printed "640 per shift" for a $1,920 total);
       · `date` knew only "business date", so Heartland's "Service Date" and Aloha's "Transaction
         Date" left it UNMAPPED — and with no date BOTH capture signals go dark ($361 of exposure
         printed as $0);
       · `hours` took "Regular Hours" over "Total Hours", overstating sales-per-hour by 45%.

     ⚠ TWO RULES HOLD THIS TOGETHER, AND BOTH ARE ABOUT ORDER:
     1. A `match` array is a PRIORITY LIST — precise term first, bare synonym last.
     2. **FIELD ORDER IS ALSO PRIORITY**, because `_autoMap` walks the fields in this order and a
        claimed column is taken. So every COUNT field is declared immediately BEFORE its DOLLAR
        twin, which is what already stopped `voids` eating "Void Count", and `net_sales` is declared
        LAST because it is the most generic — the specific sales columns get first refusal.
     `comp_count` and `refund_count` are new and deliberately unread, exactly as `void_count` has
     always been: they exist so a count column can never be mistaken for money. */
  FIELDS: [
    { key: 'server',       label: 'Server / Employee', required: true,  match: ['server name', 'server', 'employee name', 'employee', 'team member name', 'team member', 'staff name', 'staff', 'bartender', 'cashier', 'waiter', 'sales rep', 'attendant', 'name'] },
    { key: 'date',         label: 'Date',              required: false, match: ['business date', 'service date', 'transaction date', 'trans date', 'sales date', 'shift date', 'business day', 'date of business', 'date of sale', 'date', 'day'] },
    /* ⚠⚠ EVERY TENDER SPELLING IS ENUMERATED, because the bare words cannot hunt. `cash`, `card`,
       `credit`, `charge` and `credit card` are EXACT_ONLY in the shared mapper (they were reading
       TIP columns as the sales split, which printed an honest bartender as Cash Skimming). That is
       the right call, but it means every real header has to be named here or it binds NOTHING and
       the cash-mix signal goes dark in silence — `bothSides` needs both halves, so losing either
       one kills the whole signal. Measured losses that this list exists to prevent: NCR Silver
       "Cash Tendered"/"Credit Tendered", Positouch "Cash Tender"/"Credit Tender", Shift4 "Cash
       Amount"/"Credit Amount", Restaurant Manager "Cash Received"/"Credit Received", Focus POS
       "Credit Payments". On a Positouch file a 90%-cash server went from flagged to CLEAN. */
    { key: 'cash_sales',   label: 'Cash Sales',        required: false, match: ['cash sales', 'cash payments', 'cash payment', 'cash tendered', 'cash tenders', 'cash tender', 'cash received', 'cash amount', 'cash collected', 'cash total', 'total cash', 'net cash amount', 'net cash', 'cash revenue', 'cash'] },
    /* ⚠ THE "NON-CASH" SPELLINGS ARE LISTED HERE ON PURPOSE, and they have to win in PASS 1. A
       word-boundary match treats the hyphen as a separator, so `cash amount` reached inside
       "Non-Cash Amount" and the CARD half of the tender split booked as CASH — `cash_ratio` then
       read ~100% cash and printed a card-heavy server as Cash Skimming. Pass 1 runs across every
       field before pass 2 runs for any, so an exact match here beats that fuzzy reach outright. */
    /* ⚠⚠ THE "NON-CASH" HALF WAS ENUMERATED FOR FOUR NOUNS AND `cash_sales` CARRIES NINE. Every
       spelling listed on cash_sales but missing here is a column that binds the CASH field and
       leaves the CARD field unmapped — and losing either half kills `cash_ratio` outright, because
       `bothSides` needs both. Measured on the real Micros/Simphony per-server row
       (`... | Cash Tenders | Non-Cash Tenders | Charged Tips | Cash Tips`): cash bound correctly and
       **card_sales came back UNMAPPED**, so the mix fell to the single-column fallback — which is
       refused whenever the cash column exceeds net sales, and a tender column carrying tax and tip
       exceeds net sales exactly for the HIGH-CASH server the signal exists to catch. Same on
       "Non-Cash Tendered" and "Non-Cash Payments". This is the "90%-cash server went from flagged to
       CLEAN" failure, still live for the tender and payment nouns after the sales/amount/total ones
       were fixed. The two lists have to enumerate the SAME nouns or the split silently loses a side. */
    { key: 'card_sales',   label: 'Card Sales',        required: false, match: ['card sales', 'credit sales', 'card payments', 'card payment', 'credit payments', 'credit payment', 'credit card sales', 'credit card total', 'credit card amount', 'credit card tendered', 'credit card tender', 'credit tendered', 'credit tenders', 'credit tender', 'card tendered', 'card tender', 'credit received', 'card received', 'credit amount', 'card amount', 'card total', 'credit total', 'total credit', 'net credit amount', 'net credit', 'net card amount', 'net card', 'charge sales', 'charge amount', 'charge total', 'non-cash sales', 'non cash sales', 'non-cash amount', 'non cash amount', 'non-cash total', 'non cash total', 'non-cash tenders', 'non cash tenders', 'non-cash tender', 'non cash tender', 'non-cash tendered', 'non cash tendered', 'non-cash payments', 'non cash payments', 'non-cash payment', 'non cash payment', 'non-cash received', 'non cash received', 'non-cash collected', 'non cash collected', 'non-cash revenue', 'non cash revenue', 'non-cash', 'non cash', 'credit/debit', 'credit card', 'card', 'credit', 'charge'] },
    { key: 'void_count',   label: 'Void Count',        required: false, notMoney: true, match: ['void count', 'voids count', '# voids', 'number of voids', 'voided checks', 'checks voided', 'void qty'] },
    { key: 'voids',        label: 'Void $',            required: false, match: ['void amount', 'void total', 'void $', 'voided amount', 'voided total', 'void sales', 'voids', 'void'] },
    { key: 'comp_count',   label: 'Comp Count',        required: false, notMoney: true, match: ['comp count', 'comps count', '# comps', 'number of comps', 'discount count', 'discounts count', '# discounts', 'promo count'] },
    { key: 'comps',        label: 'Comp / Discount $', required: false, match: ['comp amount', 'comp total', 'comp $', 'discount amount', 'discount total', 'discounts & comps', 'discounts and comps', 'promo amount', 'comps', 'discounts', 'comp', 'discount', 'promo'] },
    { key: 'refund_count', label: 'Refund Count',      required: false, notMoney: true, match: ['refund count', 'refunds count', '# refunds', 'number of refunds', 'return count', 'returns count'] },
    { key: 'refunds',      label: 'Refund $',          required: false, match: ['refund amount', 'refund total', 'refund $', 'return amount', 'return total', 'refunds', 'returns', 'refund'] },
    // ⚠ `no sale opens` unhyphenated is THIS DOOR'S OWN LABEL minus one character, and `no sale`
    // is EXACT_ONLY, so without it the app's own export shape bound nothing and a weight-3 strong
    // signal vanished silently. Same failure shape as the `Pay ($/hr)` case.
    /* ⚠⚠ SEALING `no-sale`/`no sales`/`nosale` IN EXACT_ONLY CLOSED TWO WRONG BINDINGS AND TOOK NINE
       RIGHT ONES WITH IT — the guard-in-one-direction failure, one round after writing the rule down.
       Measured: `NoSale Count`, `NoSale Opens`, `NoSale Qty`, `No-Sale Qty`, `No Sales Qty`,
       `No-Sale #`, `# No-Sale`, `No Sales #` and `NoSale #` all bound NOTHING, because the bare
       tokens can no longer hunt and none of those spellings was an explicit candidate. Cost, end to
       end on the classic drawer-skim profile: the column goes unmapped, and a weight-3 `strong`
       signal with a solo escalation simply is not there — **High Risk becomes clean and the card
       prints "No servers flagged"**.
       ⭐ The round-2 rule says it exactly: a candidate added to restore a lost EXACT header belongs
       in EXACT_ONLY. Every spelling below is unambiguously a COUNT (`count`/`opens`/`qty`/`#`), so
       each is named explicitly rather than left to a bare token's reach. `void_count` already had
       both `# voids` and `void qty`; this list had `# no sales` alone, which is why the asymmetry
       went unnoticed. */
    { key: 'no_sales',     label: 'No-Sale Opens',     required: false, notMoney: true, match: ['no sale count', 'no sales count', 'no-sale count', 'nosale count', '# no sales', '# no-sale', '# nosale', 'no sales #', 'no-sale #', 'nosale #', 'number of no sales', 'no sale opens', 'no-sale opens', 'no sales opens', 'nosale opens', 'no sale qty', 'no-sale qty', 'no sales qty', 'nosale qty', 'drawer opens', 'no sale', 'no-sale', 'no sales', 'nosale'] },
    { key: 'checks',       label: 'Checks',            required: false, notMoney: true, match: ['check count', 'closed checks', 'guest checks', '# of checks', 'chks', 'checks', 'ticket count', 'tickets', 'order count', 'number of orders', 'orders', 'transaction count', 'transactions', 'tabs'] },
    { key: 'hours',        label: 'Labor Hours',       required: false, match: ['total hours', 'labor hours', 'hours worked', 'total hrs', 'hrs worked', 'paid hours', 'net hours', 'hours', 'hrs', 'worked'] },
    // ⚠ `sales amount` / `sales $` / `sales value` are explicit for the same reason: bare `sales` is
    // EXACT_ONLY, so a Restaurant Manager cashout headed "Sales Amount" bound NOTHING — and with
    // `a.sales` at 0, `realSales` is false and void %, comp %, average check, refund % and sales
    // per hour ALL go null at once. One missing candidate takes out five signals.
    { key: 'net_sales',    label: 'Net Sales',         required: false, match: ['net sales', 'net sales amount', 'net total', 'net revenue', 'sales total', 'total sales', 'sales amount', 'sales value', 'sales $', 'server sales', 'rung sales', 'gross sales', 'revenue', 'net', 'sales', 'total', 'amount'] }
  ],

  // Signal config. dir: how an outlier reads (high = more is worse, low = less is
  // worse, both = either extreme). weight feeds the composite; strong = a top tell
  // worth extra. cat groups the flag in the report. dollarKey present = a real $
  // exposure can be computed (no fabricated dollars on behavioral-only signals).
  /* ⚠ `solo` — THE ONE WAY A SINGLE SIGNAL CAN NAME SOMEBODY, and it is deliberately narrow.
     The two-signal rule below exists because ONE outlier is usually noise, and it is right about the
     case it was written for: a low average check alone is a patio station or a lunch shift, not a
     thief. But it had no ceiling, so a server comping NINETY PERCENT of their own sales also read
     clean — no card, no PDF line, and their computed exposure discarded. That is not noise.
     Only signals where being far above the floor is unambiguously bad AND the magnitude is real
     money are eligible, which is why this list is four entries and not nine:
       · `dir:'low'` signals are EXCLUDED — a low check average is the documented noise case, and
         re-admitting it here would reopen the exact bug the two-signal rule was added to fix;
       · `cash_ratio` (`dir:'both'`) is EXCLUDED — a cash-heavy station is ambiguous by nature;
       · the CAPTURE signals are EXCLUDED — a bartender who runs short a few times is a training
         problem, and "one short plus one walked tab printed High Risk" is already a bug this file
         has fixed once. Two of them together still flags; one alone should not.
     `ratio` is 5x the team average, not the 2x a normal flag needs, and `minShare`/`minCount` is the
     materiality: it has to be a real chunk of that server's OWN sales, so the rule cannot fire off a
     tiny floor. ⚠ A solo escalation is capped at WATCH and can never reach High Risk — one signal is
     a lead worth a look, never a pattern Bar Cop asserts. */
  SIGNALS: [
    { key: 'no_sales',    label: 'No-sale drawer opens',     cat: 'register', dir: 'high', weight: 3, strong: true, solo: { ratio: 5, minCount: 10 } },
    { key: 'void_pct',    label: 'Void rate',                cat: 'register', dir: 'high', weight: 3, strong: true, dollar: 'voids',   solo: { ratio: 5, minShare: 0.10 } },
    { key: 'avg_check',   label: 'Average check',            cat: 'pricing',  dir: 'low',  weight: 2 },
    { key: 'comp_pct',    label: 'Comps and discounts',      cat: 'pricing',  dir: 'high', weight: 2, dollar: 'comps',   solo: { ratio: 5, minShare: 0.10 } },
    { key: 'cash_ratio',  label: 'Cash mix',                 cat: 'cash',     dir: 'both', weight: 2 },
    { key: 'refund_pct',  label: 'Refunds',                  cat: 'cash',     dir: 'high', weight: 2, dollar: 'refunds', solo: { ratio: 5, minShare: 0.10 } },
    /* `twin` names the signal this one is a SECOND READING OF, not a weaker version of. Sales per
       labour hour and average check are both sales over a divisor, so when BOTH fire they are one
       fact counted twice and must not satisfy the two-signal rule between them. Against any OTHER
       signal it is an independent reading and counts normally. */
    { key: 'sales_per_hr',label: 'Sales per labor hour',     cat: 'register', dir: 'low',  weight: 1, soft: true, twin: 'avg_check' },
    { key: 'drawer_short',label: 'Drawer shorts',            cat: 'cash',     dir: 'high', weight: 3, strong: true, dollar: 'short', capture: true },
    { key: 'walkouts',    label: 'Walkouts',                 cat: 'cash',     dir: 'high', weight: 2, dollar: 'walkout', capture: true }
  ],
  CATS: [
    { key: 'register', label: 'Register Manipulation' },
    { key: 'cash',     label: 'Cash Skimming' },
    { key: 'pricing',  label: 'Under-Ringing and Pricing' }
  ],
  /* ⭐⭐ THE BAR A SIGNAL HAS TO CLEAR, AS A MULTIPLE OF THE PEER AVERAGE (everyone ELSE's mean).
     ⛔ WHY THESE ARE NOT 2 / 1.5 / 0.6, AND IT IS THE WHOLE POINT: the test used to compare against
     the WHOLE-TEAM mean, which INCLUDES the accused. Solve that and the bar it really imposes is
     `k(n-1)/(n-k)` times the peer average — a HIDDEN FUNCTION OF CREW SIZE that nobody chose:

         n  |  dir:high   |  capture  |  dir:low        (n = servers who reported THAT column)
        ----+-------------+-----------+----------
         2  | IMPOSSIBLE  |   3.000   |   0.429
         3  |    4.000    |   2.000   |   0.500
         6  |    2.500    |   1.667   |   0.556
        10  |    2.250    |   1.588   |   0.574
        50  |    2.042    |   1.515   |   0.595

     So a four-server bar was held to 3x while a twenty-server bar was held to 2.1x, and every
     comment and help line in this file said "twice the team average" — true only in the limit. At
     n=2 the high test is not merely strict, it is UNSATISFIABLE (`v > 2v` needs a negative peer),
     which is why a 6%-void skim against a 0.5% floor printed the green all-clear the moment its
     peers left the cell blank.
     The multipliers below are the effective values at **n=6** — the seeded crew, and a typical
     independent bar's shift report — so a six-server bar behaves exactly as it did, crews of 3-5
     become testable instead of near-impossible, and crews of 8+ get slightly STRICTER, which is the
     safe direction on a screen that prints a person's name. The bar is now a stated constant rather
     than an artefact of how many colleagues happened to fill in a cell.

     ⚠⚠ AND THIS APPLIES ONLY TO `dir:'high'` AND THE CAPTURE SIGNALS — A DELIBERATE ASYMMETRY,
     MEASURED, NOT AN OVERSIGHT. My first version moved `dir:'low'` and `dir:'both'` across too, and
     a pin caught it immediately: leave-one-out AMPLIFIES a deviation by `n/(n-1)`, so on a
     four-person crew one bartender at 70% cash pulled the peer mean to 33% and handed **all three
     honest servers at 15% a "Cash mix — runs low" flag** they did not have. That is verbatim the
     harm the duplicate-name pin exists to catch, arriving from a new direction, and it matters even
     though a lone cash-mix flag names nobody: it adds weight, and a phantom second signal is exactly
     how the two-flag rule gets satisfied by accident.
     For `low` and `both` the whole-team mean is CONSERVATIVE — including the accused pulls the mean
     toward them, which shrinks the gap and makes the flag harder to earn. Conservative is fine.
     For `high` it was conservative too, right up to the point where it became UNSATISFIABLE, and
     "impossible" reads on screen as "clean". Fix what was broken; leave what was merely strict. */
  RATIO_HIGH: 2.5,
  RATIO_CAPTURE: 1.667,
  MIN_CHECKS: 8,   // a server below this is "not enough data", not scored
  // When the export carries no Checks column there is nothing to count, so fall back
  // to volume: a server under this share of the median server's sales worked a
  // partial shift or is support (barback, host), not a server to benchmark against
  // the floor. Relative, so it holds on a $400 night and a $40,000 one.
  MIN_SALES_SHARE: 0.25,
  MIN_TEAM: 3,     // no floor to stand out from below this many scored servers

  /* ⚠ "NOTHING FLAGGED" AND "NOTHING COULD BE FLAGGED" ARE NOT THE SAME SENTENCE, and on a
     loss-prevention screen printing the first when the second is true is the worst kind of wrong:
     it reads as an all-clear. Returns why this review could not reach a verdict, or null if it
     genuinely could have and the crew is clean.

     ⚠ ONE ANSWER, SHARED BY THE SCREEN AND THE PDF. A first pass put the team-size caveat on the
     screen only, and the exported document — the one that gets handed to an owner or a partner —
     kept printing "Servers reviewed: 2 / Flagged: 0" with nothing beside it. Same lie, worse
     artefact. Both callers ask this function now.

     TWO WAYS TO REACH NO-VERDICT, and the first pass only covered one:
       team    — every signal compares a server against the team, so under MIN_TEAM scored servers
                 nothing can trip. A two-bartender bar was permanently green.
       signals — severity needs TWO flags (see analyze), so with fewer than two live signal columns
                 nobody can ever be flagged however bad their numbers are. A file of Server + Net
                 Sales is exactly what the empty state invites, and it always read all-clear. */
  _noVerdictReason(review) {
    /* ⚠ THE THIRD CALL SITE, MISSED WHEN THE OTHER TWO WERE FIXED. `renderReport` and `printReview`
       both rebuild a missing summary via `_summaryFrom`, and this did not — so a restored review
       printed "Servers reviewed: 4" in the table and "This file scored 0. Not enough servers in
       this file to compare." in the paragraph directly beneath it, which is verbatim the falsehood
       `_summaryFrom` was written to stop. It also meant the `skipped` branch could never fire on
       such a record, because `team` always won first. Step 0.6, again. */
    const scored = ((review && review.summary) || this._summaryFrom(review)).reviewed || 0;
    if (scored < this.MIN_TEAM) {
      return {
        reason: 'team',
        title: 'Not enough servers in this file to compare.',
        detail: 'Every signal here works by comparing one server against the rest of the team, so Bar Cop needs at least '
          + this.MIN_TEAM + ' servers with usable numbers in the same report before it can call anyone an outlier. This file scored '
          + scored + '. That is not an all-clear, it just means there is no floor to stand out from yet.'
      };
    }
    /* ⚠ A METRIC BEING NON-NULL IS NOT THE SAME AS A SIGNAL BAR COP CAN ACT ON. `analyze` sets the
       two CAPTURE signals from `hasCapture`, which is true the moment the file has a DATE column —
       so with zero drawer shortages and zero walked tabs on record they both come out as a real 0,
       not null. Counting those as live meant a Server + Date + Net Sales file (exactly what the
       empty state invites) had "two signals", skipped this caveat, and printed the green all-clear
       on both the screen and the PDF. They also cannot fire on their own: a capture signal needs
       MIN_EVENTS behind it. A capture metric counts only once something was actually captured. */
    /* ⚠ AND "SOMETHING WAS CAPTURED" IS NOT "ENOUGH WAS CAPTURED TO FIRE". A capture signal needs
       MIN_EVENTS behind it before it can ever trip, so ONE drawer short and ONE walked tab counted
       as two live signals and suppressed this caveat — on a Server + Date + Net Sales file where
       nobody could possibly have been flagged, the screen and the PDF printed the green all-clear.
       Count the EVENTS, which is why the review persists them. */
    /* ⚠⚠ AND A SOFT SIGNAL IS NOT ONE OF THE TWO EITHER. `analyze` names a server only on two
       NON-SOFT flags, so counting `sales_per_hr` here left this caveat one branch short of the rule
       it exists to enforce — a Server + Net Sales + Checks + Hours file has two live metrics and
       only ONE that can ever be half of a pattern. Measured: a blatant under-ringer at a $20 average
       check against a $42.50 floor produced live.size === 2, no caveat, and the screen and the PDF
       both printed the green all-clear. This is the SECOND CONSUMER of the severity change, missed
       when that change was made — step 0.6, exactly. The soft list is read from SIGNALS so the two
       can never drift apart again. */
    /* ⚠ A SOFT SIGNAL ONLY STOPS COUNTING WHEN ITS TWIN IS ALSO LIVE — the same rule `analyze` uses,
       and dropping it unconditionally made this caveat contradict the screen next door. Measured on
       two files with IDENTICAL columns (Server, Net Sales, Cash, Card, Hours): one NAMED a server on
       cash mix + sales-per-hour, the other printed "Not enough columns in this file to reach a
       verdict". Bar Cop read two signals in both. */
    const TWIN = {};
    this.SIGNALS.forEach(sig => { if (sig.twin) TWIN[sig.key] = sig.twin; });
    const CAPTURE = { drawer_short: 'shortCount', walkouts: 'walkCount' };
    const live = new Set();
    ((review && review.servers) || []).forEach(s => {
      const m = (s && s.metrics) || {};
      Object.keys(m).forEach(k => {
        if (m[k] == null) return;
        if (TWIN[k] && m[TWIN[k]] != null) return;   // one fact read twice is one signal
        if (CAPTURE[k] && !((s[CAPTURE[k]] || 0) >= this.MIN_EVENTS)) return;
        live.add(k);
      });
    });
    /* ⚠⚠ THE SOLO ESCALATION MADE THIS CAVEAT FALSE AND SELF-CONTRADICTING, and the condition was
       never updated for it. Measured on two files with the IDENTICAL columns (net sales + comps),
       differing only in magnitude: one printed "Not enough columns in this file to reach a verdict"
       while the other NAMED a server on that same single signal. The title asserted the columns
       could not reach a verdict; the file next door proved they could.
       One live signal is now enough IF it is solo-eligible — so the caveat only fires when nothing
       readable could ever name anybody. */
    const soloEligible = {};
    this.SIGNALS.forEach(sig => { if (sig.solo) soloEligible[sig.key] = 1; });
    const canSolo = [...live].some(k => soloEligible[k]);
    if (live.size < 2 && !canSolo) {
      return {
        reason: 'signals',
        title: 'Not enough columns in this file to reach a verdict.',
        // ⚠ This used to say Bar Cop "only" names a server on two signals, which the solo escalation
        // made false. The conclusion still holds — a one-signal file is a thin read — but the
        // sentence has to describe the rule that actually runs.
        detail: 'Bar Cop names a server when two separate signals line up, or when a single loss signal is far enough '
          + 'above the floor to stand on its own. This file carried '
          + (live.size === 1 ? 'only one signal Bar Cop can read' : 'no signals Bar Cop can read')
          /* ⚠ THE REMEDIATION MAY ONLY NAME COLUMNS THIS FILE DOES NOT ALREADY HAVE. It listed the
             full set, so a file that HAD mapped Checks was told to "map more columns — ... checks
             ...", which reads as though Bar Cop did not see the column that is sitting right there.
             ⚠ And the names are the mapper's OWN FIELD LABELS: it said "labour hours", which is a
             spelling the mapping screen never shows (the label is "Labor Hours"), so the operator
             hunts for a column that does not exist by that name. */
          + '. ' + this._missingColumnsSentence(review)
          + 'That is not an all-clear, it just means there was not enough here to judge anyone on.'
      };
    }
    /* ⚠ A FILE THAT COULD NOT SCORE HALF ITS ROSTER HAS NOT REACHED A VERDICT EITHER. Measured: two
       of five servers fell under MIN_CHECKS — and they were the two heaviest, at 30 no-sale opens
       and 84% cash — while the remaining three cleared MIN_TEAM exactly, so no caveat fired and the
       screen printed "Every server's numbers track the floor."
       ⚠ Deliberately NOT "any server was set aside": a barback or a host with a handful of checks is
       set aside on almost every honest file, and a caveat shown on a clean file is its own lie. It
       takes at least two, and at least half as many as were actually scored. */
    const scoredN = ((review && review.summary) || this._summaryFrom(review)).reviewed || 0;
    const setAside = ((review && review.skipped) || []).length;
    /* ⚠ THE THRESHOLD FIRED ON THE CANONICAL SMALL-BAR FILE. `setAside * 2 >= scoredN` triggers at
       one third, so four servers plus a barback and a host — everyone clean — got
       "Too much of this file could not be scored to call it a verdict" instead of the all-clear.
       That is verbatim the case the note above says must not trigger it. It now takes at least as
       many set aside as were actually scored. */
    if (setAside >= 2 && setAside >= scoredN) {
      return {
        reason: 'skipped',
        title: 'Too much of this file could not be scored to call it a verdict.',
        detail: setAside + ' of the ' + (setAside + scoredN) + ' people in this report did not have enough '
          + 'checks or volume to be benchmarked fairly, so only ' + scoredN + ' were actually compared. '
          + 'Anyone set aside was not cleared, just not measured. Pull a report that covers more of '
          + 'their shifts'
          // ⚠ Only offer the Checks column when the file genuinely lacks it. This fixture HAD it
          // mapped — the servers were set aside for having one check each, not a missing column.
          + (((review && review.columns) || []).indexOf('checks') >= 0 ? '' : ', or map a Checks column')
          + ', and run it again.'
      };
    }
    return null;
  },

  /* Names only the signal columns this file did not carry, using the mapper's own field labels so
     the operator is looking for the same words the mapping screen shows them. */
  _missingColumnsSentence(review) {
    const have = {};
    ((review && review.columns) || []).forEach(c => { have[c] = 1; });
    /* ⚠ "MAP THE DATE COLUMN" IS THE WRONG ADVICE WHEN THE COLUMN IS THERE AND UNREADABLE. `columns`
       records `date` only when a value PARSED, so a file whose dates read "Week of 7/6" was told to
       map a column it had already mapped — directly under an intake note saying those very rows
       could not be matched to a shift. The operator needs the FORMAT named, not the column. */
    const k = (review && review.intake) || {};
    if (k.undated > 0) have.date = 1;
    /* ⚠⚠ THE ONE COLUMN THAT DOES MOST OF THE WORK WAS MISSING FROM THE ADVICE. `net_sales` is the
       denominator of the void, comp and refund shares, of the average check and of sales per hour —
       five of the nine signals — and this sentence never named it. The empty state, the drop-zone
       copy and the help text all say so; the remediation did not. Measured: on a Server + Checks
       file, adding EVERY column this sentence listed and no Net Sales still leaves all five of those
       signals null, so an operator who follows the advice to the letter gets a High Risk accusation
       with "Flagged exposure: -" beside it. Declared FIRST because it is the one to map first. */
    const WANT = ['net_sales', 'voids', 'comps', 'no_sales', 'refunds', 'cash_sales', 'card_sales', 'checks', 'hours', 'date'];
    const byKey = {};
    this.FIELDS.forEach(f => { byKey[f.key] = f.label; });
    const missing = WANT.filter(k => !have[k]).map(k => byKey[k] || k);
    if (!missing.length) return 'Every column Bar Cop can read is already mapped here, so this file simply does not carry enough separate signals to judge anyone on. ';
    const list = missing.length === 1 ? missing[0]
      : missing.slice(0, -1).join(', ') + ' and ' + missing[missing.length - 1];
    // ⚠ The dashes are a MATCHED PAIR in the multi-column branch; the singular branch used to
    // inherit only the closing one ("Map the Checks column — and re-run it.").
    const dateNote = (k.undated > 0)
      ? 'Bar Cop could not read the dates in this file, so it could not match the report to the drawer shortages and walked tabs already on file — check the date format. ' : '';
    if (!missing.length) return dateNote || 'Every column Bar Cop can read is already mapped here, so this file simply does not carry enough separate signals to judge anyone on. ';
    return dateNote + (missing.length === 1
      ? 'Map the ' + list + ' column and re-run it. '
      : 'Map more columns — ' + list + ' — and re-run it. ');
  },
  MIN_EVENTS: 2,   // captured shorts/walkouts below this are the cost of doing business

  // Six-step investigation a Sales Integrity flag opens in Loss Prevention. Server
  // and cash focused (the product-pour steps stay on the Loss Prevention side).
  INVESTIGATION_STEPS: [
    { title: 'Pull the shift sales reports', detail: 'Gather this server\'s sales reports for the flagged window so the pattern is in front of you.' },
    { title: 'Confirm the outlier against the floor', detail: 'Recompute the flagged metric against the team and the server\'s own history. A one-off busy night is not a pattern.' },
    { title: 'Watch the drawer', detail: 'Reconcile this server\'s register at close, unannounced, for the next several shifts.' },
    { title: 'Review the void and no-sale timing', detail: 'Pull the timestamps. Voids and no-sales clustered at shift end or right after a cash sale are the tell.' },
    { title: 'Talk to the server and the shift', detail: 'Ask the server and others who worked those shifts what was going on before drawing a conclusion.' },
    { title: 'Document the finding', detail: 'Write the finding and resolution before closing, even if inconclusive.' }
  ],

  reviews() {
    if (!App.data) App.data = {};
    if (!Array.isArray(App.data.sales_reviews)) App.data.sales_reviews = [];
    return App.data.sales_reviews;
  },
  latestReview() {
    const list = this.reviews().slice().sort(App.cmpNewest);
    return list[0] || null;
  },
  /* ⚠ EVERY NAME KEY IN THIS FILE MUST BE BUILT BY `_nameKey`, OR THE CROSS-REFERENCES SILENTLY
     MISS. The roster lookup here and the drawer-short / walked-tab keys in `analyze` are all joined
     against the aggregate's key — so the moment `_nameKey` started dropping a trailing period, a
     hand-rolled `.trim().toLowerCase()` here would have made "Brianna K." on the roster stop
     matching "Brianna K." in the file, dropping her staff link AND both capture signals. Step 0.6:
     when a shared value changes, find every consumer of it. */
  staffByName() {
    const m = {};
    ((App.laborData && App.laborData.lc_staff) || []).forEach(s => { if (s && s.name) m[this._nameKey(s.name)] = s; });
    return m;
  },

  // App.parseNum is the ONE coercion; null for "no number" is already this caller's contract.
  num(v) { return App.parseNum(v); },
  /* One person, one key. Collapses any run of whitespace (including the non-breaking space an
     export pastes in, which `.trim()` does not touch) and drops trailing punctuation, so
     "Brianna K." / "Brianna K" / "Brianna  K." are one server. Deliberately NOT more aggressive
     than that: stripping initials or middle names would MERGE two real people, which on this
     screen means putting one server's numbers on another one's name. */
  _nameKey(s) {
    /* \u26a0 TRIM BEFORE STRIPPING THE PUNCTUATION, not after. Stripping first meant the strip missed
       whenever anything followed the period: "Brianna K." collapsed to "brianna k" while
       "Brianna K. " (a roster name with a trailing space) stayed "brianna k." \u2014 and three of the
       four consumers are handed RAW STORED strings, so the roster link and BOTH capture signals
       went dark on the very pair this key builder exists to join. The zero-width characters go in
       the collapse class for the same reason: `trim()` does not reach them. */
    return String(s == null ? '' : s).toLowerCase()
      .replace(/[\s\u00a0\u1680\u200b\u2000-\u200a\u202f\u205f\u3000\ufeff]+/g, ' ')
      .trim()
      .replace(/[.,;:]+$/, '')
      .trim();
  },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  /* ⚠ A ROUNDED-DOWN PEER AVERAGE ASSERTS SOMETHING FAR STRONGER THAN THE DATA. Any peer figure
     under half a rounding step printed as a FLAT ZERO — "vs an average of 0% for the rest of the
     team" when the floor really voided 0.03%, and "an average of 0 per shift" when the crew had a
     real drawer short between them. Zero means nobody else does this AT ALL, which this file's own
     solo rule calls the most incriminating reading available. A small non-zero says so instead. */
  pct(v) {
    if (v == null) return '-';
    if (v > 0 && v < 0.001) return 'under 0.1%';
    return (Math.round(v * 1000) / 10) + '%';
  },
  _smallNum(v) {
    if (v > 0 && v < 0.05) return 'under 0.1';
    return String(Math.round(v * 10) / 10);
  },

  // ── The engine: raw mapped rows → a review object (true by construction, so the
  //    seed and the upload path both call this). ───────────────────────────────
  analyze(rows, opts) {
    opts = opts || {};
    const present = {};   // which columns the file actually carried
    const agg = {};       // server name → summed fields
    const dates = new Set();
    /* ⚠⚠ THE DATE COLUMN IS PARSED, NEVER SLICED. This read `String(r.date).slice(0, 10)` — the raw
       cell, first ten characters, no parse at all — so ONLY an ISO ymd ever worked, and an ISO ymd
       is the one shape a POS does not print. Measured on the shipped code with an `07/14/2026` file
       (Toast, Square, Clover and Aloha all write that):
         · `inDates` compares against Bar Cop's OWN ymd records, so the drawer-short and walked-tab
           cross-reference matched NOTHING. Both STRONG Cash Skimming signals silently read 0 and the
           exposure printed on screen and in the PDF fell from $347.89 to $92.89 on identical facts.
           Going dark on a loss-prevention screen reads as an all-clear, which is the worst outcome
           this file has;
         · `review.date` stored "07/14/2026", and `App.cmpNewest` keys on the record DATE first, so
           the screen opened on an OLDER review while today's import sat down in Past Reviews;
         · Week Review's `_inWeek` string-compares against ymd bounds, so the review never counted as
           recovery activity for the week — while Audit Tracker's `inWindow` fails OPEN on a date it
           cannot parse, so the same review counted in EVERY window. One junk value, two opposite
           wrong answers;
         · `_autoLabel` printed "Jul 13, 20 to Jul 14, 20"; and slicing a single-digit date carrying
           a clock (`7/1/2026 18:34` -> `7/1/2026 1`) cuts INSIDE the time, so one night split into
           several "days" and every per-shift rate was divided by too much.
       It delegates to the ONE shared reader now, exactly as doors 17 and 18 were made to.
       ⚠ Before adding a date format here, add it to PosIngest.normDate. This door must never grow a
       private date parser again; `verify-import-date-year` case C6 fails the moment one appears. */
    /* ⚠ "THE READER IS UNAVAILABLE" AND "THE READER REFUSED THIS CELL" ARE NOT THE SAME ANSWER, and
       collapsing them into one `: ''` fallback refused EVERY dated row and imported nothing at all —
       caught in the verification run of this very fix, before it shipped. If PosIngest were ever
       missing, the honest behaviour is the one this door already has for a file with no date column:
       read every row, score nobody on dates, cross-reference nothing. Losing the capture signals is
       a smaller wrong than losing the file. */
    const _hasReader = typeof PosIngest !== 'undefined' && !!PosIngest.normDate;
    const _conv = (_hasReader && PosIngest.dateConvention)
      ? PosIngest.dateConvention(rows || [], 'date') : { dayFirst: false, contradictory: false };
    const _dopts = { dayFirst: _conv.dayFirst, dateAmbiguous: _conv.contradictory };
    /* The date column is OPTIONAL at this door and a BLANK cell is an ordinary dateless row, so only
       a NON-EMPTY cell that will not parse is refused. Refused rather than kept dateless: keeping it
       would leave that shift's voids, comps and no-sale opens in the server's totals while
       contributing no day to divide them by, which INFLATES their per-shift rate. On the one screen
       in Bar Cop that prints a person's name next to the word theft, the false-accusation direction
       is the one to close hardest. Every refusal is counted and reported by runImport. */
    let noName = 0, undated = 0, summaryRows = 0;
    (rows || []).forEach(r => {
      const name = (r.server || '').trim();
      if (!name) { noName++; return; }
      // The export's own totals line is not a person. See PosIngest.isSummaryName for what it
      // did to a verdict when it was scored as one — in both directions.
      if (typeof PosIngest !== 'undefined' && PosIngest.isSummaryName && PosIngest.isSummaryName(name)) { summaryRows++; return; }
      const cell = (!_hasReader || r.date == null) ? '' : String(r.date).trim();
      const d = cell ? PosIngest.normDate(cell, _dopts) : '';
      /* ⚠ AN UNREADABLE DATE COUNTS THE ROW, IT DOES NOT DISCARD IT — and the first version of this
         fix DID discard it, which made a server vanish from the report altogether: not flagged, not
         clean, not in "Not enough data to score", no trace in the saved review or the PDF. A file
         whose date column read "Week of 7/6" hid a 20-opens-a-shift skimmer completely, and the
         artefact that leaves the building said all-clear. Losing a row's DATE is not a reason to
         lose its VOIDS. It is kept as a dateless row and counted for the report. */
      if (cell && !d) undated++;
      /* ⚠ TWO SPELLINGS OF ONE PERSON ARE ONE PERSON. A bare `.toLowerCase()` made "Brianna K." and
         "Brianna K" two servers, and it did three separate wrongs at once: it halved her counts so
         her STRONGEST flag (no-sale opens, weight 3) stopped clearing its floor and disappeared; it
         split her exposure across two cards; and the duplicated cash-heavy rows dragged the team
         cash average up far enough to hand **three innocent servers a "Cash mix" flag they did not
         have**. A doubled space and a non-breaking space (which `.trim()` never reaches) do it too. */
      const key = this._nameKey(name);
      // `has` records which columns THIS server actually supplied a number for. `present` is
      // file-wide and cannot answer that, and the difference is a real defect twice over — see
      // cash_ratio (a blank Card cell read as "100% cash") and qualifies (one blank Checks cell
      // dropped a server out of scoring entirely).
      if (!agg[key]) agg[key] = { name, sales: 0, checks: 0, cash: 0, card: 0, voids: 0, void_count: 0, comp_count: 0, refund_count: 0, comps: 0, no_sales: 0, refunds: 0, hours: 0, rows: 0, noDate: 0, has: {}, days: new Set() };
      const a = agg[key];
      a.rows++;
      /* ⚠ AN UNDATED ROW STILL COUNTS AS A SHIFT WORKED. Keeping the row (so a skimmer cannot vanish
         from the report) put its opens in the NUMERATOR while `a.days` gave it no divisor — so a
         server with three dated rows and one unreadable date had 40 opens over "3 shifts" and a rate
         inflated by 33%, on the very flag that made them High Risk. That is precisely what the
         comment above says this door refuses to do. The row's date is unknown; the fact that they
         worked is not. */
      /* ⚠ A BLANK CELL COUNTS TOO, AND THE FIRST VERSION OF THIS ONLY COUNTED AN UNREADABLE ONE.
         A grouped Date column — written once per server block, which is what every spreadsheet
         export produces — leaves the rest of the block BLANK, so those rows added their opens and
         shorts to the numerator and nothing to the divisor. Measured: six servers with identical
         facts, one of whom had 4 blank date cells, and she alone came out **High Risk, $49.00
         exposure** at "10 no-sale opens in one shift" against the others' 2.00. Her inflated rate
         then dragged the team mean up and raised the bar for a real skimmer.
         ⚠ `undated` (the REPORTED counter) deliberately stays on `cell && !d` — a blank cell is not
         something to tell the operator about, it is just a row with no date. */
      if (!d) a.noDate++;
      // ⚠ MAGNITUDE FOR THE LOSS COLUMNS. A void, comp or refund is an AMOUNT OF LOSS, and a POS
      // export writes it either way round — "600" or "(600)", the latter being what any of these
      // files becomes the moment it is opened and re-saved in Excel. Summing the signed value made
      // void_pct NEGATIVE, and every floor here is a positive threshold, so the Void, Comps and
      // Refund signals could never fire at all: a server voiding 12% of their sales raised nothing
      // and the screen reported 0 flagged. Going dark on a loss-prevention screen is worse than
      // misfiring, because it reads as "all clear".
      // The loss columns. Counts belong here as much as dollars: a "(3)" is three events, not
      // minus three.
      // ⚠ `no_sales` WAS MISSING FROM THE FIRST VERSION OF THIS MAP, and it is the one that hurt
      // most — weight 3, `strong: true`, and its materiality test reads the RAW COUNT
      // (`s.raw.no_sales`), so a negative could never clear the floor. On the classic drawer-skim
      // profile (no-sale opens plus an odd cash mix) losing it drops the server under the two-flag
      // rule and the card reads "No servers flagged", on exactly the Excel-resaved file this whole
      // change was written for. `void_count` is accumulated but no metric reads it yet; it stays
      // here so it is already right the day one does.
      const LOSS = { voids: 1, comps: 1, refunds: 1, no_sales: 1, void_count: 1, comp_count: 1, refund_count: 1 };
      const add = (field, raw, col) => {
        let n = this.num(raw);
        if (n == null) return;
        if (LOSS[field]) n = Math.abs(n);
        a[field] += n; present[col] = true; a.has[col] = true;
      };
      add('sales', r.net_sales, 'net_sales');
      add('checks', r.checks, 'checks');
      add('cash', r.cash_sales, 'cash_sales');
      add('card', r.card_sales, 'card_sales');
      add('voids', r.voids, 'voids');
      add('void_count', r.void_count, 'void_count');
      // Counted, deliberately unread — see the FIELDS note. They exist so a COUNT column can never
      // be mistaken for money, and so they are already right the day a metric wants them.
      add('comp_count', r.comp_count, 'comp_count');
      add('refund_count', r.refund_count, 'refund_count');
      add('comps', r.comps, 'comps');
      add('no_sales', r.no_sales, 'no_sales');
      add('refunds', r.refunds, 'refunds');
      add('hours', r.hours, 'hours');
      // ⚠ `present.date` is recorded HERE because the date never goes through `add()` — so
      // `review.columns` never listed it, and the remediation copy told every operator to "map the
      // Date column" on files that already had one and had parsed it correctly.
      if (d) { dates.add(d); a.days.add(d); present.date = true; }
    });

    // Optional cross-reference to captured Shift data, restricted to the report's
    // dates so we never pull in unrelated shifts. Adds drawer shorts + walkouts.
    const dateList = [...dates];
    const inDates = ds => dateList.length === 0 ? false : dateList.indexOf(String(ds).slice(0, 10)) >= 0;
    /* ⚠⚠ THE NUMERATOR AND THE DIVISOR HAVE TO COVER THE SAME DAYS. These counted every short in
       the FILE'S window while `shifts` counts only the days that server has a row for, so the card
       printed **"4 drawer shorts ($72.00) over 2 shifts (2 per shift)"** — self-contradicting (a
       server has one drawer a shift) and 2.5x the true 0.80 across the window.
       An event is now counted only on a day that server actually worked, whenever the file tells us
       which days those were. If their own dates are unreadable we cannot line the two up, so the
       window is used for both and the rate stays honest by being consistently coarse. */
    const capShorts = {}, capWalk = {};
    if (dateList.length) {
      const bump = (bag, k, d, amt) => {
        if (!bag[k]) bag[k] = { count: 0, amount: 0, days: {} };
        if (!bag[k].days[d]) bag[k].days[d] = { n: 0, amt: 0 };
        bag[k].days[d].n++; bag[k].days[d].amt += amt;
        bag[k].count++; bag[k].amount += amt;
      };
      ((App.shiftData && App.shiftData.sc_variances) || []).forEach(v => {
        if (v.status === 'Short' && v.cashier && inDates(v.date)) {
          const k = this._nameKey(v.cashier);   // same key builder as the aggregate, or this misses
          bump(capShorts, k, String(v.date).slice(0, 10), Math.abs(this.num(v.variance) || 0));
        }
      });
      ((App.shiftData && App.shiftData.sc_walked_tabs) || []).forEach(w => {
        if (w.server && inDates(w.date)) {
          const k = this._nameKey(w.server);   // same key builder as the aggregate, or this misses
          bump(capWalk, k, String(w.date).slice(0, 10), (this.num(w.amount) || 0));
        }
      });
    }
    // Restrict a bag to the days this server actually has rows for. With no dated rows of their
    // own there is nothing to restrict it to, so the whole window stands.
    const onOwnDays = (bag, a) => {
      if (!bag) return { count: 0, amount: 0 };
      if (!a.days.size) return { count: bag.count, amount: bag.amount };
      /* ⚠ THE DOLLARS ARE SUMMED PER DAY, NOT PRO-RATED BY EVENT COUNT. Splitting the total evenly
         across events fabricated the figure whenever the events differed in size: two  shorts on
         her own nights plus a 00 short on a night she did not work printed **06.67** against a
         truth of 0.00, and that same number is what the PDF hands to an owner. */
      let c = 0, amt = 0;
      Object.keys(bag.days).forEach(d => { if (a.days.has(d)) { c += bag.days[d].n; amt += bag.days[d].amt; } });
      return { count: c, amount: amt };
    };

    // Per-server metrics. Every signal is a RATE, never a raw count: the file is
    // invited to cover several days, so the bartender who closes every night racks
    // up 3-5x everyone's no-sales and shorts purely by working more. Counts are
    // divided by the shifts that server actually appears on (one report period when
    // the export carries no date column, which puts everyone on the same footing).
    const hasCapture = dateList.length > 0;
    const byName = this.staffByName();
    // Servers the file dates everyone else but not them, so their shift count is unknowable.
    const noShiftCount = [];
    const servers = Object.keys(agg).map(key => {
      const a = agg[key];
      /* ⚠ A SERVER WITH NO READABLE DATES IS DIVIDED BY THEIR ROW COUNT, NOT BY 1. This was
         `a.days.size || 1`, and it manufactured an accusation the moment ONE server's date cells
         were blank while the rest of the file was dated: measured, two servers with IDENTICAL facts
         — 5 shifts, 2 no-sale opens a shift, 2 drawer shorts — came out as one CLEAN and one
         "High Risk, Cash Skimming", purely because one of them had an empty Date column. Their
         counts stayed whole and their divisor collapsed to 1.
         A row IS a shift on the per-server summary this door asks for, so the row count is the
         honest fallback. ⚠ And it cannot disturb a file with no date column at all: there every
         server falls back the same way, and every signal here is a RATIO against the team average,
         so a uniform change of divisor cancels out of the comparison entirely. */
      /* ⚠ AND THE ROW-COUNT FALLBACK ONLY APPLIES WHEN THE FILE HAS DATES AT ALL. `|| a.rows` made a
         TICKET a shift on a per-transaction export with no Date column, and row counts differ per
         server — so the divisor stopped being uniform and **the server with the FEWEST no-sale opens
         was the one flagged**: 3 opens over 8 tickets read as 0.4 "per shift" and went High Risk,
         while a colleague with 6 opens over 60 tickets read 0.10 and clean.
         With no date column anywhere, nobody's shift count is knowable, so everyone divides by ONE
         report period — uniform, which cancels out of every ratio, exactly as it did before. */
      /* ⚠ AND A SERVER CANNOT WORK MORE SHIFTS THAN THE REPORT HAS DAYS. `days.size + noDate` added
         the undated rows unconditionally, so an export that splits one server's night across lines
         — a revenue centre, a daypart, a second terminal, or a date written once per block —
         invented a shift per extra line. Measured: 60 no-sale opens over four nights read as
         **7.5 a shift instead of 15**, dropping a real skimmer from Watch to CLEAN and printing
         "over 8 shifts" under a header covering four days. */
      /* ⚠ THE CAP APPLIES ONLY WHEN THIS SERVER HAS DATES OF THEIR OWN. `dateList` is the span of
         the dates the FILE could parse, which says nothing about a server whose own cells are all
         blank — and the cap only ever shrinks the divisor, so it only ever inflates a rate.
         Measured: Ana works 7 undated nights at 2 opens each while three colleagues work one dated
         night each at the same rate; the cap took her divisor to 1 and printed **14.00 opens a
         shift, Watch**, against a truth of 2.00 where everyone is identical.
         With dates, the cap still does its job (a dated and an undated row for the SAME night
         cannot be two shifts); without them, the row count is the only honest signal there is. */
      const shifts = a.days.size
        ? Math.min(a.days.size + a.noDate, dateList.length)
        : (dateList.length ? (a.rows || 1) : 1);
      /* Whether this server's shift count came from REAL DATES or was inferred from row count.
         `_flagDetail` needs it: with no date column a weekly rollup is one row per server, and
         calling that "in one shift" printed a WEEK's 140 no-sale opens as one night's. */
      const datedSpan = a.days.size > 0;
      // Whether the FILE has dates at all — which is what decides the UNIT, since with no date
      // column anywhere every server divides by one report period and the comparison is like-for-like.
      const fileDated = dateList.length > 0;
      /* ⚠⚠ IN A DATED FILE, A SERVER WITH NO DATES OF THEIR OWN HAS NO KNOWABLE SHIFT COUNT — AND
         DIVIDING THEM BY THEIR ROW COUNT NAMED THE CLEANEST PERSON IN THE FILE. Measured on a
         seven-day export where three servers have a row per night and one has a single weekly
         rollup line with a blank date cell (the commonest spreadsheet-export shape there is): her
         40 no-sale opens over a week divided by ONE row and printed
         **"40 no-sale opens in one shift vs an average of 6 per shift for the rest of the team"**,
         Watch, on the screen and in the PDF. Her real rate is 40/7 = 5.71 a shift against peers at
         6.00 — she is the cleanest server in the file and she is the only one named.
         `a.rows` is the honest fallback when NOBODY has dates (everyone divides by one report
         period, so it cancels out of every ratio). It is not honest when the rest of the file is
         dated and this one server is not: a row is a shift on a per-shift export and a whole week
         on a rollup, and nothing in the file says which. So the per-shift RATE signals are not
         evaluated for that server, and the report says so.
         ⚠ THIS DOES NOT LOSE A SKIMMER, which is the failure the undated row was kept to prevent.
         Every SHARE signal is divisor-free — voids, comps and refunds as a share of that server's
         own sales, the cash mix, the average check — so all of them still score, the row still
         counts, and the server is still listed. Only the three per-shift rates go quiet, loudly. */
      /* ⚠⚠ AND THE FIRST VERSION OF THIS GUARD WENT TOO WIDE AND UNDID A ROUND-4 FIX — three pins
         caught it, which is the whole argument for the suite. Suppressing EVERY undated server in a
         dated file also silenced the case round 4 was written for: a server with SEVEN undated rows
         beside colleagues working one dated night each, whose row count is a perfectly good divisor
         and whose real rate (2.00 a shift) is the honest answer.
         The two cases differ in one measurable way: whether the server's rows can ACCOUNT FOR the
         span the file covers. Seven rows across a seven-day file is a row per shift. ONE row across
         a seven-day file is a rollup, and dividing a week's work by 1 is what printed "40 no-sale
         opens in one shift" on the cleanest server in the file. Only the second is unknowable, and
         only the second goes quiet. */
      /* ⚠⚠ AND MY SECOND VERSION DEMANDED PERFECT ATTENDANCE. `a.rows >= dateList.length` means an
         undated server is only judged if they appear on as many rows as the file has distinct dates
         — i.e. only if they worked EVERY night in the span. Measured on a seven-night file with the
         probe byte-identical in every run: 4, 5 or 6 undated rows → rate `null`, **clean**; 7 rows →
         8.00 a shift against peers at 2.00, **High Risk, $630**. Taking one night off in a week was
         the entire difference, and worse, her verdict moved when her COLLEAGUES' rota changed.
         The genuinely unknowable case is narrower than that, and it is the one actually measured: a
         SINGLE row standing for a multi-day span, which is what a weekly rollup line is. Two or more
         rows in a dated file read as a row per shift, which is round 4's finding and is the honest
         reading of a per-server export. So only `rows === 1` in a multi-day file goes quiet.
         ⚠ It costs the genuine one-night server their rate signals, and that is the deliberate
         direction: dividing a week by 1 inflates the rate sevenfold and NAMES somebody, while
         suppressing it leaves them scored on every share signal and reported by name in the note. */
      const shiftsKnown = !fileDated || datedSpan || dateList.length <= 1 || (a.rows || 0) > 1;
      if (!shiftsKnown) noShiftCount.push(a.name);
      const _sh = onOwnDays(capShorts[key], a), _wk = onOwnDays(capWalk[key], a);
      const shortCount = _sh.count, walkCount = _wk.count;
      /* ⚠ THE CASH MIX IS REFUSED UNLESS THIS SERVER SUPPLIED BOTH SIDES OF IT. `present` is
         file-wide, so a server whose Card cell was simply BLANK had `cash + 0` for a denominator
         and printed **"100% cash vs 36% team average, runs high"** — a Cash Skimming flag against
         someone whose real mix was 15%, and their phantom 100% then dragged the team average up
         until three colleagues read "runs low". A mix needs both halves or it is not a mix.
         ⚠ And the single-column fallback is capped at 1: a POS Cash column that carries the tip
         with the tender can exceed net sales, which printed **"125% cash"** — a share above 100%
         is arithmetically impossible and is a sign the column means something else, so refuse it
         rather than accuse someone with it. */
      const bothSides = a.has.cash_sales && a.has.card_sales;
      const cashTotal = bothSides ? (a.cash + a.card) : null;
      const cashOnly  = (!bothSides && a.has.cash_sales && a.sales > 0 && a.cash >= 0 && a.cash <= a.sales) ? a.cash / a.sales : null;
      // ⚠ A NEGATIVE OR ZERO SALES TOTAL IS NOT A BENCHMARK. A "House"/comp pseudo-server carrying a
      // credit made `avg_check` print **"$-45.00 average check"** and dragged the team floor down
      // far enough that a genuine under-ringer stopped flagging at all.
      const realSales = a.sales > 0;
      /* ⚠⚠ `a.has.*`, NOT `present.*` — THIS SERVER'S CELL, NOT THE FILE'S COLUMN. `present` is
         file-wide, so a server who simply left the Voids cell BLANK was scored as a hard 0% and
         dragged the peer floor down for everyone else. Measured: five servers, one at 6% voids and
         6% comps against peers at 3% — all CLEAN when every cell is filled, and the same server
         **HIGH RISK with $108.00 of exposure** when two peers leave those two cells blank, because
         the printed floor becomes "1.5%", which is the real 3% halved by two phantom zeroes.
         This is exactly the split already closed for `cash_ratio` and for `checks`, left open on
         the three LOSS columns and on no_sales and hours. A blank cell is not a zero. */
      const m = {
        no_sales:    (a.has.no_sales && shiftsKnown) ? a.no_sales / shifts : null,
        void_pct:    (a.has.voids && realSales) ? a.voids / a.sales : null,
        avg_check:   (a.has.checks && a.checks > 0 && realSales) ? a.sales / a.checks : null,
        comp_pct:    (a.has.comps && realSales) ? a.comps / a.sales : null,
        /* ⚠ THE GUARD WAS ONE-SIDED AND THE TWO BRANCHES DISAGREED. `Math.min(1, …)` capped the top
           and nothing capped the bottom, so a Cash column net of paid-outs printed
           **"Cash mix: -8.6% cash, runs low"** on a High Risk card and in the PDF. Worse, clamping
           an impossible 120% to exactly 1.0 printed "100% cash, runs high" — the maximum possible
           accusation value — while the cash-only branch REFUSED the identical impossibility. Two
           opposite policies for one condition. A share outside 0-100% means the column is not what
           Bar Cop thinks it is, so it is refused rather than accused with. */
        cash_ratio:  (cashTotal && cashTotal > 0)
          ? ((a.cash / cashTotal >= 0 && a.cash / cashTotal <= 1) ? a.cash / cashTotal : null)
          : cashOnly,
        refund_pct:  (a.has.refunds && realSales) ? a.refunds / a.sales : null,
        // ⚠ `hours >= 1`: a 0.25-hour clock artefact (a manager ring, a rounding stub) gave a
        // $9,600/hr rate and pushed the printed TEAM AVERAGE to $2,587.50 an hour in a bar doing
        // $300 — a number that appears on three honest servers' flag lines.
        sales_per_hr:(a.has.hours && a.hours >= 1 && realSales) ? a.sales / a.hours : null,
        // A server with no captured short had ZERO shorts on these dates, which is a
        // measurement. Left null they dropped out of the team average, so the average
        // was taken across only the servers who HAD one and could never be under 1.
        drawer_short: (hasCapture && shiftsKnown) ? shortCount / shifts : null,
        walkouts:     (hasCapture && shiftsKnown) ? walkCount / shifts : null
      };
      const staff = byName[key];
      return { name: a.name, staff_id: staff ? staff.id : '', raw: a, shifts, datedSpan, fileDated, shortCount, walkCount,
        shortAmt: _sh.amount, walkAmt: _wk.amount,
        m, qualifies: false };
    });

    // Who is big enough to benchmark. With a Checks column that is MIN_CHECKS; with
    // no way to count checks it is volume against the median server, so a barback
    // with $60 of rung sales is not scored or flagged.
    const salesVals = servers.map(s => s.raw.sales).filter(v => v > 0).sort((x, y) => x - y);
    /* ⚠ A REAL MEDIAN, NOT THE UPPER MIDDLE. `salesVals[Math.floor(len / 2)]` takes the higher of
       the two middles on an even-length list, which on a day/night split is a NIGHT number: on
       700 / 800 / 3400 / 3600 it read 3400 (cutoff $850) and set aside **the entire lunch shift**,
       so a skimmer working days could not be scored at all. The true median is 2100 (cutoff $525)
       and all four are benchmarked. */
    const medSales = !salesVals.length ? 0
      : (salesVals.length % 2 ? salesVals[(salesVals.length - 1) / 2]
        : (salesVals[salesVals.length / 2 - 1] + salesVals[salesVals.length / 2]) / 2);
    servers.forEach(s => {
      /* ⚠ THE CHECKS TEST APPLIES ONLY TO SERVERS WHO ACTUALLY HAVE A CHECKS FIGURE. `present.checks`
         is file-wide, so ONE blank Checks cell dropped that server out of scoring entirely — and the
         file then still had 3 scored servers, which clears MIN_TEAM, so no caveat fired and the
         screen printed the green all-clear over a 20%-void, 83%-cash bartender. A server the file
         cannot count checks for falls back to the volume test, exactly as a file with no Checks
         column at all does. A negative-sales pseudo-row is never a benchmark member. */
      /* ⚠⚠ A $0-SALES ROW IS NOT A BENCHMARK MEMBER, AND IT WAS BOTH BURYING A THIEF AND BEING
         NAMED ITSELF. A House / Manager / Training account with `net_sales` 0 but a checks figure
         qualified on the checks test, joined the team average, and — because `no_sales` is a COUNT
         with no sales guard — could be flagged by name. Measured: a real skimmer at 7 drawer opens
         against a floor of 1 went from **High Risk to CLEAN** when one `$0 / 26 opens` Manager row
         was appended (the floor lifted 1.0 → 2.2), and the screen printed the green all-clear while
         **"Manager" was printed as a named employee on a Watch card and into the PDF**.
         ⚠ Gated on the FILE having a sales column: a Server + Checks export with no sales at all is
         still scored on checks, exactly as before. */
      /* ⚠⚠ SCORED AND BENCHMARK ARE TWO DIFFERENT QUESTIONS, and collapsing them erased the purest
         skim profile there is. A $0-sales row must not SET THE FLOOR (a House / Manager / Training
         account was burying a real thief), but refusing to SCORE it threw away "rang nothing,
         opened the drawer 30 times, voided everything" — measured, Kayla at $0.00 was set aside and
         the screen printed the all-clear, while the same row at $0.01 was HIGH RISK with $900 of
         exposure. One cent decided the whole verdict.
         `qualifies` now means "judge this person"; `benchmark` means "let them set the floor". */
      if (!(s.raw.sales > 0) && !(s.raw.checks > 0)) { s.qualifies = false; s.benchmark = false; return; }
      s.qualifies = (present.checks && s.raw.has.checks)
        ? (s.raw.checks >= this.MIN_CHECKS)
        : (medSales > 0 && s.raw.sales >= medSales * this.MIN_SALES_SHARE);
      /* ⚠⚠ A NEGATIVE SALES CELL BARRED *SCORING*, WHICH IS THE SAME CONFLATION THE BLOCK ABOVE
         EXISTS TO UNDO. The note four lines up complains that "one cent decided the whole verdict"
         between $0.00 and $0.01 — and this line reinstated exactly that cliff on the other side of
         zero. Measured against three honest peers, a probe server with 40 checks and **30 no-sale
         opens** reads Watch at `3000`, Watch at `0`, Watch at a blank cell, and is **SET ASIDE,
         never scored, flagged count 1 → 0** at `(3000)`. Accounting parentheses are what these
         files become after an Excel round-trip, and the LOSS columns are already protected from it
         by `Math.abs`; the sales column was not. A negative total must not set the floor — it never
         does, because `benchmark` requires `sales > 0` — but it is no reason to stop counting
         somebody's drawer opens. */
      // A row with no positive sales is judged on its count signals but never sets the floor.
      s.benchmark = s.qualifies && (!present.net_sales || s.raw.sales > 0);
    });

    // Team baselines from qualifying servers only.
    const scored = servers.filter(s => s.qualifies);
    // ⚠ The team baseline is built from BENCHMARK members only — see the qualifies note above.
    const bench = servers.filter(s => s.benchmark);
    const teamAvg = {};
    const teamSum = {}, teamN = {};
    this.SIGNALS.forEach(sig => {
      const vals = bench.map(s => s.m[sig.key]).filter(v => v != null);
      teamSum[sig.key] = vals.reduce((t, v) => t + v, 0);
      teamN[sig.key] = vals.length;
      teamAvg[sig.key] = vals.length ? teamSum[sig.key] / vals.length : null;
    });
    /* ⚠⚠ THE FLOOR A SERVER IS JUDGED AGAINST MUST NOT INCLUDE THAT SERVER. `teamAvg` does, so the
       WORSE somebody is, the higher they push the bar they have to clear — backwards, and it gets
       worse the smaller the crew. Measured on the solo-escalation test: a server comping 15% of
       sales against a floor of 1% is FIFTEEN times the floor, but including themselves in a
       six-person average made it 4.5x and they cleared nothing. Same distortion understated the
       dollar exposure by ~25% on a four-person crew.
       `peerAvg` is the mean of everyone ELSE, and as of round 6 it drives EVERY comparison in this
       file: the trip test, the solo bar, the exposure figure and the number printed on the card.
       ⭐ It used to drive all of those EXCEPT the ordinary trip test, which kept the whole-team mean
       "because including the accused makes the bar harder to clear, which is the safe direction".
       That reasoning was right about the direction and wrong about the size: the bar it produced was
       `k(n-1)/(n-k)` times the peer average, i.e. a hidden function of how many colleagues filled in
       that cell — 4x on a three-server crew, UNSATISFIABLE on a two-server one, 2.04x on a large
       floor. See the RATIO_* block for the table and the calibration. */
    const peerAvg = (key, s) => {
      const v = s.m[key];
      if (v == null) return teamAvg[key];
      /* ⚠ A SERVER WHO IS NOT A BENCHMARK MEMBER IS NOT IN THE SUM, so subtracting their value would
         corrupt it. For them every benchmark member IS a peer, so the whole-bench mean is already
         the leave-one-out answer. */
      if (!s.benchmark) return teamAvg[key];
      const n = teamN[key] - 1;
      return n > 0 ? (teamSum[key] - v) / n : null;
    };
    const teamCount = scored.length;
    /* Signals that HAD a figure but too few benchmark members reporting them to compare against.
       These are not clean readings and the report says so — a silently unevaluated loss signal is
       indistinguishable from an all-clear, which is the failure this whole screen exists to avoid. */
    const thin = {};

    // Evaluate each server against the team.
    scored.forEach(s => {
      s.flags = [];
      this.SIGNALS.forEach(sig => {
        const v = s.m[sig.key];
        // ⚠ STILL READ, and only by `dir:'low'` and `dir:'both'` — see the asymmetry note above.
        const avg = teamAvg[sig.key];
        if (v == null) return;
        // Capture-based signals (drawer shorts / walkouts) are real logged events
        // rather than a rate to benchmark hard, but a small crew still has no floor
        // to stand out from: on a two-bartender bar one $7 short IS half the team.
        // The old gate read `teamCount < 3 ||` and so short-circuited to ALWAYS trip
        // on the exact crews it should have refused to score, which is how one short
        // plus one walked tab printed "High Risk, Cash Skimming" against a name.
        // Every other signal below refuses without a floor; these do the same now.
        /* ⚠⚠ THE GATE HAS TO COUNT THE PEOPLE WHO SET *THIS* FLOOR, NOT THE PEOPLE WHO WERE SCORED.
           `teamCount` is `scored.length`, while every floor is built from `bench` — and after the
           qualifies/benchmark split those two move in OPPOSITE directions, because a $0 pseudo-row
           or a blank-sales row is scored and cannot benchmark. So the gate got LOOSER exactly as the
           real floor got thinner. Three measured consequences on this one gate:
             · with the accused inside the mean, `v > avg * 2` reduces to `v(n-2) > 2R`, which at
               n=2 is UNSATISFIABLE. When peers left the Voids cell BLANK — a blank is not a zero,
               and blank is what a POS writes for a server who voided nothing — a server voiding 6%
               of sales against a floor of 0.5% read **CLEAN, $0.00**, and the screen printed the
               green all-clear. The identical file with those peer cells filled: **High Risk,
               $219.88.** Going dark is the worst outcome this screen has;
             · four servers whose ONLY difference from each other was a blank Net Sales cell were
               judged against a floor of ONE card-heavy bartender and **all four printed High Risk**;
             · two bartenders plus one $0 House row cleared MIN_TEAM and unlocked the capture
               signals on a crew of two — the exact case the capture gate refuses by design.
           `teamN[key]` is the number of benchmark members who actually supplied that column, which
           is the only count that makes the comparison mean anything.
           ⚠ A signal dropped here is NOT a clean reading, so it is recorded and reported rather than
           left to look like one. */
        const reporters = teamN[sig.key] || 0;
        /* ⭐ EVERY COMPARISON BELOW IS AGAINST THE PEER AVERAGE — the mean of everyone ELSE — and the
           multipliers live in the RATIO_* block with the table that derives them. `avg` (the
           whole-team mean) is deliberately no longer used for any test: it made the bar a function
           of crew size, and it made the tested number differ from the reported one. */
        const peer = peerAvg(sig.key, s);
        let tripped = false;
        if (sig.capture) {
          // Two tests, both required: enough events to be a pattern rather than the
          // one short every bartender has eventually, and a per-shift rate above the
          // floor's. Rate for the comparison, raw count for the materiality, so the
          // closer who works five nights is not flagged for volume alone.
          const events = (sig.key === 'drawer_short') ? s.shortCount : s.walkCount;
          /* ⚠⚠ A PEER AVERAGE OF EXACTLY ZERO MAKES `v > peer * RATIO` MEAN `v > 0`, so `MIN_EVENTS`
             becomes the only bar — AND THAT IS THE DESIGN, NOT A DEFECT. A scan flagged it as one
             (a bartender identical to her peers except for 2 shorts and 2 walked tabs reads High
             Risk), and raising the bar to "more than four events with no peer activity" broke three
             pins at once: block D, which exists to prove the capture path is not DEAD after it once
             passed vacuously, and I2, which asserts that two shorts plus two walked tabs must still
             be caught. Both were right and the scan was not.
             ⭐ Zero peer events is the STRONGEST benchmark available, not missing data — the same
             reasoning `_soloClears` already carries for a zero peer average. `MIN_EVENTS` is the
             materiality bar and its own comment says so ("below this are the cost of doing
             business"); the defect this file actually fixed was ONE short plus ONE walked tab, which
             is under that bar. Two separate capture signals lining up is exactly what the two-signal
             rule calls a pattern. Reverted, deliberately, and recorded so it is not "fixed" again. */
          tripped = reporters >= this.MIN_TEAM && peer != null
                    && events >= this.MIN_EVENTS && v > peer * this.RATIO_CAPTURE;
          if (peer != null && reporters < this.MIN_TEAM) thin[sig.key] = 1;
        } else if (peer == null || reporters < this.MIN_TEAM) {
          tripped = false;   // need a floor to compare against
          /* ⚠⚠ `if (peer != null)` MADE THIS SILENT IN EXACTLY THE WORST CASE. `peer` is null
             precisely when NOBODY ELSE supplied that column — the extreme of "too few reporters",
             and the only case the note exists for. Measured, sweeping how many of five peers fill
             the Voids cell: 0 peers → **(silent)**, 1 peer → "Void rate", 2+ → compared normally.
             Non-monotonic: the less Bar Cop could tell, the less it said. And it is the same input
             where `_exposure` withholds the dollars, so the card showed a share, no comparison, no
             money and no explanation of any of it. If the accused HAS a figure and it could not be
             compared, that is the whole condition — the peer value is irrelevant to whether it is
             worth saying. */
          thin[sig.key] = 1;
        } else if (sig.dir === 'high') {
          // Compare on the rate, but check materiality on the raw count for no_sales:
          // its floor has always meant "at least this many opens in the window", and
          // testing a per-shift rate against it would demand 3 opens EVERY shift and
          // miss the bartender popping the drawer twice a night all week.
          const material = (sig.key === 'no_sales') ? s.raw.no_sales : v;
          tripped = v > peer * this.RATIO_HIGH && material >= this._floor(sig.key, peer);
        } else if (sig.dir === 'low') {
          // ⚠ WHOLE-TEAM MEAN ON PURPOSE — see the asymmetry note in the RATIO_* block.
          tripped = avg > 0 && v < avg * 0.6;
        } else if (sig.dir === 'both') {
          tripped = avg > 0 && Math.abs(v - avg) > Math.max(0.15, avg * 0.4);
        }
        /* ⚠⚠ THE SOLO PATH HAS TO BE REACHABLE WITHOUT THE ORDINARY TRIP. It was evaluated INSIDE
           the flag push, so a signal that could not trip the 2x team test could never escalate —
           and the case solo exists for is exactly the one where there is no usable team floor. */
        const soloOk = this._soloClears(sig, v, peerAvg(sig.key, s), s);
        if (!tripped && !soloOk) return;
        s.flags.push({
          key: sig.key, label: sig.label, cat: sig.cat, weight: sig.weight, strong: !!sig.strong, soft: !!sig.soft, twin: sig.twin || '',
          // Whether THIS flag, on its own, clears the solo-escalation bar. Computed here where the
          // team average and the raw counts are both in hand, so severity does not have to re-derive it.
          solo: soloOk,
          // Whether it cleared the ORDINARY team comparison. Severity needs the two kept apart: a
          // flag that only ever cleared the solo bar was never compared against a floor at all.
          tripped: tripped,
          /* ⚠⚠ WHAT IS REPORTED IS MEASURED AGAINST THE REST OF THE FLOOR, and it used to print the
             whole-team average while the dollars beside it were computed from the peer average —
             two different baselines in one table row, neither labelled. An accountant reading
             "12% of sales voided vs 3.2% team average" and a $220 exposure cannot reconcile them
             (3.2% implies $176). The peer figure is also the HONESTER one: the whole-team mean
             includes the accused, so their own 12% drags the printed "team average" up and makes
             the case against them look milder than it is.
             ⚠ The TRIP TEST above deliberately still uses the whole-team mean it was tuned against —
             including the accused makes the bar HARDER to clear, which is the safe direction on a
             screen that names people. Test conservatively, report honestly. */
          value: v, team: peerAvg(sig.key, s), dir: sig.dir,
          detail: this._flagDetail(sig, v, peerAvg(sig.key, s), s),
          // ⚠ Exposure is "dollars above what the REST of the floor would predict", so it uses the
          // peer average too — including the offender in their own benchmark understated a $380
          // excess as $285 on a four-person crew, and worse the smaller the bar.
          exposure: this._exposure(sig, v, peerAvg(sig.key, s), s)
        });
      });
      /* ⚠⚠ THE COMPOSITE COUNTED THE TWIN READING TWICE, so MAPPING A COLUMN escalated a card. If a
         file carried Hours, `sales_per_hr` fired alongside `avg_check` — the same fact — and its
         weight pushed the composite from 4 to 5, which is the High Risk gate. Measured: identical
         server facts, and the ONLY difference being whether the export had an Hours column, gave
         Watch versus **High Risk** and moved the High Risk count in the stat strip and the PDF
         section title. `hardN` already excludes a twinned flag on the stated grounds that it is one
         fact counted twice; the composite has to use the same predicate or they disagree. */
      const flagKeys = {};
      s.flags.forEach(f => { flagKeys[f.key] = 1; });
      const independent = s.flags.filter(f => !(f.twin && flagKeys[f.twin]));
      const comp = independent.reduce((t, f) => t + f.weight + (f.strong ? 1 : 0), 0);
      const strongN = independent.filter(f => f.strong).length;
      s.composite = comp;
      // Cents in, cents out — the card header must equal the rows listed under it.
      s.exposure = this._cents(s.flags.reduce((t, f) => t + (f.exposure || 0), 0));
      // This file's own rule, up top: one outlier is noise, two-plus stacking is a
      // pattern, so a server flags on a composite and never on a single signal. One
      // weight-2 signal cleared the old `comp >= 2` on its own, which put the patio
      // server's naturally low check average on the board as a name to investigate.
      /* ⚠⚠ A SOFT SIGNAL CANNOT BE ONE OF THE TWO. `avg_check` and `sales_per_hr` are TWO READINGS
         OF THE SAME QUANTITY — both are sales over a divisor, both are `dir:'low'`, both benchmark
         against a MEAN that one outlier moves. So they fire together, and together they satisfied
         the two-flag rule by themselves. Measured on five ordinary servers plus one bottle-service
         server: **five of six innocent servers were named on Watch cards and printed into the PDF,
         while the one atypical server read clean.** The two-flag rule exists (this file's own header
         says so) to stop "the patio server's naturally low check average" being a pattern — and two
         views of that same average defeated it.
         `soft` already marks the weaker reading; it now means what it says. A soft signal still
         shows on the card and still adds weight once a real pattern exists, it just cannot be one
         of the two independent tells that CREATE one. */
      /* ⚠⚠ AND THE FIRST VERSION OF THIS WAS TOO BROAD, WHICH BLINDED THE SCREEN. Excluding every
         `soft` flag stopped `sales_per_hr` pairing with ANY signal, not just its twin — so the
         classic void skim (12.9% of sales voided against a 3.7% floor, plus a low sales-per-hour)
         came out CLEAN, composite 5, and the screen and the PDF printed "No servers flagged among
         the 5 scored" while $192.74 of void exposure was computed and never shown.
         Voids and sales-per-hour are NOT two readings of one quantity. The exclusion is pair-wise
         now: a flag stops counting as independent only when the signal it is a second reading of
         (`twin`) is ALSO flagged. Everything else counts. */
      const hardN = independent.length;
      /* ⚠ THE SOLO ESCALATION IS THE ONLY WAY ONE SIGNAL NAMES ANYBODY, and it is capped at WATCH.
         Without it a server comping 90% of their own sales read clean, because `hardN < 2` had no
         ceiling. See the `solo` block on SIGNALS for why only four signals are eligible. */
      const soloHit = s.flags.some(f => f.solo);
      /* ⚠⚠ THE WATCH CAP WAS STATED TWICE IN THIS FILE AND ENFORCED ONLY AT `hardN < 2`. A solo flag
         counts toward `hardN` exactly like one that cleared the team test, so TWO solo-only flags
         walked straight past the cap into **High Risk**. Measured on six servers where only the
         accused supplied a Voids or Comps figure: one solo flag = Watch; add the second column and
         the same person is **High Risk with $800.00 of exposure** in the PDF — on a file where
         nothing was ever compared against anything, because no peer reported either column.
         If NOTHING cleared the ordinary team comparison then no comparison happened at all, and
         this file's own rule — one signal is a lead worth a look, not a pattern Bar Cop asserts —
         governs the whole card, not merely the count of flags on it. */
      const anyTripped = independent.some(f => f.tripped);
      s.severity = hardN >= 2 ? ((anyTripped && (comp >= 5 || strongN >= 2)) ? 'high' : 'watch')
        : (soloHit ? 'watch' : 'clean');
    });

    /* ⚠ SEVERITY FIRST, THEN COMPOSITE. Round 6 decoupled the two (`anyTripped` can cap a
       high-composite card at Watch), so composite stopped being a proxy for "worst" — and both
       consumers print the stored order under a help line promising "servers are listed worst first".
       A Watch card above a High Risk card is the first name an owner reads in the document. */
    const SEV_RANK = { high: 0, watch: 1 };
    const flagged = scored.filter(s => s.severity !== 'clean')
      .sort((a, b) => (SEV_RANK[a.severity] - SEV_RANK[b.severity])
        || b.composite - a.composite || b.exposure - a.exposure);
    const clean = scored.filter(s => s.severity === 'clean');
    const skipped = servers.filter(s => !s.qualifies);

    return {
      id: opts.id || App.uid(),
      label: opts.label || this._autoLabel(dateList),
      date: opts.date || (dateList.sort()[dateList.length - 1]) || App.todayLocal(),
      created_at: opts.created_at || new Date().toISOString(),
      source: opts.source || 'import',
      columns: Object.keys(present),
      // What the file actually gave up, so the import can say so instead of drawing a
      // report over rows it quietly threw away. `ambiguous` is the S199 coin-toss case.
      intake: { rows: (rows || []).length, noName, undated, summaryRows, ambiguous: !!_conv.contradictory,
        // Named, not counted: the operator has to know WHICH server's rates went unread.
        noShiftCount: noShiftCount.slice(),
        // Signals that carried a figure but had too few reporters to compare against.
        unjudged: Object.keys(thin).map(k => (this.SIGNALS.find(g => g.key === k) || {}).label || k) },
      summary: {
        reviewed: scored.length, flagged: flagged.length, skipped: skipped.length,
        high: flagged.filter(s => s.severity === 'high').length,
        exposure: this._cents(flagged.reduce((t, s) => t + s.exposure, 0))
      },
      // Strip the bulky raw aggregate before persisting; keep what the report needs.
      servers: flagged.concat(clean).map(s => ({
        name: s.name, staff_id: s.staff_id, severity: s.severity,
        // shortCount / walkCount persist because `_noVerdictReason` has to know whether a capture
        // metric represents ENOUGH events to be actionable, and a per-shift rate cannot tell it.
        composite: s.composite, exposure: s.exposure, metrics: s.m, flags: s.flags,
        shortCount: s.shortCount, walkCount: s.walkCount
      })),
      skipped: skipped.map(s => s.name)
    };
  },

  /* Does this ONE flag clear the solo bar? Both halves are required and each does a distinct job:
       ratio     — five times the team average, not the two a normal flag needs, so a server who is
                   merely on the high side of normal is never named on a single signal;
       minShare  — a real share of THIS server's own sales, which is what stops the rule firing off a
                   tiny floor (2% comps against a 0.2% floor is 10x and is still nothing);
       minCount  — the same materiality for the one eligible signal measured in events, not dollars.
     ⚠ `v` for a count signal is a PER-SHIFT RATE, so the count test reads the RAW total — the same
     split `_floor` already documents for no_sales. Mixing them would compare two different units. */
  /* ⚠⚠ A GUARD THAT STOPS A THROW AND PRINTS A FALSEHOOD IS NOT A FIX. Defaulting a missing
     `summary` to all-zeros made a restored review print "Servers reviewed 0 · Flagged 0 · Flagged
     exposure -" and then, four lines down in the SAME PDF, "Ana (High Risk, $740.00 exposure)" —
     under a paragraph reading "Not enough servers in this file to compare. This file scored 0."
     The screen and the document also disagreed, because one guarded on `review.servers` and the
     other on the zeroed summary. The servers ARE in the record; rebuild the four numbers from them
     rather than asserting zero. */
  /* ⚠⚠ ONE PREDICATE, BECAUSE TWO SPELLINGS OF "IS THIS SERVER FLAGGED" DISAGREED ON THE SAME
     RECORD. `renderReport` and `printReview` asked `x.severity !== 'clean'` — which is TRUE for a
     record whose severity is missing — while `_summaryFrom` required the field to exist. A restored
     or partly-synced review therefore printed the stat strip "Flagged 0 · High Risk 0 · Flagged
     Exposure -" directly above a named Watch card, and the PDF printed "Not enough columns in this
     file to reach a verdict" and then a section headed with that server's name. A server with no
     verdict stored is not a flagged server: Bar Cop cannot assert a pattern it has no record of. */
  _isFlagged(x) { return !!(x && x.severity && x.severity !== 'clean'); },

  /* WHEN THIS REVIEW WAS MADE, as a LOCAL ymd, or '' when that cannot be established.
     ⚠⚠ ONE IMPLEMENTATION, because the second one was already drifting the hour it was written. The
     PDF disclaimer had this conversion — correct, and carrying three separate lessons in its
     comments — and the Resolved badge needed the same answer, so a simpler `new Date(created_at)`
     went in beside it and was immediately caught by the tree-wide private-date-parser detector. Two
     copies of a date job is how doors 17 and 18 kept a whole eliminated bug class alive.
     The three things this has to get right, all of them paid for:
       · `created_at` is a UTC INSTANT, so reading its date part is `toISOString().slice(0,10)` in
         disguise. A review imported at 8:30pm Chicago is stored `...T01:30:00Z`, and the legal
         disclaimer on a document handed to a lender dated the evidence to TOMORROW. Most of a bar's
         imports are after 7pm, so that was the common case;
       · a BARE ymd is not an instant — `new Date('2026-07-26')` is UTC midnight, which `ymdLocal`
         walks back to the 25th in every US timezone. Anchor it to local midnight first;
       · a date that cannot be true (before Bar Cop existed, or in the future) is not reported as
         fact. Callers get '' and say "earlier", or fail closed. */
  _madeOn(review) {
    const rawAt = review && review.created_at;
    if (!rawAt) return '';
    const at = (typeof rawAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawAt.trim()))
      ? new Date(rawAt.trim() + 'T00:00:00')
      : new Date(rawAt);
    if (!at || isNaN(at.getTime())) return '';
    const ymd = App.ymdLocal ? App.ymdLocal(at) : '';
    const today = App.todayLocal ? App.todayLocal() : '';
    return (ymd && ymd >= '2020-01-01' && (!today || ymd <= today)) ? ymd : '';
  },
  _summaryFrom(review) {
    const list = (review && review.servers) || [];
    const flagged = list.filter(x => this._isFlagged(x));
    return {
      reviewed: list.length,
      flagged: flagged.length,
      skipped: ((review && review.skipped) || []).length,
      high: flagged.filter(x => x.severity === 'high').length,
      exposure: flagged.reduce((t, x) => t + (x.exposure || 0), 0)
    };
  },

  _soloClears(sig, v, avg, s) {
    /* ⚠⚠ A PEER AVERAGE OF EXACTLY ZERO IS NOT MISSING DATA — IT IS THE STRONGEST BENCHMARK THERE
       IS, and `!(avg > 0)` threw it away. Measured: a server comping 90% of their own sales was
       Watch when the rest of the bar comped $1 a shift and **CLEAN when the rest comped nothing**,
       with $3,596 of exposure computed and discarded and the green all-clear printed over them.
       A floor of zero means nobody else does this at all, which is the most incriminating reading
       available, so it has to clear the ratio by definition — guarded on `v > 0` instead. */
    /* ⚠⚠ NO PEER BENCHMARK IS NOT "NOTHING TO SEE". When nobody ELSE supplied a figure for this
       column, `peerAvg` is null and this returned false — so a server voiding 30% of their own
       sales read CLEAN with $1,200 of exposure computed nowhere, and the screen printed the green
       all-clear. That is the case the solo rule exists for, disabled exactly where it is needed.
       `minShare`/`minCount` are ABSOLUTE tests — a tenth of your own sales, ten drawer opens — so
       they stand on their own without any floor to compare against. With no peers, materiality
       alone decides; with peers, it must ALSO clear the ratio. */
    const cfg = sig.solo;
    if (!cfg || (avg != null && avg < 0) || v == null || !(v > 0)) return false;
    if (avg != null && avg > 0 && !(v > avg * cfg.ratio)) return false;
    if (cfg.minShare != null) return v >= cfg.minShare;
    if (cfg.minCount != null) return (s.raw[sig.key] || 0) >= cfg.minCount;
    return false;
  },

  _floor(key, avg) {
    // A minimum the value must clear so a 2x of a tiny team average never flags.
    // no_sales is a count of opens in the window (the caller passes the raw count);
    // the rest are ratios measured against themselves. This was Math.max(3, avg)
    // back when no_sales was a raw sum and avg was a raw count too. Now that avg is
    // a per-shift rate, maxing a count against a rate would compare two different
    // units, and the `v > avg * 2` test already covers "above the team's own rate".
    if (key === 'no_sales')   return 3;
    if (key === 'void_pct')   return 0.02;
    if (key === 'comp_pct')   return 0.02;
    if (key === 'refund_pct') return 0.01;
    return 0;
  },
  /* ⚠ ROUNDED TO CENTS AT SOURCE, SO THE ITEMISATION ADDS UP TO THE TOTAL PRINTED ABOVE IT. Each
     flag row rounded for display while `s.exposure` summed the raw floats, so a three-flag card
     printed rows of $509.13 + $440.00 + $370.12 under a header, a stat strip and a PDF summary
     table all reading **$1,319.26** against an itemisation of $1,319.25. On a document an
     accountant reconciles, the parts have to equal the whole. */
  _cents(n) { return Math.round((Number(n) || 0) * 100) / 100; },
  _exposure(sig, v, avg, s) {
    if (!sig.dollar) return 0;
    // Captured events are real logged dollars, not a comparison, so they need no peer average.
    if (sig.dollar === 'short')   return this._cents(s.shortAmt);
    if (sig.dollar === 'walkout') return this._cents(s.walkAmt);
    /* ⚠⚠ WITH NO PEER AVERAGE THERE IS NO "EXCESS" TO REPORT, AND SPENDING null AS A HARD ZERO
       PRINTED THE SERVER'S ENTIRE LOSS TOTAL UNDER A HEADING THAT SAYS EXPOSURE. Measured: nobody
       else in the file supplied a Voids figure, so `peerAvg` was null and the card printed
       **"$420.00 exposure"** beside "14% of sales voided" with NO comparison clause at all — a
       number that silently asserts a normal server voids $0.00, on the same screen whose help text
       promises every dollar is "measured against the rest of the team with that server left out".
       Both sentences were false on that card. This file's own definition of exposure is "dollars
       above what the REST of the floor would predict"; with no floor that quantity does not exist,
       and a figure an owner cannot reconcile does not belong in a document handed to a lender.
       The flag still prints, and its detail still carries the share — the DOLLARS are what get
       withheld, not the finding. */
    if (avg == null) return 0;
    if (sig.dollar === 'voids')   return this._cents(Math.max(0, s.raw.voids   - avg * s.raw.sales));
    if (sig.dollar === 'comps')   return this._cents(Math.max(0, s.raw.comps   - avg * s.raw.sales));
    if (sig.dollar === 'refunds') return this._cents(Math.max(0, s.raw.refunds - avg * s.raw.sales));
    return 0;
  },
  // "Floor" reads as a limit, and half the staff sit above an average by definition,
  // so calling the team MEAN a floor accused everyone on the high side of normal of
  // breaching something. It is an average and it says so, on screen and in the PDF.
  _flagDetail(sig, v, avg, s) {
    /* ⚠ THE WORD "floor" IS BANNED HERE AND A PIN CAUGHT ME REINTRODUCING IT. An earlier round
       removed it deliberately: calling the team MEAN a "floor" reads as a limit, and half the staff
       sit above an average by definition, so it accused everyone on the high side of normal of
       breaching something. It is an AVERAGE and it has to say so — while now also saying that the
       average excludes the server being looked at, which is what makes it reconcile with the
       dollars printed beside it. */
    const teamTxt = (avg != null) ? ' vs an average of ' + this._fmtVal(sig, avg, s) + ' for the rest of the team' : '';
    // Only spell the rate out when the report spans more than one shift. On a
    // single-shift report the count already IS the per-shift rate.
    /* ⚠ THE COUNT AND THE TEAM AVERAGE ARE IN DIFFERENT UNITS, so the span is never optional. Under
       a multi-day header ("Jul 10 to Jul 12"), a server who worked ONE of those nights printed
       "9 no-sale opens vs 3 per shift team average" — a raw count beside a rate, which a reader
       spreads across the whole window and reads as BELOW the floor when it is three times it. On a
       theft screen the softer misreading is the dangerous one. */
    /* ⚠ AND "in one shift" IS A CLAIM ABOUT THE FILE, NOT JUST THE COUNT. A weekly per-server rollup
       is ONE ROW per server with no Date column, so `shifts === 1` — and printing "140 no-sale opens
       in one shift" turned a WEEK's total into a single night's on a High Risk card and in the PDF.
       Both help texts invite exactly that file ("for a shift or a week"). Only say "one shift" when
       real dates say so; otherwise name the window honestly. */
    /* ⚠⚠ "IN ONE SHIFT" IS A CLAIM ABOUT *THIS SERVER'S* DATES, NOT ABOUT THE FILE'S. Keyed on
       `fileDated` it asserted one shift for anybody the file could not date, so a weekly rollup row
       inside a dated export printed "40 no-sale opens in one shift" for a week's work. `datedSpan`
       is the field that answers this question, it has existed since round 4 for exactly this, and
       it was computed, persisted and read NOWHERE — the comment in `_fmtVal` below discusses it
       while the code beneath that comment reads `fileDated` too. */
    const span = s.shifts > 1 ? ' over ' + s.shifts + ' shifts (' + this._fmtVal(sig, v, s) + ')'
      : (s.datedSpan ? ' in one shift' : ' over the report period');
    if (sig.key === 'no_sales')     return s.raw.no_sales + ' no-sale opens' + span + teamTxt;
    if (sig.key === 'void_pct')     return this.pct(v) + ' of sales voided' + teamTxt;
    // ⚠ The row is already LABELLED "Average check", so repeating it read "Average check: $23.87
    // average check vs an average of $49.87..." — three averages in one line, once the comparison
    // wording changed. The label carries the noun; the detail carries the numbers.
    if (sig.key === 'avg_check')    return App.fmtCurrency(v) + teamTxt;
    if (sig.key === 'comp_pct')     return this.pct(v) + ' of sales comped' + teamTxt;
    if (sig.key === 'cash_ratio')   return this.pct(v) + ' cash' + teamTxt + (avg != null && v > avg ? ', runs high' : ', runs low');
    if (sig.key === 'refund_pct')   return this.pct(v) + ' of sales refunded' + teamTxt;
    if (sig.key === 'sales_per_hr') return App.fmtCurrency(v) + ' per hour' + teamTxt;
    if (sig.key === 'drawer_short') return s.shortCount + ' drawer short' + (s.shortCount === 1 ? '' : 's') + ' (' + App.fmtCurrency(s.shortAmt) + ')' + span + teamTxt;
    if (sig.key === 'walkouts')     return s.walkCount + ' walkout' + (s.walkCount === 1 ? '' : 's') + ' (' + App.fmtCurrency(s.walkAmt) + ')' + span + teamTxt;
    return this._fmtVal(sig, v, s);
  },
  _fmtVal(sig, v, s) {
    /* ⚠ "per shift" IS A CLAIM ABOUT THE FILE. With no Date column every server divides by ONE
       REPORT PERIOD, so on a weekly rollup this printed "140 no-sale opens over the report period
       vs 65 per shift" — two different units in one sentence, and a reader who spreads 140 across
       seven nights gets 20 and concludes the flagged server is HALF the floor when she is three
       times it. The span text at `_flagDetail` was fixed for this and the unit here was not. */
    // The count signals carry a per-shift rate now, so rounding to a whole number
    // would print "0" for a real 0.4-a-shift pattern.
    if (sig.key === 'no_sales' || sig.key === 'drawer_short' || sig.key === 'walkouts') {
      // With no dates there is no per-shift rate to quote — the span text in `_flagDetail` has
      // already said "over the report period", so repeating it here read as
      // "40 over the report period average for the rest of the team".
      /* ⚠ THE UNIT IS DROPPED ONLY WHEN THE SENTENCE HAS ALREADY SAID "over the report period",
         which `_flagDetail` does only at `shifts === 1`. Keyed on `datedSpan` alone, a server with
         several undated rows in a DATED file lost the unit while the sentence still said "over 4
         shifts": "56 no-sale opens over 4 shifts (14) vs an average of 1" — a reader lines up 56
         against 1 and reads 56x instead of 14x. */
      /* ⚠ THE UNIT COMES OFF ONLY WHEN `_flagDetail` HAS ALREADY SAID "over the report period", and
         that is now `shifts === 1 && !datedSpan` — the same predicate, read off the same field, so
         the two can never disagree again. It was keyed on `fileDated`, which is a fact about the
         FILE and not about this server. */
      const bare = !!s && s.shifts === 1 && !s.datedSpan;
      return this._smallNum(v) + (bare ? '' : ' per shift');
    }
    if (sig.key === 'avg_check' || sig.key === 'sales_per_hr') return App.fmtCurrency(v);
    return this.pct(v);
  },
  _autoLabel(dateList) {
    if (!dateList.length) return 'Sales review ' + this.fmtDate(App.todayLocal());
    const sorted = dateList.slice().sort();
    return sorted.length === 1 ? this.fmtDate(sorted[0]) + ' shift'
      : this.fmtDate(sorted[0]) + ' to ' + this.fmtDate(sorted[sorted.length - 1]);
  },

  // ── Render ──────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    this.draw();
    const pend = App._pendingInvestigation;
    if (pend && pend.sku && !pend.productId) {
      App._pendingInvestigation = null;
      S.TheftRisk.openInvestigationModal(null, pend.sku, { stepsDef: this.INVESTIGATION_STEPS, onClose: () => this.draw() });
    }
  },

  draw() {
    this._viewing = null;
    const latest = this.latestReview();
    const importCard = '<div class="card form-card">'
      + '<div class="card-title" style="display:flex;align-items:center;gap:10px;"><span>Sales Integrity Review</span>' + App.freqTag('As needed') + '</div>'
      + '<div id="si-csv"></div><div id="si-imp-result"></div>'
      + '</div>'
      + '<div id="si-imp-actions" style="margin:14px 0 24px;"></div>';

    let body;
    if (!latest) {
      body = '<div class="card" style="padding:22px;"><div style="font-size:14px;font-weight:700;color:var(--t1);margin-bottom:6px;">No reviews yet</div>'
        + '<div style="font-size:13px;color:var(--t3);line-height:1.6;max-width:640px;">Pull a server sales report for a shift or a week from your POS and drop it above. The only column it must have is the server name, and Net Sales is the one that unlocks the most: void, comp and refund rates, the check average and sales per hour are all measured against it, and so is every dollar figure. The more it carries after that (date, no-sales, voids, cash and card split, comps, checks, refunds, hours) the more Bar Cop can read.</div></div>';
    } else {
      body = this.renderReport(latest) + this.renderHistory(latest.id);
    }

    this.container.innerHTML = '<div class="screen">' + importCard + body + '</div>';
    this.mountImporter();
    this.wire();
  },

  mountImporter() {
    const el = document.getElementById('si-csv');
    if (!el || typeof CSVMapper === 'undefined') return;
    CSVMapper.mount(el, {
      dropTitle: 'Drop your POS per-server sales report here',
      // ⚠ NET SALES IS NAMED FIRST. It is the denominator for void %, comp %, refund %, average
      // check and sales per hour — five of nine signals — and every dollar figure on the report.
      // Measured without it: a server still went High Risk with the exposure printed as "-".
      dropSub: 'Needs a Server column, and Net Sales does most of the work after that. Date, no-sales, voids, cash and card split, comps, checks, refunds, and hours are each read if your export has them — the Date column is what matches the report to drawer shortages and walked tabs you have already logged.',
      actionsEl: '#si-imp-actions',
      fields: this.FIELDS,
      confirmLabel: 'Analyze',
      onComplete: rows => this.runImport(rows)
    });
  },

  /* ⚠ THIS DOOR USED TO REPORT NOTHING AT ALL ON SUCCESS. A file with blank server names or an
     unreadable date column drew a full theft report over whatever survived and said not one word
     about the rows it dropped. On the one screen that prints a person's name beside the word theft,
     a row the operator can see in their own file and cannot find in the review is exactly what makes
     them stop trusting the verdict.
     ⚠ AND THE REPORT IS WRITTEN AFTER THE REDRAW, INTO A FRESHLY QUERIED SLOT. `draw()` reassigns
     `container.innerHTML`, so anything written before it is destroyed the instant it is written —
     the defect door 6 shipped, where the common partial case showed nothing whatsoever. */
  async runImport(rows) {
    const review = this.analyze(rows, { source: 'import' });
    const ok = await App.putRecord('core', 'sales_review', review);
    if (!ok) {
      const res = document.getElementById('si-imp-result');
      if (res) res.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">Could not save the review. Nothing was changed — check your connection and try again.</div>';
      return;
    }
    // ⚠ The intake note now renders INSIDE the review card (see `renderReport`), so it survives a
    // reload and a re-view and reaches the PDF. Writing a second copy here would only let the two
    // drift apart, which is how the "fixed on screen, silent in the export" family of bugs starts.
    this.draw();
  },

  /* What the file gave up. Reads the counters `analyze` banked rather than re-deriving them, so the
     note and the report can never disagree about the same file.
     ⚠ It deliberately does NOT repeat the set-aside servers: `renderReport` already names them
     ("Not enough data to score: ..."), and a name beats a count. */
  _intakeNote(review) {
    /* ⚠ PER-FIELD DEFAULTS, NOT ONE OBJECT-LEVEL FALLBACK. The `||` only fired when `intake` was
       missing ENTIRELY, so a partial record — a restore, a half-synced row, anything written before
       a field existed — reached the arithmetic below and printed "NaN rows read." */
    const k0 = (review && review.intake) || {};
    const k = { rows: k0.rows || 0, noName: k0.noName || 0, undated: k0.undated || 0,
      summaryRows: k0.summaryRows || 0, ambiguous: !!k0.ambiguous,
      noShiftCount: k0.noShiftCount || [], unjudged: k0.unjudged || [] };
    const s = (review && review.summary) || { reviewed: 0 };
    const n = (c, one, many) => c + ' ' + (c === 1 ? one : (many || one + 's'));
    // ⚠ An undated row is KEPT (it just has no date), so it is not subtracted from "rows read" —
    // saying otherwise would contradict the report drawn right beside it.
    /* ⚠⚠ MY PER-FIELD DEFAULTS STOPPED THE `NaN` AND PRODUCED A NEGATIVE INSTEAD. A partial record
       carrying `{noName:3}` and no `rows` printed **"-3 rows read"** into the card and the PDF;
       `{rows:5, summaryRows:9}` printed "-4 rows read". Clamped, because a count of rows read is
       never below zero whatever the record is missing, and this line goes into an exported document. */
    const readN = Math.max(0, (k.rows || 0) - (k.noName || 0) - (k.summaryRows || 0));
    const bits = [n(readN, 'row') + ' read'];
    if (s.reviewed) bits.push(n(s.reviewed, 'server') + ' scored');
    // ⚠ The clause has to agree with the count in BOTH branches — "5 rows ... so it could not" was
    // a plural subject with a singular pronoun. Phrased so one wording is right for 1 and for many.
    if (k.undated)  bits.push(n(k.undated, 'row') + ' could not be matched to a shift (no readable date)');
    if (k.noName)   bits.push(n(k.noName, 'row') + ' skipped with no server name');
    if (k.summaryRows) bits.push(n(k.summaryRows, 'totals row') + ' skipped');
    /* Both of these are signals that went QUIET, and a loss signal that goes quiet without saying so
       is indistinguishable from an all-clear — which this file's own header calls its worst outcome.
       They are named rather than counted: the operator can act on a name and not on a tally. */
    if (k.noShiftCount.length) bits.push('no dates for ' + k.noShiftCount.join(', ')
      + ', so no-sale, drawer-short and walkout rates could not be worked out for '
      + (k.noShiftCount.length === 1 ? 'them' : 'those servers'));
    /* ⚠ "TOO FEW SERVERS REPORTED THEM" IS FALSE OF HALF THE SIGNALS IT NAMES. Drawer shorts and
       walked tabs come from Bar Cop's OWN logs, not from any column in the file, and average check
       is computed rather than reported — so the sentence sent an operator hunting for a column that
       does not exist. Say what actually happened: there were not enough servers to compare against. */
    if (k.unjudged.length) bits.push(k.unjudged.join(', ').toLowerCase()
      + (k.unjudged.length === 1 ? ' was' : ' were')
      + ' not scored — too few servers in this file to compare against');
    /* ⚠ ONLY THE CONTRADICTORY FILE IS WORTH SAYING OUT LOUD (S199). A day-first file Bar Cop read
       correctly needs no announcement — it is simply right — and a US file can never trigger the
       detection at all. What the operator does need is the case Bar Cop could not settle. */
    if (k.ambiguous) bits.push('some dates read day-first and others month-first, so day-and-month order could not be settled — check any date where both numbers are 12 or under');
    return bits.join(' · ') + '.';
  },

  // ── The report ────────────────────────────────────────────────────────────
  renderReport(review) {
    /* ⚠⚠ THE ROUND-1 COMMENT SAID THIS WAS GUARDED IN BOTH PLACES AND IT WAS GUARDED IN ONE. Only
       `renderHistory` got it, so a summary-less LATEST review still threw out of `draw()` before
       `container.innerHTML` was assigned — blanking the whole screen, the exact outcome the comment
       claimed was closed. A false comment is worse than no comment: it stops the next reader
       looking. `printReview` needs the same guard for the same reason. */
    const s = review.summary || this._summaryFrom(review);
    const sev = n => n > 0 ? 'var(--red)' : 'var(--t1)';
    const stat = (label, val, color) => '<div class="calc-item"><div class="calc-label">' + label + '</div>'
      + '<div class="calc-val lg" style="' + (color ? 'color:' + color + ';' : '') + '">' + val + '</div></div>';
    const head = '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:4px 0 12px;">'
      + '<div class="sh" style="margin:0;">Review: ' + esc(review.label) + '</div>'
      + '<button class="btn btn-ghost btn-sm no-print" id="si-export">Export PDF</button></div>';
    const statStrip = '<div class="card" style="margin-bottom:14px;"><div style="display:flex;gap:40px;flex-wrap:wrap;align-items:flex-start;">'
      + stat('Servers Reviewed', String(s.reviewed))
      + stat('Flagged', String(s.flagged), sev(s.flagged))
      + stat('High Risk', String(s.high), sev(s.high))
      /* ⚠ "Estimated Exposure" read as the file's whole exposure and it is not: `summary.exposure`
         sums the FLAGGED servers only. A server who trips a single signal is deliberately not named
         (one outlier is noise), but their dollars are still computed — measured, $5,700 of void
         exposure on a 20%-void server was calculated and then printed as "-". The number is right
         for what it counts, so the LABEL is what was lying. */
      + stat('Flagged Exposure', s.exposure > 0 ? App.fmtCurrency(s.exposure) : '-', s.exposure > 0 ? 'var(--red)' : '')
      + '</div></div>';

    // Same predicate the summary uses — see `_isFlagged`. `cleanN` is the complement, so every
    // stored server lands in exactly one of the two counts and none can silently vanish.
    const flagged = (review.servers || []).filter(x => this._isFlagged(x));
    const cleanN = (review.servers || []).filter(x => !this._isFlagged(x)).length;
    const cleanTxt = cleanN ? (cleanN + ' other server' + (cleanN === 1 ? '' : 's') + ' reviewed, no patterns flagged.') : '';
    /* ⚠ The "not cleared" reassurance used to live ONLY in the all-clear branch, so on a review that
       actually names someone — the case an operator reads hardest — the set-aside people got a bare
       list and no statement that they were not cleared. It belongs on the list itself, which prints
       in both branches. */
    /* ⚠ AND IT MUST NOT SAY IT TWICE. When the no-verdict paragraph is itself the `skipped` reason
       it already ends "Anyone set aside was not cleared, just not measured", and this line repeated
       the same claim directly underneath. The PDF was fixed for this and the SCREEN was not — the
       same one-artefact fix that has now happened three times on this file. */
    /* ⚠ SUPPRESS ONLY WHEN THE PARAGRAPH ACTUALLY PRINTED. `_noVerdictReason` RETURNING 'skipped' is
       not the same as the screen SHOWING it — that paragraph only renders when nothing was flagged.
       So on a review that both names somebody AND set most of the roster aside, the reassurance was
       dropped from the screen while the PDF still printed it: more people excluded, less
       explanation, and the two artefacts disagreeing in the same fixture. */
    const nSkip = (review.skipped && review.skipped.length) || 0;
    const nvEarly = this._noVerdictReason(review);
    const saidAlready = !!nvEarly && nvEarly.reason === 'skipped' && !flagged.length;
    /* ⚠ And no doubled period: Bar Cop's own roster convention is "Brianna K.", so a set-aside list
       ending in an initial produced "Not enough data to score: Barback B..". That is the NORMAL
       case here, not an edge one. */
    /* ⚠⚠ GUARDED LIKE EVERY OTHER READER OF THIS FIELD, and it was the only one that was not:
       `_noVerdictReason`, `_summaryFrom` and `printReview` all default it, `nSkip` one line above
       defaults it — and this line then called `.map` on it raw. A review with no `skipped` array
       (a restore, a legacy record) threw out of `renderReport` BEFORE `draw()` assigns
       `container.innerHTML`, so Sales Integrity rendered **nothing at all**. Same class as the
       `summary` guard two rounds ago, on the field right beside it. */
    const names = ((review.skipped) || []).map(esc).join(', ');
    const skipTxt = nSkip
      ? ('Not enough data to score: ' + names + (/[.!?]$/.test(names) ? '' : '.')
         + (saidAlready ? '' : ' ' + (nSkip === 1 ? 'That server was' : 'Those servers were') + ' not cleared, just not measured.')) : '';

    // The clean-and-skipped summary lives INSIDE the review card, divided from the
    // servers to investigate, never as loose text on the page background.
    /* ⚠⚠ WHAT THE FILE DROPPED BELONGS TO THE REVIEW, NOT TO THE IMPORT SCREEN. `_intakeNote` had a
       single call site — the moment of import — writing into the importer's own result slot. So
       every re-opened review lost it, and the PDF never had it at all: the artefact handed to an
       owner printed "Servers reviewed: 4" with no hint that rows were skipped for a missing name,
       dropped as totals lines, or left unmatched to a shift. It also hid the counterweight to the
       worst wording defect this round found — the intake line naming the servers whose rates could
       not be worked out is the ONLY thing on the page that qualifies the numbers above it.
       Rendered from the stored record inside the card, it now survives a reload, a re-view and the
       export, and the import slot no longer needs its own copy. */
    const intakeTxt = this._intakeNote(review);
    let footerInner = '';
    if (intakeTxt) footerInner += '<div style="font-size:11px;color:var(--t4);line-height:1.6;">' + esc(intakeTxt) + '</div>';
    if (flagged.length && cleanTxt) footerInner += '<div style="font-size:12px;color:var(--t3);line-height:1.6;' + (footerInner ? 'margin-top:4px;' : '') + '">' + cleanTxt + '</div>';
    if (skipTxt) footerInner += '<div style="font-size:12px;color:var(--t4);line-height:1.6;' + (footerInner ? 'margin-top:4px;' : '') + '">' + skipTxt + '</div>';
    const footer = footerInner ? '<div style="border-top:1px solid var(--b2);margin-top:4px;padding-top:14px;">' + footerInner + '</div>' : '';

    let inner;
    /* ⚠ "NOTHING FLAGGED" AND "NOTHING COULD BE FLAGGED" ARE NOT THE SAME SENTENCE, and on a
       loss-prevention screen printing the first when the second is true is the worst kind of
       wrong: it reads as an all-clear. Every signal here compares a server against the team, so
       under MIN_TEAM scored servers NOTHING can ever trip — a two-bartender bar was permanently
       green no matter what the numbers said. Same when the file scored nobody at all. Say which
       one happened. */
    const noVerdict = this._noVerdictReason(review);
    if (!flagged.length && noVerdict) {
      inner = '<div style="font-size:13px;color:var(--t1);font-weight:700;">' + esc(noVerdict.title) + '</div>'
        + '<div style="font-size:12px;color:var(--t3);margin-top:6px;">' + esc(noVerdict.detail) + '</div>';
    } else if (!flagged.length) {
      /* ⚠ THE ALL-CLEAR MAY ONLY CLAIM WHAT WAS ACTUALLY MEASURED. It said "Every server's numbers
         track the floor" four words above a line reading "Not enough data to score: Barback." — an
         absolute claim about a set that demonstrably excluded someone. Scope it to the scored count
         and, when anyone was set aside, say plainly that they were not cleared, just not measured. */
      /* ⚠ This branch only renders when `noVerdict` is null, which requires reviewed >= MIN_TEAM —
         so the singular and zero wordings here were unreachable dead branches. The set-aside
         sentence also moved out to `skipTxt`, which prints in BOTH branches (it used to appear only
         when nobody was flagged, i.e. never on the review an operator reads hardest). */
      inner = '<div style="font-size:13px;color:var(--green);font-weight:700;">'
        + 'No servers flagged among the ' + s.reviewed + ' scored.</div>'
        + '<div style="font-size:12px;color:var(--t3);margin-top:6px;">'
        + 'Their numbers track the floor. Run this each shift or week and the outliers surface on their own.</div>';
    } else {
      /* ⚠⚠ THE BADGE ASKS "WAS THIS CASE OPENED IN RESPONSE TO THIS REVIEW", SO IT NEEDS THE DATE
         THE REVIEW WAS MADE — NOT THE LAST SALES DATE IN THE FILE. `review.date` is the newest date
         the import could parse, which for any backfill or catch-up import is months before the
         review existed. Measured: a January period imported today, against a case opened in May and
         resolved, printed a green **"Resolved"** on a brand-new flag — because May is after January.
         A case cannot be a response to a review that did not exist yet. `created_at` is when the
         review was made; `date` stays the sales period it covers, which is what the label uses. */
      // ⚠ Fails CLOSED, as the guard inside `serverCard` already does: with no usable creation
      // stamp Bar Cop cannot know a resolved case is current, so it does not claim it is.
      const madeOn = this._madeOn(review);
      /* ⚠⚠ THE CAVEAT WAS SUPPRESSED BY THE VERY FLAG IT QUALIFIES. Both artefacts gated it on
         "nothing was flagged", so the moment a solo escalation named somebody the sentence
         explaining that this file cannot support a comparison disappeared. Measured on a
         two-bartender bar: the card printed "50% of sales comped vs an average of 0.7% for the rest
         of the team" — where the rest of the team is ONE person — while `_noVerdictReason` was
         returning "Bar Cop needs at least 3 servers with usable numbers before it can call anyone an
         outlier. This file scored 2", and neither the screen nor the PDF printed a word of it.
         A caveat that only appears when there is nothing to caveat is not a caveat. */
      inner = (noVerdict ? '<div style="font-size:12px;color:var(--amber);line-height:1.6;margin-bottom:12px;">'
          + esc(noVerdict.title + ' ' + noVerdict.detail) + '</div>' : '')
        + flagged.map(x => this.serverCard(x, madeOn)).join('');
    }
    const reviewCard = '<div class="card">' + inner + footer + '</div>';

    const note = '<div style="border:1px solid var(--gold-tint-bord);background:var(--gold-tint);border-radius:6px;padding:12px 14px;margin:18px 0 6px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--amber);margin-bottom:5px;">Heads Up</div>'
      + '<div style="font-size:11px;color:var(--t2);line-height:1.6;">These are patterns to investigate, not proof. A flag means a server\'s numbers are an outlier worth a closer look. Product theft (overpouring, free pours, bottle loss) does not show in a sales report; pour cost, inventory variance, and spot checks catch that. Bar Cop is a software tool, not an investigator; confirm before acting on anyone.</div>'
      + '</div>';

    return statStrip + head + reviewCard + note;
  },

  serverCard(x, reviewDate) {
    const sevColor = x.severity === 'high' ? 'var(--red)' : 'var(--amber)';
    const sevLabel = x.severity === 'high' ? 'High Risk' : 'Watch';
    const byCat = {};
    (x.flags || []).forEach(f => { (byCat[f.cat] = byCat[f.cat] || []).push(f); });
    const cats = this.CATS.filter(c => byCat[c.key] && byCat[c.key].length).map(c => {
      const rows = byCat[c.key].map(f => '<div style="display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px solid var(--b2);font-size:12px;">'
        + '<span style="color:var(--t2);">' + esc(f.label) + (f.soft ? ' <span style="color:var(--t4);">(soft)</span>' : '') + '<span style="color:var(--t3);">: ' + esc(f.detail) + '</span></span>'
        + '<span style="color:' + (f.exposure > 0 ? 'var(--red)' : 'var(--t4)') + ';white-space:nowrap;font-weight:600;">' + (f.exposure > 0 ? App.fmtCurrency(f.exposure) : '') + '</span></div>').join('');
      return '<div style="margin-top:10px;"><div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-bottom:2px;">' + esc(c.label) + '</div>' + rows + '</div>';
    }).join('');

    /* ⚠ A CASE CLOSED MONTHS AGO IS NOT THIS WEEK'S ANSWER. `invList` matched on NAME alone, with no
       date and no review id — so a March investigation that was resolved and forgotten printed a
       green "Resolved" on a brand-new High Risk card, which reads as "already looked at, nothing
       here". A resolved case only speaks for this review if it was opened on or after it. An OPEN
       case still counts whenever it was raised, because it is still open. */
    // ⚠ The review's own date is PASSED IN, not inferred from `_viewing`/`latestReview()`. Inferring
    // it made the answer depend on which screen happened to be mounted, and a card rendered before
    // anything was stored fell back to "no date", which re-opened the stale-Resolved hole.
    const revDate = String(reviewDate || '').slice(0, 10);
    const invList = (App.data.variance_investigations || []).filter(i => i.sku === x.name + ' (sales)');
    const invOpen = invList.some(i => i.status !== 'resolved');
    /* ⚠ AND IT FAILS CLOSED, NOT OPEN. `!revDate ||` meant a review with no date (a restored or
       legacy record) treated ANY old resolved case as current — the exact stale-Resolved hole this
       parameter was added to close, re-opened by its own guard. With no date to compare, Bar Cop
       cannot know the case is current, so it does not claim it is. */
    const invResolved = !invOpen && !!revDate && invList.some(i => i.status === 'resolved'
      && String(i.opened_date || i.date || '').slice(0, 10) >= revDate);
    const invLabel = invOpen ? 'Reviewing' : invResolved ? 'Resolved' : 'Open Investigation';
    const invStyle = invResolved ? 'color:var(--green);' : (invOpen ? 'background:var(--gold-tint);border:1px solid var(--gold-tint-bord);' : '');

    return '<div style="background:#0D181E;border-radius:8px;padding:16px 18px;margin-bottom:10px;">'
      + '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap;">'
      +   '<div style="font-size:15px;font-weight:700;color:var(--t1);">' + esc(x.name) + '</div>'
      +   '<div style="display:flex;align-items:center;gap:12px;">'
      +     (x.exposure > 0 ? '<span style="font-size:12px;color:var(--red);font-weight:600;">' + App.fmtCurrency(x.exposure) + ' exposure</span>' : '')
      +     '<span style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:' + sevColor + ';">' + sevLabel + '</span>'
      +   '</div>'
      + '</div>'
      + cats
      + '<div class="no-print" style="margin-top:12px;"><button class="btn btn-ghost btn-sm si-investigate" data-name="' + esc(x.name) + '" data-staff="' + esc(x.staff_id || '') + '" style="' + invStyle + '">' + invLabel + '</button></div>'
      + '</div>';
  },

  renderHistory(currentId) {
    const all = this.reviews().slice().sort(App.cmpNewest);
    const past = all.filter(r => r.id !== currentId);
    if (!past.length) return '';
    /* ⚠ `r.summary` UNGUARDED TOOK THE WHOLE SCREEN DOWN. One stored review without it — a restore,
       a partial sync, a record from before the shape settled — threw
       "Cannot read properties of undefined" out of BOTH this and renderReport, so a single bad row
       blanked Sales Integrity entirely rather than skipping one line of a history table. */
    const rows = past.slice(0, App.listLimit('core', 'sales_review')).map(r => {
      // ⚠ Rebuilt the same way `renderReport` and `printReview` do, or the history row printed
      // "Reviewed - / Flagged - / Exposure -" for a review that renders 4 / 1 / $510.63 the moment
      // you click into it. Three call sites, one rule.
      const sm = r.summary || this._summaryFrom(r);
      return '<tr class="si-hist-row" data-id="' + esc(r.id) + '" style="cursor:pointer;">'
      + '<td><div class="val">' + esc(r.label) + '</div></td>'
      + '<td>' + this.fmtDate(r.date) + '</td>'
      + '<td>' + sm.reviewed + '</td>'
      + '<td style="color:' + (sm.flagged > 0 ? 'var(--red)' : 'var(--t3)') + ';">' + sm.flagged + '</td>'
      + '<td>' + (sm.exposure > 0 ? App.fmtCurrency(sm.exposure) : '-') + '</td>'
      + '<td><div class="row-actions"><button class="btn btn-ghost btn-sm si-view" data-id="' + esc(r.id) + '">View</button>'
      + '<button class="btn btn-danger btn-sm si-del" data-id="' + esc(r.id) + '">Delete</button></div></td></tr>';
    }).join('');
    return '<div class="sh" style="margin:24px 0 10px;">Past Reviews</div>'
      + '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
      + '<th>Review</th><th>Date</th><th>Reviewed</th><th>Flagged</th><th>Exposure</th><th></th></tr></thead><tbody>'
      + rows + '</tbody></table></div>'
      + App.showOlderBar('core', 'sales_review', past, false);
  },

  wire() {
    document.getElementById('si-export')?.addEventListener('click', () => this.printReview(this._viewing || this.latestReview()));
    this.container.onclick = ev => {
      const inv = ev.target.closest('.si-investigate');
      if (inv) { this.openInvestigation(inv.dataset.name, inv.dataset.staff); return; }
      const view = ev.target.closest('.si-view');
      const del = ev.target.closest('.si-del');
      const row = ev.target.closest('.si-hist-row');
      if (del) { ev.stopPropagation(); this.confirmDel(del.dataset.id); return; }
      if (view) { ev.stopPropagation(); this.viewReview(view.dataset.id); return; }
      if (row) { this.viewReview(row.dataset.id); return; }
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.draw()); return; }
    };
  },

  viewReview(id) {
    const r = this.reviews().find(x => x.id === id);
    if (!r) return;
    this._viewing = r;
    App.pushView(() => {
      this.container.innerHTML = '<div class="screen">' + this.renderReport(r) + '</div>';
      document.getElementById('si-export')?.addEventListener('click', () => this.printReview(r));
      // Back is the floating nav from pushView. .si-investigate is handled by the
      // delegated container.onclick from wire() (no per-button listener, or it
      // would double-fire and open two cases).
    });
  },

  async confirmDel(id) {
    if (!(await App.confirmDelete())) return;
    await App.removeRecord('core', 'sales_review', id);
    this.draw();
  },

  // A flag opens a six-step investigation that lives in Loss Prevention, server
  // and cash focused (steps_def carries the text so Loss Prevention renders it).
  /* ⚠ CLOSING THE MODAL USED TO THROW AWAY THE REVIEW YOU WERE READING. `draw()` rebuilds the
     LANDING from `latestReview()` and clears `_viewing`, so opening an investigation from a PAST
     review and closing it silently swapped the operator onto the current one — with the floating
     Back button still lit, which makes it look deliberate. Re-render whichever view is on screen. */
  openInvestigation(name, staffId) {
    const viewing = this._viewing;
    S.TheftRisk.openInvestigationModal(null, name + ' (sales)', {
      stepsDef: this.INVESTIGATION_STEPS,
      staffId: staffId || '',
      onClose: () => {
        if (viewing) { this._viewing = viewing; this.container.innerHTML = '<div class="screen">' + this.renderReport(viewing) + '</div>';
          document.getElementById('si-export')?.addEventListener('click', () => this.printReview(viewing)); return; }
        this.draw();
      }
    });
  },

  // ── PDF ─────────────────────────────────────────────────────────────────────
  async printReview(review) {
    if (!review) return;
    try { await App._ensurePDFLib(); }
    catch (e) { alert('Could not load the PDF engine. Check your connection and try again.'); return; }
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const b = App._pdfBuilder('Sales Integrity Review');
    b.header({ right: 'Sales Integrity Review', meta: review.label + ', generated ' + today });
    const sm = review.summary || this._summaryFrom(review);
    let nvSaid = null;   // which no-verdict reason the document already stated, so nothing repeats it
    b.table(['Summary', ''], [
      ['Servers reviewed', String(sm.reviewed)],
      ['Flagged', String(sm.flagged)],
      ['High risk', String(sm.high)],
      // Same wording as the screen's stat strip — this table and that strip are the same four numbers.
      ['Flagged exposure', sm.exposure > 0 ? '$' + Number(sm.exposure).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-']
    ], { columnStyles: { 1: { halign: 'right' } } });
    // ⚠ THE SAME CAVEAT THE SCREEN SHOWS. Without it this document printed "Flagged: 0" beside a
    // review that could never have flagged anyone, and it is the artefact that leaves the building.
    {
      // ⚠ Prints whether or not anyone was flagged — see the matching note in `renderReport`. The
      // document that leaves the building is the one that most needs to carry its own caveat.
      const nv = this._noVerdictReason(review);
      if (nv) { b.paragraph(nv.title + ' ' + nv.detail); nvSaid = nv.reason; }
      // What the file gave up, in the document as well as on the screen — same sentence, one source.
      const it = this._intakeNote(review);
      if (it) b.paragraph('What this file carried: ' + it);
    }
    /* ⚠ THE DOCUMENT MUST CARRY WHAT THE SCREEN CARRIES. Four things were on screen and missing
       here, and this is the artefact handed to an owner, a partner, a lender or an accountant:
         · the SET-ASIDE servers. The screen names them; the PDF printed "Servers reviewed 4" with
           no hint that anyone was excluded. Exactly the shape of the caveat bug this file's own
           header block says was already closed once — fixed on screen, silent in the export;
         · the CATEGORY grouping (Register Manipulation / Cash Skimming / Under-Ringing), which the
           help text promises by name and the PDF printed as one flat list;
         · the per-flag DOLLARS, so a $238 comp exposure and a $0 behavioural flag looked identical;
         · the `(soft)` marker, so a weight-1 soft reading looked exactly like a strong tell. */
    (review.servers || []).filter(x => this._isFlagged(x)).forEach(x => {
      b.sectionTitle(x.name + '  (' + (x.severity === 'high' ? 'High Risk' : 'Watch') + (x.exposure > 0 ? ', ' + App.fmtCurrency(x.exposure) + ' exposure' : '') + ')');
      const byCat = {};
      (x.flags || []).forEach(f => { (byCat[f.cat] = byCat[f.cat] || []).push(f); });
      this.CATS.filter(c => byCat[c.key] && byCat[c.key].length).forEach(c => {
        b.table([c.label, 'Detail', 'Exposure'], byCat[c.key].map(f =>
          [f.label + (f.soft ? ' (soft)' : ''), f.detail, f.exposure > 0 ? App.fmtCurrency(f.exposure) : '']),
          { columnStyles: { 2: { halign: 'right' } } });
      });
    });
    if (review.skipped && review.skipped.length) {
      /* ⚠ TWO FIXES HERE, BOTH FOUND BY READING THE DOCUMENT RATHER THAN THE CODE.
         (a) When the no-verdict paragraph above already ran with `reason: 'skipped'`, this printed
             the SAME two claims again, back to back, in the document handed to an owner. Drop the
             explanatory half when it has already been said; the NAMES are what this paragraph is
             for and the screen prints only the names too.
         (b) One name read "These names ... them ... They were not cleared" — the screen got the
             singular right in the same fixture and the PDF did not. */
      const one = review.skipped.length === 1;
      const already = nvSaid === 'skipped';
      // ⚠ The same trailing-punctuation test the screen uses. Bar Cop's roster convention is
      // "Brianna K.", so "Barback B.." was the NORMAL case — fixed on screen in round 4 and not
      // here, which is the fourth screen-fixed/PDF-missed instance this file has tracked.
      const pdfNames = review.skipped.join(', ');
      b.paragraph('Not enough data to score: ' + pdfNames + (/[.!?]$/.test(pdfNames) ? '' : '.')
        + (already ? '' : (one
            ? ' This name was set aside because the report did not carry enough checks or volume to'
              + ' benchmark them fairly. They were not cleared, only left unmeasured.'
            : ' These names were set aside because the report did not carry enough checks or volume to'
              + ' benchmark them fairly. They were not cleared, only left unmeasured.')));
    }
    /* ⚠ THE DATE THE REPORT WAS UPLOADED IS NOT TODAY. Exporting a review from Past Reviews printed
       "a sales report you uploaded on <today>", misdating the evidence by however old the review is
       — eight weeks in the case that found it. `today` still belongs on "generated". */
    /* ⚠ PARSE IT, DO NOT SLICE IT — the same defect this file spent a whole block removing from the
       date column, reintroduced by me in the fix directly above. `.slice(0, 10)` on a malformed
       `created_at` of "Week of 7/6" cut mid-value and `fmtDate` handed back the fragment, so the
       LEGAL DISCLAIMER of a document going to a lender read "uploaded on Week of 7/". Anything that
       will not parse falls through to "earlier". */
    /* ⚠⚠ `created_at` IS A UTC INSTANT, SO READING ITS DATE PART IS `toISOString().slice(0,10)` IN
       DISGUISE — the exact convention violation this project has a standing rule against. A review
       imported at 8:30pm Chicago is stored `...T01:30:00Z`, and the LEGAL DISCLAIMER of the document
       handed to a lender then dated the evidence to TOMORROW. Most of a bar's imports happen after
       7pm, so this was the common case, not the edge one. Convert the instant to a LOCAL date.
       ⚠ `review.date` is the last SALES date in the file, not when anyone uploaded it, so it is no
       longer used as a stand-in. And a date that cannot be true — before Bar Cop existed, or in the
       future — falls through to "earlier" rather than printing an impossible claim. */
    /* ⚠ A BARE ymd IS NOT AN INSTANT. `new Date('2026-07-26')` is UTC midnight, which `ymdLocal`
       then walks back to the 25th in every US timezone — the same one-day error, from the other
       end. Anchor a date-only value to local midnight before converting. */
    const madeYmd = this._madeOn(review);
    const uploaded = madeYmd ? this.fmtDate(madeYmd) : '-';
    b.disclaimer('Generated ' + today + ' from a sales report uploaded ' + (uploaded === '-' ? 'earlier' : 'on ' + uploaded)
      + '. These are statistical patterns worth investigating, not proof of theft. Product theft (overpouring, '
      + 'free pours, walking out bottles) does not show in a sales report at all, so this review does not cover it. '
      + 'Bar Cop is a software tool, not an investigator, auditor, or attorney. Confirm with your own review before '
      + 'acting on any employee.');
    await b.save('BarCop_SalesIntegrity_' + App._pdfDateStamp() + '.pdf');
  },

  showHowTo() {
    App.showHelpModal('How Sales Integrity Works', [
      { p: ['Sales Integrity is the deep theft read. You drop a per-server sales report from your POS and Bar Cop benchmarks every server against the rest of the floor, then flags the ones whose numbers do not add up, with a dollar exposure on each. It is the feature an owner runs every shift or every week.'] },
      { h: 'What it catches, what it does not', p: ['It catches the register and cash games that leave a fingerprint in the sales data: no-sale drawer opens, void abuse, abnormal cash mix, low average checks, heavy comps, refunds, plus drawer shorts and walkouts Bar Cop already has on file. It does not catch product theft (overpouring, free pours, watering or walking out bottles), because an unrung free drink never reaches a sales report. Pour cost, inventory variance, and spot checks catch that half.'] },
      /* ⚠ THE DATE COLUMN WAS NAMED NOWHERE IN THE WHOLE SCREEN, and it is the one that switches on
         BOTH capture signals — drawer shorts (weight 3, strong) and walkouts. Measured: the same
         file with and without a Date column gave 1 flagged / $361 exposure versus 0 / $0. */
      { h: 'Drop the report', p: ['Pull a per-server sales summary for a shift or a week from your POS and drop it in the box up top. Map the columns once and Bar Cop remembers it. The only column it must have is the server name; most of the others unlock a signal, so the richer the export, the sharper the read. Net Sales earns its place several times over — the void, comp, refund and check-average reads are all measured against it. Include the Date column if your export has one: it is what lets Bar Cop line the report up with the drawer shortages and walked tabs you have already logged, and drawer shortages are one of the strongest tells it has. A server with too few checks to judge fairly is set aside, not flagged.', 'This is the deep theft read and wants a richer export than the weekly one, with the register and cash columns. Your basic per-server covers and sales already import at the Shift weekly close and show up in Server Check, so use that for check averages and this for the theft patterns.'] },
      /* ⚠ THE "or a strong tell is severe" CLAUSE WAS UNREACHABLE and said the opposite of the rule.
         `severity` is `clean` below TWO independent flags, full stop — measured, a server at 60
         no-sale opens against a floor of 1 raised that flag and still read clean, and the screen
         printed the all-clear. This file's own header states the real rule; the help text
         contradicted it, which is the worst place for it since it sets what the operator expects. */
      /* ⚠ Every claim in this section is checked against the code by verify-sales-integrity block K.
         Three were false when first written: it said the money behind a no-sale flag is a share of
         sales (it is a raw count of opens, and that signal carries no dollars at all), it said
         "five times the floor" while the card printed the whole-team average (~4x), and it said
         flags are sorted worst first when only SERVERS are sorted. */
      { h: 'How a server gets flagged', p: ['One outlier is usually noise; a real pattern stacks. A server is named when at least two separate signals line up — so a naturally low check average on a slow station, on its own, is never treated as a pattern.', 'There is one exception, and it is deliberately narrow. A single signal can put someone on the board as Watch, never High Risk, when it runs five times the rest of the floor and the loss behind it is material: a real share of that server\'s own sales for voids, comps and discounts or refunds, or at least ten drawer opens for no-sales. One signal is a lead worth a look, not a pattern Bar Cop will assert. Cash mix, check averages, sales per labour hour, drawer shorts and walkouts are never enough on their own, however far off they look: a cash-heavy or a slow station explains the first three, and a bartender who runs short once or twice is a training problem, not a pattern.', 'Servers are listed worst first, and each one\'s flags are grouped into Register Manipulation, Cash Skimming, and Under-Ringing. Every figure you see, and every dollar exposure, is measured against the rest of the team with that server left out, so their own numbers never soften the comparison. A dollar exposure is shown on the signals where one can be computed honestly (voids, comps, refunds, drawer shorts and walkouts); the behavioural signals carry no dollar figure, so a flagged server can show none.'] },
      { h: 'Working a flag', p: ['A flag is a lead, not a verdict. Open Investigation starts a six-step case over in Loss Prevention so you work it the same way you work any variance: watch the drawer, pull the void timestamps, talk to the shift, document the finding. Export PDF saves the review for an owner or partner. Confirm before you act on anyone.'] }
    ]);
  }
};
