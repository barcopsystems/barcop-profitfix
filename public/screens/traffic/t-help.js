'use strict';
S.TrafficHelp = {
  render(container, actions) {
    const sections = [
      { t: 'Getting Started', qa: [
        { q: 'Where do I start?',
          a: 'Open Getting Started from the Hub sidebar. It is the unified setup checklist across Bar Cop\'s systems, in four phases. Foundation: operation profile and your targets, including Traffic targets like Google rating goal, review velocity, response rate, and monthly sessions. Baseline Diagnosis: run all three Audits including the Traffic Audit so you have a scored picture of where your digital presence sits on day one. Capture System: Inventory, Labor, and Shift Control (Traffic does not have a Control system, see below). Weekly Work: the recurring habits that keep the numbers honest. For Traffic specifically, complete the Google Business Profile audit, run the Website Scorecard, and log your current ratings and review counts as a baseline before changing anything.' },
        { q: 'What is Traffic Recovery and how is it different from Profit and Revenue Recovery?',
          a: 'Profit Recovery handles cost control. Pour cost, food cost, theft, and vendor pricing. Revenue Recovery handles what your team collects from every guest who walks through the door. Traffic Recovery handles whether enough people find you, choose you, and come back. An operation can have tight costs and a well-coached service team and still underperform because its digital presence is weak. A 3.8 Google rating gets filtered out of local search. An unclaimed GBP listing removes you from Maps entirely. A website that will not load on a phone turns away most of the guests who try to find you. Traffic Recovery fixes the top of the funnel so the Profit and Revenue systems have the volume they need to work.' },
        { q: 'Why is Traffic standalone and not fed by a Control system?',
          a: 'The three Control systems (Inventory, Labor, Shift) capture operational reality that happens inside the four walls of the bar. Traffic data lives outside those walls: on Google, on Yelp, on your website analytics, on delivery platforms, on social media. There is no operational log to feed it. So Traffic Recovery both captures and diagnoses, and the Traffic Audit is screenshot-based rather than Control-data fed. The pieces of Traffic that feel like Control (the weekly logging of rating, reviews, sessions) all live in This Week.' },
        { q: 'Do I need to use every section?',
          a: 'No. Start with This Week, the GBP section, and Review Tracker. Get those three running and you have your baseline rating tracked, your review velocity visible, and your response rate showing as a real number. Add the Website Scorecard once you pull your analytics. Add Social Media once you have a month of posting data. The Guests and Planning section (VIP Regulars, Slow-Night Initiatives, Holiday and Events, Group Inquiries) is the operator toolkit, add what fits your operation. The Traffic Audit scores whatever data exists. Every section you complete unlocks more scoring categories and more specific action items.' }
      ]},
      { t: 'Traffic Audit', qa: [
        { q: 'How does the Traffic Audit work?',
          a: 'Click Generate This Month\'s Audit, upload your screenshots and data files, and Bar Cop reads every document you submit alongside the weekly data you have entered. It scores seven sections: Google Business Profile, website, reviews, search and SEO, social media, delivery platforms, and email marketing. Each section gets a score based on what the submitted data shows. The overall score is a weighted composite. The report identifies your lowest-scoring section, the specific variables pulling the score down, and the biggest-dollar actions to take before your next audit. The PDF is ready to download within two minutes.' },
        { q: 'What should I upload for the best audit?',
          a: 'The highest-value upload is a GBP dashboard screenshot showing your review count, rating, and recent activity. That alone unlocks the full Google Business Profile section. A website analytics screenshot showing monthly sessions and traffic sources unlocks the website section. Instagram and Facebook profile screenshots showing follower counts and recent posts unlock the social section. A DoorDash or UberEats listing screenshot unlocks the delivery section. Submit whatever you have. A single GBP screenshot produces a real scored report with real action items. Every additional file unlocks more sections and raises the confidence of the score.' },
        { q: 'When should I request my first audit?',
          a: 'Day one. Before you change anything. That becomes your baseline score. After 30 days of working through Getting Started and the Traffic Fix Process, request the second audit. The gap between the two scores is the most useful number Bar Cop gives you. It shows you exactly what your 30 days of work moved.' },
        { q: 'How often can I request an audit?',
          a: 'One every 30 days from your last audit. The audit screen shows a countdown to your next available audit after you generate one. The 30-day pace gives you enough time to act on the prior audit before you score yourself again.' }
      ]},
      { t: 'Traffic Fix', qa: [
        { q: 'What is the Traffic Fix screen?',
          a: 'The prescriptive part of Traffic Recovery. The Traffic Audit scores your gaps; Traffic Fix is where you close them. Each gap area (Google Business Profile, Website, Reviews, Search and SEO, Social Media, Delivery Platforms, Email Marketing) has a Fix Process: an ordered list of steps that take you to the exact screen that performs the task. Action steps run a feature (audit the profile, log this week\'s numbers). Result steps show you a computed number (your digital presence score, your 90-day trend). Reference steps download a worksheet or checklist. When the work is done, mark the fix implemented with a date and the Recovery Scoreboard tracks the result.' },
        { q: 'How does the Recovery Scoreboard work for Traffic?',
          a: 'Traffic gaps do not all dollarize cleanly the way pour cost or food cost do. Some Traffic fixes (Email Marketing conversions, delivery platform rating changes) translate to dollars over time. Others (review velocity, GBP completeness) move the underlying score without a direct dollar figure. Bar Cop is honest about that. When a fix has a clean dollar metric to measure, the Scoreboard shows the recovered dollars after the 8-week before-and-after window matures. When a fix moves a score without a dollar metric, the Scoreboard shows the score movement instead. No invented dollar figures.' },
        { q: 'How does Bar Cop know I made a fix?',
          a: 'Bar Cop watches for threshold crossings as you work the screens, and writes a fix_log entry automatically. GBP completeness hits 100%? Credited. Local SEO checklist hits 100%? Credited. Logged 8 GBP posts this month? Credited. Review response rate cleared the target? Credited. Email list grew 10+ contacts week-over-week? Credited. You do not have to remember to mark anything done. The dashboard chart shows a Fix Logged marker on the week the credit landed, and the Recovery Scoreboard tallies the impact over the following 8-week window.' },
        { q: 'What does the Watch Out For section in each Fix Process show?',
          a: 'The top three operator mistakes that show up around that gap. Things Bar Cop itself cannot prevent: posting promotional graphics as the dominant social content, never showing the inside of the bar in video, ignoring duplicate listings, treating a 4.1 rating as fine. Read them before walking the process the first time.' }
      ]},
      { t: 'This Week', qa: [
        { q: 'What does the wizard pre-fill from?',
          a: 'Every field starts with the value you typed last week. Monday\'s entry is a confirm-and-update session, not a retype-from-blank. The numbers that moved are the ones you change. Numbers that did not move you leave as is and click through.' },
        { q: 'Where do I find my Google rating and review count?',
          a: 'Search your bar name in Google or open your Google Business Profile dashboard at business.google.com. Your current star rating and total review count are right on the listing. For new reviews this month, go to the Reviews tab in your GBP dashboard and count the reviews that came in during the current calendar month. If you are logging this weekly it takes under two minutes.' },
        { q: 'Where do I find my monthly website sessions?',
          a: 'Log into Google Analytics at analytics.google.com. Monthly sessions show on the Overview report. If you use a different analytics tool, look for total visitors or sessions for the current month. If your website does not have analytics installed, that gets flagged in the Website Scorecard as a gap because you cannot manage what you cannot measure. Getting Google Analytics on your site is a 15-minute job that needs to happen immediately if it is not already done.' },
        { q: 'Why are delivery platform ratings not in the wizard anymore?',
          a: 'They moved to the Delivery Platforms screen. Active status and per-platform rating live there as the one place you type them, so there is no question about which door is the source of truth. The wizard still captures rolled-up delivery volume (total orders, average order value) since those are weekly numbers worth a trend line.' },
        { q: 'What if I do not have all this data every week?',
          a: 'Enter what you have. Google rating and new reviews take under two minutes from your GBP dashboard. Sessions and bounce rate require analytics access. Social follower counts are on your profile in seconds. Log whatever you can and leave the rest blank. Bar Cop tracks trends from what you enter, so even three data points per week builds a useful picture over time. Do not skip the week because the data is incomplete. Partial data entered consistently beats complete data entered once in a while.' }
      ]},
      { t: 'Google Business Profile', qa: [
        { q: 'Why does my Google Business Profile matter so much?',
          a: 'It is the first thing most guests see when they search for your bar. It controls whether you show up in the local Maps Pack, the three-listing block that appears above regular search results for queries like "bar near me" or "sports bar Austin." An unclaimed or incomplete listing puts you below competitors who did the basic work of filling out their profile. Every missing field, no menu link, incomplete hours, no photos, no attribute tags, is a signal telling Google your listing is lower quality than a fully optimized competitor.' },
        { q: 'How do I use the GBP Post Log?',
          a: 'When you publish a post on Google (Offer, Event, or Update), log it on the GBP screen with the date, type, headline, and link. The log counts your posts for the month automatically and replaces the typed Posts/Mo number on the profile form. Eight posts a month is the benchmark. The log gives you a record of what you posted, when, and whether you cross-posted to Instagram or Facebook so you can run the same content across channels without losing track. Click Worksheet to print a paper log for capturing posts during the week, then type them in after.' },
        { q: 'How many photos should my GBP listing have?',
          a: 'The benchmark is 100 photos or more. Exterior shots, interior shots, food and drink photos, event photos, staff photos. Listings with more than 100 photos get significantly more views and direction requests than listings with under 20. You do not need professional photography. Consistent, well-lit phone photos uploaded weekly add up fast. The algorithm rewards recency as well as volume, so adding 5 to 10 new photos per month matters more than uploading 200 photos once and walking away.' },
        { q: 'How do I respond to negative reviews effectively?',
          a: 'Respond within 24 hours. Keep it under 100 words. Acknowledge the specific issue without arguing or making excuses. Offer to make it right and give a direct contact. Never respond in a way that escalates the situation or that a prospective guest reading the exchange would find off-putting. The goal is not to change the mind of the person who left the review. The goal is to show every other guest reading it that your operation handles problems professionally. A clean response to a 1-star review builds more trust than the negative review costs.' }
      ]},
      { t: 'Review Tracker', qa: [
        { q: 'Why is response rate a scored metric?',
          a: 'Google has confirmed that businesses responding to reviews are seen as more credible, and that response activity factors into local search ranking. The benchmark is 75 percent or higher. Below 50 percent means you are leaving a large number of public conversations unanswered, which signals to prospective guests that management is not paying attention. Responding to reviews puts you in control of the narrative.' },
        { q: 'How do I use the Review Reply Log?',
          a: 'Every time you reply to a review (positive or negative, on any platform), log it: date, source, rating, the reply you wrote, and the action you took. Use the Worksheet button to print a paper log to keep behind the bar or in the office, capturing replies as you write them. The log gives you the bookkeeper-ready record of which reviews you handled, and Bar Cop credits the Recovery Scoreboard when your logged monthly reply count hits the review velocity target.' },
        { q: 'How fast should I be growing my review count?',
          a: 'The target is 8 or more new reviews per month. Below 4 per month and your listing is aging relative to competitors generating reviews consistently. Freshness matters to Google. A listing with 150 reviews where the most recent is 4 months old ranks below a listing with 80 reviews where 12 came in the last 30 days. The most effective method is a direct verbal ask at the close of a good guest interaction, followed by a short follow-up if you have their contact. Review QR codes at tables and on receipts work well and require zero staff training.' },
        { q: 'How do I handle a pattern of similar negative reviews?',
          a: 'A recurring negative theme is not a review problem. It is an operational problem showing up in reviews. If multiple reviews over 90 days mention slow service, a specific menu item, parking, noise, or a particular staff interaction, that has to be fixed at the operational level before the reviews improve. Log the pattern in Negative Patterns Noted on the Review Tracker, find the root cause, make the change, and monitor whether new reviews over the next 60 days reflect the improvement.' }
      ]},
      { t: 'Search and SEO', qa: [
        { q: 'What is NAP consistency and why does it matter?',
          a: 'NAP stands for Name, Address, Phone. Google cross-checks your business information across every online listing where you appear: your GBP, your website, Yelp, TripAdvisor, delivery platforms, local directories, and social profiles. When those listings do not match, it sends conflicting signals that hurt your local search ranking. A bar listed as "The Rusty Nail" on GBP but "Rusty Nail Bar and Grill" on Yelp with a slightly different address format confuses the algorithm. Audit your top 10 listing sources and get the NAP identical across all of them. It is a one-time cleanup with a lasting positive effect on ranking.' },
        { q: 'What is the Maps Pack and how do I get into it?',
          a: 'The Maps Pack is the block of three local business listings that appears in Google search above the organic links for local queries. It is the highest-value position in local search because it loads first and shows your rating, photos, hours, and a direct Maps link. The primary factors for Maps Pack placement are a fully claimed and complete GBP listing, consistent NAP across the web, review count and rating, recency of reviews, and relevance of your GBP category and attributes to the search query. You cannot pay your way in. You earn it through consistent work on the listing.' },
        { q: 'What is my primary local keyword and how do I find it?',
          a: 'Your primary keyword is the search phrase most likely to bring a new guest to your door. For most bars it follows the pattern: bar type plus city or neighborhood. Sports bar Austin. Rooftop bar downtown Nashville. Dive bar Brooklyn. To find what people actually search, open Google and type your bar type and city. The autocomplete suggestions show you real search behavior. Your business name, GBP listing, and website title tags should all reflect this primary keyword. Secondary keywords are variations: best happy hour in your city, live music bar in your city, neighborhood plus bar. Work those into your GBP description, posts, and website copy.' }
      ]},
      { t: 'Website Scorecard', qa: [
        { q: 'What does the Website Scorecard measure?',
          a: 'A scored audit of your website across page speed, mobile elements, menu structure, and calls to action. Each toggle gets checked off as you complete the audit and the composite gives you a single number to track over time. The Scorecard is the data behind the Website section of the Traffic Audit, so improvements here flow directly into your next monthly audit score.' },
        { q: 'What are the biggest-dollar website fixes?',
          a: 'In order: page speed (compress every homepage and menu image under 200KB, takes 20 minutes, costs nothing), replace any PDF menu with a real web page (PDF menus are not indexed by Google and unreadable on phones), put a clickable phone number above the fold on mobile, put a reservation or order button above the fold (not buried in the navigation), install Google Analytics 4 if it is not already there. These five fixes cover most of the lift available to most bar websites.' },
        { q: 'What goes in the Notes field?',
          a: 'Anything you noticed in your weekly numbers that the numbers alone do not explain. A campaign that drove a spike. A page that went slow. A referral source that surprised you. The Notes are operator memory, not metrics. They make next month\'s review honest about what actually happened.' }
      ]},
      { t: 'Social Media', qa: [
        { q: 'How often should I post?',
          a: 'The benchmark is 12 or more posts per month across Instagram and Facebook combined, roughly 3 per week. Consistency matters more than volume. Posting every day for two weeks then going dark for a month hurts your reach more than posting 3 times a week all month. The simplest system: one food or drink photo on a weekday, one event or promo post before the weekend, one behind-the-scenes or staff post mid-week. Three posts, each under 5 minutes on your phone, builds a presence that stacks up over time.' },
        { q: 'How do I use the Social Post Log?',
          a: 'When you publish a social post, log it: date, platform, content type (Food/Drink, Event/Promo, Behind-Scenes, Staff/Guest, Reel/Video, Story), a caption snippet, and the link. The log counts your monthly posts automatically and replaces the typed IG Posts/Mo number with a real count when at least one post is logged this month. Use the Worksheet button to print a paper log for the back bar that staff can fill in as they post, then you type the week into Bar Cop on Monday.' },
        { q: 'What content performs best for bars and restaurants?',
          a: 'Food and drink photography is the top-performing content for bars and restaurants on Instagram. Behind-the-scenes content (bartenders making cocktails, chefs plating, prep shots) consistently outperforms polished advertising. Events and specials posted 3 to 5 days out generate the most saves. Staff introductions and guest moments work well because they show real people running a real operation. The worst-performing content is generic promotional graphics that look like ads.' }
      ]},
      { t: 'Delivery Platforms', qa: [
        { q: 'Where do I set platform active status and rating?',
          a: 'On the Delivery Platforms screen itself. Active and rating live in the platform profile (one canonical place), so there is no question about which door is the source of truth. The weekly wizard captures only the rolled-up volume metrics (total orders and average order value) because those are weekly numbers worth a trend line. The four tracked platforms are DoorDash, Uber Eats, Grubhub, and ezCater.' },
        { q: 'What is the Menu Synced checkbox?',
          a: 'A signal that the menu on this delivery platform matches your in-house menu. Prices and availability drift across platforms over time, and a guest who orders an item that came off the menu leaves a one-star review. Check this box after you have verified the platform menu matches your current menu, and re-check it any time you change prices or remove items. The check date is stamped so you can see how old the sync is at a glance.' },
        { q: 'Why do delivery platform ratings matter?',
          a: 'Guests on DoorDash, UberEats, and Grubhub filter by rating before picking a restaurant. A rating below 4.0 on a delivery platform cuts you out of consideration for a large portion of users. Delivery ratings are also visible to guests who are not ordering delivery. They search your name and see your delivery listing right next to your Google and Yelp profiles. A strong Google rating paired with a weak delivery rating creates a credibility problem. Give your delivery listing the same attention you give your Google listing.' }
      ]},
      { t: 'Email Marketing', qa: [
        { q: 'Why does an email list matter when I already have social media?',
          a: 'Social followers are not yours. The platform decides who sees your posts, and organic reach keeps shrinking every year. An email list is an owned channel: when you send, it lands in the inbox. For a bar, email is the most reliable way to pull past guests back for a slow Tuesday, an event, or a new menu. A list of 1,000 engaged contacts you email monthly is worth more than 5,000 followers who might see one post in ten.' },
        { q: 'How do I use the Email Campaign Log?',
          a: 'Every time you send an email campaign, log it: send date, type (Newsletter, Event Promo, New Menu, etc.), subject line, send count, and open percentage if you know it from your platform. The log gives you the bookkeeper-ready answer to "what did you send this month" and the open-rate metric uses the logged campaign averages when present. Use the Worksheet button to print an ongoing record of campaigns sent across the month.' },
        { q: 'What email open rate should I expect?',
          a: 'The Bar Cop benchmark is 20 percent or higher, since guests who opted in genuinely like the place. Below 15 percent usually means one of three things: the list went stale from infrequent sending, the subject lines are weak, or the list was built from low-quality signups. Tighten the subject line, send around the time guests decide where to eat, and clear inactive contacts off the list.' }
      ]},
      { t: 'VIP Regulars', qa: [
        { q: 'What is the VIP Regulars Log?',
          a: 'The bar\'s regulars book in digital form. Name, contact, birthday, anniversary, drink preferences, last visit. The screen surfaces birthdays and anniversaries coming up this month so you can pull regulars in with a text or an email. It also flags regulars who have gone quiet (60+ days no visit) so you can reach out before they\'re gone for good. This is what an independent bar does that the big chains can\'t: know the regulars by name, by drink, by date.' },
        { q: 'How should I format birthday and anniversary?',
          a: 'MM-DD format, no year. For example 03-12 for March 12. The year doesn\'t matter for the recurring outreach trigger, just the month and day. Bar Cop calculates how many days until the next birthday or anniversary and surfaces dates in the next 30 days on the regular\'s row.' },
        { q: 'How do I find regulars who have gone quiet?',
          a: 'The Quiet 60+ Days tile on the summary shows the count, and the Quiet 60+ days only filter on the filter card narrows the list to just those regulars. They are the operator\'s reach-out list: a quick text, a comp on their next visit, a personal email tied to whatever is happening at the bar this month.' }
      ]},
      { t: 'Slow-Night Initiatives', qa: [
        { q: 'What is the Slow-Night Initiatives Tracker?',
          a: 'A place to log the tactics you try on slow weeknights and measure whether they actually moved covers. Trivia Tuesday. Wing Wednesday. Industry Sunday. Live music Thursday. Operators try these constantly. Most never track whether they worked. Log the tactic with baseline weeknight covers before launch, then update Current Covers as the initiative runs. Bar Cop shows the lift percentage so you know whether it\'s worth keeping.' },
        { q: 'What is the baseline I should capture?',
          a: 'Average covers on the same weekday for the 4 weeks before the initiative started. If you\'re launching Wing Wednesday, look at the last 4 Wednesdays and take the average. That\'s your baseline. As the initiative runs, update Current Covers with the average for the most recent 4 weeks of that weekday. The lift percentage is current minus baseline divided by baseline, expressed as a percentage.' },
        { q: 'When should I mark an initiative Completed vs Stopped?',
          a: 'Completed means it ran its planned course and you have data on the lift. Stopped means you killed it before measuring (didn\'t draw, lost interest, conflicted with something else). Completed initiatives with positive lift credit the Recovery Scoreboard. Stopped initiatives don\'t, but they\'re worth logging anyway so you don\'t repeat the same dead tactic in six months.' }
      ]},
      { t: 'Holiday and Events', qa: [
        { q: 'What is the Holiday and Events Calendar?',
          a: 'A 12-month forward view of the dates you trade on, with a per-date planning checklist: menu locked, promo created, staffing scheduled, reservations open. Operators always feel they planned the holiday too late. This is the screen the owner-operator opens once a month to look at what\'s coming up and whether the basics are in place. Dates group by month so the next 30 days are obvious at a glance.' },
        { q: 'What dates should I add?',
          a: 'The dates that matter for your operation. Major holidays you trade on (Valentine\'s, Mother\'s Day, Father\'s Day, NYE). Local events (the homecoming game, the festival weekend, the parade). Sports (Game Day, opening weekend). Industry nights or anything else that pulls a different crowd on a specific date. If a date doesn\'t change how you run the bar, don\'t bother adding it.' },
        { q: 'When does a date credit the Recovery Scoreboard?',
          a: 'When the 4-toggle planning checklist hits 4 of 4 for an upcoming date. That signals the operation is ready: menu locked, promo published, staff scheduled, reservations or walk-in plan set. Hitting 4/4 on the day of doesn\'t help, but hitting 4/4 a week or two out closes the gap that would otherwise have been a half-planned trading day.' }
      ]},
      { t: 'Group Inquiries', qa: [
        { q: 'What is the Group Inquiries tracker?',
          a: 'Sales pipeline for group and private event inquiries. Every call, email, or walk-in asking about a party, a corporate dinner, a rehearsal, a memorial. Log the lead when it comes in and move it through Called Back → Quote Sent → Booked or Lost. The summary card shows conversion rate over the last 90 days (Booked as a percentage of closed inquiries). Most operators find they\'re losing 40% because they didn\'t call back fast enough. The log makes that visible.' },
        { q: 'How is this different from the Events screen in Revenue Recovery?',
          a: 'Revenue Recovery\'s Events screen tracks events that have already booked: confirmed dates, deposits, prep, P&L. Group Inquiries tracks the leads before they become bookings. Same operator workflow, different stage of the funnel. Once an inquiry is marked Booked here, the operator can open the Events screen and add the confirmed event with all the operational detail.' },
        { q: 'What does Stale (3+ Days) mean?',
          a: 'An inquiry that\'s still open (not Booked, Declined, or Lost) and 3+ days have passed since received. That\'s the threshold where lead conversion starts collapsing. If the stale count is climbing, the lesson is callbacks are slow, not that the leads are bad.' }
      ]},
      { t: 'Reports and History', qa: [
        { q: 'What does Reports and History show?',
          a: 'Every Traffic Recovery week you have saved, sorted newest first. Google rating, new reviews, response rate, monthly sessions, bounce rate, social posts, follower count, and the trend line for each. Click any week to see the full detail. Use the history to spot the weeks that moved outside the norm and understand why. A week where review velocity spiked is worth understanding because whatever drove it is probably worth repeating.' },
        { q: 'What is the Month End Brief PDF?',
          a: 'A one-page summary for the operation\'s owner or marketing consultant. Digital presence score for the month with month-over-month delta, the big-three metrics (rating, sessions, list size) with deltas, and the top fixes Bar Cop credited this month from the fix_log. Use it as the monthly conversation document with anyone who isn\'t in Bar Cop daily.' },
        { q: 'Can I export the weekly history?',
          a: 'Yes. Weekly History (PDF) renders the table in a clean digital presence trail you can show ownership or share with a marketing consultant. The Month End Brief above is the summary version for someone who isn\'t going to read every weekly row.' }
      ]},
      { t: 'Settings', qa: [
        { q: 'Where do I set my Traffic targets?',
          a: 'In Hub Settings, on the Traffic Targets card. Google rating goal, new reviews per month, response rate percent, monthly sessions, and social posts per month. Bar Cop benchmarks are pre-filled. Adjust them to your operation. Click Save Data when you change them.' },
        { q: 'Where do I add my platform URLs?',
          a: 'In Hub Settings, on the Operation Links card. Website, Google, Yelp, Instagram, Facebook, DoorDash, Uber Eats, Grubhub, ezCater, OpenTable, Resy, Email Platform. These power the Live Links strip on the Traffic Dashboard for one-click access to your live listings.' },
        { q: 'What Google rating target should I set?',
          a: 'The Bar Cop benchmark is 4.3 or higher. Below 4.0 is where search filtering starts cutting you out. Many guests and platforms exclude results below 4.0 by default. If you are below 4.0, set your target at 4.0 first. Hit that, then move to 4.3.' }
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

    const refCard = '<div class="card" style="margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">'
      + '<div style="flex:1;min-width:220px;"><div style="font-size:13px;font-weight:700;color:var(--t1);">Traffic Quick Reference Card</div>'
      + '<div style="font-size:12px;color:var(--t3);line-height:1.5;">Every Traffic benchmark on one page, with what each number means. Print it and post it where the team can see it.</div></div>'
      + '<button class="btn btn-primary btn-sm" id="th-qref" style="flex-shrink:0;">Open Quick Reference Card</button></div>';

    container.innerHTML = '<div class="screen">' + refCard + sectionsHtml + '</div>';

    document.getElementById('th-qref')?.addEventListener('click', () => this.quickReferenceCard());
  },

  quickReferenceCard() {
    const barName = App.data.settings?.bar_name || 'Bar Cop';
    const rows = [
      ['Google Rating',        '4.3 stars or higher', 'Below 4.0 and local search filters you out of results.'],
      ['New Reviews',          '8 per month',         'Freshness ranks you. Below 4 per month your listing ages.'],
      ['Review Response Rate', '75% or higher',       'Reply to every review. Google counts response activity.'],
      ['Yelp Rating',          '4.0 stars or higher', 'Yelp runs lower than Google, but under 4.0 still hurts.'],
      ['GBP Photos',           '100 or more',         'More photos drives more listing views and visits.'],
      ['GBP Posts',            '8 per month',         'Posts appear in search before a guest clicks through.'],
      ['Website Sessions',     '2,000 per month',     'Below 500 means you are not being found online.'],
      ['Bounce Rate',          'Under 60%',           'Above 70% the homepage has no clear next step.'],
      ['Social Posts',         '12 per month',        'About 3 a week across Instagram and Facebook.'],
      ['Instagram Engagement', '2% or higher',        'Confirms followers are actually interacting.'],
      ['Delivery Rating',      '4.5 stars or higher', 'Below 4.0 cuts you from delivery consideration.'],
      ['Local Citations',      '40 or more',          'Consistent directory listings build local authority.'],
      ['Email Open Rate',      '20% or higher',       'Your one owned channel. Keep it warm by sending.']
    ];
    const tr = rows.map(r => '<tr><td class="m">' + r[0] + '</td><td class="b">' + r[1] + '</td><td>' + r[2] + '</td></tr>').join('');
    const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Traffic Quick Reference Card</title>'
      + '<style>body{font-family:Helvetica,Arial,sans-serif;color:#111;margin:0;padding:34px;}'
      + 'h1{font-size:20px;margin:0 0 2px;}.sub{font-size:11px;color:#666;margin-bottom:18px;}'
      + 'table{width:100%;border-collapse:collapse;font-size:12px;}'
      + 'th{background:#1a1a2e;color:#fff;padding:8px 10px;text-align:left;font-size:10px;letter-spacing:0.5px;text-transform:uppercase;}'
      + 'td{padding:8px 10px;border-bottom:1px solid #eee;vertical-align:top;}'
      + 'td.m{font-weight:700;white-space:nowrap;}td.b{font-weight:700;color:#8a6a16;white-space:nowrap;}'
      + '.footer{margin-top:18px;font-size:10px;color:#aaa;text-align:center;}</style></head><body>'
      + '<h1>Traffic Quick Reference</h1>'
      + '<div class="sub">' + esc(barName) + ' &nbsp;|&nbsp; Digital presence benchmarks for the team</div>'
      + '<table><thead><tr><th>Metric</th><th>Benchmark</th><th>What the number means</th></tr></thead>'
      + '<tbody>' + tr + '</tbody></table>'
      + '<div class="footer">Bar Cop Traffic Recovery</div></body></html>';
    const win = window.open('', '_blank');
    if (!win) { alert('Allow pop-ups to open the reference card.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }
};
