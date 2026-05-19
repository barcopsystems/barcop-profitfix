'use strict';
S.Resources = {
  CATEGORIES: [
    {
      title: 'Daily Operations',
      icon: '📋',
      desc: 'Use these every shift. Print and post at each station.',
      items: [
        { num: '01', type: 'PDF', title: 'Opening Bar Checklist', desc: 'Bottle counts, station setup, pour standard verification, cleanliness sign-off.', file: 'Opening_Bar_Checklist.pdf' },
        { num: '02', type: 'PDF', title: 'Closing Bar Checklist', desc: 'End-of-shift bottle counts, lockup, waste documentation, bar breakdown.', file: 'Closing_Bar_Checklist.pdf' },
        { num: '03', type: 'PDF', title: 'Shift Audit Form', desc: 'Till count, comp and void review, manager observation log. Run at least once per week.', file: 'Shift_Audit_Form.pdf' },
        { num: '04', type: 'PDF', title: 'Daily Food Waste Tracking Sheet', desc: 'Log every spill, drop, spoilage, and overproduction with reason codes and dollar values.', file: 'Daily_Food_Waste_Tracking.pdf' },
      ]
    },
    {
      title: 'Inventory & Vendor Control',
      icon: '📦',
      desc: 'Receiving, inspection, and discrepancy tracking.',
      items: [
        { num: '05', type: 'PDF', title: 'Vendor Delivery Inspection Form', desc: 'Item-by-item delivery count, price verification, condition check, receiving sign-off.', file: 'Vendor_Delivery_Inspection.pdf' },
        { num: '06', type: 'PDF', title: 'Vendor Delivery Discrepancy Report', desc: 'Document short shipments, price disputes, wrong items, damaged goods.', file: 'Vendor_Delivery_Discrepancy.pdf' },
        { num: '07', type: 'PDF', title: 'Portion Control Audit Form', desc: 'Unannounced spot-check of actual vs. standard portions by station. Pass = within 10%.', file: 'Portion_Control_Audit.pdf' },
        { num: '08', type: 'DOC', title: 'Vendor Agreement Terms Checklist', desc: 'Pricing, substitution policy, delivery standards, credit memos, annual review. Use at every vendor onboarding.', file: 'Vendor_Agreement_Terms_Checklist.docx' },
      ]
    },
    {
      title: 'Weekly & Monthly Reviews',
      icon: '📊',
      desc: 'Track your numbers week over week.',
      items: [
        { num: '09', type: 'PDF', title: 'Weekly P&L Snapshot Form', desc: 'Sales, COGS, labor, prime cost. Complete every Monday morning from last week\'s POS data.', file: 'Weekly_PL_Snapshot.pdf' },
        { num: '10', type: 'PDF', title: '30-Day Implementation Review Form', desc: 'Week-by-week checkpoint for the first 30 days. Documents wins, gaps, and blockers.', file: '30Day_Implementation_Review.pdf' },
        { num: '11', type: 'DOC', title: 'Monthly Cost Control Review Agenda', desc: 'Four-week prime cost review, section-by-section findings, action items with owners and due dates.', file: 'Monthly_Cost_Control_Review_Agenda.docx' },
        { num: '12', type: 'DOC', title: '90-Day Cost Control Roadmap', desc: '30/60/90-day milestones, quarterly review structure, and annual planning template.', file: '90Day_Cost_Control_Roadmap.docx' },
      ]
    },
    {
      title: 'Policies & Staff Documents',
      icon: '📄',
      desc: 'Print, customize, sign. File a copy in every employee record.',
      items: [
        { num: '13', type: 'DOC', title: 'Measured Pour Standards Policy', desc: 'Pour standards by spirit category, free-pour prohibition, calibration test requirements, enforcement and consequences.', file: 'Measured_Pour_Standards_Policy.docx' },
        { num: '14', type: 'DOC', title: 'Bar Inventory Procedures Manual', desc: 'Who counts, when, how, variance thresholds, investigation process, sign-off requirements.', file: 'Bar_Inventory_Procedures_Manual.docx' },
        { num: '15', type: 'DOC', title: 'Theft & Loss Prevention Policy', desc: 'Defined violations, documentation requirements, investigation process, disciplinary procedures, termination language.', file: 'Theft_Loss_Prevention_Policy.docx' },
        { num: '16', type: 'DOC', title: 'Employee Corrective Action Template', desc: 'Written warning form for cost control violations. Includes violation type, incident description, corrective action, and signatures.', file: 'Employee_Corrective_Action_Template.docx' },
        { num: '17', type: 'DOC', title: 'Food Handling & Portion Standards Guide', desc: 'Portioning standards table, prep standards by station, temperature requirements, waste documentation, staff sign-off.', file: 'Food_Handling_Portion_Standards.docx' },
      ]
    }
  ],

  render(container, actions) {
    const totalFiles = this.CATEGORIES.reduce((s, c) => s + c.items.length, 0);
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
          + `<a href="assets/resources/${encodeURIComponent(item.file)}" download="${item.file}" style="flex-shrink:0;display:inline-flex;align-items:center;gap:5px;background:transparent;border:1px solid var(--b1);border-radius:3px;color:var(--t2);font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:5px 10px;text-decoration:none;white-space:nowrap;transition:all 0.1s;" onmouseover="this.style.borderColor='rgba(255,255,255,0.28)';this.style.color='#fff'" onmouseout="this.style.borderColor='var(--b1)';this.style.color='var(--t2)'">`
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
