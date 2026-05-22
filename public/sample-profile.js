'use strict';

/* ── The Anchor — locked sample operation profile ─────────────────────────────
   The single source of truth for all sample data (Section 13). Every module's
   loadSample, and every Control-module sample build, derives its numbers from
   this one profile so the whole dataset describes one coherent operation.

   Twelve weeks, weeks[0] oldest .. weeks[11] most recent. The story is a
   recovery: revenue $14.9k -> $19.2k/week, pour cost 28.0 -> 22.8%, food cost
   39.2 -> 32.9%, blended labor 32.1 -> 28.6%, prime cost 64.3 -> 55.2%. Week 12
   (~$19.2k/week) matches the settings annual figures: $624k bar + $374k food.

   Per week, the canonical numbers all reconcile:
     total_rev = covers x check_avg
     bar_rev   = round(total_rev x 0.625)   food_rev = total_rev - bar_rev
     bar_cogs / bar_rev    = bar_pour_pct      food_cogs / food_rev = food_cost_pct
     bar_labor + food_labor = total labor      (food_labor = kitchen + floor)
   Control-module sample data must compute back to these figures. */

window.ANCHOR = {
  bar_name:   'The Anchor Bar & Kitchen',
  city_state: 'Austin, TX',
  annual_bar_revenue:  624000,
  annual_food_revenue: 374400,

  bar_share: 0.625,                 // bar's share of total revenue
  kitchen_share_of_food_labor: 0.5, // food_labor splits kitchen/floor 50/50
  wages: { bar: 16, kitchen: 15, floor: 14 },

  // Fixes land between week 5 and week 6, where every trend breaks toward target.
  fix_week: 6,

  weeks: [
    { wk:1,  covers:488, check_avg:30.6, total_rev:14933, bar_rev:9333,  food_rev:5600,
      bar_cogs:2613, food_cogs:2195, bar_labor:2940, food_labor:1848,
      bar_pour_pct:28.0, food_cost_pct:39.2, labor_pct_blended:32.1, prime_cost_pct:64.3 },
    { wk:2,  covers:490, check_avg:31.1, total_rev:15239, bar_rev:9524,  food_rev:5715,
      bar_cogs:2629, food_cogs:2217, bar_labor:2971, food_labor:1869,
      bar_pour_pct:27.6, food_cost_pct:38.8, labor_pct_blended:31.8, prime_cost_pct:63.6 },
    { wk:3,  covers:489, check_avg:30.4, total_rev:14866, bar_rev:9291,  food_rev:5575,
      bar_cogs:2583, food_cogs:2174, bar_labor:2917, food_labor:1834,
      bar_pour_pct:27.8, food_cost_pct:39.0, labor_pct_blended:32.0, prime_cost_pct:64.0 },
    { wk:4,  covers:492, check_avg:31.5, total_rev:15498, bar_rev:9686,  food_rev:5812,
      bar_cogs:2635, food_cogs:2232, bar_labor:2983, food_labor:1877,
      bar_pour_pct:27.2, food_cost_pct:38.4, labor_pct_blended:31.4, prime_cost_pct:62.8 },
    { wk:5,  covers:491, check_avg:31.0, total_rev:15221, bar_rev:9513,  food_rev:5708,
      bar_cogs:2607, food_cogs:2198, bar_labor:2949, food_labor:1855,
      bar_pour_pct:27.4, food_cost_pct:38.5, labor_pct_blended:31.6, prime_cost_pct:63.1 },
    { wk:6,  covers:494, check_avg:33.6, total_rev:16598, bar_rev:10374, food_rev:6224,
      bar_cogs:2635, food_cogs:2266, bar_labor:3071, food_labor:1954,
      bar_pour_pct:25.4, food_cost_pct:36.4, labor_pct_blended:30.3, prime_cost_pct:59.8 },
    { wk:7,  covers:495, check_avg:34.8, total_rev:17226, bar_rev:10766, food_rev:6460,
      bar_cogs:2648, food_cogs:2287, bar_labor:3144, food_labor:2003,
      bar_pour_pct:24.6, food_cost_pct:35.4, labor_pct_blended:29.9, prime_cost_pct:58.5 },
    { wk:8,  covers:496, check_avg:35.6, total_rev:17658, bar_rev:11036, food_rev:6622,
      bar_cogs:2649, food_cogs:2291, bar_labor:3178, food_labor:2026,
      bar_pour_pct:24.0, food_cost_pct:34.6, labor_pct_blended:29.5, prime_cost_pct:57.5 },
    { wk:9,  covers:497, check_avg:36.4, total_rev:18091, bar_rev:11307, food_rev:6784,
      bar_cogs:2657, food_cogs:2300, bar_labor:3223, food_labor:2056,
      bar_pour_pct:23.5, food_cost_pct:33.9, labor_pct_blended:29.2, prime_cost_pct:56.6 },
    { wk:10, covers:498, check_avg:37.2, total_rev:18526, bar_rev:11579, food_rev:6947,
      bar_cogs:2675, food_cogs:2320, bar_labor:3265, food_labor:2084,
      bar_pour_pct:23.1, food_cost_pct:33.4, labor_pct_blended:28.9, prime_cost_pct:55.8 },
    { wk:11, covers:499, check_avg:37.7, total_rev:18812, bar_rev:11758, food_rev:7054,
      bar_cogs:2693, food_cogs:2328, bar_labor:3292, food_labor:2102,
      bar_pour_pct:22.9, food_cost_pct:33.0, labor_pct_blended:28.7, prime_cost_pct:55.4 },
    { wk:12, covers:500, check_avg:38.3, total_rev:19150, bar_rev:11969, food_rev:7181,
      bar_cogs:2729, food_cogs:2363, bar_labor:3339, food_labor:2133,
      bar_pour_pct:22.8, food_cost_pct:32.9, labor_pct_blended:28.6, prime_cost_pct:55.2 },
  ],

  // The most recent week — the figure the live This Week feeds should land on.
  current() { return this.weeks[this.weeks.length - 1]; },

  // Labor for a week, broken into the three departments Revenue tracks.
  // Bar department = bar_labor; kitchen + floor split food_labor.
  laborDepts(w) {
    const kitchen = Math.round(w.food_labor * this.kitchen_share_of_food_labor);
    return { bar: w.bar_labor, kitchen: kitchen, floor: w.food_labor - kitchen };
  }
};
