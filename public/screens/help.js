'use strict';
S.Help = {
  render(container) {
    const sections = [
      {t:'Getting Started', qa:[
        {q:'Where do I start?', a:'Go to Getting Started in the sidebar. It walks you through the 4-week setup in order. Start by setting your cost targets on the Profit Recovery dashboard, then set up your Bar Products, and enter your first week of data in This Week. Once you have 4 weeks of data the dashboard and all calculations are fully populated.'},
        {q:'What is the Profit Audit and when should I request it?', a:'The Profit Audit is a comprehensive scored analysis of your bar\'s profit systems. Request your first audit in Week 1. It acts as your baseline before you start making changes. After 30 days of using the app, request a second audit and it will automatically include all your tracked data for a much deeper analysis. After that, one audit per month is included with your subscription.'},
        {q:'Do I need to use every section?', a:'No. Start with Bar Products, Settings, and This Week. Add recipes, vendor watch, cash reconciliation, and shift check as you build the habit. The audit works with whatever data you have. More data submitted means more sections scored and more specific action items.'}
      ]},
      {t:'Bar Products', qa:[
        {q:'What is Standard Pour?', a:'The amount you pour per drink in ounces. Spirits are typically 1.25 to 1.5 oz. Wine by the glass is typically 5 oz. Draft beer is typically 14 to 16 oz. This number drives pour cost %, cost per pour, and the weekly variance calculation.'},
        {q:'What is Pour Cost %?', a:'Cost Per Pour divided by Menu Price. At 22% pour cost, every dollar of bar revenue costs 22 cents in product. Industry benchmark for spirits is 18 to 22%. If your blended pour cost consistently runs above 25%, investigate pour standards, recipe coverage, and inventory variance.'},
        {q:'What does Incomplete mean on a product?', a:'The product is missing one or more required fields: container size, standard pour, unit cost, or menu price. Incomplete products cannot calculate pour cost or contribute to variance. Click Edit to see which fields are highlighted in red.'},
        {q:'Can I import products from my POS?', a:'Yes. Click Import on the Bar Products or Kitchen Products screen and upload a CSV or Excel file exported from your POS system. The app auto-detects your column names and lets you match them to the right fields. Products import instantly. Any missing data shows as Incomplete and can be filled in afterwards.'}
      ]},
      {t:'Importing Products', qa:[
        {q:'How does the product import work?', a:'Click the Import button on Bar Products or Kitchen Products. Upload a CSV or Excel file from your POS item export, a spreadsheet you already maintain, or your distributor order guide. The app reads your column headers and shows a mapping screen where you match each column to the right field. You confirm the mapping, click Import, and all products load instantly. Any product missing required data shows as Incomplete in red and you fill those in one at a time.'},
        {q:'What columns does my file need?', a:'Only the product name column is truly required. Everything else is optional. The app auto-detects columns named Item, Name, Product, or Description for the name. It also recognizes Category, Vendor, Supplier, Size, Container, Pour, Cost, Unit Cost, Price, and Menu Price by common variations. If your column names are different you correct them on the mapping screen before importing.'},
        {q:'Where do I export my product list from my POS?', a:'Toast: Menu then Menu Items then Export. Square: Items then Item Library then Export CSV. Lightspeed: Menu then Products then Export. Aloha: Maintenance then Menu then Items then Export. If your POS does not have a clean export, your distributor portal is often a better source. Sysco, US Foods, and PFG all have downloadable order guides in Excel that work well as a starting product list.'},
        {q:'What file formats work?', a:'CSV and Excel (.xlsx or .xls). The first row of your file must be column headers. The app uses those to identify which column is which. Do not use files where the first row is a title or report name with the headers in row 2.'},
        {q:'What happens to products that are missing cost or pour size?', a:'They import successfully but are marked Incomplete in red. The product name appears, the category and vendor fill in if you had those columns, but the pour cost calculation stays blank until you add the missing fields.'}
      ]},
      {t:'Importing Weekly Inventory and Variance Data', qa:[
        {q:'What can I import on the This Week steps?', a:'Three import buttons exist in the weekly data entry. Bar Inventory Count (Step 4) accepts your physical count sheet. Bar Variance (Step 5) accepts your POS sales mix report to auto-fill pours sold. Food Inventory Count (Step 6) accepts your kitchen count sheet. All three work the same way: upload, the app matches product names, fills in the numbers, and you review the result.'},
        {q:'How does name matching work when my count sheet has different names than my products?', a:'The app strips size descriptors like 750ml, 1.75L, 12oz, and case, then compares the core brand name. TITOS VODKA 750ML matches Titos Handmade Vodka. MODELO ESPECIAL 12PK matches Modelo Especial. After import the status message tells you how many matched and lists anything that did not match so you can fill those in manually.'},
        {q:'What file do I use for Step 5 Bar Variance POS Sales?', a:'Your POS Item Sales Report, Sales Mix, or Product Mix for the week. Toast: Reports then Menu then Item Selection Report. Square: Reports then Item Sales. Aloha: Reports then Sales then Product Mix. Lightspeed: Reports then Sales then Sales by Item.'}
      ]},
      {t:'This Week', qa:[
        {q:'What is Bar Revenue?', a:'Total bar sales for the week from your POS: spirits, beer, wine, and non-alcoholic. Pull from your POS end-of-week summary report.'},
        {q:'What is Bar COGS?', a:'Cost of Goods Sold. What you spent on bar product this week. Use your beverage invoice totals for the week, plus any product transferred in, minus any transferred out.'},
        {q:'How does variance work?', a:'Variance is the difference between pours made from your inventory count and pours sold from your POS. The app converts bottles used into pours automatically using the standard pour you set in Bar Products. Near zero variance means product and sales are aligned. Positive variance means more product left inventory than was rung in. Investigate over-pouring or theft.'}
      ]},
      {t:'Shift Check', qa:[
        {q:'What is Shift Check for?', a:'A fast daily spot-check that takes under 60 seconds. Enter shift revenue and COGS from your POS and you immediately see the shift pour cost and whether it is on target. Running this daily catches problems before they compound into a full week of loss.'},
        {q:'What is Shift COGS?', a:'The bar product cost for that specific shift: spirits, beer, and wine only. Do not include labor. Estimate from your weekly invoices divided by number of shifts, or use your POS cost report if available.'}
      ]},
      {t:'Theft Risk', qa:[
        {q:'What is the Theft Risk Scorecard?', a:'A scored assessment of your bar\'s internal control environment. It covers 10 areas including cash handling, pour accountability, POS discipline, and management oversight. Each area is scored 0 to 10. Your total score tells you how exposed your operation is right now.'},
        {q:'How often should I run the scorecard?', a:'Run it in Week 1 to establish your baseline. After that, run it once a month or any time you make significant changes to your controls, hire a new bartender, or see unexplained variance show up in your weekly numbers.'},
        {q:'What score should I be aiming for?', a:'70 and above means your control environment is reasonably solid. Below 50 means you have real exposure. The scorecard tells you exactly which areas are dragging your score down so you know where to focus first.'}
      ]},
      {t:'Cash Reconciliation', qa:[
        {q:'What is Cash Reconciliation for?', a:'Tracks whether your cash drawers are coming up short or over at end of shift. Enter expected cash from your POS, actual cash counted, and credit card deposits. The app calculates the variance and flags anything outside your tolerance. Patterns across shifts or employees are often more telling than any single entry.'},
        {q:'What is Opening Bank?', a:'The cash float placed in the drawer at the start of the shift. Not revenue. The starting change fund. It should not be counted as part of cash sales for the shift.'},
        {q:'What is the tolerance?', a:'The maximum dollar amount you consider acceptable for a drawer to be off. Set in Settings, defaults to $10. Within tolerance shows as OK in gold. Outside tolerance shows red. Consistent patterns on the same employee are worth investigating regardless of the tolerance setting.'}
      ]},
      {t:'Reports and History', qa:[
        {q:'What does the weekly history show?', a:'Every week you have entered, sorted newest first. Click any week to see the full breakdown: bar and food revenue, COGS, labor, pour cost, food cost, prime cost, and variance by product.'},
        {q:'What is the Annual Cost Calculator?', a:'Enter your annual revenue and current vs target cost percentages to see the annual dollar gap and what closing it is worth monthly and weekly. Pre-fills from your Settings data. Use it when presenting the business case for operational changes.'}
      ]},
      {t:'Profit Audit', qa:[
        {q:'How does the audit work?', a:'You upload your POS reports and any other data files you have. The app reads all submitted documents and produces a full scored PDF audit report with no waiting and no manual work. The report scores up to 6 sections depending on what data you submit. More data submitted means more sections scored and more specific action items.'},
        {q:'What is the minimum data needed for an audit?', a:'Your POS Beverages sales report for a minimum of 4 weeks. That alone produces a Tier 1 audit scoring the revenue and cost baseline sections. Every additional file you upload unlocks more scored sections.'},
        {q:'When should I request my first audit?', a:'Request your first audit as soon as you sign up, before you change anything. This becomes your baseline score. After 30 days of using the app and entering data, request your second audit. The app automatically includes all your tracked weekly data, products, variance, and vendor logs, making it significantly more detailed.'},
        {q:'How often can I request an audit?', a:'One audit per month, available at the start of each billing cycle. The countdown on the Profit Audit screen shows how many days until your next audit is available.'},
        {q:'How do I download my audit PDF?', a:'Click the Download PDF button on the Latest Audit card. The PDF generates directly in your browser with no email and no waiting. All past audits are also available for download in the Audit History table.'}
      ]},
      {t:'Settings', qa:[
        {q:'What targets should I set?', a:'Bar Pour Cost: 22% is the standard industry target for full-service operations. Food Cost: 32% for full-service, lower for bar-heavy concepts. Prime Cost: 60% or below is the target for sustainable profitability. Labor targets depend heavily on your concept. 28 to 30% for bar labor is common. Adjust all targets to match your specific operation and ownership goals.'},
        {q:'How do I change my password?', a:'Go to Settings, scroll to the Account section, enter your new password twice, and click Update Password. Password must be at least 8 characters.'},
        {q:'What does Load Sample Data do?', a:'Populates every section of the app with realistic sample data: 10 bar products, 10 kitchen products, 7 recipes, 8 weeks of weekly data, 14 shift checks, 10 cash reconciliation entries, vendor log entries, theft scorecards, and two sample audit reports with downloadable PDFs. Use it to see every screen populated before entering your own data.'},
        {q:'What does Clear All Data do?', a:'Wipes all your data and resets the app to empty, keeping only your settings and targets. Use this when you are done testing with sample data and ready to start entering your real numbers.'}
      ]},
      {t:'Getting Started Checklist', qa:[
        {q:'What is the Getting Started checklist?', a:'A 4-week guided setup that tells you exactly what to do in what order to get the full value of the app. Each task links directly to the relevant screen. Check off tasks as you complete them and progress is saved automatically.'},
        {q:'Do I have to follow the checklist in order?', a:'No, but the order is intentional. Products and targets need to be set up before weekly data means anything. Weekly data needs to exist before the dashboard and variance are useful. The checklist reflects the dependency chain so each step builds on the one before it.'}
      ]}
    ];

    const html = sections.map(sec =>
      '<div class="card" style="margin-bottom:12px;">'
      + '<div class="card-title">' + esc(sec.t) + '</div>'
      + sec.qa.map(item =>
        '<div style="margin-bottom:14px;">'
        + '<div style="font-size:12px;font-weight:700;color:var(--t1);margin-bottom:5px;">' + esc(item.q) + '</div>'
        + '<div style="font-size:12px;color:var(--t2);line-height:1.7;">' + esc(item.a) + '</div>'
        + '</div>'
      ).join('')
      + '</div>'
    ).join('');

    container.innerHTML = '<div class="screen">' + html + '</div>';
  }
};
