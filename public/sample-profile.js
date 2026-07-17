'use strict';

/* ── The Anchor — locked sample operation profile ─────────────────────────────
   The single source of truth for all sample data (Section 13). Every module's
   loadSample, and every Control-module sample build, derives its numbers from
   this one profile so the whole dataset describes one coherent operation.

   Thirteen weeks, weeks[0] oldest .. weeks[12] most recent — the operation's
   first 90 days on Bar Cop. The Anchor is an established ~$1M bar that has been
   open for years; only its Bar Cop usage is new. The arc is a real recovery the
   audits can stand behind: weeks 1-2 are the failing pre-Bar-Cop baseline (high
   cost, the numbers the day-one intake audit reflects), fixes start landing in
   week 3, cost falls fastest through weeks 3-7, and weeks 11-13 settle near
   target. Week 13 (~$19.2k/week) matches the settings annual run-rate figures:
   $624k bar + $374k food.

   The weekly numbers are BUILT from a compact spec (covers, check average, and
   the three cost percentages) so every figure reconciles by construction:
     total_rev   = round(covers x check_avg)
     bar_rev     = round(total_rev x bar_share)        food_rev  = total_rev - bar_rev
     bar_cogs    = round(bar_rev  x bar_pour_pct)      food_cogs = round(food_rev x food_cost_pct)
     total_labor = round(total_rev x labor_pct_blended)
     bar_labor   = round(total_labor x bar_labor_share) food_labor = total_labor - bar_labor
     prime_cost_pct = (bar_cogs + food_cogs + bar_labor + food_labor) / total_rev
   Control-module sample data must compute back to these figures. */

(function () {
  var BAR_SHARE       = 0.625;  // bar's share of total revenue
  var BAR_LABOR_SHARE = 0.61;   // bar department's share of total labor dollars

  // Each row: [covers, check_avg, bar_pour_pct, food_cost_pct, labor_pct_blended, loose]
  // wk = row index + 1 (row 0 is the oldest week). loose = the pre-Bar-Cop /
  // onboarding weeks before discipline takes hold; it drives the void/comp,
  // cash-variance, and walked-tab seeds (more events, looser authorization when
  // loose) so the early audits see real problems and the recent ones read clean.
  var SPEC = [
    // ── Weeks 1-2 — pre-Bar-Cop baseline: bleeding on cost, the numbers the
    //    day-one intake audit reflects (pour ~30%, food ~40%, prime ~67%) ──
    [478, 35.4, 30.5, 40.5, 32.5, 1],   // wk 1
    [481, 35.6, 30.2, 40.0, 32.4, 1],   // wk 2
    // ── Weeks 3-4 — first fixes land (jiggers, costed recipes); still loose ──
    [484, 35.9, 28.9, 38.7, 31.8, 1],   // wk 3  (the trend breaks here)
    [487, 36.2, 27.7, 37.5, 31.2, 1],   // wk 4
    // ── Weeks 5-9 — discipline holds, cost falls fastest, revenue climbing ──
    [490, 36.5, 26.5, 36.5, 30.7],      // wk 5
    [492, 36.8, 25.6, 35.7, 30.3],      // wk 6
    [494, 37.1, 24.8, 35.0, 30.0],      // wk 7  (prime crosses under 60 here)
    [496, 37.4, 24.2, 34.4, 29.7],      // wk 8
    [497, 37.6, 23.8, 33.9, 29.4],      // wk 9
    // ── Weeks 10-13 — settling near target, the locked current state ──
    [498, 37.8, 23.5, 33.5, 29.2],      // wk 10
    [499, 38.0, 23.2, 33.2, 29.0],      // wk 11
    [500, 38.2, 23.0, 33.0, 28.8],      // wk 12
    [500, 38.3, 22.8, 32.9, 28.6],      // wk 13  (current state; matches annual run-rate)
  ];

  function buildWeek(t, i) {
    var covers = t[0], check_avg = t[1], pour = t[2], food = t[3], laborPct = t[4], loose = !!t[5];
    var total_rev   = Math.round(covers * check_avg);
    var bar_rev     = Math.round(total_rev * BAR_SHARE);
    var food_rev    = total_rev - bar_rev;
    var bar_cogs    = Math.round(bar_rev  * pour / 100);
    var food_cogs   = Math.round(food_rev * food / 100);
    var total_labor = Math.round(total_rev * laborPct / 100);
    var bar_labor   = Math.round(total_labor * BAR_LABOR_SHARE);
    var food_labor  = total_labor - bar_labor;
    var prime = (bar_cogs + food_cogs + bar_labor + food_labor) / total_rev * 100;
    return {
      wk: i + 1, covers: covers, check_avg: check_avg,
      total_rev: total_rev, bar_rev: bar_rev, food_rev: food_rev,
      bar_cogs: bar_cogs, food_cogs: food_cogs, bar_labor: bar_labor, food_labor: food_labor,
      bar_pour_pct: pour, food_cost_pct: food, labor_pct_blended: laborPct,
      prime_cost_pct: +prime.toFixed(1), loose: loose
    };
  }

  window.ANCHOR = {
    bar_name:   'The Anchor Bar & Kitchen',
    city_state: 'Austin, TX',
    annual_bar_revenue:  624000,
    annual_food_revenue: 374400,

    bar_share: BAR_SHARE,                 // bar's share of total revenue
    kitchen_share_of_food_labor: 0.5,     // food_labor splits kitchen/floor 50/50
    wages: { bar: 16, kitchen: 15, floor: 14 },

    // The trend first breaks toward target in week 3, when the first fixes land.
    // Documentary only — the discipline seeds key off each week's `loose` flag.
    fix_week: 3,

    weeks: SPEC.map(buildWeek),

    // Days-ago offset for a week's period-end date. The week count drives it, so
    // the seed stays correct at any number of weeks. Most recent week = 0 days ago.
    endAgo: function (a) { return (this.weeks.length - a.wk) * 7; },

    // The most recent week — the figure the live This Week feeds should land on.
    current: function () { return this.weeks[this.weeks.length - 1]; },

    // Labor for a week, broken into the three departments Revenue tracks.
    // Bar department = bar_labor; kitchen + floor split food_labor.
    laborDepts: function (w) {
      var kitchen = Math.round(w.food_labor * this.kitchen_share_of_food_labor);
      return { bar: w.bar_labor, kitchen: kitchen, floor: w.food_labor - kitchen };
    }
  };
})();
