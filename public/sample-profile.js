'use strict';

/* ── The Anchor — locked sample operation profile ─────────────────────────────
   The single source of truth for all sample data (Section 13). Every module's
   loadSample, and every Control-module sample build, derives its numbers from
   this one profile so the whole dataset describes one coherent operation.

   Fifty-two weeks, weeks[0] oldest .. weeks[51] most recent — a full operating
   year. The arc is a real recovery: months 1-2 run loose and onboarding-messy
   (high cost, choppy lower revenue), months 3-6 tighten steadily toward target,
   months 6-12 sustain the gains through one seasonal dip and one believable
   bad stretch before settling back. Week 52 (~$19.2k/week) matches the settings
   annual figures: $624k bar + $374k food.

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
  // wk = row index + 1 (row 0 is the oldest week). loose = onboarding-messy or a
  // slipped stretch; it drives the discipline arc in the void/comp, cash-variance,
  // and walked-tab seeds (fewer events, all authorized, when NOT loose).
  var SPEC = [
    // ── Months 1-2 — onboarding, loose: high cost, choppy lower revenue ──
    [470, 28.8, 31.0, 42.0, 32.5, 1],   // wk 1
    [478, 29.5, 30.8, 41.6, 32.4, 1],   // wk 2
    [466, 28.9, 31.2, 42.2, 32.6, 1],   // wk 3
    [482, 30.1, 30.5, 41.3, 32.2, 1],   // wk 4
    [475, 29.6, 30.7, 41.5, 32.3, 1],   // wk 5
    [486, 30.6, 30.2, 40.9, 32.0, 1],   // wk 6
    [480, 30.2, 30.4, 41.1, 32.1, 1],   // wk 7
    [488, 31.0, 30.0, 40.6, 31.8, 1],   // wk 8
    // ── Months 3-6 — tighten: steady decline toward target, revenue climbing ──
    [489, 31.2, 29.8, 40.2, 31.6],      // wk 9  (the trend breaks here)
    [491, 31.6, 29.5, 39.6, 31.4],      // wk 10
    [490, 32.0, 29.0, 39.0, 31.1],      // wk 11
    [493, 32.4, 28.6, 38.4, 30.9],      // wk 12
    [492, 32.9, 28.1, 37.9, 30.6],      // wk 13
    [495, 33.2, 27.6, 37.4, 30.4],      // wk 14
    [494, 33.6, 27.2, 36.9, 30.2],      // wk 15
    [496, 33.9, 26.8, 36.5, 30.0],      // wk 16
    [495, 34.2, 26.4, 36.1, 29.9],      // wk 17
    [497, 34.5, 26.0, 35.7, 29.8],      // wk 18
    [496, 34.8, 25.7, 35.4, 29.7],      // wk 19
    [498, 35.1, 25.4, 35.1, 29.6],      // wk 20
    [497, 35.4, 25.1, 34.8, 29.5],      // wk 21
    [499, 35.6, 24.8, 34.6, 29.5],      // wk 22
    [498, 35.9, 24.6, 34.4, 29.4],      // wk 23
    [500, 36.1, 24.4, 34.2, 29.4],      // wk 24
    [499, 36.3, 24.2, 34.0, 29.3],      // wk 25
    [500, 36.5, 24.0, 33.9, 29.3],      // wk 26
    // ── Months 6-12 — sustained at target ──
    [499, 36.7, 23.8, 33.7, 29.2],      // wk 27
    [501, 36.8, 23.6, 33.5, 29.1],      // wk 28
    [500, 37.0, 23.5, 33.4, 29.0],      // wk 29
    [502, 37.0, 23.4, 33.3, 29.0],      // wk 30
    [500, 37.1, 23.5, 33.4, 29.1],      // wk 31
    // seasonal dip — a slow three-week stretch, revenue off ~10-12%, cost % ticks up
    [470, 35.5, 24.0, 34.2, 30.0],      // wk 32
    [458, 35.0, 24.2, 34.5, 30.3],      // wk 33
    [466, 35.4, 23.9, 34.0, 29.6],      // wk 34
    // recover
    [492, 36.8, 23.6, 33.6, 29.1],      // wk 35
    [500, 37.2, 23.4, 33.4, 29.0],      // wk 36
    [501, 37.3, 23.3, 33.3, 28.9],      // wk 37
    [503, 37.4, 23.2, 33.2, 28.9],      // wk 38
    [502, 37.5, 23.3, 33.3, 28.9],      // wk 39
    // bad stretch — discipline slips: cost % up ~2-3 pts, scheduling loose
    [500, 37.4, 25.5, 35.8, 29.8, 1],   // wk 40
    [498, 37.2, 25.8, 36.2, 30.0, 1],   // wk 41
    [501, 37.3, 26.0, 36.5, 30.1, 1],   // wk 42
    [499, 37.4, 25.6, 36.0, 29.7, 1],   // wk 43
    // pulled back in, settling onto the locked current-state targets
    [500, 37.6, 24.0, 34.0, 29.0],      // wk 44
    [502, 37.8, 23.6, 33.6, 28.9],      // wk 45
    [501, 37.9, 23.4, 33.4, 28.8],      // wk 46
    [503, 38.0, 23.2, 33.2, 28.7],      // wk 47
    [502, 38.0, 23.1, 33.1, 28.7],      // wk 48
    [504, 38.1, 23.0, 33.0, 28.6],      // wk 49
    [502, 38.2, 22.9, 33.0, 28.6],      // wk 50
    [503, 38.2, 22.9, 32.9, 28.6],      // wk 51
    [500, 38.3, 22.8, 32.9, 28.6],      // wk 52  (current state; matches annual settings)
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

    // The trend first breaks toward target around week 9. Documentary only —
    // the discipline seeds key off each week's `loose` flag, not this number.
    fix_week: 9,

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
