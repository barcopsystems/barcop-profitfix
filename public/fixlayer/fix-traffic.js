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
      intro: 'Profile completeness is the single largest factor in local map ranking. Complete the profile once, maintain it weekly, audit it quarterly. Every field you fill is a field a competitor with a complete profile is not beating you on. Bar Cop scores your profile and tracks the numbers over time. Each step below opens where the work happens.',
      steps: [
        { kind: 'result', target: 't-gbp', targetLabel: 'Google Business Profile',
          title: 'Audit where your profile stands',
          detail: 'Open the Google Business Profile screen. It scores your profile completeness and tracks photo count, posts per month, and the weekly insight numbers. Start here, so you know which fields are costing you ranking before you change anything.' },
        { kind: 'reference', target: 'GBP_Optimization_Checklist.pdf', targetLabel: 'GBP Optimization Checklist',
          title: 'Complete every field',
          detail: 'Work the GBP Optimization Checklist on Google itself. Every field filled, the right primary and secondary categories, the full 750-character description, and ten seeded Q&A entries. Use your exact business name and do not stuff keywords into it, that risks a suspension.' },
        { kind: 'reference', target: 'GBP_Photo_Brief.pdf', targetLabel: 'GBP Photo Brief',
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
    ],

    quickRef: {
      rhythm: [
        'Pull profile views, call clicks, and direction requests for the prior week',
        'Log the three numbers in your monthly digital presence scorecard',
        'Check the Q&A section for new questions and respond within 24 hours',
        'Confirm no user-suggested edits have been applied to the profile',
        'Post once this week if last week had no post, holding a minimum of two per month',
        'Flag any review that needs a response'
      ],
      escalation: [
        'Re-audit profile completeness and compare the score to last quarter.',
        'Benchmark the profile against your top three local competitors and note any new gaps.',
        'Update hours for the coming season, including holiday variations.',
        'Review every attribute for seasonal accuracy, such as patio and outdoor seating.',
        'Add at least five new photos from the past quarter.',
        'Update the description if the menu, concept, or team has changed.',
        'Pull the 90-day insights trend and compare it against last quarter.'
      ]
    },

    aiWorkflows: [
      {
        id: 'gbp-ai-1',
        title: 'Write a Google Business Profile Description',
        whatItDoes: 'Drafts a 750-character and a 300-character description, both specific to your concept and neighborhood.',
        prompt: 'My bar concept: [DESCRIBE YOUR CONCEPT, NEIGHBORHOOD, ATMOSPHERE, AND SIGNATURE OFFERINGS]. My primary Google category: [PRIMARY CATEGORY]. My secondary categories: [LIST UP TO 4]. My address neighborhood: [NEIGHBORHOOD NAME]. Write a GBP business description in two versions, one at 750 characters maximum and one at 300 characters maximum. Both should include my primary category, my neighborhood name, two or three specific items or experiences that make the bar distinctive, and a call to action. No filler language, no superlatives, specific and accurate only.',
        whatToPaste: 'Fill in your concept, primary and secondary categories, and neighborhood.'
      },
      {
        id: 'gbp-ai-2',
        title: 'Write Four GBP Posts for the Month',
        whatItDoes: 'Drafts four posts in four formats: Event, What\'s New, Offer, and Update.',
        prompt: 'My bar concept: [BRIEF DESCRIPTION]. My upcoming events or specials this month: [LIST ANY EVENTS, SPECIALS, OR NEW ITEMS]. Write four GBP posts for this month using four different post types: one Event post, one What\'s New post, one Offer post, and one Update post. Each post should be under 150 words, include a specific call to action, and tell the guest exactly what to expect. No filler, no exclamation points, operator voice not marketing voice.',
        whatToPaste: 'Fill in your concept and this month\'s events, specials, or new items.'
      },
      {
        id: 'gbp-ai-3',
        title: 'Seed the Q&A Section',
        whatItDoes: 'Writes 10 owner-posted question and answer pairs phrased the way guests search.',
        prompt: 'My bar concept: [DESCRIBE]. Relevant details: hours [HOURS], parking [PARKING SITUATION], reservation policy [POLICY], happy hour [TIMES AND DEAL], private events [YES/NO AND DETAILS], dress code [IF ANY], kitchen hours [HOURS], takeout [YES/NO]. Write 10 question and answer pairs I can post to my GBP as the business owner. Questions should be phrased the way a guest would ask them in a search. Answers should be factual, complete, and include the neighborhood name and one relevant keyword. Each answer under 100 words.',
        whatToPaste: 'Fill in your concept and the hours, parking, reservations, happy hour, and other details.'
      },
      {
        id: 'gbp-ai-4',
        title: 'Analyze Competitor GBP Gaps',
        whatItDoes: 'Compares your profile to your top competitors and ranks the gaps by impact per hour of effort.',
        prompt: 'Here is my GBP data and my top three competitor GBP data. [PASTE DATA: for each listing include name, completeness score, review count, average rating, post frequency, photo count, categories used]. Identify the three fields where my top-ranking competitor has the largest advantage over me. For each gap, estimate how long it would take to close at a realistic effort level and what ranking improvement to expect after closing it. Sort by impact per hour of effort, highest first.',
        whatToPaste: 'Paste your profile data and your top three competitors\' profile data.'
      }
    ]
  },

  {
    id: 'website',
    name: 'Website',
    module: 'traffic',
    summary: 'Most guests hit your site on a phone, ready to act. Convert them or lose them.',

    process: {
      intro: 'A bar website has one job: turn a guest who is already looking for you into a visit. Audit it before you change anything so you can prove the fixes worked, then fix conversion in the order that returns the most per hour. Bar Cop scores the site and tracks the numbers over time. Each step below opens where the work happens.',
      steps: [
        { kind: 'reference', target: 'Restaurant_Website_Audit_Form.pdf', targetLabel: 'Restaurant Website Audit Form',
          title: 'Audit the site before you change anything',
          detail: 'Work the Restaurant Website Audit Form page by page: page speed on the homepage and menu page, mobile elements, menu structure, and calls to action. Do the eight-second test on your own phone, you should find the phone number, the hours, and the reservation link without scrolling. An audit done after fixes cannot measure what changed.' },
        { kind: 'result', target: 't-website', targetLabel: 'Website Scorecard',
          title: 'Score it and hold the baseline',
          detail: 'Enter the audit results into the Website Scorecard. It turns them into a conversion score and a baseline. Every fix from here is measured against that baseline, so set it before you change a thing.' },
        { kind: 'reference', target: 'Website_Conversion_Fix_Checklist.pdf', targetLabel: 'Website Conversion Fix Checklist',
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
    ],

    quickRef: {
      rhythm: [
        'Pull mobile load time from a page-speed test or hosting analytics and log it',
        'Pull mobile bounce rate from Google Analytics and log it',
        'Pull click-to-call events and reservation link clicks from the analytics events report',
        'Flag any metric that moved more than five points below your baseline',
        'Update the menu page if any items or prices changed in the past week',
        'Confirm the reservation link still works and routes to the correct booking page'
      ],
      escalation: [
        'Compress every image on the homepage and menu page to under 200KB.',
        'Add a clickable phone number to the mobile header, visible without scrolling.',
        'Replace any PDF menu with a web-readable HTML or platform menu page.',
        'Add a reserve or order button to the mobile header or a sticky footer.',
        'Confirm the address and today\'s hours are visible without scrolling on mobile.',
        'Install Google Analytics 4 if it is not already tracking.',
        'Re-run the page-speed test and record the updated score against the baseline.'
      ]
    },

    aiWorkflows: [
      {
        id: 'web-ai-1',
        title: 'Rewrite the Homepage Headline for Mobile',
        whatItDoes: 'Drafts three short homepage headlines with subheadlines, written for a guest who found you on a phone.',
        prompt: 'My bar concept: [DESCRIBE IN 2 SENTENCES]. My neighborhood: [NEIGHBORHOOD AND CITY]. My primary offering or differentiator: [WHAT MAKES YOUR BAR WORTH VISITING]. My current homepage headline: [PASTE CURRENT HEADLINE]. Write three alternative headline options optimized for a guest on a phone who found me through a Google search. Each headline should be under 8 words, name the concept type or a key offering, and include the neighborhood name. Write a one-sentence subheadline for each that answers what the guest gets if they visit.',
        whatToPaste: 'Fill in your concept, neighborhood, differentiator, and current headline.'
      },
      {
        id: 'web-ai-2',
        title: 'Write Online Menu Item Descriptions',
        whatItDoes: 'Drafts tight online menu descriptions for your top items, each with a specific ingredient detail.',
        prompt: 'I need online menu descriptions for my top performing items. For each item: name, key ingredients, preparation note, price. [PASTE ITEM LIST]. Write a description for each under 20 words, including one specific ingredient detail and one sensory word. For cocktails, include the base spirit and one flavor note. No filler, no "delicious", no "house-made" without a specific follow-up, no "fresh" as a standalone adjective. Format: item name on one line, description on the next.',
        whatToPaste: 'Paste your top items with ingredients, prep notes, and prices.'
      },
      {
        id: 'web-ai-3',
        title: 'Rank Your Website Conversion Problems',
        whatItDoes: 'Reads your audit scores and ranks the conversion problems by impact, with one non-developer fix for each.',
        prompt: 'Here is my website conversion audit scores for each section. [PASTE SCORES: mobile speed score, above-fold elements present or absent, CTA placement score, menu accessibility score, reservation path step count]. My current mobile page-speed score: [SCORE]. My mobile bounce rate: [RATE]%. Rank my conversion problems by estimated impact on bounce rate. For each problem, suggest one specific fix that does not require a developer and estimate how long it takes to implement.',
        whatToPaste: 'Paste your audit section scores, page-speed score, and bounce rate.'
      },
      {
        id: 'web-ai-4',
        title: 'Write the Contact and Hours Page',
        whatItDoes: 'Drafts the full text of a mobile-friendly contact and hours page in under 150 words.',
        prompt: 'My bar details: name [NAME], address [ADDRESS], neighborhood [NEIGHBORHOOD], phone [PHONE], hours [HOURS BY DAY], reservation policy [POLICY], parking [PARKING DETAILS], public transit [NEAREST STOP IF RELEVANT]. Write the complete text for a Contact and Hours page. Include a one-sentence intro with the neighborhood name, hours formatted for easy reading on mobile, the address with a note about landmarks or parking, the phone number with a note about reservations, and one sentence about walk-in availability. Under 150 words total, no marketing language.',
        whatToPaste: 'Fill in your name, address, neighborhood, phone, hours, and policies.'
      }
    ]
  },

  {
    id: 'reviews',
    name: 'Reviews',
    module: 'traffic',
    summary: 'Recent reviews rank you and reassure the guest who is deciding tonight.',

    process: {
      intro: 'Review velocity matters more than the rating sitting on your profile today. A fresh stream of reviews tells Google the business is active and tells the guest other people went last week. Build the ask into service and respond to every review. Bar Cop tracks your velocity, rating, and response rate. Each step below opens where the work happens.',
      steps: [
        { kind: 'result', target: 't-reviews', targetLabel: 'Review Tracker',
          title: 'Track velocity, not just the rating',
          detail: 'The Review Tracker counts new Google and Yelp reviews, the rolling 30-day rating, and your response rate. Velocity is what ranks you in the map results. A high rating with no recent reviews looks stale next to a competitor getting a steady flow.' },
        { kind: 'reference', target: 'Review_Response_Templates.docx', targetLabel: 'Review Response Templates',
          title: 'Respond to every review within 48 hours',
          detail: 'Download the Review Response Templates. Negative reviews get the four-sentence pattern: acknowledge, address the specific complaint, state your standard, invite them back, with your direct contact at the end so the next step happens off the public page. Positive reviews get a named, specific reply too. A generic thank-you signals you did not read it.' },
        { kind: 'reference', target: 'Review_Request_Script.pdf', targetLabel: 'Review Request Script',
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
    ],

    quickRef: {
      rhythm: [
        'Read every new Google and Yelp review from the past 7 days',
        'Respond to every unanswered review within 48 hours and log the response time',
        'Count new Google and new Yelp reviews for the prior week and log them',
        'Calculate the rolling 30-day average rating and compare it to last week',
        'Flag any week where new reviews are below the monthly target divided by four',
        'If velocity is low, find the shift with the weakest review ask and address it'
      ],
      benchmarks: [
        { label: 'Average rating',                  target: '4.4 and up', warning: '4.0 to 4.3', critical: 'below 4.0' },
        { label: 'Response rate',                   target: '100%',       warning: '80 to 99%',  critical: 'below 80%' },
        { label: 'Monthly velocity, full-service',  target: '8-12 / mo',  warning: '4-7 / mo',   critical: 'under 4 / mo' },
        { label: 'Monthly velocity, neighborhood bar', target: '4-8 / mo', warning: '2-3 / mo',  critical: 'under 2 / mo' },
        { label: 'Monthly velocity, craft cocktail', target: '6-10 / mo', warning: '3-5 / mo',   critical: 'under 3 / mo' },
        { label: 'Monthly velocity, tourist-area',  target: '15-25 / mo', warning: '8-14 / mo',  critical: 'under 8 / mo' }
      ],
      escalation: [
        'Read the review fully and identify the specific complaint before drafting anything.',
        'Respond within 48 hours: acknowledge, address it specifically, state your standard, invite them back.',
        'Keep all defensiveness out, and put your direct contact at the end of a negative response.',
        'If the review looks fake, respond factually that you have no record of the experience, without accusing the reviewer.',
        'Flag a policy-violating or fake review to Google through the escalation path.',
        'Log the response and its time in the response tracker.'
      ]
    },

    aiWorkflows: [
      {
        id: 'rev-ai-1',
        title: 'Draft Responses to Reviews',
        whatItDoes: 'Drafts a response to each review using the four-sentence pattern, specific to the review and ready for a quick human edit.',
        prompt: 'Here are five reviews I need to respond to. [PASTE EACH REVIEW WITH ITS STAR RATING]. My bar name: [NAME]. My concept: [BRIEF DESCRIPTION]. My neighborhood: [NEIGHBORHOOD]. For each review, write a response using the four-sentence pattern: acknowledge, address specifically, state your standard, invite return. Use the guest\'s name if it appears. No generic openings like "Thank you so much for the kind words." No defensive language in negative responses. Each response under 100 words. For negative responses, include my direct contact at the end.',
        whatToPaste: 'Paste each review with its star rating, and fill in your bar name, concept, and neighborhood.'
      },
      {
        id: 'rev-ai-2',
        title: 'Write a Review Request Script',
        whatItDoes: 'Drafts three short review-ask scripts matched to your service style: the compliment moment, the receipt, and a text follow-up.',
        prompt: 'My bar concept: [DESCRIBE]. My team: primarily [servers/bartenders/both] interact with guests. My typical service style: [casual and conversational / professional and formal / somewhere between]. Write three versions of a review request script for my team: one for the compliment moment during service, one for the receipt presentation, and one short text message for guests who opted in to follow-up. Each version under 30 words, matched to the service style, and asking specifically for Google. No salesy language, no incentive offers.',
        whatToPaste: 'Fill in your concept, who interacts with guests, and your service style.'
      },
      {
        id: 'rev-ai-3',
        title: 'Analyze Review Velocity',
        whatItDoes: 'Reads 12 weeks of review counts, finds the patterns in slow weeks, and recommends one change to the ask process.',
        prompt: 'Here is my weekly review count data for the last 12 weeks. [PASTE: week number, new Google reviews, new Yelp reviews, notes on busy vs slow weeks]. My current ask process: [DESCRIBE WHAT IS IN PLACE]. My target: [X] new reviews per month. Identify any patterns, including whether slow weeks correlate with specific days, shifts, or events. Based on the data, suggest the one change to the ask process most likely to improve velocity in the next 30 days.',
        whatToPaste: 'Paste 12 weeks of review counts and describe your current ask process and target.'
      },
      {
        id: 'rev-ai-4',
        title: 'Respond to a Suspicious Review',
        whatItDoes: 'Drafts a factual public response to a suspected fake review that does not accuse the reviewer.',
        prompt: 'Here is a review I believe may be fake or inaccurate: [PASTE REVIEW]. Reason I believe it is inaccurate: [DESCRIBE: no record of this guest, experience described is impossible, etc.]. My bar name: [NAME]. My direct contact: [EMAIL OR PHONE]. Write a public response that acknowledges the review professionally, states factually that you have no record of this experience, invites them to contact you directly to resolve any genuine concern, and does not accuse them of fabricating the review. Under 80 words, factual and professional throughout.',
        whatToPaste: 'Paste the review, why you believe it is inaccurate, and your contact.'
      }
    ]
  },

  {
    id: 'search-seo',
    name: 'Search and SEO',
    module: 'traffic',
    summary: 'Local search ranking comes from a clean, consistent listing across the web.',

    process: {
      intro: 'Local-pack ranking is built on two things: a complete Google Business Profile and consistent business information across the web. Fix the foundation before you build on it, because a citation built on top of inconsistent information just creates another variant. Local-pack ranking and organic website ranking are two separate jobs, built differently. The Search and SEO screen tracks your keyword positions and citation count. Each step below opens where the work happens.',
      steps: [
        { kind: 'reference', target: 'NAP_Consistency_Audit.pdf', targetLabel: 'NAP Consistency Audit',
          title: 'Fix NAP consistency first',
          detail: 'Work the NAP Consistency Audit across Google, Yelp, TripAdvisor, and the top local directories. Your name, address, and phone have to match exactly everywhere. One wrong character splits your citation authority, so fix every variant before you build anything new.' },
        { kind: 'reference', target: 'Keyword_Research_Worksheet.docx', targetLabel: 'Keyword Research Worksheet',
          title: 'Build your target keyword list',
          detail: 'Use the Keyword Research Worksheet to land 10 target terms across neighborhood, occasion, concept, and proximity. Aim at terms like "bar Wicker Park" that drive walk-ins. Broad city terms like "best bar Chicago" drive almost no real traffic for an independent bar.' },
        { kind: 'reference', target: 'Local_SEO_Quick_Start_Guide.docx', targetLabel: 'Local SEO Quick-Start Guide',
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
      'Optimizing for broad city-level terms instead of neighborhood and occasion terms. "Best bar Chicago" drives almost no new traffic; "bar Wicker Park" drives walk-ins.',
      'Inconsistent name, address, and phone across platforms. A business name that appears three different ways splits citation authority three ways.',
      'Not claiming listings on secondary directories. An unclaimed Foursquare listing produces variants on every downstream directory it feeds.',
      'Ignoring duplicate listings. A bar with two Google listings splits its review count and its authority. Merge them before building more reviews.',
      'Never checking keyword ranking position. Without weekly rank tracking you cannot know whether the work is producing a position improvement.',
      'Treating organic SEO and local-pack SEO as the same thing. Local pack needs profile completeness and citations; organic needs website content.'
    ],

    quickRef: {
      rhythm: [
        'Update keyword ranking positions for all of your target terms',
        'Update the citation count and flag any directory showing a name, address, or phone variant',
        'Correct any variant found in the check',
        'Pull direction requests from the GBP insights and compare to last month',
        'Log the SEO numbers in your monthly digital presence scorecard',
        'Run the full local SEO audit once a quarter'
      ],
      escalation: [
        'Confirm the Google Business Profile is claimed and 100% complete.',
        'Build the target keyword list and identify your 10 terms.',
        'Audit name, address, and phone across every platform and fix every variant.',
        'Find duplicate listings on Google and Yelp and submit merge requests.',
        'Record a baseline ranking position for each target keyword.',
        'Build citations in priority order: Yelp, Facebook, Apple Maps, Foursquare, TripAdvisor, reservation platforms.'
      ]
    },

    aiWorkflows: [
      {
        id: 'seo-ai-1',
        title: 'Identify Your 10 Target Search Terms',
        whatItDoes: 'Generates 10 local-pack target terms across neighborhood, occasion, concept, proximity, and comparison categories, with intent classification.',
        prompt: 'My bar concept: [DESCRIBE BRIEFLY]. My neighborhood: [NEIGHBORHOOD NAME]. My city: [CITY]. My primary Google category: [CATEGORY]. My secondary categories or key offerings: [LIST 3 TO 5]. Generate 10 target search terms I should be ranking for in Google Maps: 3 neighborhood-specific terms, 2 occasion-based terms, 2 concept-specific terms, 2 proximity terms a guest on their phone would use, and 1 competitor comparison term. For each term, estimate whether search intent is primarily foot traffic or information-seeking, and exclude any term where the intent is primarily informational.',
        whatToPaste: 'Fill in your concept, neighborhood, city, primary category, and secondary categories.'
      },
      {
        id: 'seo-ai-2',
        title: 'Write Keyword-Rich Q&A for Your Profile',
        whatItDoes: 'Drafts 8 owner-posted Q&A pairs that work your target keywords in naturally.',
        prompt: 'My bar concept: [DESCRIBE]. My neighborhood: [NEIGHBORHOOD AND CITY]. My target keywords: [PASTE YOUR 10 TERMS]. Write 8 question and answer pairs I can post to my GBP Q&A section as the business owner. Each question should be phrased the way a guest searching locally would ask it, and each answer should include at least one of my target keywords naturally plus the neighborhood name. Answers under 80 words each, no keyword stuffing.',
        whatToPaste: 'Fill in your concept and neighborhood and paste your 10 target keywords.'
      },
      {
        id: 'seo-ai-3',
        title: 'Find Citation Gaps vs a Competitor',
        whatItDoes: 'Compares your citations to a competitor\'s and ranks the missing directories by value.',
        prompt: 'Here is my current citation data and my top competitor\'s citation data. [PASTE: for each, list the directories where they appear that I do not, and vice versa]. Identify the directories where my competitor has a listing and I do not, rank them by domain authority for local search citation purposes, and for each gap describe what type of listing it is and estimate how long it takes to build.',
        whatToPaste: 'Paste your citation list and your competitor\'s citation list.'
      },
      {
        id: 'seo-ai-4',
        title: 'Write a Location Page',
        whatItDoes: 'Drafts a location or contact page that strengthens local search relevance without reading like marketing.',
        prompt: 'I need to write or rewrite the location or contact page on my website. My bar: [NAME], [ADDRESS], [NEIGHBORHOOD], [CITY]. My target keywords: [PASTE TOP 5]. My hours: [HOURS]. My phone: [PHONE]. Write a location page that includes the neighborhood name and city naturally at least twice, uses two of my target keywords in the copy, describes how to find the bar including a landmark reference, and mentions parking or transit options. Under 200 words, no marketing language, factual and specific.',
        whatToPaste: 'Fill in your name, address, neighborhood, top keywords, hours, and phone.'
      }
    ]
  },

  {
    id: 'social',
    name: 'Social Media',
    module: 'traffic',
    summary: 'Social drives walk-ins when it shows what the bar feels like and runs on a calendar.',

    process: {
      intro: 'Consistency beats quality for social reach. Pick one platform where your guests are and own it before spreading to a second. Post on a fixed weekly rhythm with content the floor team captures, and measure the numbers that mean a new guest is considering a visit, not the numbers that just count the audience you already have. The Social Media screen tracks your numbers over time. Each step below opens where the work happens.',
      steps: [
        { kind: 'reference', target: 'Social_Media_Profile_Audit_Form.pdf', targetLabel: 'Social Media Profile Audit Form',
          title: 'Audit the profile',
          detail: 'Work the Social Media Profile Audit Form across bio, profile photo, link-in-bio, content mix, and posting frequency. Fix the bio, photo, and link-in-bio before you post anything new.' },
        { kind: 'result', target: 't-social', targetLabel: 'Social Media',
          title: 'Set the baseline',
          detail: 'Record your current follower count, profile visits, link clicks, and posts per month in the Social Media screen. Set the baseline before you change anything, so you can tell later whether the work moved the numbers.' },
        { kind: 'reference', target: 'Social_Content_Calendar.pdf', targetLabel: 'Social Content Calendar',
          title: 'Run on a content calendar',
          detail: 'Plan the month on the Social Content Calendar. Post five times a week on the 3-1-1 mix: three experience posts, one promotional, one community. Make experience content the dominant type. A 60-second walkthrough of a busy night outperforms a polished promo, because the feel of the room is what drives a new guest\'s decision.' },
        { kind: 'reference', target: 'Social_Media_Standards_Policy.docx', targetLabel: 'Social Media Standards Policy',
          title: 'Set the posting standard and the Sunday review',
          detail: 'The Social Media Standards Policy covers posting frequency, image quality, caption tone, and the approval workflow for staff posts. Protect the Sunday review: go through the week\'s captured content, pick five posts, schedule them, and flag one to cross-post to the Google profile.' },
        { kind: 'action', target: 't-this-week', targetLabel: 'This Week',
          title: 'Log the weekly numbers',
          detail: 'Every Monday, in This Week, log profile visits and link clicks. Track visits and clicks, not likes. Profile visits and link-in-bio clicks measure new-guest consideration. Follower count and likes only measure the audience you already have.' },
        { kind: 'result', target: 't-dashboard', targetLabel: 'Traffic Dashboard',
          title: 'Watch the trend',
          detail: 'The Traffic dashboard rolls your social numbers into the digital presence score and the 90-day trend. Read it weekly. Social content compounds over months, so 90 days of consistent posting gets fundamentally different distribution than the first 30.' }
      ]
    },

    commonMistakes: [
      'Posting promotional graphics as the dominant content type. Promo content gets saves from existing followers and almost no new reach. Experience content drives new-guest decisions.',
      'Abandoning a platform after 30 days. Social content compounds over months. Ninety days of consistent posting gets fundamentally different distribution than the first 30.',
      'Using the same post on every platform without format adjustment. A square photo pushed to three platforms at once ignores the format and audience differences.',
      'Never showing the inside of the bar in video. Food and cocktail photos show what guests can order, not what it feels like to be there. The feel is the decision driver.',
      'Tracking follower count and likes instead of profile visits and link clicks. The first pair measures your existing audience, the second measures new-guest consideration.',
      'No content calendar, so posting is reactive and irregular. Irregular posting is penalized by every algorithm. Consistency matters more than polish for distribution.'
    ],

    quickRef: {
      rhythm: [
        'Sunday: review the week\'s captured content and select five posts',
        'Schedule the five posts on the 3-1-1 split, three experience, one promotional, one community',
        'Flag one post to cross-post to the Google profile as a What\'s New or Event post',
        'Monday: ask one server and one bartender the weekly social question and log the answer',
        'Monday: pull profile visits and link clicks from platform analytics and log them',
        'Mid-week: confirm all five posts for the week are scheduled or in draft'
      ],
      escalation: [
        'Pull the 30-day totals: posts published, profile visits, link clicks, saves, direct messages.',
        'Identify the two highest-performing posts by profile visits and link clicks.',
        'Identify the two lowest-performing posts and note the content type.',
        'Log the social numbers in your monthly digital presence scorecard.',
        'Adjust next month\'s 3-1-1 ratio if one content pillar is clearly outperforming.',
        'Check whether any posts were referenced by arriving guests and log it.'
      ]
    },

    aiWorkflows: [
      {
        id: 'soc-ai-1',
        title: 'Write This Week\'s Captions',
        whatItDoes: 'Drafts a caption for each of the week\'s posts, matched to post type, with a specific detail in each.',
        prompt: 'Here is my content plan for this week. For each post: content type, what was captured, platform, and any relevant context. [PASTE: e.g., Post 1: Reel, Friday night walkthrough, Instagram, busy with live music]. My bar name: [NAME]. My neighborhood: [NEIGHBORHOOD]. Write a caption for each post. Experience posts: under 50 words, first sentence is a hook that does not start with "We", one specific detail about what is shown, a location tag reference, no hashtags in the body. Promotional posts: one sentence description, one sentence call to action. Community posts: reference the local context specifically. No emojis unless the post explicitly calls for them.',
        whatToPaste: 'Paste this week\'s post plan and fill in your bar name and neighborhood.'
      },
      {
        id: 'soc-ai-2',
        title: 'Plan a 30-Day Content Calendar',
        whatItDoes: 'Builds a 30-day calendar of 20 posts on the 3-1-1 mix, with type, description, and caption theme for each.',
        prompt: 'My bar concept: [DESCRIBE]. My primary platform: [INSTAGRAM / FACEBOOK]. Upcoming events or specials this month: [LIST]. My team size: [NUMBER]. Build a 30-day content calendar using the 3-1-1 mix, three experience posts, one promotional post, and one community post per week. For each post include the date, content type, content description, caption theme, and whether it should also be posted to the Google profile. Promotional posts should correspond to actual events or specials listed above, and community posts should reference local seasonal or neighborhood context.',
        whatToPaste: 'Fill in your concept, primary platform, this month\'s events, and team size.'
      },
      {
        id: 'soc-ai-3',
        title: 'Analyze What Is Driving Walk-Ins',
        whatItDoes: 'Reads a month of engagement data to find which content types produce visits and clicks, and recommends a ratio adjustment.',
        prompt: 'Here is my monthly social engagement data. [PASTE: for each week, post type, reach, likes, saves, shares, profile visits, link clicks]. Here are my weekly social question responses: [PASTE: week number, yes/no, and if yes what content the guest mentioned]. Identify which content types produced the most profile visits and link clicks, identify which content types were mentioned by arriving guests, and recommend one adjustment to my 3-1-1 ratio for next month based on this data.',
        whatToPaste: 'Paste your monthly engagement data and the weekly guest-mention responses.'
      },
      {
        id: 'soc-ai-4',
        title: 'Write an Email Signup Post',
        whatItDoes: 'Drafts a link-in-bio post that drives followers to join the email list, with a specific benefit up front.',
        prompt: 'My bar concept: [DESCRIBE]. My email list current size: [NUMBER]. What people on my email list receive: [DESCRIBE: early access to events, monthly update, etc.]. Write an Instagram post designed to drive followers to sign up for my email list. Caption under 60 words. First sentence: a specific reason to be on the list, not a generic "join our community" opener. Second sentence: what they get. Third sentence: a link-in-bio call to action. No urgency language, no discount offers.',
        whatToPaste: 'Fill in your concept, list size, and what list members receive.'
      }
    ]
  },

  {
    id: 'delivery',
    name: 'Delivery Platforms',
    module: 'traffic',
    summary: 'A delivery listing is a storefront most operators never check.',

    process: {
      intro: 'Delivery platforms run on the same signals as Google: photos, accuracy, reviews, and activity. A listing left alone runs at about 60% of its potential and looks fine from the outside. You only see the gap after the audit. The Delivery Platforms screen tracks each listing over time. Each step below opens where the work happens.',
      steps: [
        { kind: 'reference', target: 'Delivery_Platform_Audit_Checklist.pdf', targetLabel: 'Delivery Platform Audit Checklist',
          title: 'Audit every active listing first',
          detail: 'Work the Delivery Platform Audit Checklist across DoorDash, Uber Eats, and Grubhub: photos, hours, menu items, descriptions, and reviews. Replace any photo showing a discontinued item, and match platform hours to kitchen hours exactly. It is a one-time project of three to four hours.' },
        { kind: 'result', target: 't-delivery', targetLabel: 'Delivery Platforms',
          title: 'Score and baseline the listings',
          detail: 'Record each platform\'s active status, rating, and photo count in the Delivery Platforms screen. Set the baseline so you can tell later whether the audit and the menu work moved the numbers.' },
        { kind: 'reference', target: 'Delivery_Menu_Builder_Worksheet.pdf', targetLabel: 'Delivery Menu Builder Worksheet',
          title: 'Curate the delivery menu',
          detail: 'Use the Delivery Menu Builder Worksheet. The delivery menu is a tight subset of your in-house menu, not the whole thing. Recalculate every item\'s margin at the platform commission rate, rate how well each item travels, and pull any item whose margin drops below 15%.' },
        { kind: 'action', target: 't-this-week', targetLabel: 'This Week',
          title: 'Log the weekly numbers',
          detail: 'Every Monday, in This Week, log each platform\'s rating and order volume. Answer every new platform review with the same standard you use for Google, and never blame the platform or the driver. Check the dashboards for any item the platform auto-flagged or removed.' },
        { kind: 'result', target: 't-dashboard', targetLabel: 'Traffic Dashboard',
          title: 'Watch the trend',
          detail: 'The Traffic dashboard rolls your delivery numbers into the digital presence score and the 90-day trend. Read it weekly. Ten minutes a week catches a rating slide before it compounds.' }
      ]
    },

    commonMistakes: [
      'Using photos from a previous menu or ownership era. A listing showing discontinued items produces the bad experience that generates a one-star review.',
      'Not updating platform hours when kitchen hours change. Wrong hours produce wrong-time orders that arrive cold or get cancelled.',
      'Listing every in-house item on delivery. Items that travel poorly or lose margin at commission should not be on a tight delivery menu.',
      'Ignoring delivery platform reviews. They affect platform ranking the way Google reviews affect your profile. The same response standard applies.',
      'Never logging into the platform dashboards. Ratings and order volume change weekly, and an operator who checks monthly misses problems that compound for weeks.',
      'Adding a third platform before optimizing the first two. A poor listing on two platforms is not fixed by adding a third.'
    ],

    quickRef: {
      rhythm: [
        'Log into every active platform dashboard and pull the current rating and order volume',
        'Log rating, order count, and average order value for each platform',
        'Flag any platform where the rating dropped from the prior week',
        'Read and respond to any new platform reviews',
        'Verify no menu items have been auto-flagged or removed by the platform',
        'Log the delivery numbers in your monthly digital presence scorecard'
      ],
      escalation: [
        'Log into every active platform and note the current rating, order volume, and any flagged issues.',
        'Update all photos to the current menu and remove any showing discontinued items.',
        'Verify hours match current kitchen hours exactly on every platform.',
        'Remove any menu item that is no longer served.',
        'Add a description to every item over $12 that currently has none.',
        'Respond to every unanswered platform review.'
      ]
    },

    aiWorkflows: [
      {
        id: 'del-ai-1',
        title: 'Write Delivery Menu Item Descriptions',
        whatItDoes: 'Drafts tight delivery menu descriptions, key ingredient first, with a travel note where it matters.',
        prompt: 'I need descriptions for my delivery menu items. For each item: name, key ingredients, price, and whether it travels well. [PASTE ITEM LIST]. Write a description for each item under 25 words. Include the most recognizable ingredient first, one sensory or preparation detail, and for items that travel in parts note "sauce served separately" or similar. No filler language, no "house-made" without a specific follow-up, no "delicious" or "fresh" as standalone adjectives.',
        whatToPaste: 'Paste your delivery items with ingredients, prices, and travel notes.'
      },
      {
        id: 'del-ai-2',
        title: 'Build a Tight Delivery Menu',
        whatItDoes: 'Calculates each item\'s margin at the commission rate and recommends a 15 to 20 item delivery menu by margin and travel quality.',
        prompt: 'Here is my full in-house menu with food cost percentages. [PASTE MENU]. My delivery platform commission rate: [RATE]%. My minimum acceptable margin on delivery: 15%. For each item, calculate the effective margin at the commission rate and flag any item where margin falls below 15%. For items above 15%, assess travel quality as good, moderate, or poor based on item category. Recommend a delivery menu of 15 to 20 items that maximizes margin and travel quality, and explain any item removed from the recommendation.',
        whatToPaste: 'Paste your in-house menu with food cost percentages and fill in the commission rate.'
      },
      {
        id: 'del-ai-3',
        title: 'Draft Delivery Review Responses',
        whatItDoes: 'Drafts responses to delivery platform reviews using the four-sentence pattern, with no blame on the platform or driver.',
        prompt: 'Here are five reviews from my delivery platforms with star ratings. [PASTE REVIEWS]. My bar name: [NAME]. My direct contact for escalation: [EMAIL]. Apply the four-sentence response pattern: acknowledge, address specifically, state your standard, invite return or escalate. For food quality or delivery time complaints, acknowledge without assigning blame to the platform or the driver. For wrong or missing item complaints, offer to resolve directly. Each response under 80 words.',
        whatToPaste: 'Paste five delivery reviews with ratings and your bar name and contact.'
      },
      {
        id: 'del-ai-4',
        title: 'Write a Delivery-to-Dine-In Insert',
        whatItDoes: 'Drafts the copy for a package insert card that invites a delivery guest to visit in person.',
        prompt: 'My bar concept: [DESCRIBE BRIEFLY]. My address: [ADDRESS]. My neighborhood: [NEIGHBORHOOD]. My hours: [HOURS]. My reservation link or phone: [CONTACT]. Write the copy for a small package insert card, credit-card size, front and back. Front: a headline under 8 words that creates curiosity about the in-person experience. Back: address, hours, and one sentence that connects the delivery order to the in-person experience. No discount, no offer, just the invitation.',
        whatToPaste: 'Fill in your concept, address, neighborhood, hours, and contact.'
      }
    ]
  },

  {
    id: 'email-loyalty',
    name: 'Email and Loyalty',
    module: 'traffic',
    summary: 'Email is the one channel where you own the audience.',

    process: {
      intro: 'Social platforms rent you an audience. Email is the one channel you own outright. A list that hears from you on a consistent monthly rhythm, in a real voice, brings guests back. A list that hears nothing goes cold within 30 days. The Email and Loyalty screen tracks your list and your sends. Each step below opens where the work happens.',
      steps: [
        { kind: 'reference', target: 'Email_List_Building_Playbook.pdf', targetLabel: 'Email List Building Playbook',
          title: 'Build the list at every contact point',
          detail: 'Work the Email List Building Playbook. Capture addresses at the POS, on table cards, through WiFi sign-in, at events, and through a QR code. Activate the contact points two at a time so each one gets set up properly. A loyalty program sign-up is one of the strongest capture points, so run the two together.' },
        { kind: 'reference', target: 'Email_Campaign_Templates.docx', targetLabel: 'Email Campaign Templates',
          title: 'Set up the three campaigns in owner voice',
          detail: 'Use the Email Campaign Templates for the three campaigns every bar needs: a welcome sequence, a monthly update, and an event announcement. Set up the welcome sequence before you collect a single address, it is the highest-opened email you will ever send. Write first person, with one specific detail, signed with a name. I wanted to tell you reads like a person. We are thrilled to announce reads like a chain.' },
        { kind: 'result', target: 't-email', targetLabel: 'Email and Loyalty',
          title: 'Track the list, the sends, and loyalty',
          detail: 'The Email and Loyalty screen tracks list size, emails sent, open rate, and loyalty members. Read it so you know whether the list is growing and whether the sends are landing.' },
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
      'Not tracking estimated visit conversion. Open rate tells you who read it; visit conversion tells you whether it drove anyone in.'
    ],

    quickRef: {
      rhythm: [
        'First week of the month: write and send the monthly update',
        'Subject line: conversational and personal, specific to something new this month',
        'Body: under 200 words, first person, one specific detail, one invitation, signed with a name',
        'Day after the send: ask hosts and servers whether any guests mentioned the email',
        'Log open rate, click rate, and any attributable covers',
        'Second send only if warranted, and only as an event announcement, not another general update',
        'End of month: check the list growth rate against target'
      ],
      escalation: [
        'Export the list and identify subscribers who have not opened anything in 90 days.',
        'Send a re-engagement email asking whether they want to stay on the list.',
        'Remove any subscriber who does not open the re-engagement email within 7 days.',
        'Record the cleaned list size and the hygiene date.',
        'Compare the open rate before and after hygiene. It should improve.',
        'Review the capture touchpoints and add a new one if list growth is below target.'
      ]
    },

    aiWorkflows: [
      {
        id: 'em-ai-1',
        title: 'Write This Month\'s Email Update',
        whatItDoes: 'Drafts a monthly update in owner voice, under 200 words, with three subject line options.',
        prompt: 'My bar: [NAME], [CONCEPT DESCRIPTION], [NEIGHBORHOOD]. What is new this month: [LIST 1 TO 3 SPECIFIC THINGS: menu addition, event, staff change, seasonal shift]. What is happening in the coming weeks: [1 TO 2 SPECIFIC EVENTS OR OCCASIONS]. The email should read like it came from me, not from a marketing department. Write a monthly email update under 200 words, first person singular throughout. Give 3 subject line options, conversational, no all-caps, no exclamation points. No discount offers. Sign off with my first name.',
        whatToPaste: 'Fill in your bar, what is new this month, what is coming up, and your first name.'
      },
      {
        id: 'em-ai-2',
        title: 'Write a Welcome Sequence',
        whatItDoes: 'Drafts the two welcome emails new subscribers receive, in owner voice, with no discount offers.',
        prompt: 'My bar: [NAME], [CONCEPT], [NEIGHBORHOOD]. What makes the bar worth visiting: [2 TO 3 SPECIFIC THINGS]. Best nights or experiences: [DESCRIBE]. My name: [FIRST NAME]. Write two welcome emails. Email 1 (immediate): thanks for joining, what to expect from the list, one specific invitation for the near future, under 150 words. Email 2 (3 days later): something the subscriber would not find on the website, an insider detail about the bar, under 100 words. Both first person, both conversational, no discount offers.',
        whatToPaste: 'Fill in your bar, what makes it worth visiting, best experiences, and your first name.'
      },
      {
        id: 'em-ai-3',
        title: 'Analyze Email Campaign Performance',
        whatItDoes: 'Reads six months of campaign data to find what is converting and recommends two changes.',
        prompt: 'Here is my campaign performance data for the last 6 months. [PASTE: campaign name, date sent, list size, open rate, click rate, estimated visit conversion if tracked]. Identify which campaign types and which subject line styles produced the highest open rates and estimated visit conversion. Identify any patterns in underperforming sends, such as day of week, subject line style, or content type. Recommend two changes to my email approach for the next 90 days.',
        whatToPaste: 'Paste six months of campaign performance data.'
      },
      {
        id: 'em-ai-4',
        title: 'Write a Re-Engagement Email',
        whatItDoes: 'Drafts a short re-engagement email for inactive subscribers with a clear click-to-stay and removal notice.',
        prompt: 'My bar: [NAME], [NEIGHBORHOOD]. How long since these subscribers last opened: [TIME PERIOD]. Write a re-engagement email under 100 words. Subject line: creates mild curiosity about whether they want to stay on the list. Body: acknowledge they have not been hearing from us lately, give them a reason to stay, and give them a simple yes or no, click to stay or they will be removed in 7 days. No guilt, no discount, conversational.',
        whatToPaste: 'Fill in your bar, neighborhood, and how long these subscribers have been inactive.'
      }
    ]
  }

];
