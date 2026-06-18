'use strict';

/* ── Fix Layer content — Traffic Recovery ─────────────────────────────────────
   Static fix content for the Traffic gap-areas (Section 9). Rendered by the
   Traffic Fix screen. Operator-to-operator, directive voice: tell the operator
   what to open, what to do, what number to hit, what mistake to avoid. No
   teaching, no justifying a metric. The tracked steps come FIRST in each system
   (their index maps to the TRACK table in t-fix.js), the Guidance steps follow.
   See fix-profit.js for the object shape. */

window.FIX = window.FIX || {};

FIX.traffic = [

  {
    id: 'gbp',
    name: 'Google Business',
    module: 'traffic',
    summary: 'Your Google Business Profile is what shows up in the local map results. Fill it out, keep it current, post.',

    process: {
      steps: [
        { kind: 'action', target: 't-presence', targetLabel: 'Google Business',
          title: 'Fill every profile field',
          detail: 'Open the Google Business card and check off each field as you finish it on Google: name, hours, phone, website, menu link, primary and secondary category, attributes, ten Q and A. Use your exact business name. Do not keyword-stuff it.' },
        { kind: 'action', target: 't-presence', targetLabel: 'Google Business',
          title: 'Get to 100 photos',
          detail: 'Load 100 photos across exterior, interior, food, drinks, and the room. Reshoot every six months. Drop stock shots and anything over a year old. Log the count on the card.' },
        { kind: 'action', target: 't-presence', targetLabel: 'Google Business',
          title: 'Post 8 times a month',
          detail: 'Post weekly using the Event, Offer, and Update formats. Never go 90 days dark. Log the month\'s count on the card.' },
        { kind: 'action', target: 't-this-week', targetLabel: 'This Week',
          title: 'Log the numbers every Monday',
          detail: 'In This Week, enter your rating, total reviews, and new reviews. Keep it current.' },
        { kind: 'reference', target: 'GBP_Yelp_Description_Template.docx', targetLabel: 'Description Template',
          title: 'Write the 750-character description',
          detail: 'Use the template for Google and Yelp. Lead with what makes the bar specific, name the neighborhood, name the category the way guests search for it.' },
        { kind: 'reference', target: 'Photo_Brief_25_Shots.pdf', targetLabel: 'Photo Brief',
          title: 'Shoot the photo set off the brief',
          detail: 'Use the shot list. Cover every category Google surfaces. Real photos only, no stock.' },
        { kind: 'reference', target: 'GBP_Checklist.pdf', targetLabel: 'GBP Optimization Checklist',
          title: 'Re-audit every quarter',
          detail: 'Recheck completeness, update seasonal hours and attributes, add fresh photos.' }
      ]
    },

    commonMistakes: [
      'Set the hours once and never touch them. Update holiday and seasonal hours before the date, not after a guest hits a closed door.',
      'Keyword-stuff the business name. Use your exact name. Anything extra risks a suspension.',
      'Skip the Q and A. Check it weekly and answer within 24 hours. A competitor can answer it if you do not.',
      'Go dark on posts. Two a month is the floor. Ninety days quiet reads as inactive.',
      'Run stock photos or year-old shots. Reshoot real ones every six months.'
    ]
  },

  {
    id: 'website',
    name: 'Website',
    module: 'traffic',
    summary: 'Most guests hit your site on a phone, ready to act. Convert them or lose them.',

    process: {
      steps: [
        { kind: 'action', target: 't-presence', targetLabel: 'Website',
          title: 'Get the setup in place',
          detail: 'On the Website card, check off live site, mobile-ready, menu linked from the homepage, online ordering, reservation link, and Google Analytics installed.' },
        { kind: 'action', target: 't-this-week', targetLabel: 'This Week',
          title: 'Log the numbers every Monday',
          detail: 'In This Week, enter monthly visits, bounce rate, and reservations. Flag anything that moved more than five points off your baseline.' },
        { kind: 'reference', target: 'Website_Conversion_Audit.pdf', targetLabel: 'Website Audit Form',
          title: 'Audit before you change anything',
          detail: 'Run the audit page by page. On your own phone, find the phone number, hours, and reservation link without scrolling. Do it before you touch a thing.' },
        { kind: 'reference', target: 'Website_Copy_CTA_Standards.docx', targetLabel: 'Conversion Fix Checklist',
          title: 'Fix conversion in impact order',
          detail: 'Compress every homepage and menu image under 200KB, get four elements above the fold on mobile, replace any PDF menu with a real web page. Speed first, 20 minutes and free.' }
      ]
    },

    commonMistakes: [
      'Run a PDF menu. Google cannot index it and nobody reads it on a phone. Use a real web page.',
      'Bury the phone number. Put a tap-to-call above the fold on mobile.',
      'Fill the mobile screen with a hero image and no information under it.',
      'Hide the order or reserve button in the menu or footer. Put it above the fold.',
      'Leave the menu a year stale. Guests order what is gone, then review you for it.'
    ]
  },

  {
    id: 'reviews',
    name: 'Reviews',
    module: 'traffic',
    summary: 'Recent reviews rank you and reassure tonight\'s guest. Answer every one and ask every happy table.',

    process: {
      steps: [
        { kind: 'action', target: 't-this-week', targetLabel: 'This Week',
          title: 'Hold response rate at 75 percent or higher',
          detail: 'Reply to every review within 48 hours. Log your response rate in This Week each Monday.' },
        { kind: 'action', target: 't-this-week', targetLabel: 'This Week',
          title: 'Pull 8 or more new reviews a month',
          detail: 'Ask at every happy table and put a QR code on the bill presenter. Log new reviews in This Week.' },
        { kind: 'action', target: 't-this-week', targetLabel: 'This Week',
          title: 'Log the numbers every Monday',
          detail: 'In This Week, enter new Google and Yelp reviews and your response rate.' },
        { kind: 'reference', target: 'Review_Response_Templates.pdf', targetLabel: 'Review Response Templates',
          title: 'Answer off the templates',
          detail: 'Negatives get the four-sentence pattern: acknowledge, address the complaint, state your standard, invite them back with your direct contact. Reply to positives by name, never a generic thank-you.' },
        { kind: 'reference', target: 'Review_Request_Script_Card.pdf', targetLabel: 'Review Request Script',
          title: 'Build the ask into service',
          detail: 'Run the script: a compliment-moment ask from every server, a QR code on the bill. Never offer an incentive and never ask only happy guests.' },
        { kind: 'reference', target: 'Negative_Review_Recovery_Protocol.docx', targetLabel: 'Negative Review Recovery Protocol',
          title: 'Work a recurring complaint at the floor',
          detail: 'A theme across reviews is an operations problem. Respond publicly, reach out privately, fix the cause, invite them back with a specific gesture.' }
      ]
    },

    commonMistakes: [
      'Answer the negatives and ignore the positives. Reply to both, by name.',
      'Paste the same reply on every review. Name something specific from each one.',
      'Offer an incentive or ask only happy guests. Both risk a profile suspension.',
      'Leave the ask off the floor. A process no server runs produces no reviews.',
      'Treat a 4.1 as fine. Next to a competitor at 4.4 you lose the comparison.'
    ]
  },

  {
    id: 'search-seo',
    name: 'Search and SEO',
    module: 'traffic',
    summary: 'Local ranking comes from a clean, consistent listing across the web.',

    process: {
      steps: [
        { kind: 'action', target: 't-presence', targetLabel: 'Search and SEO',
          title: 'Match name, address, phone everywhere',
          detail: 'Confirm your name, address, and phone match exactly on Google, Yelp, and the top directories, then check each off on the Search card. One wrong character splits you.' },
        { kind: 'action', target: 't-presence', targetLabel: 'Search and SEO',
          title: 'Get into the Maps 3-pack',
          detail: 'Check the Maps-pack box once you confirm you show in the local three-listing block for your main search.' },
        { kind: 'action', target: 't-presence', targetLabel: 'Search and SEO',
          title: 'Set your primary keyword',
          detail: 'Enter the one phrase guests type to find a bar like yours, neighborhood plus concept, like "bar Wicker Park". Not broad city terms.' },
        { kind: 'action', target: 't-presence', targetLabel: 'Search and SEO',
          title: 'Build to 40 citations',
          detail: 'List on Yelp, Facebook, Apple Maps, Foursquare, and TripAdvisor in that order. Log your count on the card.' },
        { kind: 'action', target: 't-presence', targetLabel: 'Search and SEO',
          title: 'Carry the keyword in your page titles',
          detail: 'Check the titles box once your website page titles include your primary keyword.' },
        { kind: 'reference', target: 'Keyword_Research_Worksheet.docx', targetLabel: 'Keyword Research Worksheet',
          title: 'Land your 10 target terms',
          detail: 'Use the worksheet to pick 10 across neighborhood, occasion, concept, and proximity. Aim at "bar Wicker Park", not "best bar Chicago".' },
        { kind: 'reference', target: 'Platform_Claiming_Checklist.docx', targetLabel: 'Local SEO Quick-Start',
          title: 'Merge duplicate listings first',
          detail: 'Two Google or Yelp listings split your reviews and authority. Merge before you build more.' }
      ]
    },

    commonMistakes: [
      'Chase "best bar Chicago" instead of "Bar Wicker Park". Go after neighborhood and occasion terms.',
      'Let your name, address, and phone differ across platforms. Make them identical everywhere.',
      'Leave secondary directories unclaimed. An open Foursquare listing seeds bad variants downstream.',
      'Ignore a duplicate listing. Merge it before you build more reviews.',
      'Stop checking keyword position. Track it or you work blind.'
    ]
  },

  {
    id: 'social',
    name: 'Social Media',
    module: 'traffic',
    summary: 'Social drives walk-ins when it shows what the bar feels like and runs on a calendar.',

    process: {
      steps: [
        { kind: 'action', target: 't-presence', targetLabel: 'Social Media',
          title: 'Turn on Stories and Reels',
          detail: 'On the Social card, mark Stories and Reels once you are running both regularly, and set your content mix.' },
        { kind: 'action', target: 't-this-week', targetLabel: 'This Week',
          title: 'Post 12 or more a month',
          detail: 'Run the 3-1-1 mix, five posts a week: three experience, one promo, one community. Log your monthly posts in This Week.' },
        { kind: 'action', target: 't-presence', targetLabel: 'Social Media',
          title: 'Hold engagement at 2 percent or higher',
          detail: 'Lead with experience content, a 60-second walkthrough of a busy night. Log your engagement rate on the card.' },
        { kind: 'action', target: 't-this-week', targetLabel: 'This Week',
          title: 'Log the numbers every Monday',
          detail: 'In This Week, log profile visits and posts, not likes.' },
        { kind: 'reference', target: 'Social_Content_Brief.pdf', targetLabel: 'Social Content Calendar',
          title: 'Run on a content calendar',
          detail: 'Plan the month: three experience, one promo, one community. Lead with experience, a busy-night video beats a polished promo.' },
        { kind: 'reference', target: 'Social_Media_Content_Standards.docx', targetLabel: 'Social Standards Policy',
          title: 'Hold the Sunday review',
          detail: 'Go through the week\'s captured content, pick five, schedule them, and flag one to cross-post to your Google profile.' }
      ]
    },

    commonMistakes: [
      'Post mostly promo graphics. Lead with experience content, that is what pulls new guests.',
      'Go dark after 30 days. Posting compounds, hold it 90.',
      'Push the same post to every platform without reformatting it.',
      'Never show the inside of the bar in video. Photos show what to order, video shows the feel.',
      'Chase followers and likes. Track profile visits and link clicks instead.'
    ]
  },

  {
    id: 'delivery',
    name: 'Delivery Platforms',
    module: 'traffic',
    summary: 'A delivery listing is a storefront most operators never check. Price it for the commission and keep it current.',

    process: {
      steps: [
        { kind: 'action', target: 't-presence', targetLabel: 'Delivery Platforms',
          title: 'Get every active listing complete',
          detail: 'On the Delivery card, for each active platform check menu complete, promo active, and menu synced to in-house.' },
        { kind: 'action', target: 't-presence', targetLabel: 'Delivery Platforms',
          title: 'Hold every rating at 4.5 or higher',
          detail: 'Log each active platform\'s rating on the card. Answer platform reviews with your Google standard, never blaming the platform or driver.' },
        { kind: 'action', target: 't-this-week', targetLabel: 'This Week',
          title: 'Log orders and volume every Monday',
          detail: 'In This Week, log delivery orders and average order value.' },
        { kind: 'reference', target: 'Delivery_Platform_Comparison.docx', targetLabel: 'Delivery Platform Comparison',
          title: 'Decide which platforms earn the commission',
          detail: 'Compare commission, average ticket, reach, and effort per platform, then add, drop, or refocus before you sink more work in.' },
        { kind: 'reference', target: 'Online_Menu_Audit.pdf', targetLabel: 'Delivery Menu Builder',
          title: 'Curate the delivery menu',
          detail: 'A tight subset, not the whole menu. Recalculate every item\'s margin at the commission rate and pull anything under 15%.' }
      ]
    },

    commonMistakes: [
      'Run photos of discontinued items. Reshoot to the current menu.',
      'Leave platform hours wrong when kitchen hours change. Match them exactly.',
      'List every in-house item. Keep a tight subset that travels and holds margin.',
      'Ignore platform reviews. Same response standard as Google.',
      'Add a third platform before the first two are clean.'
    ]
  },

  {
    id: 'email-loyalty',
    name: 'Email Marketing',
    module: 'traffic',
    summary: 'Email is the one channel where you own the audience.',

    process: {
      steps: [
        { kind: 'action', target: 't-presence', targetLabel: 'Email Marketing',
          title: 'Turn on a list-growth mechanism',
          detail: 'On the Email card, set how new contacts get added: POS, a table card, WiFi sign-in, online checkout, or a QR code.' },
        { kind: 'action', target: 't-presence', targetLabel: 'Email Marketing',
          title: 'Set a monthly-or-better send frequency',
          detail: 'Set your frequency on the card. One a month is the floor, more than two and unsubscribes climb.' },
        { kind: 'action', target: 't-this-week', targetLabel: 'This Week',
          title: 'Hold open rate at 20 percent or higher',
          detail: 'In This Week, log list size, sends, and open rate each Monday.' },
        { kind: 'action', target: 't-this-week', targetLabel: 'This Week',
          title: 'Send every month',
          detail: 'Send on a steady monthly rhythm and log each send in This Week.' },
        { kind: 'reference', target: 'Email_Campaign_Templates.docx', targetLabel: 'Email Campaign Templates',
          title: 'Set up the three campaigns',
          detail: 'Build the welcome sequence, the monthly update, and the event announcement. Stand up the welcome sequence before you collect a single address. Write owner voice: "I wanted to tell you", not "We are thrilled to announce".' },
        { kind: 'reference', target: 'Guest_Email_Capture.pdf', targetLabel: 'Email List Building Playbook',
          title: 'Build the list at every contact point',
          detail: 'Capture at the POS, table cards, WiFi, events, and a QR code. Activate two points at a time so each gets set up right.' }
      ]
    },

    commonMistakes: [
      'Collect addresses and never send. A list that hears nothing within 30 days goes cold.',
      'Send too rarely, then too often. One a month is the floor, hold the rhythm.',
      'Write in marketing voice. "I wanted to tell you", not "We are thrilled to announce".',
      'Skip the welcome sequence. It is the highest-opened email you send.',
      'Send the whole list one message. Regulars and new guests convert off different ones.'
    ]
  }

];
