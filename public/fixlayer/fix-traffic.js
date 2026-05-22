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
    summary: 'Your Google Business Profile is the listing that decides whether you show up in the local map results. Complete every field, keep it current, and it ranks. Leave gaps and it does not.',

    process: {
      intro: 'Profile completeness is the single largest factor in local map ranking. Complete the profile once, maintain it weekly, audit it quarterly. Every field you fill is a field a competitor with a complete profile is not beating you on.',
      steps: [
        { title: 'Complete every profile field',
          detail: 'Name, address, phone, website, hours, and attributes all get filled in. An empty field is information a guest never gets and a ranking signal you never send. Use your exact business name and do not stuff keywords into it, that risks a suspension.' },
        { title: 'Set the right categories',
          detail: 'Your primary category carries the most weight. Add every accurate secondary category. Categories expand the searches you can appear for, so use all of the ones that genuinely fit the bar.' },
        { title: 'Load real, current photos',
          detail: 'Put up at least 25 real photos across the categories Google surfaces. Photos older than 12 months pull down click-through. Reshoot every six months. Stock photos do not convert.' },
        { title: 'Write the business description',
          detail: 'Use the full 750 characters. Lead with your primary category and your neighborhood name, name two or three specific things that make the bar distinctive, and close with a call to action. No filler, no superlatives.' },
        { title: 'Seed and watch the Q&A section',
          detail: 'Post 10 real questions and answer them as the business owner. Check the section every week. Anyone can answer a public question, including a competitor, so answer every new one within 24 hours.' },
        { title: 'Post at least twice a month',
          detail: 'A profile with no posts in 90 days reads as an inactive business to Google and to guests. Use the Event, What\'s New, Offer, and Update formats. Two posts a month is the floor, not the goal.' },
        { title: 'Maintain weekly, audit quarterly',
          detail: 'Every Monday pull profile views, call clicks, and direction requests, and log them. Every quarter re-audit completeness, update seasonal hours and attributes, and add fresh photos.' }
      ]
    },

    formulas: [],

    commonMistakes: [
      'Setting the hours once and never updating them. Holiday and seasonal hours get changed before they happen, not after a guest finds a closed door and leaves a review.',
      'Stuffing keywords into the business name. Adding something like "best cocktail bar downtown" to the listing name violates Google policy and risks suspension. Use your exact name.',
      'Ignoring the Q&A section. Anyone can answer a public question, including a competitor. Check it weekly and answer every question within 24 hours.',
      'Never posting. A profile with no posts in 90 days signals an inactive business. Two posts a month is the minimum to hold the prominence benefit.',
      'Using stock photos or the same photos for years. Photos older than 12 months reduce click-through. Reshoot real photos every six months.',
      'Not tracking the weekly insight numbers. Profile views, call clicks, and direction requests tell you whether the optimization is working. Without them you are guessing.'
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

    templates: [
      { name: 'GBP Optimization Checklist', type: 'PDF', file: 'GBP_Optimization_Checklist.pdf',
        description: 'Step-by-step checklist to claim, complete, and optimize every field of your Google Business Profile, including categories, attributes, photos, posts, and Q&A.' },
      { name: 'GBP Photo Brief', type: 'PDF', file: 'GBP_Photo_Brief.pdf',
        description: 'The shot list for a profile photo set. Covers the photo categories Google surfaces, how many of each to load, and what each shot needs to show.' }
    ],

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
    summary: 'Most guests reach your website on a phone, after a Google search, ready to act. If they cannot find your hours, your menu, and a way to book in a few seconds, they leave.',

    process: {
      intro: 'A bar website has one job: turn a guest who is already looking for you into a visit. Audit it before you change anything so you can prove the fixes worked, then fix conversion in the order that returns the most per hour.',
      steps: [
        { title: 'Audit before you touch anything',
          detail: 'Run a page-speed test on the homepage and the menu page, score the conversion audit, and record the baseline. An audit done after fixes cannot measure what changed.' },
        { title: 'Pass the eight-second test',
          detail: 'Open the site on your own phone. A guest should find the phone number, the hours, and the reservation link within eight seconds. If you cannot, neither can they.' },
        { title: 'Get four elements above the fold on mobile',
          detail: 'A clickable phone number, today\'s hours, the address, and a reservation or order button, all visible without scrolling. A full-screen hero photo with no information is a conversion failure no matter how good it looks.' },
        { title: 'Fix speed first',
          detail: 'Compress every image on the homepage and menu page to under 200KB. Image compression alone usually moves a page-speed score 15 to 25 points. It takes 20 minutes and costs nothing.' },
        { title: 'Replace the PDF menu with a web page',
          detail: 'A PDF menu cannot be indexed by Google and cannot be read on a phone without zooming. Put the menu on a web-readable HTML or platform page so it works and earns search value.' },
        { title: 'Install analytics',
          detail: 'Set up Google Analytics 4. Without bounce rate, session data, and click paths you cannot know whether a change helped. It takes 15 minutes and is free.' },
        { title: 'Track weekly',
          detail: 'Every Monday pull mobile load time, mobile bounce rate, and click-to-call and reservation clicks. Flag any metric that moved more than five points off the baseline.' }
      ]
    },

    formulas: [],

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

    templates: [
      { name: 'Restaurant Website Audit Form', type: 'PDF', file: 'Restaurant_Website_Audit_Form.pdf',
        description: 'Page-by-page website audit covering mobile optimization, menu page structure, calls to action, page load speed, and NAP consistency across all pages.' },
      { name: 'Website Conversion Fix Checklist', type: 'PDF', file: 'Website_Conversion_Fix_Checklist.pdf',
        description: 'The conversion fixes in priority order, from image compression through analytics setup, with the expected impact and effort of each.' }
    ],

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
    summary: 'A steady stream of recent reviews ranks you and reassures the guest who is deciding. Respond to every one, ask every satisfied guest, and track velocity every week.',

    process: {
      intro: 'Review velocity matters more than the rating sitting on your profile today. A fresh stream of reviews tells Google the business is active and tells the guest other people went last week. Build the ask into service and respond to every review.',
      steps: [
        { title: 'Treat velocity as the metric, not just the rating',
          detail: 'A high rating with no recent reviews looks stale. A steady flow of new reviews is what ranks you in the map results and reassures a guest comparing two listings.' },
        { title: 'Respond to every review within 48 hours',
          detail: 'Every review gets a response, named and specific, within two days. Set a phone alert for new reviews so nothing sits unanswered for more than a day.' },
        { title: 'Use the four-sentence framework on negative reviews',
          detail: 'Acknowledge, address the specific complaint, state your standard, invite them back. No defensiveness. Put your direct contact at the end so the next step happens off the public page.' },
        { title: 'Respond to positive reviews specifically too',
          detail: 'Use the guest name, reference a specific detail, mention the next visit. A generic thank-you signals you did not read it, and an unanswered positive review signals you only show up when there is a problem.' },
        { title: 'Build the review ask into the service sequence',
          detail: 'Train every server on a short compliment-moment ask, put a QR code on the bill presenter, and frame it as how the bar operates, not as a campaign. Never offer an incentive, that violates Google policy.' },
        { title: 'Track velocity every week',
          detail: 'Count new Google and Yelp reviews, calculate the rolling 30-day rating, and flag any week that comes in below your monthly target divided by four.' },
        { title: 'Handle fake reviews through the escalation path',
          detail: 'Respond factually that you have no record of the experience, without accusing the reviewer, then flag a policy-violating or fake review to Google.' }
      ]
    },

    formulas: [
      { label: 'Review Response Rate',
        formula: 'Reviews responded to / total reviews x 100',
        example: 'Target is 100%. At 8 to 12 new reviews a month that is two to three responses a week.' },
      { label: 'Monthly Velocity Target',
        formula: 'Your own monthly review baseline x 1.15',
        example: 'A bar averaging 6 a month sets a target near 7, a 15% monthly growth goal' },
      { label: 'Weekly Velocity Floor',
        formula: 'Monthly review target / 4',
        example: 'A target of 8 a month means any week under 2 new reviews gets flagged' }
    ],

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

    templates: [
      { name: 'Review Response Templates', type: 'DOC', file: 'Review_Response_Templates.docx',
        description: 'Ready-to-use response templates for positive reviews, negative reviews by category, and no-comment ratings. Personalize each with the specific detail only you know.' },
      { name: 'Review Request Script', type: 'PDF', file: 'Review_Request_Script.pdf',
        description: 'Word-for-word verbal scripts for asking satisfied guests for a Google review, plus a table card template and QR code placement guide.' },
      { name: 'Review Velocity Tracker', type: 'PDF', file: 'Review_Velocity_Tracker.pdf',
        description: 'Weekly tracking sheet for new reviews by platform. Tracks total count, new reviews, star distribution, and response rate against your monthly target.' }
    ],

    aiWorkflows: [
      {
        id: 'rev-ai-1',
        title: 'Draft Responses to Reviews',
        whatItDoes: 'Drafts a response to each review using the four-sentence framework, specific to the review and ready for a quick human edit.',
        prompt: 'Here are five reviews I need to respond to. [PASTE EACH REVIEW WITH ITS STAR RATING]. My bar name: [NAME]. My concept: [BRIEF DESCRIPTION]. My neighborhood: [NEIGHBORHOOD]. For each review, write a response using the four-sentence framework: acknowledge, address specifically, state your standard, invite return. Use the guest\'s name if it appears. No generic openings like "Thank you so much for the kind words." No defensive language in negative responses. Each response under 100 words. For negative responses, include my direct contact at the end.',
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
        title: 'Respond to a Potentially Fake Review',
        whatItDoes: 'Drafts a factual public response to a suspected fake review that does not accuse the reviewer.',
        prompt: 'Here is a review I believe may be fake or inaccurate: [PASTE REVIEW]. Reason I believe it is inaccurate: [DESCRIBE: no record of this guest, experience described is impossible, etc.]. My bar name: [NAME]. My direct contact: [EMAIL OR PHONE]. Write a public response that acknowledges the review professionally, states factually that you have no record of this experience, invites them to contact you directly to resolve any genuine concern, and does not accuse them of fabricating the review. Under 80 words, factual and professional throughout.',
        whatToPaste: 'Paste the review, why you believe it is inaccurate, and your contact.'
      }
    ]
  },

  {
    id: 'search-seo',
    name: 'Search & SEO',
    module: 'traffic',
    summary: 'Local search ranking comes from a clean, consistent listing across the web. Fix your name, address, and phone everywhere first, then build citations and track the terms that bring walk-ins.',

    process: {
      intro: 'Local-pack ranking is built on two things: a complete Google Business Profile and consistent business information across the web. Fix the foundation before you build on it, because a citation built on top of inconsistent information just creates another variant.',
      steps: [
        { title: 'Fix NAP consistency first',
          detail: 'Name, address, and phone have to match exactly across every platform. One wrong character splits your citation authority. Audit all the major directories and fix every variant before building anything new.' },
        { title: 'Build your target keyword list',
          detail: 'Target neighborhood and occasion terms that drive walk-ins, like "bar Wicker Park" or "date night bar Chicago". Broad city terms like "best bar Chicago" drive almost no real traffic for an independent bar.' },
        { title: 'Find and merge duplicate listings',
          detail: 'Two Google listings for one bar split your review count and your citation authority in half. Find duplicates on Google and Yelp and submit merge requests before building more reviews.' },
        { title: 'Build citations in priority order',
          detail: 'Google first, then Yelp, Facebook, Apple Maps, Foursquare, TripAdvisor, and the reservation platforms. Every listing carries the exact same name, address, and phone.' },
        { title: 'Do not skip Foursquare',
          detail: 'Foursquare is the citation most operators skip and most should not. Its data feeds dozens of downstream directories automatically, so a consistent Foursquare listing propagates accuracy across the web.' },
        { title: 'Track keyword rank',
          detail: 'Load your target terms into a rank tracker and record a baseline position before making changes. Without rank tracking you cannot know whether the GBP and citation work is moving you up.' },
        { title: 'Keep local-pack and organic SEO separate',
          detail: 'Local-pack ranking comes from profile completeness and citation consistency. Organic website ranking comes from website content. They are built differently, so work them as two jobs.' }
      ]
    },

    formulas: [],

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

    templates: [
      { name: 'NAP Consistency Audit', type: 'PDF', file: 'NAP_Consistency_Audit.pdf',
        description: 'Audit form for checking your business name, address, and phone number across Google, Yelp, TripAdvisor, delivery platforms, and the top local directories.' },
      { name: 'Local SEO Quick-Start Guide', type: 'DOC', file: 'Local_SEO_Quick_Start_Guide.docx',
        description: 'Plain-English guide to local SEO for bars and restaurants. Covers profile optimization, citation building, website title tags, and keyword targeting for local search.' },
      { name: 'Keyword Research Worksheet', type: 'DOC', file: 'Keyword_Research_Worksheet.docx',
        description: 'Worksheet for identifying your 10 target search terms across neighborhood, occasion, concept, proximity, and competitor-comparison categories.' }
    ],

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
  }

];
