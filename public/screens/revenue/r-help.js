'use strict';
S.RevenueHelp = {
  render(container, actions) {
    const faqs = [
      { q: 'What is RPLH and why does it matter?', a: 'Revenue Per Labor Hour. Divide total revenue by total labor hours worked in a shift or daypart. It tells you how efficiently your labor is generating revenue. A low RPLH means you are overstaffed relative to your volume. Set your target by daypart in Settings.' },
      { q: 'How often should I enter This Week data?', a: 'Every week, ideally within 1 to 2 days of your period end. Consistency is what makes the trends meaningful. The system is designed for a 15-minute weekly entry.' },
      { q: 'What is a good check average target?', a: 'It depends on your concept. Full service restaurants typically target $35 to $55. Bar-heavy operations often see $25 to $40. Set your target based on your current average plus a realistic improvement goal, not an industry number that does not fit your concept.' },
      { q: 'What does the Menu Engineering matrix show?', a: 'It plots every menu item on two axes: contribution margin (horizontal) and weekly covers (vertical). Stars are high margin and high volume — your best items. Plowhorses are high volume but low margin — candidates for a price increase. Puzzles are high margin but low volume — need promotion. Dogs are low on both — candidates for removal.' },
      { q: 'How is the server performance spread calculated?', a: 'The spread is the difference between your top server check average and your bottom server check average. A spread under $10 indicates a consistent team with a standard being enforced. A spread over $20 indicates no coaching process and significant revenue being left on the table by the bottom performers.' },
      { q: 'How does the Labor Budget calculator work?', a: 'It takes last week\'s revenue for each department, multiplies by your labor target percentage, and divides by your average hourly wage to give you the maximum schedulable hours before you write the schedule. Use it on schedule day to set your hour budget before you start filling in names.' },
      { q: 'How do I use Events and Catering?', a: 'Log every inquiry, proposal, and completed event in the Pipeline tab. Build your rate card in the Rate Card tab so you stop verbal quoting. Use the Catering Calculator to build per-head pricing on the fly when quoting a new booking.' },
      { q: 'What is the Revenue Audit?', a: 'A monthly scored PDF report covering menu engineering, labor efficiency, server performance, check average trends, and event revenue. Upload your POS reports and labor data and the audit generates automatically. One audit per month is included in your Revenue Recovery subscription.' },
    ];

    const items = faqs.map((f, i) =>
      '<div style="border-bottom:1px solid var(--b2);padding:14px 0;">'
      + '<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:6px;cursor:pointer;" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'none\'?\'block\':\'none\'">' + esc(f.q) + '</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.7;display:none;">' + esc(f.a) + '</div>'
      + '</div>'
    ).join('');

    container.innerHTML = '<div class="screen"><div class="card">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:14px;">Help and FAQ</div>'
      + items
      + '</div></div>';
  }
};
