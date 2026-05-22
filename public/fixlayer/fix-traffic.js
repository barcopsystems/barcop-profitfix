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
  }

];
