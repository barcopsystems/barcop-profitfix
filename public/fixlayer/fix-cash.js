'use strict';

/* ── Fix Layer content — Cash Recovery ────────────────────────────────────────
   Static fix content for the four Cash Fix Systems, rendered by the Cash Fix
   screen (S.CashFix) as the same master-detail rail the Profit and Revenue Fix
   screens use. The dollars underneath come from CashEngine (honest, off your
   inventory and bills), never a made-up figure. Source: the Cash Recovery spec. */

window.FIX = window.FIX || {};

FIX.cash = [

  {
    id: 'free-trapped',
    name: 'Free Trapped Inventory Cash',
    module: 'cash',
    summary: 'Working capital sitting on the shelf in dead stock and overstock instead of in your account. The biggest cash lever you have, and it is real money back this week.',
    process: {
      steps: [
        { kind: 'action', target: 'c-trapped', targetLabel: 'Trapped Cash',
          title: 'Read what is trapped',
          detail: 'Open Trapped Cash and read what is not moving and what is sitting above par, ranked by the dollars you can free. Work the biggest ones first.' },
        { kind: 'action', target: 'ic-take-inventory', targetLabel: 'Take Inventory',
          title: 'Count on the same day every week',
          detail: 'Trapped cash reads off your counts, so a steady weekly count keeps both the trapped number and the cash you free honest.' },
        { kind: 'action', target: 'ic-par-suggestions', targetLabel: 'Dynamic Pars',
          title: 'Cut the pars that run above your usage',
          detail: 'In Dynamic Pars, drop the par on anything you keep reordering before it runs low. A lower par stops you buying ahead of what you actually use.' },
        { kind: 'action', target: 'ic-report-movers', targetLabel: 'Movement',
          title: 'Run the dead stock down',
          detail: 'Feature a dead bottle, put it on a special, work it into a cocktail, or eighty-six it and stop reordering. Money on the shelf is not money in the bank.' }
      ]
    },
    commonMistakes: [
      'Counting a different day each week, so the trapped number jumps around for reasons that have nothing to do with what is on the shelf.',
      'Cutting the par on a true seasonal item right before its season. Check the calendar before you drop it.',
      'Calling stock dead off a single count. Give it two counts of no movement before you run it down.'
    ]
  },

  {
    id: 'order-to-par',
    name: 'Order to Par, Not to Fear',
    module: 'cash',
    summary: 'Every case you buy ahead of when you need it is cash off your account and onto the shelf. Order to what you actually use, not to a number that feels safe.',
    process: {
      steps: [
        { kind: 'result', target: 'c-purchasing', targetLabel: 'Purchasing',
          title: 'Check how many weeks you are carrying',
          detail: 'Open Purchasing and read your weeks on hand against your usage, and which categories are overstocked. Two to three weeks is healthy for most bars. Capital Efficiency goes deeper, showing which categories turn slowest, where your cash sits longest.' },
        { kind: 'action', target: 'ic-par-suggestions', targetLabel: 'Dynamic Pars',
          title: 'Tune your pars to real usage',
          detail: 'Set pars off what you actually use, not a comfort number. If a category keeps coming in overstocked, the par is too high.' },
        { kind: 'action', target: 'ic-order-sheet', targetLabel: 'Order Sheet',
          title: 'Order to par in the Order Sheet',
          detail: 'Place your order to bring everything to par and no further. Consolidate to fewer, fuller orders timed near when your sales come in.' },
        { kind: 'action', target: 'ic-take-inventory', targetLabel: 'Take Inventory',
          title: 'Re-count to confirm it came down',
          detail: 'Count again the following week and watch your weeks on hand settle toward target as the overstock works off.' }
      ]
    },
    commonMistakes: [
      'Padding every order "just in case." That padding is exactly the cash that ends up trapped.',
      'Ordering to a round case when a partial covers you to the next delivery.',
      'Stocking deep on a slow premium item because it looks good on the shelf. It looks better in the bank.'
    ]
  },

  {
    id: 'stay-ahead',
    name: 'Stay Ahead of the Week',
    module: 'cash',
    summary: 'Cash is about timing as much as amount. Line up what is going out against what is coming in across the quarter ahead, so a heavy week does not catch you short.',
    process: {
      steps: [
        { kind: 'result', target: 'c-forecast', targetLabel: 'Cash Forecast',
          title: 'Read the quarter ahead',
          detail: 'Open the Cash Forecast and read cash in against cash out across the next thirteen weeks. Enter your cash on hand to see a running balance, your low-point week, and your runway, and stress-test a slow season or a big buy before you commit to it.' },
        { kind: 'action',
          title: 'Spot any tight week',
          detail: 'Find the week where cash out beats cash in. A quarterly bill landing on a slow week, the same week as a big order, is the kind of thing that catches an operator short.' },
        { kind: 'action', target: 'books', targetLabel: 'Books',
          title: 'Move a payment or hold an order to cover it',
          detail: 'Slide a bill to its due date, hold a big buy a week, or lean out a slow shift so the tight week clears. Small moves, made early, beat scrambling on Friday.' },
        { kind: 'action',
          title: 'Confirm the week is covered',
          detail: 'Check the forecast again after your moves and make sure the tight week is back in the black.' }
      ]
    },
    commonMistakes: [
      'Reading the forecast once a quarter instead of every week. Tight weeks form on a few days notice.',
      'Forgetting the lumpy ones, quarterly insurance, an annual license, a big equipment buy, that do not show on a normal week.',
      'Paying everything the day it arrives, so a normal week looks like a tight one.'
    ]
  },

  {
    id: 'pay-on-terms',
    name: 'Pay on Terms',
    module: 'cash',
    summary: 'If a vendor gives you net 30, paying on day 5 hands them your cash three weeks early for nothing. Hold it to the due date and take any early-pay discount that beats idle cash.',
    process: {
      steps: [
        { kind: 'action', target: 'ic-vendors', targetLabel: 'List Vendors',
          title: 'Set payment terms on each vendor',
          detail: 'On each vendor record, set the terms they actually give you, net 7, 15, or 30. Bar Cop uses it to flag anything you are paying faster than you have to.' },
        { kind: 'action', target: 'books', targetLabel: 'Books',
          title: 'Hold every bill to its due date',
          detail: 'Pay on the due date, not the day it lands. That cash stays in your account working for you until the day it is owed.' },
        { kind: 'action',
          title: 'Take early-pay discounts worth taking',
          detail: 'If a vendor knocks two percent off for paying in ten days, that usually beats what the cash is worth sitting idle. Take those; hold the rest.' },
        { kind: 'action',
          title: 'Review your terms each quarter',
          detail: 'Ask your reps for better terms at your quarterly review. A vendor you spend with will often move from net 15 to net 30.' }
      ]
    },
    commonMistakes: [
      'Paying every invoice the day it hits the desk, the most common way good operators give up free float.',
      'Chasing a one percent early-pay discount that does not beat what the cash is worth to you that month.',
      'Never asking for terms. Most distributors will give them to a steady account that just asks.'
    ]
  }

];
