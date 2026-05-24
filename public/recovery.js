'use strict';

/* ── Recovery — the Recovery Scoreboard computation engine (Section 10) ────────
   Turns a fix_log entry into a recovered figure by comparing the gap-area's
   metric before vs after the implementation date.

   Honesty rule: a dollar figure is shown only when it can be computed from
   real data the app already holds, never from an invented conversion rate.
   A gap-area with no clean weekly dollar metric (all of Traffic, and any
   Recovery gap-area whose metric does not dollarize) is simply absent from
   METRICS and returns status 'untracked'. The fix still logs, it just carries
   no dollar figure, and recovery for it shows as the module score moving.

   Maturing window: BEFORE is up to 8 weeks immediately before the fix date,
   fixed the moment the fix is logged. AFTER is every week since, capped at 8,
   so it grows. A figure surfaces once 2 weeks of after-data exist and is
   flagged preliminary until the after-window reaches 8 weeks. */

window.Recovery = {
  WINDOW: 8,
  MIN_AFTER: 2,

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
      target: () => { const t = Recovery._rtargets();
        return ((t.bar_labor_pct ?? 28) + (t.kitchen_labor_pct ?? 30) + (t.floor_labor_pct ?? 32)) / 3; },
      fmt: v => v.toFixed(1) + '%'
    },
    'rplh': {
      series: 'revenue_weeks', label: 'RPLH', lowerBetter: false,
      value: w => w.rplh_blended,
      base:  w => w.total_hours, baseKind: 'unit',
      target: () => { const t = Recovery._rtargets();
        return ((t.rplh_lunch ?? 50) + (t.rplh_dinner ?? 75) + (t.rplh_bar ?? 65)) / 3; },
      fmt: v => '$' + v.toFixed(0)
    }
  },

  _series(key) {
    if (key === 'weeks') return (App.data.weeks || []);
    if (key === 'revenue_weeks') return (App.data.revenue_weeks || [])
      .filter(w => (w.bar_revenue || 0) + (w.floor_revenue || 0) > 0);
    return [];
  },

  /* Compute the recovery result for one fix_log entry. Returns one of:
     { status:'untracked' }                          no dollar metric for this gap-area
     { status:'no-baseline' }                         no weeks before the fix date
     { status:'pending', weeksAfter }                 fewer than 2 weeks of after-data
     { status:'ok', label, before, after, improvement, fmt, dollars, weeksAfter, mature }
       dollars may be null, positive (recovered) or negative (regressed). */
  compute(entry) {
    const m = entry && this.METRICS[entry.gap_id];
    if (!m || !entry.date) return { status: 'untracked' };

    const weeks = this._series(m.series)
      .filter(w => w.period_end)
      .slice()
      .sort((a, b) => a.period_end.localeCompare(b.period_end));

    const beforeW = weeks.filter(w => w.period_end < entry.date).slice(-this.WINDOW);
    const afterW  = weeks.filter(w => w.period_end >= entry.date).slice(0, this.WINDOW);

    const bAvg = this._avg(beforeW.map(m.value));
    const aAvg = this._avg(afterW.map(m.value));
    const aN   = afterW.map(m.value).filter(v => v != null && !isNaN(v)).length;

    if (bAvg == null) return { status: 'no-baseline' };
    if (aN < this.MIN_AFTER) return { status: 'pending', weeksAfter: aN };

    const improvement = m.lowerBetter ? (bAvg - aAvg) : (aAvg - bAvg);
    const baseAvg = this._avg(afterW.map(m.base));
    let dollars = null;
    if (baseAvg != null) {
      dollars = (m.baseKind === 'pts')
        ? (improvement / 100) * baseAvg * 52
        : improvement * baseAvg * 52;
    }
    return {
      status: 'ok',
      label: m.label,
      before: bAvg, after: aAvg, improvement,
      fmt: m.fmt,
      dollars,
      weeksAfter: aN,
      mature: aN >= this.WINDOW
    };
  },

  /* Roll a module's logged fixes into a slice for its dashboard. Returns
     { logged, recovered, withFigure, measuring }: total logged fixes, the
     summed annualized recovered dollars, how many produced a dollar figure,
     and how many are still in the measuring window. */
  moduleSummary(moduleKey) {
    const log = (App.data && Array.isArray(App.data.fix_log)) ? App.data.fix_log : [];
    const mine = log.filter(e => e.module === moduleKey);
    let recovered = 0, withFigure = 0, measuring = 0;
    mine.forEach(e => {
      const r = this.compute(e);
      if (r.status === 'ok' && r.dollars != null && r.dollars > 0) { recovered += r.dollars; withFigure++; }
      else if (r.status === 'pending') measuring++;
    });
    return { logged: mine.length, recovered: recovered, withFigure: withFigure, measuring: measuring };
  },

  /* Cross-module recovery total for the Hub Scoreboard. Sums the annualized
     recovered dollars across every logged fix that has produced a figure. */
  total() {
    const log = (App.data && Array.isArray(App.data.fix_log)) ? App.data.fix_log : [];
    let dollars = 0, fixes = 0;
    log.forEach(e => {
      const r = this.compute(e);
      if (r.status === 'ok' && r.dollars > 0) { dollars += r.dollars; fixes++; }
    });
    return { dollars: dollars, fixes: fixes };
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
