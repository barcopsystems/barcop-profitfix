'use strict';

/* ── Hub Help and FAQ — platform-wide help, not module-specific ────────────
   A Hub-owned view (map Section 1). Covers cross-system questions: what
   Bar Cop is, how the three layers fit together, account, data, and getting
   unstuck. System-specific help lives in each Recovery and Control system's
   own Help screen. Renders into the Hub container, never the module app shell. */
S.HubHelp = {

  // Full-page Hub screen. Sidebar stays mounted, content area swaps, topbar
  // shows "HELP AND FAQ | Back to Dashboard".
  open() {
    App.openHubFullPage('Help and FAQ', (mount) => this.render(mount));
  },

  render(container) {
    const sections = [
      { t: 'About Bar Cop', qa: [
        { q: 'What is Bar Cop?',
          a: 'Bar Cop runs your operation in three layers. Capture is the three Control systems where you log what actually happened: Inventory Control for product counts and deliveries, Labor Control for schedules and hours, Shift Control for shift revenue and cash. Diagnose is the three Recovery systems plus the monthly Audit. They read your Control data, surface the gaps, and put a dollar figure on each one. Fix is the Fix Process inside each Recovery system. Pick a gap, follow the ordered steps, mark it implemented when the work is done. The Recovery Scoreboard tracks every recovered dollar against the baseline so you see what the fix was worth. Capture, diagnose, fix. That is the loop.' },
        { q: 'How do the six systems fit together?',
          a: 'The three Control systems log the operation. The three Recovery systems read that log and score it. No double entry. Anything you count in Inventory Control feeds the Profit Audit and the Recovery dashboards. Anything you schedule and pay in Labor Control feeds the Revenue Audit and the labor cost line on every weekly review. Shift revenue and cash variance from Shift Control feed both Profit and Revenue. The Hub Dashboard pulls every number into one cross-system view so you can see the full picture without opening six different screens.' },
        { q: 'Where do I start?',
          a: 'Open Getting Started from the Hub sidebar. It is one ordered list across all six systems, in four phases. Foundation: operation profile and your targets. Baseline Diagnosis: run all three Audits for a scored snapshot of where you sit on day one. Capture System: set up Inventory, Labor, and Shift Control so daily data starts flowing into Recovery. Weekly Work: the recurring operational habits that keep the numbers honest from week one onward. Work it top to bottom. The order matters. Each phase builds on the last, and skipping ahead just produces dashboards full of blanks.' },
        { q: 'Can I use Bar Cop on my phone behind the bar?',
          a: 'Yes. The screens that get used during a shift are built mobile-first, meaning they work on a phone propped behind the bar, a tablet on the counting cart, or a manager\'s tablet during a walkthrough. 48px touch targets, 16px text minimum, no horizontal scroll, auto-save the moment a value is entered. The mobile-first screens are Take Inventory, Receive Delivery, and Spot Check in Inventory Control, plus Active Shift, Cash Drop, 86 List, and Void / Comp Log in Shift Control. These are the screens you actually touch while running the floor, not while sitting at a desk. If your wifi flakes mid-count, Bar Cop keeps writing to local storage as you go. The next time you open it on a working connection, a sync banner offers to push the pending changes to the server. Nothing is lost when the connection drops in the middle of counting the well.' },
        { q: 'What is the Hub Dashboard showing me?',
          a: 'The Hub Dashboard is the cross-system view of everything. Across the top: the three Audit scores (Profit, Revenue, Traffic), the Total Monthly Opportunity that sums every flagged gap into one dollar figure, and the Weekly Status showing which weeks have been logged in each system. Down the middle: the Recovery Scoreboard tallying every recovered dollar since you started, and the 6-tile Key Metrics grid showing the live state of pour cost, food cost, prime cost, RPLH, check average, and Google rating. On the right: the Alerts panel pulling every flagged item from all six systems into one list, and the Priority Action Items ranked by annual dollar impact. The 8-Week Trend chart at the bottom shows where you have been moving, marked with the dates you logged each fix. Every tile, every number, every action item is clickable. Click it and Bar Cop takes you to the exact screen where that figure is calculated.' },
        { q: 'What does the Audit do that the dashboard does not?',
          a: 'The dashboard shows you the current state. The Audit scores the operation. It is a structured diagnostic on a 0 to 100 scale across every section of every Recovery system, written like a coaching report instead of a raw metric dump. It names each gap, attaches a dollar figure to it, and ranks the action items by annual impact. One Audit every 30 days is included in your subscription. The recurring value of Bar Cop is that scored report plus the Recovery Scoreboard proving the work is paying off.' },
        { q: 'How is the Recovery Scoreboard calculated?',
          a: 'Every time you mark a Fix Process step implemented, Bar Cop logs the date in fix_log against the gap it closed. The Scoreboard then watches the metric that gap controls for the next eight weeks. It compares the 8-week average before the fix date to the 8-week average after. The improvement multiplied by your revenue base is the recovered dollar figure. A figure appears once two weeks of after-data exist and stays flagged preliminary until the eight-week window is full. No invented conversion rates, no marketing math. Every dollar on the Scoreboard traces to a real weekly number that moved.' }
      ]},

      { t: 'Your Account and Your Data', qa: [
        { q: 'How is my data saved?',
          a: 'Every change saves to your account automatically the moment you make it. There is no Save button to remember on most screens. Sign in on another device and your data is already there. If your connection drops mid-change, Bar Cop holds the edit on this device and pushes it to the server the next time you are online. A small banner appears the next time you open Bar Cop offering to sync any pending changes. Nothing is lost when your wifi flakes mid-shift.' },
        { q: 'Does Bar Cop connect to my POS?',
          a: 'Not through a live API connection yet. The bridge today is CSV and Excel import. Most POSes (Toast, Square, Lightspeed, Aloha) let you export a Sales by Item, Item Selection, or Product Mix report for any date range. Bar Cop\'s import screens read those exports directly. Upload the file, map the columns once on the mapping screen, the data lands. The Bar Variance import on This Week pulls pour counts straight from your weekly sales mix. The product setup screens import your full menu off a vendor order guide or POS item list in one shot. Shift revenue is the one POS number Bar Cop reads as ground truth. You enter it per shift in Shift Control along with covers and cash. Every Recovery system reads the weekly sum from there, so there is no double entry across the rest of the app. Live POS integrations with Toast, Square, and Lightspeed are on the roadmap. CSV import was built first because it covers the same ground without per-POS engineering and works for every POS, not just the big three.' },
        { q: 'Can I export my data?',
          a: 'Yes. Open App Settings from the Hub sidebar, scroll to the Account card, and use Export Backup. The export pulls every record from every system into one file: settings, targets, weekly numbers, all three Audits, recipes, fix log, and your full Inventory, Labor, and Shift Control records. Keep a copy offsite as your own backup. Restore from Backup reads the same file back in if you ever need to roll back or move accounts. Export takes under a second on most accounts.' },
        { q: 'What happens if I cancel my subscription?',
          a: 'Your account stays in place for 30 days after cancellation. During that window you can sign back in, run an export, or resubscribe and pick up exactly where you left off. After 30 days the account closes and the data is removed for good. If you think you might come back, do the export before you cancel anyway. Backup files do not expire.' },
        { q: 'How do I change my bar name, location, or revenue baselines?',
          a: 'App Settings, in the Hub sidebar under Manage. The Profile card holds bar name, city, state, and annual bar and food revenue. Click Save Data on the card when you are done. Bar name changes flow through every screen instantly. Revenue baseline changes update the dollar-quantified figures on every dashboard the next time they refresh.' },
        { q: 'How do I change my targets?',
          a: 'App Settings, then the Profit Targets, Revenue Targets, or Traffic Targets card depending on which system you are tuning. Industry benchmarks are pre-filled (22 percent bar pour cost, 32 percent food cost, 60 percent prime cost, etc). Change them to reflect your specific operation. A target that does not match your real business just produces a dashboard full of red that nobody pays attention to. Save Data on the card commits the change.' },
        { q: 'How do I change my password?',
          a: 'App Settings, then the Account card, enter your new password twice, click Update Password. Password must be at least 8 characters. Bar Cop does not store the old password, so if you forget it, use the Reset Password link on the sign-in screen instead.' }
      ]},

      { t: 'Getting Unstuck', qa: [
        { q: 'A number on the dashboard looks wrong.',
          a: 'Click the number. The Hub takes you straight to the screen where that figure is calculated, and you can see every input that produced it. Most wrong-looking numbers turn out to be a missed week, a partial inventory count, a target that was set to an aspirational figure instead of an operational one, or a shift that did not get logged into Shift Control. Fix the input on its own screen and the dashboard updates the moment the change saves. If the math itself looks off after you have verified the inputs, that is a bug worth reporting through Report Bug in the Hub sidebar.' },
        { q: 'I missed a week of data. Can I go back and add it?',
          a: 'Yes. Profit This Week and Revenue This Week both accept any past period_end date. Pick the week you missed in the Period field, fill in the numbers from your POS and inventory count for that period, save it. The dashboard regenerates with the new week included. The 8-week trend chart, the Audit data tiers, and the Recovery Scoreboard math all redraw based on whatever weeks exist, not a fixed calendar. If you missed several weeks, work newest first or oldest first, whatever fits your records. The order does not matter to Bar Cop. What matters is filling the gaps so the trend math has continuous data to average against. One caveat: if the missing week falls inside the 8-week before-window of a fix you have already logged, the Recovery Scoreboard does not retroactively recompute. Those windows are fixed when the fix is logged. The week still lands in your weekly history and the dashboard, just not in already-closed Scoreboard math.' },
        { q: 'My POS numbers do not match what Bar Cop is showing.',
          a: 'Three common causes, in order of how often they show up. First, net vs gross. Most POSes default to gross, the total ring before voids, comps, and refunds. Bar Cop uses net sales, the figure after voids and comps. If your POS report shows $24,000 gross and Bar Cop shows $22,400, the $1,600 gap is your void and comp activity for the week, which is exactly what should be excluded. Second, period cutoff. Most POSes cut the day at 4am or at close, not at midnight. Bar Cop\'s weekly periods cut on the period_end date at midnight. If your POS week ends Sunday at 4am Monday and your Bar Cop week ends Sunday at midnight, four hours of Sunday-night sales sit on opposite sides of the line. Set the Bar Cop period_end to match your POS week boundary and the gap closes. Third, manual overrides. Anything you typed into This Week overrides whatever Control fed in. If the auto-filled revenue from Shift Control was $22,400 and you typed $23,800 over it, the dashboard now shows $23,800. The This Week screen flags any field that was overridden so you can spot which figure has been manually edited. If none of those explain the gap, the variance itself is useful data. A persistent unexplained discrepancy between POS sales and Bar Cop sales is often the first signal of cash handling or void-fraud activity, which is what the Theft Risk Scorecard exists to surface.' },
        { q: 'I have a question about a specific screen or system.',
          a: 'Every system has its own Help and FAQ in its own sidebar. Profit Recovery Help covers Bar Products, This Week, the Profit Audit, recipes, theft risk, and cash reconciliation. Revenue Recovery Help covers menu items, menu engineering, RPLH, check average, and events. Traffic Recovery Help covers Google Business Profile, reviews, search, social, delivery, and email. The three Control systems each have their own Help too. This page is for cross-system questions about Bar Cop, the Hub, and your account.' },
        { q: 'I logged data and the dashboard did not update.',
          a: 'Two things to check. First, did the save complete? Most screens show a brief Saved confirmation in gold after a successful write. If you closed the screen before that appeared, the change may not have committed. Reopen the screen and verify the data is there. Second, are you looking at the right week? Most dashboard figures roll up to the current period. A shift logged for last week shows up in last week, not this week. Cross-system rollups also need the week to be closed and saved on the relevant system before they reflect.' },
        { q: 'Something is broken.',
          a: 'Use Report Bug in the Manage section of the Hub sidebar. Tell us what you were doing when it broke and what you expected to see instead. A screenshot of the screen helps. Reports come straight to support and we triage every one. If the bug is blocking you from running your shift, say so in the description and we move it to the top of the queue.' },
        { q: 'I want a feature that does not exist yet.',
          a: 'Same Report Bug screen. Tell us what you are trying to do, what would help, and how often you would use it. Feature requests get read by the team that builds Bar Cop. Operator suggestions drive most of what gets built next. Specific requests with a real use case land louder than abstract wishlists.' }
      ]}
    ];

    const sectionsHtml = sections.map(sec => {
      const items = sec.qa.map(f =>
        '<div style="border-bottom:1px solid var(--b2);padding:14px 0;">'
        + '<div style="font-size:12px;font-weight:700;color:var(--t1);margin-bottom:6px;cursor:pointer;" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'none\'?\'block\':\'none\'">' + esc(f.q) + '</div>'
        + '<div style="font-size:12px;color:var(--t2);line-height:1.7;display:none;">' + esc(f.a) + '</div>'
        + '</div>'
      ).join('');
      return '<div class="card" style="margin-bottom:14px;">'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--gold);margin-bottom:12px;">' + esc(sec.t) + '</div>'
        + items
        + '</div>';
    }).join('');

    container.scrollTop = 0;
    container.innerHTML =
      '<div class="screen">'
      + sectionsHtml
      + '</div>';

    if (App.setHubTopbarActions) App.setHubTopbarActions('');
  }
};
