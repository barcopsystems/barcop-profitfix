'use strict';

/* ── Recovery — the Recovery Scoreboard computation engine (Section 10) ────────
   Turns a fix_log entry into a recovered figure by comparing the gap-area's
   metric before vs after the implementation date.

   Honesty rule: a dollar figure is shown only when it can be computed from
   real data the app already holds, never from an invented conversion rate.
   A gap-area with no clean weekly dollar metric (any Recovery gap-area
   whose metric does not dollarize) is simply absent from
   METRICS and returns status 'untracked'. The fix still logs, it just carries
   no dollar figure, and recovery for it shows as the module score moving.

   Baseline model (2026): a system starts on the operator's first tracked action
   (auto, no manual date), so a real new user has no "before" history to compare
   against. Instead the BASELINE is the operator's OWN first few operating weeks,
   and recovery measures how far the recent weeks have moved against that starting
   point. Positive = tightened up; negative = slipping below where they started.
   No figure until there is a baseline plus a measurement week (roughly the first
   month); it firms up as the measurement window fills. */

window.Recovery = {
  WINDOW: 8,            // recent measurement weeks averaged for current performance
  MIN_AFTER: 2,        // retained for callers; superseded by the baseline model
  BASELINE_WEEKS: 3,   // the operator's first N operating weeks set the baseline
  MIN_MEASURE: 1,      // weeks past the baseline needed before any figure
  MATURE_MEASURE: 4,   // measurement weeks before the figure reads "mature"

  _avg(arr) {
    const v = arr.filter(x => x != null && !isNaN(x));
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  },

  // ── DURABLE FIX BASELINES (S168) ─────────────────────────────────────────────────────────────
  // A fix's start date IS its recovery baseline (compute() measures weeks >= it). It used to live
  // only on the windowed fix_log row, so after 24 months that row stopped loading, _autoStart
  // re-fired with a LATER date, the baseline jumped forward, and "Recovered to date" collapsed —
  // or the gap dropped out of the summary entirely. The baseline now lives in account_state (the
  // per-account config blob, which is NEVER windowed), keyed by module|gap_id, holding the EARLIEST
  // start ever recorded. The fix_log stays windowed — it is only the activity/timeline log now.
  _baselineKey(module, gapId) { return String(module) + '|' + String(gapId); },
  // ⚠ BARE `App`, NOT `window.App` — App is a top-level const (app.js:244), not on window, so
  // window.App is undefined in the browser and would make every read here empty (moduleSummary
  // would return $0 recovered). The rest of recovery.js references bare App.data for this reason.
  _fixBaselines() { return (typeof App !== 'undefined' && App.acctGet) ? (App.acctGet('fix_baselines', {}) || {}) : {}; },
  // The measurement start for an entry: the durable baseline if we have one, else the entry's own
  // date (backward-compat for a fix whose baseline was never promoted). Always the string date or null.
  baselineFor(entry) {
    if (!entry) return null;
    const b = this._fixBaselines()[this._baselineKey(entry.module, entry.gap_id)];
    return (b && b.date) || entry.date || null;
  },
  // Record the durable baseline, keeping the EARLIEST date. Idempotent: writes only when it adds a
  // gap or moves the date earlier, so calling it every render does not churn account_state.
  ensureBaseline(module, gapId, gapName, date) {
    if (!module || gapId == null || !date || !(typeof App !== 'undefined' && App.acctSet)) return false;
    const d = String(date).slice(0, 10);
    const map = this._fixBaselines();
    const key = this._baselineKey(module, gapId);
    const cur = map[key];
    if (cur && cur.date && String(cur.date) <= d) return false;   // already earliest-or-equal
    const next = Object.assign({}, map);
    next[key] = { date: d, gap_name: gapName || (cur && cur.gap_name) || '' };
    App.acctSet('fix_baselines', next);
    return true;
  },
  // Every active fix as one synthetic entry per gap, from the UNION of durable baselines and the
  // windowed fix_log — so a gap keeps scoring after its log row ages out. moduleKey null = all.
  // Composite gaps are excluded here, matching the old _oneFixPerGap callers.
  _gapEntries(moduleKey) {
    const out = {};
    const add = (module, gapId, gapName, date) => {
      if (gapId == null || this.COMPOSITE_GAPS.indexOf(gapId) !== -1) return;
      if (moduleKey && module !== moduleKey) return;
      const k = this._baselineKey(module, gapId);
      if (!out[k]) out[k] = { module: module, gap_id: gapId, gap_name: gapName || '', date: date || null };
      else {
        if (date && (!out[k].date || String(date) < String(out[k].date))) out[k].date = date;
        if (!out[k].gap_name && gapName) out[k].gap_name = gapName;
      }
    };
    const bl = this._fixBaselines();
    Object.keys(bl).forEach(k => { const i = k.indexOf('|'); add(k.slice(0, i), k.slice(i + 1), bl[k].gap_name, bl[k].date); });
    const log = (typeof App !== 'undefined' && App.data && Array.isArray(App.data.fix_log)) ? App.data.fix_log : [];
    log.forEach(e => { if (e) add(e.module, e.gap_id, e.gap_name, e.date); });
    return Object.keys(out).map(k => out[k]);
  },

  // Gap-area id -> metric. Only gap-areas whose recovered dollars compute
  // honestly from existing weekly data appear here. baseKind 'pts' means the
  // metric is a percentage and dollars = (improvement / 100) x base x 52;
  // 'unit' means dollars = improvement x base x 52.
  _ptargets() { return (App.data.settings || {}).targets || {}; },
  _rtargets() { return ((App.data.revenue_settings || {}).targets) || {}; },

  /* THE BASE RULE: a metric's `base` must be the DENOMINATOR its `value` was
     measured against, because a point of a % is worth exactly denominator/100.
     Pair a % with the wrong base and every dollar it produces is off by the ratio
     of the two. See [[labor-cost-model]] DENOMINATORS before touching either side. */

  // Total sales for a profit `week`: bar + food + catering + ancillary. The same
  // denominator confirm-week.js divides prime_cost_pct by, and the Books tie.
  _totSales(w) {
    const n = v => parseFloat(v) || 0;
    return n(w.bar && w.bar.revenue) + n(w.food && w.food.revenue)
         + n(w.catering && w.catering.revenue) + n(w.other && w.other.revenue);
  },
  // Total sales for a `revenue_week`. catering_revenue/other_revenue were added
  // 2026-07-16 so this base could reach the denominator labor_pct_blended actually
  // uses. A row saved before that carries neither, so fall back to bar+floor, which
  // is what the base was for every row until now: an old row cannot get worse.
  _rTotSales(w) {
    const n = v => parseFloat(v) || 0;
    const fb = n(w.bar_revenue) + n(w.floor_revenue);
    return (w.catering_revenue == null && w.other_revenue == null)
      ? fb : fb + n(w.catering_revenue) + n(w.other_revenue);
  },

  METRICS: {
    'pour-cost': {
      series: 'weeks', label: 'Bar Pour Cost', lowerBetter: true,
      value: w => (w.bar ? w.bar.cost_pct : null),
      base:  w => (w.bar ? w.bar.revenue : null), baseKind: 'pts',
      target: () => Recovery._ptargets().bar_pour_cost_pct ?? 22,
      fmt: v => v.toFixed(1) + '%'
    },
    'food-cost': {
      series: 'weeks', label: 'Food Cost', lowerBetter: true,
      value: w => (w.food ? w.food.cost_pct : null),
      base:  w => (w.food ? w.food.revenue : null), baseKind: 'pts',
      target: () => Recovery._ptargets().food_cost_pct ?? 32,
      fmt: v => v.toFixed(1) + '%'
    },
    'prime-cost': {
      series: 'weeks', label: 'Prime Cost', lowerBetter: true,
      value: w => w.prime_cost_pct,
      // prime_cost_pct is measured against TOTAL sales, so a point of it is worth
      // total sales / 100. Basing it on bar+food alone understated the leak by
      // catering's and ancillary's share of the week.
      base:  w => Recovery._totSales(w), baseKind: 'pts',
      target: () => Recovery._ptargets().prime_cost_pct ?? 60,
      fmt: v => v.toFixed(1) + '%'
    },
    // Pricing's only live weekly signal is check average, which is the SAME
    // metric the 'check-average' gap dollarizes. Dollarizing both would show the
    // identical leak twice and double-count it in recovered totals, so Pricing is
    // noDollar (a Review row): its real lever is menu margin %, which Bar Cop does
    // not track as a weekly dollar. Check Average carries the one honest figure.
    'pricing': {
      series: 'revenue_weeks', label: 'Check Average', lowerBetter: false, noDollar: true,
      value: w => w.check_avg,
      base:  w => w.covers, baseKind: 'unit',
      target: () => Recovery._rtargets().check_avg ?? 35,
      fmt: v => '$' + v.toFixed(2)
    },
    'check-average': {
      series: 'revenue_weeks', label: 'Check Average', lowerBetter: false,
      value: w => w.check_avg,
      base:  w => w.covers, baseKind: 'unit',
      target: () => Recovery._rtargets().check_avg ?? 35,
      fmt: v => '$' + v.toFixed(2)
    },
    'labor-scheduling': {
      series: 'revenue_weeks', label: 'Labor Cost', lowerBetter: true,
      // Status band (gapImpact) reads TOTAL labor % vs your total labor target.
      // Recovery dollars (compute) read HOURLY labor % only: salaried pay is fixed,
      // so labor is recovered by scheduling hours, not by diluting a fixed salary as
      // sales grow (that dilution would double-count with check-average growth).
      value: w => w.labor_pct_blended,
      recoverValue: w => (w.hourly_labor_pct != null ? w.hourly_labor_pct : w.labor_pct_blended),
      // TWO values, two denominators, so TWO bases. labor_pct_blended is measured
      // against total sales; hourly_labor_pct against bar+food only. The 2026-07-16
      // fix lined up recoverValue with this bar+food base for compute(), and left
      // gapImpact dollarizing the TOTAL-sales-basis labor_pct_blended against it, so
      // the leak on the board ran light by catering's share of the week. base pairs
      // with value (gapImpact), recoverBase pairs with recoverValue (compute).
      base:  w => Recovery._rTotSales(w), baseKind: 'pts',
      recoverBase: w => (w.bar_revenue || 0) + (w.floor_revenue || 0),
      target: () => App.laborTargetPct(),
      fmt: v => v.toFixed(1) + '%'
    },
    'rplh': {
      series: 'revenue_weeks', label: 'RPLH', lowerBetter: false, noDollar: true,
      value: w => w.rplh_blended,
      base:  w => w.total_hours, baseKind: 'unit',
      target: () => { const t = Recovery._rtargets();
        return ((t.rplh_lunch ?? 50) + (t.rplh_dinner ?? 75) + (t.rplh_bar ?? 65)) / 3; },
      fmt: v => '$' + v.toFixed(0)
    },

  },

  _series(key) {
    if (key === 'weeks') return (App.data.weeks || []);
    if (key === 'revenue_weeks') return (App.data.revenue_weeks || [])
      .filter(w => (w.bar_revenue || 0) + (w.floor_revenue || 0) > 0);
    return [];
  },

  /* Compute the recovery result for one fix_log entry. Returns one of:
     { status:'untracked' }                            no dollar metric for this gap-area
     { status:'building', weeksIn, baselineWeeks }     not enough operating weeks yet
     { status:'ok', label, before, after, improvement, fmt, dollars, weeksAfter, mature }
       before = your baseline (first weeks) avg, after = recent weeks avg.
       dollars may be null, positive (recovered) or negative (slipping below start). */
  compute(entry) {
    const m = entry && this.METRICS[entry.gap_id];
    // ⚠ The measurement start is the DURABLE baseline (S168), not entry.date — so a re-fired
    // fix_log row carrying a later date can never move the baseline forward.
    const start = this.baselineFor(entry);
    if (!m || !start) return { status: 'untracked' };

    // Recovery dollars use the metric's recoverValue when defined (labor dollarizes
    // HOURLY labor %, not total), falling back to value for every other metric.
    // The base has to follow the value: recoverValue carries its own denominator, so
    // it carries its own base. Every other metric has neither and falls back to both.
    const vf = m.recoverValue || m.value;
    const bf = m.recoverBase || m.base;

    // The weeks the operator has run SINCE the system started, earliest first.
    // The baseline is their own first weeks, not a pre-start history a new user
    // never has.
    const operating = this._series(m.series)
      .filter(w => w.period_end && w.period_end >= start && vf(w) != null)
      .slice()
      .sort((a, b) => a.period_end.localeCompare(b.period_end));

    const B = this.BASELINE_WEEKS;
    if (operating.length < B + this.MIN_MEASURE) {
      return { status: 'building', weeksIn: operating.length, baselineWeeks: B };
    }

    const baselineW    = operating.slice(0, B);
    const allMeasure   = operating.slice(B);                 // every week since the baseline
    const recentMeasure = allMeasure.slice(-this.WINDOW);    // recent weeks, for the current rate

    const bAvg = this._avg(baselineW.map(vf));
    const cAvg = this._avg(recentMeasure.map(vf));           // current sustained performance
    const mN   = allMeasure.length;
    if (bAvg == null || cAvg == null || mN < this.MIN_MEASURE) {
      return { status: 'building', weeksIn: operating.length, baselineWeeks: B };
    }

    // REALIZED-to-date = the sum of each measurement week's actual gap vs the
    // baseline, times that week's revenue base. Honest and cumulative: early
    // weeks still loose credit little, later tightened weeks credit more, a bad
    // week subtracts, and it grows the longer you hold the gain. Can be negative
    // (net slipping below your starting point).
    let dollars = 0, counted = 0;
    allMeasure.forEach(w => {
      const v = vf(w), base = bf(w);
      if (v == null || base == null) return;
      const imp = m.lowerBetter ? (bAvg - v) : (v - bAvg);
      dollars += (m.baseKind === 'pts') ? (imp / 100) * base : imp * base;
      counted++;
    });
    if (m.noDollar || !counted) dollars = null;   // ratio metrics track as score-moved, not dollars

    // Forward run-rate from the CURRENT sustained rate, a labeled "on pace for".
    const improvement = m.lowerBetter ? (bAvg - cAvg) : (cAvg - bAvg);
    const recentBase = this._avg(recentMeasure.map(bf));
    const perWeek = (!m.noDollar && recentBase != null) ? ((m.baseKind === 'pts') ? (improvement / 100) * recentBase : improvement * recentBase) : null;
    const dollarsAnnual = (perWeek != null) ? perWeek * 52 : null;

    return {
      status: 'ok',
      label: m.label,
      before: bAvg, after: cAvg, improvement,
      fmt: m.fmt,
      dollars,            // realized to date vs baseline, cumulative
      dollarsAnnual,      // forward run-rate, labeled as such
      weeksAfter: mN,
      mature: mN >= this.MATURE_MEASURE
    };
  },

  // Gap categorization for honest totals. Cost recovery (real leaks plugged)
  // is kept separate from revenue growth (projected). Prime cost is the
  // composite of pour + food, so it is EXCLUDED from totals to avoid counting
  // the same dollars twice.
  COST_GAPS:      ['pour-cost', 'food-cost', 'labor-scheduling'],
  REVENUE_GAPS:   ['pricing', 'check-average', 'rplh'],
  COMPOSITE_GAPS: ['prime-cost'],

  /* Roll a module's logged fixes into a slice for its dashboard. Returns
     { logged, recovered, withFigure, measuring }: total logged fixes, the
     summed annualized recovered dollars, how many produced a dollar figure,
     and how many are still in the measuring window. */
  // Recovery is measured per gap-AREA — compute() reads the gap's weekly metric
  // vs a baseline, so it returns the SAME dollars for every fix_log entry sharing a
  // gap_id. Collapse to one entry per gap (the earliest) before summing, or logging
  // a second fix in the same area double-counts the realized/annual dollars.
  _oneFixPerGap(entries) {
    const byGap = {};
    (entries || []).forEach(e => {
      if (!e || e.gap_id == null) return;
      const cur = byGap[e.gap_id];
      if (!cur || String(e.date || '') < String(cur.date || '')) byGap[e.gap_id] = e;
    });
    return Object.keys(byGap).map(k => byGap[k]);
  },

  moduleSummary(moduleKey) {
    const log = (App.data && Array.isArray(App.data.fix_log)) ? App.data.fix_log : [];
    const mine = log.filter(e => e.module === moduleKey);
    // ⚠ Scored set is the UNION of durable baselines + windowed fix_log (S168), one per gap, so a
    // fix keeps scoring after its log row ages out. `logged` stays the literal fix_log count.
    const scored = this._gapEntries(moduleKey);
    let recovered = 0, annual = 0, withFigure = 0, measuring = 0;
    scored.forEach(e => {
      const r = this.compute(e);
      if (r.status === 'ok' && r.dollars != null && r.dollars > 0) { recovered += r.dollars; annual += (r.dollarsAnnual || 0); withFigure++; }
      else if (r.status === 'building') measuring++;
    });
    return { logged: mine.length, recovered: recovered, annualRunRate: Math.round(annual), withFigure: withFigure, measuring: measuring };
  },

  /* Cross-module recovery total for the Hub Scoreboard. Sums REALIZED-to-date
     dollars across logged fixes, excluding the prime-cost composite, and keeps
     cost recovery separate from revenue growth. `annualRunRate` is the forward
     pace, for an "on pace for" line only. */
  total() {
    // One entry per gap-area (see moduleSummary), from the durable-baseline + fix_log union (S168),
    // so a fix never double-counts AND never drops out of the headline after 24 months.
    const scored = this._gapEntries(null);
    let dollars = 0, annual = 0, cost = 0, revenue = 0, fixes = 0;
    scored.forEach(e => {
      const r = this.compute(e);
      if (r.status === 'ok' && r.dollars > 0) {
        dollars += r.dollars; annual += (r.dollarsAnnual || 0); fixes++;
        if (this.REVENUE_GAPS.indexOf(e.gap_id) !== -1) revenue += r.dollars; else cost += r.dollars;
      }
    });
    return { dollars: Math.round(dollars), annualRunRate: Math.round(annual), cost: Math.round(cost), revenue: Math.round(revenue), fixes: fixes };
  },

  /* Fix-event markers for an annotated trend chart. Given the charted weeks
     (each with a period_end) and a module, return the markers to draw as
     [{ index, label, date }], where index is the charted week the fix landed
     in. Used so a trend chart shows when a fix went in against the metric. */
  chartMarkers(weeks, moduleKey) {
    const log = (App.data && Array.isArray(App.data.fix_log)) ? App.data.fix_log : [];
    const dated = (weeks || []).filter(w => w && w.period_end);
    if (dated.length < 2) return [];
    const first = dated[0].period_end, last = dated[dated.length - 1].period_end;
    return log
      .filter(e => e.module === moduleKey && e.date && e.date >= first && e.date <= last)
      .map(e => {
        let idx = weeks.findIndex(w => w && w.period_end && w.period_end >= e.date);
        if (idx < 0) idx = weeks.length - 1;
        return { index: idx, label: e.gap_name || 'Fix', date: e.date };
      });
  },

  /* Live diagnosis of a gap-area: its latest weekly metric measured against
     target. Returns { band, onTarget, dollars, current, target, label } where
     band is 'ok' | 'watch' | 'over' and dollars is the annualized cost of
     being off target. Returns null when it cannot be computed honestly (no
     metric, no data, or no revenue base). The 0-100 score stays in the Audit;
     this is the always-current status band the dashboard reads. */
  gapImpact(gapId) {
    const m = this.METRICS[gapId];
    if (!m) return null;
    const weeks = this._series(m.series)
      .filter(w => w.period_end)
      .slice()
      .sort((a, b) => a.period_end.localeCompare(b.period_end));
    const latest = weeks[weeks.length - 1];
    if (!latest) return null;
    const cur = m.value(latest), tgt = m.target(), base = m.base(latest);
    if (cur == null || isNaN(cur) || tgt == null || !base || isNaN(base)) return null;
    const delta = m.lowerBetter ? (cur - tgt) : (tgt - cur);   // positive = off target
    let band, dollars = 0;
    if (delta <= 0) {
      band = 'ok';
    } else {
      // Watch within 10% past target, Over beyond it — the same target
      // logic the Audit grades this metric by.
      band = (delta / tgt) <= 0.10 ? 'watch' : 'over';
      // noDollar metrics (e.g. RPLH, a productivity ratio) render as a Review row,
      // never a dollar: dollarizing a ratio overstates and double-counts labor.
      if (!m.noDollar) dollars = (m.baseKind === 'pts')
        ? Math.abs(App.dollarize(cur, tgt, base * 52).annual)
        : delta * base * 52;
    }
    return { band: band, onTarget: band === 'ok', dollars: dollars,
             current: cur, target: tgt, label: m.label };
  }
};
