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

  // Gap-area id -> metric. Only gap-areas whose recovered dollars compute
  // honestly from existing weekly data appear here. baseKind 'pts' means the
  // metric is a percentage and dollars = (improvement / 100) x base x 52;
  // 'unit' means dollars = improvement x base x 52.
  _ptargets() { return (App.data.settings || {}).targets || {}; },
  _rtargets() { return ((App.data.revenue_settings || {}).targets) || {}; },
  _checkAvg() { return Recovery._rtargets().check_avg ?? 35; },

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
      base:  w => (w.bar ? w.bar.revenue || 0 : 0) + (w.food ? w.food.revenue || 0 : 0), baseKind: 'pts',
      target: () => Recovery._ptargets().prime_cost_pct ?? 60,
      fmt: v => v.toFixed(1) + '%'
    },
    'pricing': {
      series: 'revenue_weeks', label: 'Check Average', lowerBetter: false,
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
      value: w => w.labor_pct_blended,
      base:  w => (w.bar_revenue || 0) + (w.floor_revenue || 0), baseKind: 'pts',
      target: () => App.laborTargetPct(),
      fmt: v => v.toFixed(1) + '%'
    },
    'rplh': {
      series: 'revenue_weeks', label: 'RPLH', lowerBetter: false,
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
    if (!m || !entry.date) return { status: 'untracked' };

    // The weeks the operator has run SINCE the system started, earliest first.
    // The baseline is their own first weeks, not a pre-start history a new user
    // never has.
    const operating = this._series(m.series)
      .filter(w => w.period_end && w.period_end >= entry.date && m.value(w) != null)
      .slice()
      .sort((a, b) => a.period_end.localeCompare(b.period_end));

    const B = this.BASELINE_WEEKS;
    if (operating.length < B + this.MIN_MEASURE) {
      return { status: 'building', weeksIn: operating.length, baselineWeeks: B };
    }

    const baselineW    = operating.slice(0, B);
    const allMeasure   = operating.slice(B);                 // every week since the baseline
    const recentMeasure = allMeasure.slice(-this.WINDOW);    // recent weeks, for the current rate

    const bAvg = this._avg(baselineW.map(m.value));
    const cAvg = this._avg(recentMeasure.map(m.value));      // current sustained performance
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
      const v = m.value(w), base = m.base(w);
      if (v == null || base == null) return;
      const imp = m.lowerBetter ? (bAvg - v) : (v - bAvg);
      dollars += (m.baseKind === 'pts') ? (imp / 100) * base : imp * base;
      counted++;
    });
    if (!counted) dollars = null;

    // Forward run-rate from the CURRENT sustained rate, a labeled "on pace for".
    const improvement = m.lowerBetter ? (bAvg - cAvg) : (cAvg - bAvg);
    const recentBase = this._avg(recentMeasure.map(m.base));
    const perWeek = (recentBase != null) ? ((m.baseKind === 'pts') ? (improvement / 100) * recentBase : improvement * recentBase) : null;
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
  REVENUE_GAPS:   ['pricing', 'check-average', 'rplh', 'website', 'email-loyalty', 'delivery'],
  COMPOSITE_GAPS: ['prime-cost'],

  /* Roll a module's logged fixes into a slice for its dashboard. Returns
     { logged, recovered, withFigure, measuring }: total logged fixes, the
     summed annualized recovered dollars, how many produced a dollar figure,
     and how many are still in the measuring window. */
  moduleSummary(moduleKey) {
    const log = (App.data && Array.isArray(App.data.fix_log)) ? App.data.fix_log : [];
    const mine = log.filter(e => e.module === moduleKey);
    let recovered = 0, annual = 0, withFigure = 0, measuring = 0;
    mine.forEach(e => {
      if (this.COMPOSITE_GAPS.indexOf(e.gap_id) !== -1) return;   // skip composite (double-count)
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
    const log = (App.data && Array.isArray(App.data.fix_log)) ? App.data.fix_log : [];
    let dollars = 0, annual = 0, cost = 0, revenue = 0, fixes = 0;
    log.forEach(e => {
      if (this.COMPOSITE_GAPS.indexOf(e.gap_id) !== -1) return;
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
      dollars = (m.baseKind === 'pts')
        ? Math.abs(App.dollarize(cur, tgt, base * 52).annual)
        : delta * base * 52;
    }
    return { band: band, onTarget: band === 'ok', dollars: dollars,
             current: cur, target: tgt, label: m.label };
  }
};
