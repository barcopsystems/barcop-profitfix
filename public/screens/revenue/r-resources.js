'use strict';
S.RevenueResources = {
  CATEGORIES: [
    {
      title: 'Daily Service',
      icon: '🎯',
      desc: 'Use these every shift to drive upsells and monitor table performance.',
      items: [
        { num: '01', type: 'PDF', title: 'Pre-Shift Upsell Briefing', desc: 'Structured pre-shift huddle guide covering featured items, upsell targets, server goals, and manager sign-off.', file: 'PreShift_Upsell_Briefing.pdf' },
        { num: '02', type: 'PDF', title: 'Table Visit Audit', desc: 'Manager observation form tracking upsell attempts, timing, guest engagement, and check average by server.', file: 'Table_Visit_Audit.pdf' },
      ]
    },
    {
      title: 'Menu & Pricing',
      icon: '📋',
      desc: 'Audit your menu mix and keep pricing aligned with your revenue targets.',
      items: [
        { num: '03', type: 'PDF', title: 'Menu Engineering Audit', desc: 'Item-by-item popularity vs. profitability matrix. Identifies stars, plowhorses, puzzles, and dogs across every category.', file: 'Menu_Engineering_Audit.pdf' },
        { num: '04', type: 'PDF', title: 'Quarterly Pricing Review', desc: 'Structured review of pricing vs. food cost, competitive positioning, and margin by category. Run every 90 days.', file: 'Quarterly_Pricing_Review.pdf' },
        { num: '05', type: 'DOC', title: 'Catering Services Menu & Pricing', desc: 'Full catering menu template with per-person pricing, minimums, package tiers, and add-on pricing structure.', file: 'Catering_Services_Menu_Pricing.docx' },
      ]
    },
    {
      title: 'Events & Catering',
      icon: '🎪',
      desc: 'Site inspections, event execution, and delivery logistics.',
      items: [
        { num: '06', type: 'PDF', title: 'Private Dining Site Inspection', desc: 'Pre-event walkthrough checklist covering room setup, A/V, staffing, timeline, and client confirmation sign-off.', file: 'Private_Dining_Site_Inspection.pdf' },
        { num: '07', type: 'PDF', title: 'Catering Delivery & Setup', desc: 'On-site delivery logistics form covering load-out checklist, setup sequence, equipment, and client acceptance sign-off.', file: 'Catering_Delivery_Setup.pdf' },
        { num: '08', type: 'PDF', title: 'Event Day Operations', desc: 'Day-of execution checklist for staffing, timeline, service flow, breakdown, and post-event documentation.', file: 'Event_Day_Operations.pdf' },
        { num: '09', type: 'DOC', title: 'Private Dining & Events Package', desc: 'Client-facing private dining proposal template with room options, menus, minimums, deposit terms, and contract language.', file: 'Private_Dining_Events_Package.docx' },
      ]
    },
    {
      title: 'Labor & Growth Planning',
      icon: '📊',
      desc: 'Track labor efficiency and build your 90-day revenue roadmap.',
      items: [
        { num: '10', type: 'PDF', title: 'Weekly Labor Review', desc: 'Sales-per-labor-hour analysis by shift and position. Compare actual vs. scheduled vs. target RPLH week over week.', file: 'Weekly_Labor_Review.pdf' },
        { num: '11', type: 'DOC', title: '30/90-Day Revenue Growth Roadmap', desc: '30/60/90-day milestone tracker with weekly revenue targets, upsell goals, event pipeline, and quarterly review structure.', file: '30_90Day_Revenue_Growth_Roadmap.docx' },
      ]
    },
    {
      title: 'Staff Standards & Scripts',
      icon: '📄',
      desc: 'Print, customize, and train. File a copy in every server record.',
      items: [
        { num: '12', type: 'DOC', title: 'Server Upsell Standards & Scripts', desc: 'Word-for-word upsell scripts by course, suggestive selling standards, table minimum language, and server certification checklist.', file: 'Server_Upsell_Standards_Scripts.docx' },
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
          + `<div style="font-size:12px;font-weight:700;color:var(--t1);margin-bottom:3px;">Doc ${item.num} — ${esc(item.title)}</div>`
          + `<div style="font-size:11px;color:var(--t3);line-height:1.5;">${esc(item.desc)}</div>`
          + `</div>`
          + `<a href="assets/resources/revenue/${encodeURIComponent(item.file)}" download="${item.file}" style="flex-shrink:0;display:inline-flex;align-items:center;gap:5px;background:transparent;border:1px solid var(--b1);border-radius:3px;color:var(--t2);font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:5px 10px;text-decoration:none;white-space:nowrap;transition:all 0.1s;" onmouseover="this.style.borderColor='rgba(255,255,255,0.28)';this.style.color='#fff'" onmouseout="this.style.borderColor='var(--b1)';this.style.color='var(--t2)'">`
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
