'use strict';

/* ── Fix Layer content — Traffic Recovery ─────────────────────────────────────
   Static fix content for the Traffic gap-areas (Section 9). Rendered by the
   Traffic Fix screen. Operator-to-operator, directive voice; see fix-profit.js
   for the object shape. */

window.FIX = window.FIX || {};

FIX.traffic = [

  {
    id: 'gbp',
    name: 'Google Business Profile',
    module: 'traffic',
    summary: 'Your Google Business Profile decides whether you show up in the local map results.',

    process: {
      steps: [
        { kind: 'result', target: 't-gbp', targetLabel: 'Google Business Profile',
          title: 'Audit where your profile stands',
          detail: 'Open the Google Business Profile screen and read your completeness score, photo count, posts, and weekly insights. Start here before you change anything.' },
        { kind: 'reference', target: 'GBP_Checklist.pdf', targetLabel: 'GBP Optimization Checklist',
          title: 'Complete every field',
          detail: 'Work the GBP Optimization Checklist on Google: every field filled, primary and secondary categories set, the full 750-character description, ten seeded Q&A. Use your exact business name, never keyword-stuffed, that risks a suspension.' },
        { kind: 'reference', target: 'GBP_Yelp_Description_Template.docx', targetLabel: 'GBP and Yelp Description Template',
          title: 'Write the 750-character description well',
          detail: 'Download the GBP and Yelp Description Template and use it for both Google and Yelp. Lead with what makes the bar specific, name your neighborhood, name your category the way guests search for it, and do not keyword-stuff.' },
        { kind: 'reference', target: 'Photo_Brief_25_Shots.pdf', targetLabel: 'GBP Photo Brief',
          title: 'Load a real, current photo set',
          detail: 'Use the GBP Photo Brief as your shot list: at least 25 real photos across the categories Google surfaces, reshot every six months. Skip stock, and replace anything over 12 months old.' },
        { kind: 'action', target: 't-this-week', targetLabel: 'This Week',
          title: 'Log the weekly numbers and keep posting',
          detail: 'Every Monday in This Week, log profile views, call clicks, and direction requests. Post at least twice a month using the Event, Offer, and Update formats. Never let 90 days pass with no post.' },
        { kind: 'result', target: 't-dashboard', targetLabel: 'Traffic Dashboard',
          title: 'Watch the trend and re-audit quarterly',
          detail: 'Read your GBP numbers on the Traffic dashboard weekly. Every quarter, re-audit completeness, update seasonal hours and attributes, and add fresh photos.' }
      ]
    },

    commonMistakes: [
      'Setting the hours once and never updating them. Change holiday and seasonal hours before they happen, not after a guest finds a closed door and leaves a review.',
      'Stuffing keywords into the business name. Adding something like "best cocktail bar downtown" violates Google policy and risks a suspension. Use your exact name.',
      'Ignoring the Q&A section. Anyone can answer a public question, including a competitor. Check it weekly and answer within 24 hours.',
      'Never posting. Two posts a month is the floor; 90 days dark and Google treats you as inactive.',
      'Using stock photos or the same shots for years. Reshoot real photos every six months.',
      'Not tracking the weekly insight numbers. Profile views, call clicks, and direction requests are how you know the work is landing.'
    ]
  },

  {
    id: 'website',
    name: 'Website',
    module: 'traffic',
    summary: 'Most guests hit your site on a phone, ready to act. Convert them or lose them.',

    process: {
      steps: [
        { kind: 'reference', target: 'Website_Conversion_Audit.pdf', targetLabel: 'Restaurant Website Audit Form',
          title: 'Audit the site before you change anything',
          detail: 'Work the Restaurant Website Audit Form page by page: homepage and menu page speed, mobile elements, menu structure, calls to action. Run the eight-second test on your own phone, you should find the phone number, hours, and reservation link without scrolling. Do it before you change a thing.' },
        { kind: 'result', target: 't-website', targetLabel: 'Website Scorecard',
          title: 'Score it and hold the baseline',
          detail: 'Enter the audit results into the Website Scorecard for a conversion score and a baseline. Set it before you touch anything.' },
        { kind: 'reference', target: 'Website_Copy_CTA_Standards.docx', targetLabel: 'Website Conversion Fix Checklist',
          title: 'Fix conversion in priority order',
          detail: 'Work the Website Conversion Fix Checklist in impact order: compress every homepage and menu image under 200KB, get four elements above the fold on mobile, replace any PDF menu with a real web page, and install Google Analytics 4. Speed first, 20 minutes and free.' },
        { kind: 'action', target: 't-this-week', targetLabel: 'This Week',
          title: 'Log the weekly numbers',
          detail: 'Every Monday in This Week, log mobile load time, mobile bounce rate, and click-to-call and reservation clicks. Flag any metric that moved more than five points off the baseline.' },
        { kind: 'result', target: 't-dashboard', targetLabel: 'Traffic Dashboard',
          title: 'Watch the trend',
          detail: 'Read your website metrics on the Traffic dashboard weekly so a fix that helped, or did not, shows up.' }
      ]
    },

    commonMistakes: [
      'Using a PDF menu instead of a web page. Google cannot index it and nobody reads it on a phone without zooming.',
      'No clickable phone number above the fold on mobile. A number that takes scrolling to find loses the guest who needs to call.',
      'A hero image that fills the whole mobile screen with no information under it.',
      'The order or reserve button only in the navigation or footer. Put it above the fold on mobile, not buried.',
      'A menu last updated over 12 months ago. Guests arrive expecting items that are gone, then review you for it.',
      'No analytics installed. Without bounce rate, session duration, and click paths you are guessing whether a fix worked.'
    ]
  },

  {
    id: 'reviews',
    name: 'Reviews',
    module: 'traffic',
    summary: 'Recent reviews rank you and reassure the guest deciding tonight. Volume comes from asking every happy table; a recurring complaint is a floor problem to fix, not a reputation to spin.',

    process: {
      steps: [
        { kind: 'result', target: 't-reviews', targetLabel: 'Review Tracker',
          title: 'Track velocity, not just the rating',
          detail: 'In the Review Tracker, watch new Google and Yelp reviews, the rolling 30-day rating, and response rate. Velocity ranks you; a high rating with no recent reviews looks stale next to a competitor with a steady flow.' },
        { kind: 'reference', target: 'Review_Response_Templates.pdf', targetLabel: 'Review Response Templates',
          title: 'Respond to every review within 48 hours',
          detail: 'Download the Review Response Templates. Negatives get the four-sentence pattern: acknowledge, address the specific complaint, state your standard, invite them back, with your direct contact at the end so the next step happens off the public page. Reply to positives by name and specific too, never a generic thank-you.' },
        { kind: 'reference', target: 'Review_Response_Standards_Scripts.docx', targetLabel: 'Review Response Standards and Scripts',
          title: 'Set the written response standard for every manager',
          detail: 'Download the Review Response Standards and Scripts. Train every manager on the same tone, timing, and sign-off so your replies read as one voice. The templates handle wording; this sets the policy: who responds, by when, what to escalate, what never to say in public.' },
        { kind: 'reference', target: 'Negative_Review_Recovery_Protocol.docx', targetLabel: 'Negative Review Recovery Protocol',
          title: 'Recover the guest, not just the rating',
          detail: 'Download the Negative Review Recovery Protocol. For a fixable complaint, work the playbook: respond publicly, reach out privately, document what went wrong operationally, invite them back with a specific gesture. A guest who comes back after a one-star stays loyal for years.' },
        { kind: 'reference', target: 'Review_Request_Script_Card.pdf', targetLabel: 'Review Request Script',
          title: 'Build the review ask into service',
          detail: 'Use the Review Request Script: a short compliment-moment ask for every server and a QR code on the bill presenter, framed as how the bar runs, not a campaign. Never offer an incentive and never ask only happy guests, both violate Google policy and risk a suspension.' },
        { kind: 'action', target: 't-this-week', targetLabel: 'This Week',
          title: 'Log the weekly numbers',
          detail: 'Every Monday in This Week, log new Google and Yelp reviews and your response rate. Flag any week below your monthly target divided by four, and find the shift with the weakest review ask.' },
        { kind: 'result', target: 't-dashboard', targetLabel: 'Traffic Dashboard',
          title: 'Watch the trend',
          detail: 'Read reviews on the Traffic dashboard weekly so a stall in velocity shows up before it costs you ranking.' }
      ]
    },

    commonMistakes: [
      'Answering the negatives but ignoring the positives. It makes you look like you only show up when there is a problem.',
      'Copy-paste replies that name nothing specific from the review.',
      'Asking for reviews in a way that breaks Google policy. Offering incentives or asking only happy guests both risk a profile suspension.',
      'Not training staff on the ask. A process on paper that no server runs produces no reviews.',
      'Letting velocity stall after the first push. The opening surge fades unless the ask is a permanent part of service.',
      'Treating a 4.1 as fine. Next to a competitor at 4.4, you lose the comparison for every guest who sees both.'
    ]
  },

  {
    id: 'search-seo',
    name: 'Search and SEO',
    module: 'traffic',
    summary: 'Local search ranking comes from a clean, consistent listing across the web.',

    process: {
      steps: [
        { kind: 'reference', target: 'Local_SEO_Audit.pdf', targetLabel: 'NAP Consistency Audit',
          title: 'Fix NAP consistency first',
          detail: 'Work the NAP Consistency Audit across Google, Yelp, TripAdvisor, and the top local directories. Your name, address, and phone have to match exactly everywhere. One wrong character splits your citation authority, so fix every variant before you build anything new.' },
        { kind: 'reference', target: 'Keyword_Research_Worksheet.docx', targetLabel: 'Keyword Research Worksheet',
          title: 'Build your target keyword list',
          detail: 'Use the Keyword Research Worksheet to land 10 target terms across neighborhood, occasion, concept, and proximity. Aim at terms like "bar Wicker Park" that drive walk-ins, not broad city terms like "best bar Chicago" that bring almost no real traffic for an independent bar.' },
        { kind: 'reference', target: 'Platform_Claiming_Checklist.docx', targetLabel: 'Local SEO Quick-Start Guide',
          title: 'Merge duplicates, then build citations',
          detail: 'Follow the Local SEO Quick-Start Guide. Merge duplicate Google and Yelp listings first, two listings split your reviews and authority in half. Then build citations in order: Yelp, Facebook, Apple Maps, Foursquare, TripAdvisor. Do not skip Foursquare, its data feeds dozens of downstream directories.' },
        { kind: 'result', target: 't-search', targetLabel: 'Search and SEO',
          title: 'Track keyword rank and citations',
          detail: 'In the Search and SEO screen, record your target keyword positions and citation count, and set a baseline before you change anything.' },
        { kind: 'result', target: 't-dashboard', targetLabel: 'Traffic Dashboard',
          title: 'Watch the trend',
          detail: 'Read your search numbers on the Traffic dashboard weekly, and run the full local SEO audit once a quarter.' }
      ]
    },

    commonMistakes: [
      'Chasing broad city terms instead of neighborhood and occasion terms. "Best bar Chicago" brings almost no new traffic; "Bar Wicker Park" brings walk-ins.',
      'Inconsistent name, address, and phone across platforms. A name that appears three ways splits citation authority three ways.',
      'Not claiming listings on secondary directories. An unclaimed Foursquare listing seeds variants on every directory it feeds.',
      'Ignoring duplicate listings. Two Google listings split your review count and authority. Merge them before building more reviews.',
      'Never checking keyword position. Track it weekly or you are working blind.',
      'Treating organic SEO and local-pack SEO as the same job. Local pack needs profile completeness and citations; organic needs website content.'
    ]
  },

  {
    id: 'social',
    name: 'Social Media',
    module: 'traffic',
    summary: 'Social drives walk-ins when it shows what the bar feels like and runs on a calendar.',

    process: {
      steps: [
        { kind: 'reference', target: 'Social_Media_Profile_Audit.pdf', targetLabel: 'Social Media Profile Audit Form',
          title: 'Audit the profile',
          detail: 'Work the Social Media Profile Audit Form across bio, profile photo, link-in-bio, content mix, and posting frequency. Fix the bio, photo, and link-in-bio before you post anything new.' },
        { kind: 'result', target: 't-social', targetLabel: 'Social Media',
          title: 'Set the baseline',
          detail: 'In the Social Media screen, record follower count, profile visits, link clicks, and posts per month as your baseline before you change anything.' },
        { kind: 'reference', target: 'Social_Content_Brief.pdf', targetLabel: 'Social Content Calendar',
          title: 'Run on a content calendar',
          detail: 'Plan the month on the Social Content Calendar. Post five times a week on the 3-1-1 mix: three experience, one promo, one community. Lead with experience content, a 60-second walkthrough of a busy night beats a polished promo.' },
        { kind: 'reference', target: 'Social_Media_Content_Standards.docx', targetLabel: 'Social Media Standards Policy',
          title: 'Set the posting standard and the Sunday review',
          detail: 'The Social Media Standards Policy covers posting frequency, image quality, caption tone, and the approval workflow for staff posts. Protect the Sunday review: go through the week\'s captured content, pick five posts, schedule them, and flag one to cross-post to the Google profile.' },
        { kind: 'action', target: 't-this-week', targetLabel: 'This Week',
          title: 'Log the weekly numbers',
          detail: 'Every Monday in This Week, log profile visits and link clicks, not likes. Visits and clicks measure new guests; followers and likes measure the audience you already have.' },
        { kind: 'result', target: 't-dashboard', targetLabel: 'Traffic Dashboard',
          title: 'Watch the trend',
          detail: 'Read your social numbers on the Traffic dashboard weekly. Posting compounds, 90 days of consistency gets far better distribution than the first 30.' }
      ]
    },

    commonMistakes: [
      'Posting promotional graphics as your dominant content. Promo gets saves from existing followers and almost no new reach; experience content drives new-guest decisions.',
      'Abandoning a platform after 30 days. Posting compounds, 90 days of consistency gets far better distribution than the first 30.',
      'Pushing the same post to every platform without adjusting the format.',
      'Never showing the inside of the bar in video. Food shots show what to order; video shows what it feels like to be there.',
      'Tracking followers and likes instead of profile visits and link clicks. The first measures your existing audience, the second measures new-guest consideration.',
      'No content calendar, so posting is reactive and irregular. Every algorithm penalizes irregular posting; consistency beats polish for distribution.'
    ]
  },

  {
    id: 'delivery',
    name: 'Delivery Platforms',
    module: 'traffic',
    summary: 'A delivery listing is a storefront most operators never check, and pricing it the same as dine-in hands the 20 to 30 percent commission straight out of your margin.',

    process: {
      steps: [
        { kind: 'reference', target: 'Delivery_Platform_Audit.pdf', targetLabel: 'Delivery Platform Audit Checklist',
          title: 'Audit every active listing first',
          detail: 'Work the Delivery Platform Audit Checklist across DoorDash, Uber Eats, and Grubhub: photos, hours, menu items, descriptions, and reviews. Replace any photo of a discontinued item and match platform hours to kitchen hours exactly. A one-time project of three to four hours.' },
        { kind: 'result', target: 't-delivery', targetLabel: 'Delivery Platforms',
          title: 'Score and baseline the listings',
          detail: 'In the Delivery Platforms screen, record each platform\'s active status, rating, and photo count as your baseline.' },
        { kind: 'reference', target: 'Delivery_Platform_Comparison.docx', targetLabel: 'Delivery Platform Comparison',
          title: 'Decide which platforms are worth the commission',
          detail: 'Download the Delivery Platform Comparison. Not every platform earns its commission cut. Compare commission rates, average ticket, reach, and effort per platform, then decide to add, drop, or refocus before you sink more work into menus and photos.' },
        { kind: 'reference', target: 'Online_Menu_Audit.pdf', targetLabel: 'Delivery Menu Builder Worksheet',
          title: 'Curate the delivery menu',
          detail: 'Use the Delivery Menu Builder Worksheet. The delivery menu is a tight subset of your in-house menu, not the whole thing. Recalculate every item\'s margin at the platform commission rate, rate how well each one travels, and pull anything whose margin drops below 15%.' },
        { kind: 'action', target: 't-this-week', targetLabel: 'This Week',
          title: 'Log the weekly numbers',
          detail: 'Every Monday in This Week, log each platform\'s rating and order volume. Answer every new platform review with the same standard you use for Google, never blaming the platform or driver. Check the dashboards for any item the platform auto-flagged or removed.' },
        { kind: 'result', target: 't-dashboard', targetLabel: 'Traffic Dashboard',
          title: 'Watch the trend',
          detail: 'Read your delivery numbers on the Traffic dashboard weekly. Ten minutes catches a rating slide before it stacks up.' }
      ]
    },

    commonMistakes: [
      'Using photos from a previous menu or owner. A listing showing discontinued items buys you the bad experience and the one-star review.',
      'Not updating platform hours when kitchen hours change. Wrong hours bring wrong-time orders that arrive cold or get cancelled.',
      'Listing every in-house item on delivery. Items that travel poorly or lose margin at commission do not belong on a tight delivery menu.',
      'Ignoring delivery platform reviews. They move platform ranking the way Google reviews move your profile. Same response standard applies.',
      'Never logging into the platform dashboards. Ratings and order volume move weekly; check monthly and you miss problems that stacked for weeks.',
      'Adding a third platform before optimizing the first two. A poor listing on two is not fixed by adding a third.'
    ]
  },

  {
    id: 'email-loyalty',
    name: 'Email Marketing',
    module: 'traffic',
    summary: 'Email is the one channel where you own the audience.',

    process: {
      steps: [
        { kind: 'reference', target: 'Guest_Email_Capture.pdf', targetLabel: 'Email List Building Playbook',
          title: 'Build the list at every contact point',
          detail: 'Work the Email List Building Playbook. Capture addresses at the POS, on table cards, through WiFi sign-in, at events, and through a QR code. Activate the contact points two at a time so each one gets set up properly.' },
        { kind: 'reference', target: 'Email_Campaign_Templates.docx', targetLabel: 'Email Campaign Templates',
          title: 'Set up the three campaigns in owner voice',
          detail: 'Use the Email Campaign Templates for the three every bar needs: a welcome sequence, a monthly update, and an event announcement. Set up the welcome sequence before you collect a single address, it is the highest-opened email you will send. Write first person, one specific detail, signed with a name. "I wanted to tell you," not "We are thrilled to announce."' },
        { kind: 'result', target: 't-email', targetLabel: 'Email Marketing',
          title: 'Track the list, the sends, and opens',
          detail: 'The Email Marketing screen tracks list size, emails sent, and open rate. Read it to see whether the list is growing and the sends are landing.' },
        { kind: 'action', target: 't-this-week', targetLabel: 'This Week',
          title: 'Log the monthly send',
          detail: 'Send on a consistent monthly rhythm, one a month is the floor and more than two is where unsubscribes climb. In This Week, log open rate, click rate, and any covers a guest tied to the email. Track visit conversion, not just opens.' },
        { kind: 'result', target: 't-dashboard', targetLabel: 'Traffic Dashboard',
          title: 'Watch the trend and run quarterly hygiene',
          detail: 'Read email on the Traffic dashboard weekly. Every 90 days, re-engage subscribers who have not opened in 90 days and drop the ones who never respond. A clean list of 400 beats a stale 2,000.' }
      ]
    },

    commonMistakes: [
      'Collecting addresses but never sending. A list that hears nothing within 30 days of signup is already going cold.',
      'Sending too infrequently, then too often. One a month is the floor, more than two and unsubscribes climb. Find the rhythm and hold it.',
      'Writing in marketing voice instead of owner voice. "I wanted to tell you," not "We are thrilled to announce."',
      'No welcome sequence, so new subscribers never hear from you after signing up. The welcome email is the highest-opened one you send.',
      'Sending the same message to the whole list. Regulars and new guests convert from different messages.',
      'Not tracking visit conversion. Opens are who read it; visits are who came in.'
    ]
  }

];
