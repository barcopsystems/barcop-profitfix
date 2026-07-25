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
  FIELDS: [
    { key: 'server',     label: 'Server / Employee', required: true,  match: ['server', 'employee', 'employee name', 'name', 'staff', 'bartender', 'cashier'] },
    { key: 'date',       label: 'Date',              required: false, match: ['date', 'business date', 'shift date', 'day'] },
    { key: 'net_sales',  label: 'Net Sales',         required: false, match: ['net sales', 'net', 'total sales', 'sales', 'gross sales', 'gross'] },
    { key: 'checks',     label: 'Checks',            required: false, match: ['checks', 'check count', 'transactions', 'tickets', 'guest checks', 'tabs'] },
    { key: 'cash_sales', label: 'Cash Sales',        required: false, match: ['cash sales', 'cash', 'cash tenders', 'cash collected'] },
    { key: 'card_sales', label: 'Card Sales',        required: false, match: ['card sales', 'card', 'credit', 'credit card', 'non-cash', 'non cash'] },
    { key: 'voids',      label: 'Void $',            required: false, match: ['void amount', 'voids', 'void', 'void total', 'voided'] },
    { key: 'void_count', label: 'Void Count',        required: false, match: ['void count', 'voids count', '# voids', 'number of voids'] },
    { key: 'comps',      label: 'Comp / Discount $', required: false, match: ['comp amount', 'comps', 'comp', 'discount', 'discounts', 'promo'] },
    { key: 'no_sales',   label: 'No-Sale Opens',     required: false, match: ['no sale', 'no-sale', 'no sales', 'nosale', 'drawer opens', 'no sale count'] },
    { key: 'refunds',    label: 'Refund $',          required: false, match: ['refund', 'refunds', 'returns', 'refund amount'] },
    { key: 'hours',      label: 'Labor Hours',       required: false, match: ['hours', 'labor hours', 'hrs', 'worked'] }
  ],

  // Signal config. dir: how an outlier reads (high = more is worse, low = less is
  // worse, both = either extreme). weight feeds the composite; strong = a top tell
  // worth extra. cat groups the flag in the report. dollarKey present = a real $
  // exposure can be computed (no fabricated dollars on behavioral-only signals).
  SIGNALS: [
    { key: 'no_sales',    label: 'No-sale drawer opens',     cat: 'register', dir: 'high', weight: 3, strong: true },
    { key: 'void_pct',    label: 'Void rate',                cat: 'register', dir: 'high', weight: 3, strong: true, dollar: 'voids' },
    { key: 'avg_check',   label: 'Average check',            cat: 'pricing',  dir: 'low',  weight: 2 },
    { key: 'comp_pct',    label: 'Comps and discounts',      cat: 'pricing',  dir: 'high', weight: 2, dollar: 'comps' },
    { key: 'cash_ratio',  label: 'Cash mix',                 cat: 'cash',     dir: 'both', weight: 2 },
    { key: 'refund_pct',  label: 'Refunds',                  cat: 'cash',     dir: 'high', weight: 2, dollar: 'refunds' },
    { key: 'sales_per_hr',label: 'Sales per labor hour',     cat: 'register', dir: 'low',  weight: 1, soft: true },
    { key: 'drawer_short',label: 'Drawer shorts',            cat: 'cash',     dir: 'high', weight: 3, strong: true, dollar: 'short', capture: true },
    { key: 'walkouts',    label: 'Walkouts',                 cat: 'cash',     dir: 'high', weight: 2, dollar: 'walkout', capture: true }
  ],
  CATS: [
    { key: 'register', label: 'Register Manipulation' },
    { key: 'cash',     label: 'Cash Skimming' },
    { key: 'pricing',  label: 'Under-Ringing and Pricing' }
  ],
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
    const scored = (review && review.summary && review.summary.reviewed) || 0;
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
    const CAPTURE = { drawer_short: 1, walkouts: 1 };
    const live = new Set();
    ((review && review.servers) || []).forEach(s => {
      const m = (s && s.metrics) || {};
      Object.keys(m).forEach(k => {
        if (m[k] == null) return;
        if (CAPTURE[k] && !(m[k] > 0)) return;
        live.add(k);
      });
    });
    if (live.size < 2) {
      return {
        reason: 'signals',
        title: 'Not enough columns in this file to reach a verdict.',
        detail: 'Bar Cop only names a server when at least two separate signals line up, and this file carried '
          + (live.size === 1 ? 'only one signal Bar Cop can read' : 'no signals Bar Cop can read')
          + '. Map more columns — voids, comps, no-sale opens, refunds, cash and card split — and re-run it. '
          + 'That is not an all-clear, it just means there was not enough here to judge anyone on.'
      };
    }
    return null;
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
  staffByName() {
    const m = {};
    ((App.laborData && App.laborData.lc_staff) || []).forEach(s => { if (s && s.name) m[String(s.name).trim().toLowerCase()] = s; });
    return m;
  },

  // App.parseNum is the ONE coercion; null for "no number" is already this caller's contract.
  num(v) { return App.parseNum(v); },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  pct(v) { return (v == null) ? '-' : (Math.round(v * 1000) / 10) + '%'; },

  // ── The engine: raw mapped rows → a review object (true by construction, so the
  //    seed and the upload path both call this). ───────────────────────────────
  analyze(rows, opts) {
    opts = opts || {};
    const present = {};   // which columns the file actually carried
    const agg = {};       // server name → summed fields
    const dates = new Set();
    (rows || []).forEach(r => {
      const name = (r.server || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (!agg[key]) agg[key] = { name, sales: 0, checks: 0, cash: 0, card: 0, voids: 0, void_count: 0, comps: 0, no_sales: 0, refunds: 0, hours: 0, days: new Set() };
      const a = agg[key];
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
      const LOSS = { voids: 1, comps: 1, refunds: 1, no_sales: 1, void_count: 1 };
      const add = (field, raw, col) => {
        let n = this.num(raw);
        if (n == null) return;
        if (LOSS[field]) n = Math.abs(n);
        a[field] += n; present[col] = true;
      };
      add('sales', r.net_sales, 'net_sales');
      add('checks', r.checks, 'checks');
      add('cash', r.cash_sales, 'cash_sales');
      add('card', r.card_sales, 'card_sales');
      add('voids', r.voids, 'voids');
      add('void_count', r.void_count, 'void_count');
      add('comps', r.comps, 'comps');
      add('no_sales', r.no_sales, 'no_sales');
      add('refunds', r.refunds, 'refunds');
      add('hours', r.hours, 'hours');
      const d = r.date ? String(r.date).slice(0, 10) : '';
      if (d) { dates.add(d); a.days.add(d); }
    });

    // Optional cross-reference to captured Shift data, restricted to the report's
    // dates so we never pull in unrelated shifts. Adds drawer shorts + walkouts.
    const dateList = [...dates];
    const inDates = ds => dateList.length === 0 ? false : dateList.indexOf(String(ds).slice(0, 10)) >= 0;
    const capShorts = {}, capWalk = {};
    if (dateList.length) {
      ((App.shiftData && App.shiftData.sc_variances) || []).forEach(v => {
        if (v.status === 'Short' && v.cashier && inDates(v.date)) {
          const k = String(v.cashier).trim().toLowerCase();
          if (!capShorts[k]) capShorts[k] = { count: 0, amount: 0 };
          capShorts[k].count++; capShorts[k].amount += Math.abs(this.num(v.variance) || 0);
        }
      });
      ((App.shiftData && App.shiftData.sc_walked_tabs) || []).forEach(w => {
        if (w.server && inDates(w.date)) {
          const k = String(w.server).trim().toLowerCase();
          if (!capWalk[k]) capWalk[k] = { count: 0, amount: 0 };
          capWalk[k].count++; capWalk[k].amount += (this.num(w.amount) || 0);
        }
      });
    }

    // Per-server metrics. Every signal is a RATE, never a raw count: the file is
    // invited to cover several days, so the bartender who closes every night racks
    // up 3-5x everyone's no-sales and shorts purely by working more. Counts are
    // divided by the shifts that server actually appears on (one report period when
    // the export carries no date column, which puts everyone on the same footing).
    const hasCapture = dateList.length > 0;
    const byName = this.staffByName();
    const servers = Object.keys(agg).map(key => {
      const a = agg[key];
      const shifts = a.days.size || 1;
      const shortCount = capShorts[key] ? capShorts[key].count : 0;
      const walkCount  = capWalk[key] ? capWalk[key].count : 0;
      const cashTotal = (present.cash_sales && present.card_sales) ? (a.cash + a.card) : null;
      const m = {
        no_sales:    present.no_sales ? a.no_sales / shifts : null,
        void_pct:    (present.voids && a.sales > 0) ? a.voids / a.sales : null,
        avg_check:   (present.checks && a.checks > 0) ? a.sales / a.checks : null,
        comp_pct:    (present.comps && a.sales > 0) ? a.comps / a.sales : null,
        cash_ratio:  (cashTotal && cashTotal > 0) ? a.cash / cashTotal : ((present.cash_sales && a.sales > 0) ? a.cash / a.sales : null),
        refund_pct:  (present.refunds && a.sales > 0) ? a.refunds / a.sales : null,
        sales_per_hr:(present.hours && a.hours > 0) ? a.sales / a.hours : null,
        // A server with no captured short had ZERO shorts on these dates, which is a
        // measurement. Left null they dropped out of the team average, so the average
        // was taken across only the servers who HAD one and could never be under 1.
        drawer_short: hasCapture ? shortCount / shifts : null,
        walkouts:     hasCapture ? walkCount / shifts : null
      };
      const staff = byName[key];
      return { name: a.name, staff_id: staff ? staff.id : '', raw: a, shifts, shortCount, walkCount,
        shortAmt: capShorts[key] ? capShorts[key].amount : 0, walkAmt: capWalk[key] ? capWalk[key].amount : 0,
        m, qualifies: false };
    });

    // Who is big enough to benchmark. With a Checks column that is MIN_CHECKS; with
    // no way to count checks it is volume against the median server, so a barback
    // with $60 of rung sales is not scored or flagged.
    const salesVals = servers.map(s => s.raw.sales).filter(v => v > 0).sort((x, y) => x - y);
    const medSales = salesVals.length ? salesVals[Math.floor(salesVals.length / 2)] : 0;
    servers.forEach(s => {
      s.qualifies = present.checks
        ? (s.raw.checks >= this.MIN_CHECKS)
        : (medSales > 0 && s.raw.sales >= medSales * this.MIN_SALES_SHARE);
    });

    // Team baselines from qualifying servers only.
    const scored = servers.filter(s => s.qualifies);
    const teamAvg = {};
    this.SIGNALS.forEach(sig => {
      const vals = scored.map(s => s.m[sig.key]).filter(v => v != null);
      teamAvg[sig.key] = vals.length ? vals.reduce((t, v) => t + v, 0) / vals.length : null;
    });
    const teamCount = scored.length;

    // Evaluate each server against the team.
    scored.forEach(s => {
      s.flags = [];
      this.SIGNALS.forEach(sig => {
        const v = s.m[sig.key];
        const avg = teamAvg[sig.key];
        if (v == null) return;
        // Capture-based signals (drawer shorts / walkouts) are real logged events
        // rather than a rate to benchmark hard, but a small crew still has no floor
        // to stand out from: on a two-bartender bar one $7 short IS half the team.
        // The old gate read `teamCount < 3 ||` and so short-circuited to ALWAYS trip
        // on the exact crews it should have refused to score, which is how one short
        // plus one walked tab printed "High Risk, Cash Skimming" against a name.
        // Every other signal below refuses without a floor; these do the same now.
        let tripped = false;
        if (sig.capture) {
          // Two tests, both required: enough events to be a pattern rather than the
          // one short every bartender has eventually, and a per-shift rate above the
          // floor's. Rate for the comparison, raw count for the materiality, so the
          // closer who works five nights is not flagged for volume alone.
          const events = (sig.key === 'drawer_short') ? s.shortCount : s.walkCount;
          tripped = teamCount >= this.MIN_TEAM && avg != null
                    && events >= this.MIN_EVENTS && v > avg * 1.5;
        } else if (avg == null || teamCount < this.MIN_TEAM) {
          tripped = false;   // need a floor to compare against
        } else if (sig.dir === 'high') {
          // Compare on the rate, but check materiality on the raw count for no_sales:
          // its floor has always meant "at least this many opens in the window", and
          // testing a per-shift rate against it would demand 3 opens EVERY shift and
          // miss the bartender popping the drawer twice a night all week.
          const material = (sig.key === 'no_sales') ? s.raw.no_sales : v;
          tripped = v > avg * 2 && material >= this._floor(sig.key, avg);
        } else if (sig.dir === 'low') {
          tripped = avg > 0 && v < avg * 0.6;
        } else if (sig.dir === 'both') {
          tripped = avg > 0 && Math.abs(v - avg) > Math.max(0.15, avg * 0.4);
        }
        if (!tripped) return;
        s.flags.push({
          key: sig.key, label: sig.label, cat: sig.cat, weight: sig.weight, strong: !!sig.strong, soft: !!sig.soft,
          value: v, team: avg, dir: sig.dir,
          detail: this._flagDetail(sig, v, avg, s),
          exposure: this._exposure(sig, v, avg, s)
        });
      });
      const comp = s.flags.reduce((t, f) => t + f.weight + (f.strong ? 1 : 0), 0);
      const strongN = s.flags.filter(f => f.strong).length;
      s.composite = comp;
      s.exposure = s.flags.reduce((t, f) => t + (f.exposure || 0), 0);
      // This file's own rule, up top: one outlier is noise, two-plus stacking is a
      // pattern, so a server flags on a composite and never on a single signal. One
      // weight-2 signal cleared the old `comp >= 2` on its own, which put the patio
      // server's naturally low check average on the board as a name to investigate.
      s.severity = s.flags.length < 2 ? 'clean'
        : ((comp >= 5 || strongN >= 2) ? 'high' : 'watch');
    });

    const flagged = scored.filter(s => s.severity !== 'clean')
      .sort((a, b) => b.composite - a.composite || b.exposure - a.exposure);
    const clean = scored.filter(s => s.severity === 'clean');
    const skipped = servers.filter(s => !s.qualifies);

    return {
      id: opts.id || App.uid(),
      label: opts.label || this._autoLabel(dateList),
      date: opts.date || (dateList.sort()[dateList.length - 1]) || App.todayLocal(),
      created_at: opts.created_at || new Date().toISOString(),
      source: opts.source || 'import',
      columns: Object.keys(present),
      summary: {
        reviewed: scored.length, flagged: flagged.length, skipped: skipped.length,
        high: flagged.filter(s => s.severity === 'high').length,
        exposure: flagged.reduce((t, s) => t + s.exposure, 0)
      },
      // Strip the bulky raw aggregate before persisting; keep what the report needs.
      servers: flagged.concat(clean).map(s => ({
        name: s.name, staff_id: s.staff_id, severity: s.severity,
        composite: s.composite, exposure: s.exposure, metrics: s.m, flags: s.flags
      })),
      skipped: skipped.map(s => s.name)
    };
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
  _exposure(sig, v, avg, s) {
    if (!sig.dollar) return 0;
    if (sig.dollar === 'voids')   return Math.max(0, s.raw.voids   - (avg != null ? avg : 0) * s.raw.sales);
    if (sig.dollar === 'comps')   return Math.max(0, s.raw.comps   - (avg != null ? avg : 0) * s.raw.sales);
    if (sig.dollar === 'refunds') return Math.max(0, s.raw.refunds - (avg != null ? avg : 0) * s.raw.sales);
    if (sig.dollar === 'short')   return s.shortAmt || 0;
    if (sig.dollar === 'walkout') return s.walkAmt || 0;
    return 0;
  },
  // "Floor" reads as a limit, and half the staff sit above an average by definition,
  // so calling the team MEAN a floor accused everyone on the high side of normal of
  // breaching something. It is an average and it says so, on screen and in the PDF.
  _flagDetail(sig, v, avg, s) {
    const teamTxt = (avg != null) ? ' vs ' + this._fmtVal(sig, avg) + ' team average' : '';
    // Only spell the rate out when the report spans more than one shift. On a
    // single-shift report the count already IS the per-shift rate.
    const span = s.shifts > 1 ? ' over ' + s.shifts + ' shifts (' + this._fmtVal(sig, v) + ')' : '';
    if (sig.key === 'no_sales')     return s.raw.no_sales + ' no-sale opens' + span + teamTxt;
    if (sig.key === 'void_pct')     return this.pct(v) + ' of sales voided' + teamTxt;
    if (sig.key === 'avg_check')    return App.fmtCurrency(v) + ' average check' + teamTxt;
    if (sig.key === 'comp_pct')     return this.pct(v) + ' of sales comped' + teamTxt;
    if (sig.key === 'cash_ratio')   return this.pct(v) + ' cash' + teamTxt + (avg != null && v > avg ? ', runs high' : ', runs low');
    if (sig.key === 'refund_pct')   return this.pct(v) + ' of sales refunded' + teamTxt;
    if (sig.key === 'sales_per_hr') return App.fmtCurrency(v) + ' per hour' + teamTxt;
    if (sig.key === 'drawer_short') return s.shortCount + ' drawer short' + (s.shortCount === 1 ? '' : 's') + ' (' + App.fmtCurrency(s.shortAmt) + ')' + span + teamTxt;
    if (sig.key === 'walkouts')     return s.walkCount + ' walkout' + (s.walkCount === 1 ? '' : 's') + ' (' + App.fmtCurrency(s.walkAmt) + ')' + span + teamTxt;
    return this._fmtVal(sig, v);
  },
  _fmtVal(sig, v) {
    // The count signals carry a per-shift rate now, so rounding to a whole number
    // would print "0" for a real 0.4-a-shift pattern.
    if (sig.key === 'no_sales' || sig.key === 'drawer_short' || sig.key === 'walkouts') return (Math.round(v * 10) / 10) + ' per shift';
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
        + '<div style="font-size:13px;color:var(--t3);line-height:1.6;max-width:640px;">Pull a server sales report for a shift or a week from your POS and drop it above. The more columns it carries (no-sales, voids, cash and card split, comps, checks, hours) the more Bar Cop can read. The only column it must have is the server name.</div></div>';
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
      dropSub: 'Needs a Server column. No-sales, voids, cash and card split, comps, checks, refunds, and hours are each read if your export has them.',
      actionsEl: '#si-imp-actions',
      fields: this.FIELDS,
      confirmLabel: 'Analyze',
      onComplete: rows => this.runImport(rows)
    });
  },

  async runImport(rows) {
    const review = this.analyze(rows, { source: 'import' });
    const ok = await App.putRecord('core', 'sales_review', review);
    const res = document.getElementById('si-imp-result');
    if (!ok) { if (res) res.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">Save failed. Try the import again.</div>'; return; }
    this.draw();
  },

  // ── The report ────────────────────────────────────────────────────────────
  renderReport(review) {
    const s = review.summary;
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
      + stat('Estimated Exposure', s.exposure > 0 ? App.fmtCurrency(s.exposure) : '-', s.exposure > 0 ? 'var(--red)' : '')
      + '</div></div>';

    const flagged = (review.servers || []).filter(x => x.severity !== 'clean');
    const cleanN = (review.servers || []).filter(x => x.severity === 'clean').length;
    const cleanTxt = cleanN ? (cleanN + ' other server' + (cleanN === 1 ? '' : 's') + ' reviewed, no patterns flagged.') : '';
    const skipTxt = (review.skipped && review.skipped.length)
      ? ('Not enough data to score: ' + review.skipped.map(esc).join(', ') + '.') : '';

    // The clean-and-skipped summary lives INSIDE the review card, divided from the
    // servers to investigate, never as loose text on the page background.
    let footerInner = '';
    if (flagged.length && cleanTxt) footerInner += '<div style="font-size:12px;color:var(--t3);line-height:1.6;">' + cleanTxt + '</div>';
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
      inner = '<div style="font-size:13px;color:var(--green);font-weight:700;">No servers flagged in this report.</div>'
        + '<div style="font-size:12px;color:var(--t3);margin-top:6px;">Every server\'s numbers track the floor. Run this each shift or week and the outliers surface on their own.</div>';
    } else {
      inner = flagged.map(x => this.serverCard(x)).join('');
    }
    const reviewCard = '<div class="card">' + inner + footer + '</div>';

    const note = '<div style="border:1px solid var(--gold-tint-bord);background:var(--gold-tint);border-radius:6px;padding:12px 14px;margin:18px 0 6px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--amber);margin-bottom:5px;">Heads Up</div>'
      + '<div style="font-size:11px;color:var(--t2);line-height:1.6;">These are patterns to investigate, not proof. A flag means a server\'s numbers are an outlier worth a closer look. Product theft (overpouring, free pours, bottle loss) does not show in a sales report; pour cost, inventory variance, and spot checks catch that. Bar Cop is a software tool, not an investigator; confirm before acting on anyone.</div>'
      + '</div>';

    return statStrip + head + reviewCard + note;
  },

  serverCard(x) {
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

    const invList = (App.data.variance_investigations || []).filter(i => i.sku === x.name + ' (sales)');
    const invOpen = invList.some(i => i.status !== 'resolved');
    const invResolved = !invOpen && invList.some(i => i.status === 'resolved');
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
    const rows = past.slice(0, App.listLimit('core', 'sales_review')).map(r => '<tr class="si-hist-row" data-id="' + esc(r.id) + '" style="cursor:pointer;">'
      + '<td><div class="val">' + esc(r.label) + '</div></td>'
      + '<td>' + this.fmtDate(r.date) + '</td>'
      + '<td>' + r.summary.reviewed + '</td>'
      + '<td style="color:' + (r.summary.flagged > 0 ? 'var(--red)' : 'var(--t3)') + ';">' + r.summary.flagged + '</td>'
      + '<td>' + (r.summary.exposure > 0 ? App.fmtCurrency(r.summary.exposure) : '-') + '</td>'
      + '<td><div class="row-actions"><button class="btn btn-ghost btn-sm si-view" data-id="' + esc(r.id) + '">View</button>'
      + '<button class="btn btn-danger btn-sm si-del" data-id="' + esc(r.id) + '">Delete</button></div></td></tr>').join('');
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
  openInvestigation(name, staffId) {
    S.TheftRisk.openInvestigationModal(null, name + ' (sales)', { stepsDef: this.INVESTIGATION_STEPS, onClose: () => this.draw() });
  },

  // ── PDF ─────────────────────────────────────────────────────────────────────
  async printReview(review) {
    if (!review) return;
    try { await App._ensurePDFLib(); }
    catch (e) { alert('Could not load the PDF engine. Check your connection and try again.'); return; }
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const b = App._pdfBuilder('Sales Integrity Review');
    b.header({ right: 'Sales Integrity Review', meta: review.label + ', generated ' + today });
    b.table(['Summary', ''], [
      ['Servers reviewed', String(review.summary.reviewed)],
      ['Flagged', String(review.summary.flagged)],
      ['High risk', String(review.summary.high)],
      ['Estimated exposure', review.summary.exposure > 0 ? '$' + Number(review.summary.exposure).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-']
    ], { columnStyles: { 1: { halign: 'right' } } });
    // ⚠ THE SAME CAVEAT THE SCREEN SHOWS. Without it this document printed "Flagged: 0" beside a
    // review that could never have flagged anyone, and it is the artefact that leaves the building.
    {
      const nv = this._noVerdictReason(review);
      if (nv && !review.summary.flagged) b.paragraph(nv.title + ' ' + nv.detail);
    }
    (review.servers || []).filter(x => x.severity !== 'clean').forEach(x => {
      b.sectionTitle(x.name + '  (' + (x.severity === 'high' ? 'High Risk' : 'Watch') + (x.exposure > 0 ? ', ' + App.fmtCurrency(x.exposure) + ' exposure' : '') + ')');
      b.table(['Pattern', 'Detail'], (x.flags || []).map(f => [f.label, f.detail]));
    });
    b.disclaimer('Generated from a sales report you uploaded on ' + today + '. These are statistical patterns worth investigating, not proof of theft. Bar Cop is a software tool, not an investigator, auditor, or attorney. Confirm with your own review before acting on any employee.');
    await b.save('BarCop_SalesIntegrity_' + App._pdfDateStamp() + '.pdf');
  },

  showHowTo() {
    App.showHelpModal('How Sales Integrity Works', [
      { p: ['Sales Integrity is the deep theft read. You drop a per-server sales report from your POS and Bar Cop benchmarks every server against the rest of the floor, then flags the ones whose numbers do not add up, with a dollar exposure on each. It is the feature an owner runs every shift or every week.'] },
      { h: 'What it catches, what it does not', p: ['It catches the register and cash games that leave a fingerprint in the sales data: no-sale drawer opens, void abuse, abnormal cash mix, low average checks, heavy comps, refunds, plus drawer shorts and walkouts Bar Cop already has on file. It does not catch product theft (overpouring, free pours, watering or walking out bottles), because an unrung free drink never reaches a sales report. Pour cost, inventory variance, and spot checks catch that half.'] },
      { h: 'Drop the report', p: ['Pull a per-server sales summary for a shift or a week from your POS and drop it in the box up top. Map the columns once and Bar Cop remembers it. The only column it must have is the server name; every other column unlocks one more signal, so the richer the export, the sharper the read. A server with too few checks to judge fairly is set aside, not flagged.', 'This is the deep theft read and wants a richer export than the weekly one, with the register and cash columns. Your basic per-server covers and sales already import at the Shift weekly close and show up in Server Check, so use that for check averages and this for the theft patterns.'] },
      { h: 'How a server gets flagged', p: ['One outlier is noise; a real pattern stacks. A server flags only when several signals line up or a strong tell (no-sales, void abuse, drawer shorts) is severe. They are sorted worst first, grouped into Register Manipulation, Cash Skimming, and Under-Ringing, with the dollar exposure where it can be computed honestly.'] },
      { h: 'Working a flag', p: ['A flag is a lead, not a verdict. Open Investigation starts a six-step case over in Loss Prevention so you work it the same way you work any variance: watch the drawer, pull the void timestamps, talk to the shift, document the finding. Export PDF saves the review for an owner or partner. Confirm before you act on anyone.'] }
    ]);
  }
};
