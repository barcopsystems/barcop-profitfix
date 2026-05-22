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
  }

];
