'use strict';

/* ── Fix Layer content — Traffic Recovery ─────────────────────────────────────
   Static fix content for the Traffic gap-areas (Section 9). Rendered by
   FixPanel inside Traffic Recovery's Help & FAQ. Populated gap-area by
   gap-area; see fix-profit.js for the object shape. */

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
          detail: 'Open the Google Business Profile screen. It scores your profile completeness and tracks photo count, posts per month, and the weekly insight numbers. Start here, so you know which fields are costing you ranking before you change anything.' },
        { kind: 'reference', target: 'GBP_Checklist.pdf', targetLabel: 'GBP Optimization Checklist',
          title: 'Complete every field',
          detail: 'Work the GBP Optimization Checklist on Google itself. Every field filled, the right primary and secondary categories, the full 750-character description, and ten seeded Q&A entries. Use your exact business name and do not stuff keywords into it, that risks a suspension.' },
        { kind: 'reference', target: 'GBP_Yelp_Description_Template.docx', targetLabel: 'GBP and Yelp Description Template',
          title: 'Write the 750-character description well',
          detail: 'Download the GBP and Yelp Description Template and use it for the long-form descriptions on both Google and Yelp. Lead with what makes the bar specific, name your neighborhood, name your category exactly the way guests search for it, and avoid keyword-stuffing. A description that reads like a person wrote it converts better than one that reads like SEO.' },
        { kind: 'reference', target: 'Photo_Brief_25_Shots.pdf', targetLabel: 'GBP Photo Brief',
          title: 'Load a real, current photo set',
          detail: 'Use the GBP Photo Brief as your shot list. At least 25 real photos across the categories Google surfaces, reshot every six months. Stock photos do not convert, and photos over 12 months old pull down click-through.' },
        { kind: 'action', target: 't-this-week', targetLabel: 'This Week',
          title: 'Log the weekly numbers and keep posting',
          detail: 'Every Monday, in This Week, log profile views, call clicks, and direction requests. Post to the profile at least twice a month using the Event, Offer, and Update formats. A profile with no posts in 90 days reads as an inactive business to Google and to guests.' },
        { kind: 'result', target: 't-dashboard', targetLabel: 'Traffic Dashboard',
          title: 'Watch the trend and re-audit quarterly',
          detail: 'The Traffic dashboard rolls your GBP numbers into the digital presence score and the 90-day trend. Read it weekly. Every quarter, re-audit completeness, update seasonal hours and attributes, and add fresh photos.' }
      ]
    },

    commonMistakes: [
      'Setting the hours once and never updating them. Holiday and seasonal hours get changed before they happen, not after a guest finds a closed door and leaves a review.',
      'Stuffing keywords into the business name. Adding something like "best cocktail bar downtown" to the listing name violates Google policy and risks suspension. Use your exact name.',
      'Ignoring the Q&A section. Anyone can answer a public question, including a competitor. Check it weekly and answer every question within 24 hours.',
      'Never posting. A profile with no posts in 90 days signals an inactive business. Two posts a month is the minimum to hold the prominence benefit.',
      'Using stock photos or the same photos for years. Photos older than 12 months reduce click-through. Reshoot real photos every six months.',
      'Not tracking the weekly insight numbers. Profile views, call clicks, and direction requests tell you whether the work is paying off. Without them you are guessing.'
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
          detail: 'Work the Restaurant Website Audit Form page by page: page speed on the homepage and menu page, mobile elements, menu structure, and calls to action. Do the eight-second test on your own phone, you should find the phone number, the hours, and the reservation link without scrolling. An audit done after fixes cannot measure what changed.' },
        { kind: 'result', target: 't-website', targetLabel: 'Website Scorecard',
          title: 'Score it and hold the baseline',
          detail: 'Enter the audit results into the Website Scorecard. It turns them into a conversion score and a baseline. Every fix from here is measured against that baseline, so set it before you change a thing.' },
        { kind: 'reference', target: 'Website_Copy_CTA_Standards.docx', targetLabel: 'Website Conversion Fix Checklist',
          title: 'Fix conversion in priority order',
          detail: 'Work the Website Conversion Fix Checklist, which lists each fix by impact and effort. Compress every homepage and menu image under 200KB, get four elements above the fold on mobile, replace any PDF menu with a web page, and install Google Analytics 4. Speed first, it is 20 minutes and costs nothing.' },
        { kind: 'action', target: 't-this-week', targetLabel: 'This Week',
          title: 'Log the weekly numbers',
          detail: 'Every Monday, in This Week, log mobile load time, mobile bounce rate, and click-to-call and reservation clicks. Flag any metric that moved more than five points off the baseline.' },
        { kind: 'result', target: 't-dashboard', targetLabel: 'Traffic Dashboard',
          title: 'Watch the trend',
          detail: 'The Traffic dashboard rolls your website metrics into the digital presence score and the 90-day trend. Read it weekly so a fix that helped, or one that did not, shows up where you can see it.' }
      ]
    },

    commonMistakes: [
      'Using a PDF menu instead of a web page. PDF menus cannot be indexed by Google, cannot be read on a phone without zooming, and produce no search value.',
      'No clickable phone number above the fold on mobile. A number that takes scrolling to find loses the guest who needs to call.',
      'A hero image that fills the whole mobile screen. A beautiful full-screen photo with no visible information is a conversion failure.',
      'The action button only in the navigation or footer. The reserve or order button has to be above the fold on mobile, not buried.',
      'A menu last updated over 12 months ago. An outdated online menu produces bad reviews when guests arrive expecting items that are gone.',
      'No analytics installed. Without bounce rate, session duration, and click paths you cannot know whether your fixes worked.'
    ]
  },

  {
    id: 'reviews',
    name: 'Reviews',
    module: 'traffic',
    summary: 'Recent reviews rank you and reassure the guest who is deciding tonight. Volume comes from asking every happy table, and a recurring complaint theme is an operational signal to fix on the floor, not a reputation problem to manage.',

    process: {
      steps: [
        { kind: 'result', target: 't-reviews', targetLabel: 'Review Tracker',
          title: 'Track velocity, not just the rating',
          detail: 'The Review Tracker counts new Google and Yelp reviews, the rolling 30-day rating, and your response rate. Velocity is what ranks you in the map results. A high rating with no recent reviews looks stale next to a competitor getting a steady flow.' },
        { kind: 'reference', target: 'Review_Response_Templates.pdf', targetLabel: 'Review Response Templates',
          title: 'Respond to every review within 48 hours',
          detail: 'Download the Review Response Templates. Negative reviews get the four-sentence pattern: acknowledge, address the specific complaint, state your standard, invite them back, with your direct contact at the end so the next step happens off the public page. Positive reviews get a named, specific reply too. A generic thank-you signals you did not read it.' },
        { kind: 'reference', target: 'Review_Response_Standards_Scripts.docx', targetLabel: 'Review Response Standards and Scripts',
          title: 'Set the written response standard for every manager',
          detail: 'Download the Review Response Standards and Scripts. Train every manager on the same tone, timing, and sign-off language so a guest reading your replies sees one consistent voice across the profile. The templates handle the wording. This document handles the policy: who responds, by when, what to escalate, and what never to say in public.' },
        { kind: 'reference', target: 'Negative_Review_Recovery_Protocol.docx', targetLabel: 'Negative Review Recovery Protocol',
          title: 'Recover the guest, not just the rating',
          detail: 'Download the Negative Review Recovery Protocol. A negative review with a complaint that can be fixed is a guest worth winning back. The protocol walks the playbook: respond publicly, reach out privately, document what happened operationally, invite the guest back with a specific gesture. A guest who returns after a one-star issue stays loyal for years.' },
        { kind: 'reference', target: 'Review_Request_Script_Card.pdf', targetLabel: 'Review Request Script',
          title: 'Build the review ask into service',
          detail: 'Use the Review Request Script: a short compliment-moment ask for every server, a QR code on the bill presenter, framed as how the bar operates rather than a campaign. Never offer an incentive and never ask only happy guests. Both violate Google policy and risk a suspension.' },
        { kind: 'action', target: 't-this-week', targetLabel: 'This Week',
          title: 'Log the weekly numbers',
          detail: 'Every Monday, in This Week, log new Google and Yelp reviews and your response rate. Flag any week that comes in below your monthly target divided by four, and find the shift with the weakest review ask.' },
        { kind: 'result', target: 't-dashboard', targetLabel: 'Traffic Dashboard',
          title: 'Watch the trend',
          detail: 'The Traffic dashboard rolls reviews into the digital presence score and the 90-day trend. Read it weekly so a stall in velocity shows up before it costs you ranking.' }
      ]
    },

    commonMistakes: [
      'Responding to negative reviews but ignoring positive ones. An unanswered positive review tells future guests the owner only shows up when there is a problem.',
      'Copy-paste responses that reference nothing specific. A generic reply to a specific compliment or complaint signals the owner did not read it.',
      'Asking for reviews in a way that violates Google policy. Offering incentives or asking only happy guests both risk a profile suspension.',
      'Not training staff on the ask. A review process that exists on paper but that no server has been shown how to run produces no reviews.',
      'Letting velocity stall after the first push. The opening surge fades unless the ask becomes a permanent part of service.',
      'Treating a 4.1 rating as fine. A 4.1 next to a competitor at 4.4 loses the comparison for every guest who sees both.'
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
          detail: 'Use the Keyword Research Worksheet to land 10 target terms across neighborhood, occasion, concept, and proximity. Aim at terms like "bar Wicker Park" that drive walk-ins. Broad city terms like "best bar Chicago" drive almost no real traffic for an independent bar.' },
        { kind: 'reference', target: 'Platform_Claiming_Checklist.docx', targetLabel: 'Local SEO Quick-Start Guide',
          title: 'Merge duplicates, then build citations',
          detail: 'Follow the Local SEO Quick-Start Guide. Merge duplicate Google and Yelp listings first, because two listings split your reviews and authority in half. Then build citations in priority order: Yelp, Facebook, Apple Maps, Foursquare, TripAdvisor. Do not skip Foursquare, its data feeds dozens of downstream directories.' },
        { kind: 'result', target: 't-search', targetLabel: 'Search and SEO',
          title: 'Track keyword rank and citations',
          detail: 'Record your target keyword positions and citation count in the Search and SEO screen, and set a baseline before you change anything. Without rank tracking you cannot know whether the profile and citation work is moving you up.' },
        { kind: 'result', target: 't-dashboard', targetLabel: 'Traffic Dashboard',
          title: 'Watch the trend',
          detail: 'The Traffic dashboard rolls your search numbers into the digital presence score and the 90-day trend. Read it weekly and run the full local SEO audit once a quarter.' }
      ]
    },

    commonMistakes: [
      'Optimizing for broad city-level terms instead of neighborhood and occasion terms. "Best bar Chicago" drives almost no new traffic. "Bar Wicker Park" drives walk-ins.',
      'Inconsistent name, address, and phone across platforms. A business name that appears three different ways splits citation authority three ways.',
      'Not claiming listings on secondary directories. An unclaimed Foursquare listing produces variants on every downstream directory it feeds.',
      'Ignoring duplicate listings. A bar with two Google listings splits its review count and its authority. Merge them before building more reviews.',
      'Never checking keyword ranking position. Without weekly rank tracking you cannot know whether the work is moving you up.',
      'Treating organic SEO and local-pack SEO as the same thing. Local pack needs profile completeness and citations. Organic needs website content.'
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
          detail: 'Record your current follower count, profile visits, link clicks, and posts per month in the Social Media screen. Set the baseline before you change anything, so you can tell later whether the work moved the numbers.' },
        { kind: 'reference', target: 'Social_Content_Brief.pdf', targetLabel: 'Social Content Calendar',
          title: 'Run on a content calendar',
          detail: 'Plan the month on the Social Content Calendar. Post five times a week on the 3-1-1 mix: three experience posts, one promotional, one community. Make experience content the dominant type. A 60-second walkthrough of a busy night outperforms a polished promo, because the feel of the room is what drives a new guest\'s decision.' },
        { kind: 'reference', target: 'Social_Media_Content_Standards.docx', targetLabel: 'Social Media Standards Policy',
          title: 'Set the posting standard and the Sunday review',
          detail: 'The Social Media Standards Policy covers posting frequency, image quality, caption tone, and the approval workflow for staff posts. Protect the Sunday review: go through the week\'s captured content, pick five posts, schedule them, and flag one to cross-post to the Google profile.' },
        { kind: 'action', target: 't-this-week', targetLabel: 'This Week',
          title: 'Log the weekly numbers',
          detail: 'Every Monday, in This Week, log profile visits and link clicks. Track visits and clicks, not likes. Profile visits and link-in-bio clicks measure new-guest consideration. Follower count and likes only measure the audience you already have.' },
        { kind: 'result', target: 't-dashboard', targetLabel: 'Traffic Dashboard',
          title: 'Watch the trend',
          detail: 'The Traffic dashboard rolls your social numbers into the digital presence score and the 90-day trend. Read it weekly. Social content stacks up over months, so 90 days of consistent posting gets fundamentally different distribution than the first 30.' }
      ]
    },

    commonMistakes: [
      'Posting promotional graphics as the dominant content type. Promo content gets saves from existing followers and almost no new reach. Experience content drives new-guest decisions.',
      'Abandoning a platform after 30 days. Social content stacks up over months. Ninety days of consistent posting gets fundamentally different distribution than the first 30.',
      'Using the same post on every platform without format adjustment. A square photo pushed to three platforms at once ignores the format and audience differences.',
      'Never showing the inside of the bar in video. Food and cocktail photos show what guests can order, not what it feels like to be there. The feel is the decision driver.',
      'Tracking follower count and likes instead of profile visits and link clicks. The first pair measures your existing audience, the second measures new-guest consideration.',
      'No content calendar, so posting is reactive and irregular. Irregular posting is penalized by every algorithm. Consistency matters more than polish for distribution.'
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
          detail: 'Work the Delivery Platform Audit Checklist across DoorDash, Uber Eats, and Grubhub: photos, hours, menu items, descriptions, and reviews. Replace any photo showing a discontinued item, and match platform hours to kitchen hours exactly. It is a one-time project of three to four hours.' },
        { kind: 'result', target: 't-delivery', targetLabel: 'Delivery Platforms',
          title: 'Score and baseline the listings',
          detail: 'Record each platform\'s active status, rating, and photo count in the Delivery Platforms screen. Set the baseline so you can tell later whether the audit and the menu work moved the numbers.' },
        { kind: 'reference', target: 'Delivery_Platform_Comparison.docx', targetLabel: 'Delivery Platform Comparison',
          title: 'Decide which platforms are worth the commission',
          detail: 'Download the Delivery Platform Comparison. Not every platform is worth the commission cut for every bar. The comparison reads through commission rates, average ticket sizes, audience reach, and effort-to-maintain for each platform. Decide whether to add, drop, or refocus before you commit more energy to menu and photo work.' },
        { kind: 'reference', target: 'Online_Menu_Audit.pdf', targetLabel: 'Delivery Menu Builder Worksheet',
          title: 'Curate the delivery menu',
          detail: 'Use the Delivery Menu Builder Worksheet. The delivery menu is a tight subset of your in-house menu, not the whole thing. Recalculate every item\'s margin at the platform commission rate, rate how well each item travels, and pull any item whose margin drops below 15%.' },
        { kind: 'action', target: 't-this-week', targetLabel: 'This Week',
          title: 'Log the weekly numbers',
          detail: 'Every Monday, in This Week, log each platform\'s rating and order volume. Answer every new platform review with the same standard you use for Google, and never blame the platform or the driver. Check the dashboards for any item the platform auto-flagged or removed.' },
        { kind: 'result', target: 't-dashboard', targetLabel: 'Traffic Dashboard',
          title: 'Watch the trend',
          detail: 'The Traffic dashboard rolls your delivery numbers into the digital presence score and the 90-day trend. Read it weekly. Ten minutes a week catches a rating slide before it stacks up.' }
      ]
    },

    commonMistakes: [
      'Using photos from a previous menu or ownership era. A listing showing discontinued items produces the bad experience that generates a one-star review.',
      'Not updating platform hours when kitchen hours change. Wrong hours produce wrong-time orders that arrive cold or get cancelled.',
      'Listing every in-house item on delivery. Items that travel poorly or lose margin at commission should not be on a tight delivery menu.',
      'Ignoring delivery platform reviews. They affect platform ranking the way Google reviews affect your profile. The same response standard applies.',
      'Never logging into the platform dashboards. Ratings and order volume change weekly, and an operator who checks monthly misses problems that stack up for weeks.',
      'Adding a third platform before optimizing the first two. A poor listing on two platforms is not fixed by adding a third.'
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
          detail: 'Use the Email Campaign Templates for the three campaigns every bar needs: a welcome sequence, a monthly update, and an event announcement. Set up the welcome sequence before you collect a single address, it is the highest-opened email you will ever send. Write first person, with one specific detail, signed with a name. I wanted to tell you reads like a person. We are thrilled to announce reads like a chain.' },
        { kind: 'result', target: 't-email', targetLabel: 'Email Marketing',
          title: 'Track the list, the sends, and opens',
          detail: 'The Email Marketing screen tracks list size, emails sent, and open rate. Read it so you know whether the list is growing and whether the sends are landing.' },
        { kind: 'action', target: 't-this-week', targetLabel: 'This Week',
          title: 'Log the monthly send',
          detail: 'Send on a consistent monthly rhythm, one email a month is the floor and more than two is where unsubscribes accelerate. In This Week, log open rate, click rate, and any covers a guest attributed to the email. Track estimated visit conversion, not just open rate. Open rate tells you who read it. Visit conversion tells you whether it drove anyone in.' },
        { kind: 'result', target: 't-dashboard', targetLabel: 'Traffic Dashboard',
          title: 'Watch the trend and run quarterly hygiene',
          detail: 'The Traffic dashboard rolls email into the digital presence score and the 90-day trend. Read it weekly. Every 90 days, re-engage subscribers who have not opened in 90 days and remove the ones who do not respond. A clean list of 400 outperforms a stale list of 2,000.' }
      ]
    },

    commonMistakes: [
      'Collecting email addresses but never sending. A list that hears nothing within 30 days of signup has already started to go cold.',
      'Sending too infrequently and then too often. One email a month is the floor, more than two is where unsubscribes accelerate. Find the rhythm and hold it.',
      'Writing in marketing voice instead of owner voice. "We are thrilled to announce" reads like a chain. "I wanted to tell you" reads like a person.',
      'No welcome sequence, so new subscribers never hear from you after signing up. The welcome email is the highest-opened email in any sequence.',
      'Sending the same message to the whole list. Regulars and new guests have different relationships with the bar and convert from different messages.',
      'Not tracking estimated visit conversion. Open rate tells you who read it. Visit conversion tells you whether it drove anyone in.'
    ]
  }

];
