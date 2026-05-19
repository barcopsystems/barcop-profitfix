'use strict';
S.TrafficResources = {
  CATEGORIES: [
    {
      title: 'Google Business Profile',
      icon: '🔍',
      desc: 'Claim, complete, and optimize your GBP listing to rank in the Maps Pack.',
      items: [
        { num: '01', type: 'PDF', title: 'GBP Optimization Checklist', desc: 'Step-by-step checklist to fully claim, complete, and optimize your Google Business Profile listing. Covers categories, attributes, photos, posts, and Q&A setup.', file: 'GBP_Optimization_Checklist.pdf' },
        { num: '02', type: 'PDF', title: 'Review Request Script', desc: 'Word-for-word verbal scripts for requesting Google reviews from satisfied guests. Includes table card template and QR code placement guide.', file: 'Review_Request_Script.pdf' },
        { num: '03', type: 'DOC', title: 'Review Response Templates', desc: 'Ready-to-use response templates for positive reviews, negative reviews by category, and responses to no-comment ratings. Customize with your bar name and voice.', file: 'Review_Response_Templates.docx' },
      ]
    },
    {
      title: 'Reputation Management',
      icon: '⭐',
      desc: 'Grow your rating, increase review velocity, and respond to every review.',
      items: [
        { num: '04', type: 'PDF', title: 'Review Velocity Tracker', desc: 'Weekly tracking sheet for new reviews by platform. Tracks total count, new reviews, star distribution, and response rate against your monthly target.', file: 'Review_Velocity_Tracker.pdf' },
        { num: '05', type: 'DOC', title: '30-Day Reputation Recovery Plan', desc: 'Day-by-day action plan for operations with a Google rating below 4.0. Covers response strategy, review generation, and operational changes that directly impact rating.', file: '30Day_Reputation_Recovery_Plan.docx' },
      ]
    },
    {
      title: 'Website and SEO',
      icon: '🌐',
      desc: 'Make your website convert visitors and rank for local search terms.',
      items: [
        { num: '06', type: 'PDF', title: 'Restaurant Website Audit Form', desc: 'Page-by-page website audit covering mobile optimization, menu page structure, calls to action, page load speed, and NAP consistency across all pages.', file: 'Restaurant_Website_Audit_Form.pdf' },
        { num: '07', type: 'PDF', title: 'NAP Consistency Audit', desc: 'Spreadsheet-style audit form for checking your business name, address, and phone number across Google, Yelp, TripAdvisor, delivery platforms, and top 10 local directories.', file: 'NAP_Consistency_Audit.pdf' },
        { num: '08', type: 'DOC', title: 'Local SEO Quick-Start Guide', desc: 'Plain-English guide to local SEO for bars and restaurants. Covers GBP optimization, citation building, website title tags, and keyword targeting for local search.', file: 'Local_SEO_Quick_Start_Guide.docx' },
      ]
    },
    {
      title: 'Social Media',
      icon: '📱',
      desc: 'Build a consistent posting system that drives discovery and repeat visits.',
      items: [
        { num: '09', type: 'PDF', title: 'Social Content Calendar', desc: '4-week content calendar template with daily posting slots, content category suggestions, caption prompts, and hashtag strategy for Instagram and Facebook.', file: 'Social_Content_Calendar.pdf' },
        { num: '10', type: 'DOC', title: 'Social Media Standards Policy', desc: 'Internal policy document covering posting frequency standards, image quality requirements, caption tone guidelines, response time targets, and approval workflow for staff posts.', file: 'Social_Media_Standards_Policy.docx' },
      ]
    },
    {
      title: 'Delivery Platforms',
      icon: '🛵',
      desc: 'Optimize your third-party delivery listings to rank higher and convert better.',
      items: [
        { num: '11', type: 'PDF', title: 'Delivery Platform Audit Checklist', desc: 'Platform-by-platform audit form for DoorDash, UberEats, and Grubhub. Checks photo coverage, menu completeness, description quality, pricing accuracy, and promotional status.', file: 'Delivery_Platform_Audit_Checklist.pdf' },
      ]
    },
    {
      title: 'Email and Growth Planning',
      icon: '📧',
      desc: 'Build your email list and plan your 90-day digital presence roadmap.',
      items: [
        { num: '12', type: 'PDF', title: 'Email List Building Playbook', desc: 'Seven proven list-building tactics for bars and restaurants. Covers POS capture, table cards, WiFi sign-in, event registration, loyalty program integration, and QR code placement.', file: 'Email_List_Building_Playbook.pdf' },
        { num: '13', type: 'DOC', title: '90-Day Digital Traffic Growth Roadmap', desc: '30/60/90-day milestone tracker for digital presence recovery. Weekly targets for review count, GBP optimization tasks, social posts, website sessions, and email list growth.', file: '90Day_Digital_Traffic_Growth_Roadmap.docx' },
      ]
    },
  ],

  render(container, actions) {
    let html = '<div class="screen">'
      + `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(440px,1fr));gap:16px;">`;

    this.CATEGORIES.forEach(cat => {
      html += '<div class="card" style="margin-bottom:0;">'
        + `<div style="margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--b2);">`
        + `<div style="font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:var(--w);margin-bottom:3px;">${esc(cat.title)}</div>`
        + `<div style="font-size:11px;color:var(--t3);">${esc(cat.desc)}</div></div>`;

      cat.items.forEach(item => {
        const isPdf = item.type === 'PDF';
        const typeColor = isPdf ? '#C03828' : '#C9A84C';
        html += `<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.03);">`
          + `<div style="flex-shrink:0;margin-top:2px;">`
          + `<span style="display:inline-block;font-size:8px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:3px 6px;border-radius:3px;background:${isPdf?'rgba(192,56,40,0.12)':'rgba(201,168,76,0.10)'};color:${typeColor};">${item.type}</span>`
          + `</div>`
          + `<div style="flex:1;min-width:0;">`
          + `<div style="font-size:12px;font-weight:700;color:var(--t1);margin-bottom:3px;">Doc ${item.num}: ${esc(item.title)}</div>`
          + `<div style="font-size:11px;color:var(--t3);line-height:1.5;">${esc(item.desc)}</div>`
          + `</div>`
          + `<a href="assets/resources/traffic/${encodeURIComponent(item.file)}" download="${item.file}" style="flex-shrink:0;display:inline-flex;align-items:center;gap:5px;background:transparent;border:1px solid var(--b1);border-radius:3px;color:var(--t2);font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:5px 10px;text-decoration:none;white-space:nowrap;transition:all 0.1s;" onmouseover="this.style.borderColor='rgba(255,255,255,0.28)';this.style.color='#fff'" onmouseout="this.style.borderColor='var(--b1)';this.style.color='var(--t2)'">`
          + `<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 1v6M2.5 5l3 3 3-3M1 9.5h9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`
          + `Download</a>`
          + `</div>`;
      });

      html += '</div>';
    });

    html += '</div></div>';
    container.innerHTML = html;
  }
};
