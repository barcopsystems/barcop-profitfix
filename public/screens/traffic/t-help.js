'use strict';
S.TrafficHelp = {
  render(container, actions) {
    const sections = [
      { t: 'Getting Started', qa: [
        { q: 'Where do I start?',
          a: 'Open Getting Started in the sidebar and work through it in order. Set your targets first. Google rating goal, review velocity, response rate, and monthly sessions are all pre-filled with industry benchmarks so you can get moving immediately. Then complete the Google Business Profile audit, run the Website Scorecard, and log your current ratings and review counts as a baseline. Four weeks in, your dashboard is populated, your trends are visible, and your Traffic Audit can score all seven sections with real data. Most operators want to skip the setup and jump straight to tracking. Do not. The baseline is what makes the tracking worth anything.' },
        { q: 'What is Traffic Recovery and how is it different from Profit and Revenue Recovery?',
          a: 'Profit Recovery handles cost control. Pour cost, food cost, theft, and vendor pricing. Revenue Recovery handles what your team collects from every guest who walks through the door. Traffic Recovery handles whether enough people find you, choose you, and come back. An operation can have tight costs and a well-coached service team and still underperform because its digital presence is weak. A 3.8 Google rating gets filtered out of local search. An unclaimed GBP listing removes you from Maps entirely. A website that will not load on a phone turns away most of the guests who try to find you. Traffic Recovery fixes the top of the funnel so the Profit and Revenue systems have the volume they need to work.' },
        { q: 'Do I need to use every section?',
          a: 'No. Start with This Week, the GBP section, and Review Tracker. Get those three running and you have your baseline rating tracked, your review velocity visible, and your response rate showing as a real number. Add the Website Scorecard once you pull your analytics. Add Social Media once you have a month of posting data. The Traffic Audit scores whatever data you have submitted at any point. Every section you complete unlocks more scoring categories and more specific action items. A partial audit beats no audit every time.' },
      ]},
      { t: 'This Week', qa: [
        { q: 'Where do I find my Google rating and review count?',
          a: 'Search your bar name in Google or open your Google Business Profile dashboard at business.google.com. Your current star rating and total review count are right on the listing. For new reviews this month, go to the Reviews tab in your GBP dashboard and count the reviews that came in during the current calendar month. If you are logging this weekly it takes under two minutes.' },
        { q: 'Where do I find my monthly website sessions?',
          a: 'Log into Google Analytics at analytics.google.com. Monthly sessions show on the Overview report. If you use a different analytics tool, look for total visitors or sessions for the current month. If your website does not have analytics installed, that gets flagged in the Website Scorecard as a gap because you cannot manage what you cannot measure. Getting Google Analytics on your site is a 15-minute job that needs to happen immediately if it is not already done.' },
        { q: 'What is bounce rate and how do I find it?',
          a: 'Bounce rate is the percentage of visitors who land on your website and leave without clicking to any other page. Above 70 percent means your homepage is not turning visitors into menu views, reservation clicks, or phone calls. Find it in Google Analytics under the Acquisition or Behavior reports. The benchmark for bar and restaurant websites is under 60 percent. Above 70 tells you the homepage lacks a clear next step, loads too slow, or does not show guests what they came to find.' },
        { q: 'What if I do not have all this data every week?',
          a: 'Enter what you have. Google rating and new reviews take under two minutes from your GBP dashboard. Sessions and bounce rate require analytics access and take a bit longer. Social follower counts are on your profile in seconds. Log whatever you can and leave the rest blank. The system tracks trends from what you enter, so even three data points per week builds a useful picture over time. Do not skip the week because the data is incomplete. Partial data entered consistently beats complete data entered once in a while.' },
      ]},
      { t: 'Google Business Profile', qa: [
        { q: 'Why does my Google Business Profile matter so much?',
          a: 'It is the first thing most guests see when they search for your bar. It controls whether you show up in the local Maps Pack, the three-listing block that appears above regular search results for queries like "bar near me" or "sports bar Austin." An unclaimed or incomplete listing puts you below competitors who did the basic work of filling out their profile. Every missing field, no menu link, incomplete hours, no photos, no attribute tags, is a signal telling Google your listing is lower quality than a fully optimized competitor.' },
        { q: 'How many photos should my GBP listing have?',
          a: 'The benchmark is 100 photos or more. Exterior shots, interior shots, food and drink photos, event photos, staff photos. Listings with more than 100 photos get significantly more views and direction requests than listings with under 20. You do not need professional photography. Consistent, well-lit phone photos uploaded weekly add up fast. The algorithm rewards recency as well as volume, so adding 5 to 10 new photos per month matters more than uploading 200 photos once and walking away.' },
        { q: 'How do I respond to negative reviews effectively?',
          a: 'Respond within 24 hours. Keep it under 100 words. Acknowledge the specific issue without arguing or making excuses. Offer to make it right and give a direct contact. Never respond in a way that escalates the situation or that a prospective guest reading the exchange would find off-putting. The goal is not to change the mind of the person who left the review. The goal is to show every other guest reading it that your operation handles problems professionally. A clean response to a 1-star review builds more trust than the negative review costs.' },
        { q: 'What is the Google Posts feature and should I use it?',
          a: 'Google Posts show up directly on your GBP listing in search results. They can feature events, specials, promotions, menu items, or announcements. The benchmark is 8 or more posts per month. Posts expire after 7 days unless they are event posts, so consistency is what drives results. Use them for weekly specials, upcoming events, new menu items, and holiday hours changes. Each post takes under 5 minutes and is one of the highest-return actions available in GBP because it appears in the search result before a guest ever clicks through to your website.' },
      ]},
      { t: 'Review Tracker', qa: [
        { q: 'Why is response rate a scored metric?',
          a: 'Google has confirmed that businesses responding to reviews are seen as more credible, and that response activity factors into local search ranking. The benchmark is 75 percent or higher. Below 50 percent means you are leaving a large number of public conversations unanswered, which signals to prospective guests that management is not paying attention. Responding to reviews puts you in control of the narrative. A string of unanswered 1-star reviews with no management reply looks worse than the same reviews with professional, straightforward responses.' },
        { q: 'How fast should I be growing my review count?',
          a: 'The target is 8 or more new reviews per month. Below 4 per month and your listing is aging relative to competitors generating reviews consistently. Freshness matters to Google. A listing with 150 reviews where the most recent is 4 months old ranks below a listing with 80 reviews where 12 came in the last 30 days. The most effective method is a direct verbal ask at the close of a good guest interaction, followed by a short follow-up if you have their contact. Review QR codes at tables and on receipts work well and require zero staff training.' },
        { q: 'How do I handle a pattern of similar negative reviews?',
          a: 'A recurring negative theme is not a review problem. It is an operational problem showing up in reviews. If multiple reviews over 90 days mention slow service, a specific menu item, parking, noise, or a particular staff interaction, that has to be fixed at the operational level before the reviews improve. Log the pattern, find the root cause, make the change, and monitor whether new reviews over the next 60 days reflect the improvement. Using reviews as operational feedback is one of the most useful things the Review Tracker does for you.' },
      ]},
      { t: 'Search and SEO', qa: [
        { q: 'What is NAP consistency and why does it matter?',
          a: 'NAP stands for Name, Address, Phone. Google cross-checks your business information across every online listing where you appear: your GBP, your website, Yelp, TripAdvisor, delivery platforms, local directories, and social profiles. When those listings do not match, it sends conflicting signals that hurt your local search ranking. A bar listed as "The Rusty Nail" on GBP but "Rusty Nail Bar and Grill" on Yelp with a slightly different address format confuses the algorithm. Audit your top 10 listing sources and get the NAP identical across all of them. It is a one-time cleanup with a lasting positive effect on ranking.' },
        { q: 'What is the Maps Pack and how do I get into it?',
          a: 'The Maps Pack is the block of three local business listings that appears in Google search above the organic links for local queries. It is the highest-value position in local search because it loads first and shows your rating, photos, hours, and a direct Maps link. The primary factors for Maps Pack placement are a fully claimed and complete GBP listing, consistent NAP across the web, review count and rating, recency of reviews, and relevance of your GBP category and attributes to the search query. You cannot pay your way in. You earn it through consistent optimization.' },
        { q: 'What is my primary local keyword and how do I find it?',
          a: 'Your primary keyword is the search phrase most likely to bring a new guest to your door. For most bars it follows the pattern: bar type plus city or neighborhood. Sports bar Austin. Rooftop bar downtown Nashville. Dive bar Brooklyn. To find what people actually search, open Google and type your bar type and city. The autocomplete suggestions show you real search behavior. Your business name, GBP listing, and website title tags should all reflect this primary keyword. Secondary keywords are variations: best happy hour in your city, live music bar in your city, neighborhood plus bar. Work those into your GBP description, posts, and website copy.' },
      ]},
      { t: 'Social Media', qa: [
        { q: 'How often should I post?',
          a: 'The benchmark is 12 or more posts per month across Instagram and Facebook combined, roughly 3 per week. Consistency matters more than volume. Posting every day for two weeks then going dark for a month hurts your reach more than posting 3 times a week all month. The simplest system: one food or drink photo on a weekday, one event or promo post before the weekend, one behind-the-scenes or staff post mid-week. Three posts, each under 5 minutes on your phone, builds a presence that compounds.' },
        { q: 'What content performs best for bars and restaurants?',
          a: 'Food and drink photography is the top-performing content for bars and restaurants on Instagram. Behind-the-scenes content, bartenders making cocktails, chefs plating, prep shots, consistently outperforms polished advertising. Events and specials posted 3 to 5 days out generate the most saves. Staff introductions and guest moments work well because they show real people running a real operation. The worst-performing content is generic promotional graphics that look like ads. Real photography of real food, drinks, and people beats designed promo posts every time.' },
        { q: 'Should I be on TikTok?',
          a: 'Depends on whether you can create video consistently. TikTok reaches a younger crowd and bar content performs well on the platform. Cocktail prep videos, kitchen content, and staff personality videos have organic reach that is hard to match on Instagram or Facebook without an existing following. But a dormant TikTok account with 3 posts does more damage than no account at all because it signals an incomplete, abandoned presence. If you cannot commit to at least 2 to 4 posts per week on TikTok, put your energy into Instagram and Facebook first. Get those running consistently, then add TikTok when you have the capacity.' },
      ]},
      { t: 'Delivery Platforms', qa: [
        { q: 'Why do delivery platform ratings matter?',
          a: 'Guests on DoorDash, UberEats, and Grubhub filter by rating before picking a restaurant. A rating below 4.0 on a delivery platform cuts you out of consideration for a large portion of users. Delivery ratings are also visible to guests who are not ordering delivery. They search your name and see your delivery listing right next to your Google and Yelp profiles. A strong Google rating paired with a weak delivery rating creates a credibility problem. Give your delivery listing the same attention you give your Google listing.' },
        { q: 'What makes a strong delivery platform listing?',
          a: 'Three things drive delivery platform performance: photo coverage, menu completeness, and promotions. Photo coverage means every menu item has a photo, not just the top sellers. Menu completeness means descriptions are filled in, prices are current, and unavailable items are removed. Promotions, even a simple free delivery offer for new customers, give you a significant visibility lift within the platform algorithm. Most operators have a listing that is technically active but with photos on fewer than half the items and no promotions running. Closing that gap takes one afternoon and produces an immediate improvement in order volume.' },
      ]},
      { t: 'Email and Loyalty', qa: [
        { q: 'Why does an email list matter when I already have social media?',
          a: 'Social followers are not yours. The platform decides who sees your posts, and organic reach keeps shrinking every year. An email list is an owned channel: when you send, it lands in the inbox. For a bar, email is the most reliable way to pull past guests back for a slow Tuesday, an event, or a new menu. A list of 1,000 engaged contacts you email monthly is worth more than 5,000 followers who might see one post in ten.' },
        { q: 'What email open rate should I expect?',
          a: 'The benchmark is 20 percent or higher. Bar and restaurant lists run a little above the all-industry average because guests who opted in genuinely like the place. Below 15 percent usually means one of three things: the list went stale from infrequent sending, the subject lines are weak, or the list was built from low-quality signups. Tighten the subject line, send around the time guests decide where to eat, and clear inactive contacts off the list.' },
        { q: 'How do I grow the list?',
          a: 'Growth matters more than raw size. Add contacts every month through an active mechanism: a signup form on the website, a capture point at the host stand or on receipts, WiFi login capture, or an opt-in at online-order checkout. A list that is not growing is shrinking, because contacts naturally go cold. The Email and Loyalty screen flags it when no growth mechanism is set.' },
        { q: 'How often should I email?',
          a: 'At least monthly, and twice a month is better for a bar with events and specials. Less than monthly and the list goes cold — opens drop and spam complaints rise because guests forget they signed up. A predictable cadence trains guests to expect and open your email. Pick a frequency you can sustain and hold it.' },
        { q: 'Is a loyalty program worth running?',
          a: 'For a bar, a simple one is. Loyalty turns a one-time delivery order or a walk-in into a regular. It does not need an app or a points engine — a basic visit-based reward tracked at the POS works fine. The real value is the contact capture and the built-in reason to come back. The Email and Loyalty screen tracks whether a program is active and the member count so you can watch it grow.' },
      ]},
      { t: 'Traffic Audit', qa: [
        { q: 'How does the Traffic Audit work?',
          a: 'Click Generate This Month\'s Audit, upload your screenshots and data files, and the system reads every document you submit alongside the weekly data you have entered in the app. It scores seven sections: Google Business Profile, website, reviews, search and SEO, social media, delivery platforms, and email and loyalty. Each section gets a score based on what the submitted data shows. The overall score is a weighted composite. The report identifies your lowest-scoring section, the specific variables pulling the score down, and the highest-impact actions to take before your next audit. The PDF is ready to download within two minutes.' },
        { q: 'What should I upload for the best audit?',
          a: 'The highest-value upload is a GBP dashboard screenshot showing your review count, rating, and recent activity. That alone unlocks the full Google Business Profile section. A website analytics screenshot showing monthly sessions and traffic sources unlocks the website section. Instagram and Facebook profile screenshots showing follower counts and recent posts unlock the social section. A DoorDash or UberEats listing screenshot unlocks the delivery section. Submit whatever you have. A single GBP screenshot produces a real scored report with real action items. Every additional file unlocks more sections and raises the confidence of the score.' },
        { q: 'How often should I request an audit?',
          a: 'One audit per month is included with your Traffic Recovery subscription. Monthly is the right frequency. It gives you enough time to act on the prior audit before you score yourself again. Request it at the same point each month so the data periods are consistent and the score trend is meaningful. Your first audit is your baseline. Your second audit, after 30 days of entering weekly data and working through the Getting Started checklist, shows the gap your work has already closed. That score movement is the most useful number in the system.' },
      ]},
      { t: 'Settings', qa: [
        { q: 'What Google rating target should I set?',
          a: 'The industry benchmark is 4.3 or higher. Below 4.0 is where search filtering starts cutting you out. Many guests and platforms exclude results below 4.0 by default. If you are below 4.0, set your target at 4.0 first. Hit that, then move to 4.3. Above 4.3 the improvement per decimal point matters less, but keeping the rating strong through consistent responses and fresh reviews stays important.' },
        { q: 'What review velocity target should I set?',
          a: 'Start at 8 new reviews per month. That is roughly 2 per week, which is reachable for most operations through a consistent verbal ask and a QR code at tables or on receipts. Below 4 per month your listing is aging noticeably in any competitive market. Above 15 per month puts you at the top of local search presence for a bar. Hit 8 consistently for 60 days, then reassess. In high-volume markets with strong competition, 15 to 20 per month becomes the target once you have the request process running.' },
        { q: 'What monthly sessions target should I set?',
          a: 'The benchmark for a typical bar or restaurant website is 2,000 sessions per month. Below 500 means your site is not ranking in local search and is not being found through any digital channel. Between 500 and 1,500 is common for operations with a website but no active SEO or GBP work. Above 2,000 means your digital presence is driving real discovery traffic. Set 2,000 as your starting target and watch how sessions move as you complete the GBP optimization, clean up NAP consistency, and increase social posting frequency. Sessions respond directly to GBP work. Most bars see a measurable increase within 30 to 60 days of fully completing their listing.' },
      ]},
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
      ['Avg Session Duration', '90 seconds or more',  'Shows visitors are finding what they came for.'],
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
