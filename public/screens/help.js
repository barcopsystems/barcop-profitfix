'use strict';
S.Help = {
  render(container) {
    const sections = [
      {t:'Getting Started', qa:[
        {q:'Where do I start?', a:'Go to Getting Started in the sidebar. It walks you through the 4-week setup in order. The short version: set your cost targets on the dashboard first, then set up your Bar Products, enter your cost targets in Settings, and enter your first week of data in This Week. Once you have 4 weeks of data the dashboard and all calculations are fully populated.'},
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
        {q:'What if my product names in the file are different from what I want in the app?', a:'The import uses your file names as-is. After importing you can edit any product name by clicking Edit on that row. If your POS uses abbreviated names like TITOS 750 you can import them all and then rename the ones that matter, or just leave them as-is since name matching during weekly inventory import handles abbreviations automatically.'},
        {q:'Where do I export my product list from my POS?', a:'Toast: Menu then Menu Items then Export. Square: Items then Item Library then Export CSV. Lightspeed: Menu then Products then Export. Aloha: Maintenance then Menu then Items then Export. If your POS does not have a clean export, your distributor portal is often a better source. Sysco, US Foods, and PFG all have downloadable order guides in Excel that work well as a starting product list.'},
        {q:'What file formats work?', a:'CSV and Excel (.xlsx or .xls). The first row of your file must be column headers. The app uses those to identify which column is which. Do not use files where the first row is a title or report name with the headers in row 2.'},
        {q:'What happens to products that are missing cost or pour size?', a:'They import successfully but are marked Incomplete in red. The product name appears, the category and vendor fill in if you had those columns, but the pour cost calculation stays blank until you add the missing fields. The alert bar at the top of the product list shows how many products are incomplete so you have a clear to-do list after import.'}
      ]},
      {t:'Importing Weekly Inventory and Variance Data', qa:[
        {q:'What can I import on the This Week steps?', a:'Three import buttons exist in the weekly data entry. Bar Inventory Count (Step 4) accepts your physical count sheet. Bar Variance (Step 5) accepts your POS sales mix report to auto-fill pours sold. Food Inventory Count (Step 6) accepts your kitchen count sheet. All three work the same way: upload, the app matches product names, fills in the numbers, and you review the result.'},
        {q:'What file do I use for Step 4 Bar Inventory Count?', a:'Your physical bar inventory count sheet in whatever format you currently use to count bottles. The app looks for a product name column plus a Purchases or Received column and an Ending or On Hand column. Beginning inventory carries forward automatically from last week so you do not need that column. Export from your inventory system or use a spreadsheet you fill out manually during your count.'},
        {q:'How does name matching work when my count sheet has different names than my products?', a:'The app strips size descriptors like 750ml, 1.75L, 12oz, case, and compares the core brand name. TITOS VODKA 750ML matches Titos Handmade Vodka. MODELO ESPECIAL 12PK matches Modelo Especial. The match threshold is 45% similarity so it catches most common variations without creating bad matches. After import the status message tells you how many matched and lists anything that did not match so you can fill those in manually.'},
        {q:'What file do I use for Step 5 Bar Variance POS Sales?', a:'Your POS Item Sales Report, Sales Mix, or Product Mix for the week. This report shows how many of each item was sold. The app uses the quantity sold column, not the dollar amount column, to fill in Pours Sold for each product. Toast: Reports then Menu then Item Selection Report. Square: Reports then Item Sales. Aloha: Reports then Sales then Product Mix. Lightspeed: Reports then Sales then Sales by Item.'},
        {q:'My POS sales report has hundreds of items but I only have 20 bar products set up. What happens?', a:'The app only tries to match rows from your file to products that exist in your bar products list. Extra rows in the file that do not match any product are ignored. You will see how many products were updated and how many were not matched. The unmatched items are extra POS items with no corresponding product in your setup, which is expected.'},
        {q:'Can I import partial data and fill in the rest manually?', a:'Yes. Import fills in whatever it can match. Any product that did not match or was not in your file stays blank and you enter those manually in the table. Import is an accelerator, not a replacement for manual entry when needed.'},
        {q:'What file do I use for Step 6 Food Inventory Count?', a:'Your kitchen inventory count sheet. Works the same as the bar count import. Your inventory system such as MarketMan, Craftable, BlueCart, or Compeat typically has a Physical Count export. Your food distributor order history download also works as a purchases import. Save as CSV or Excel and upload.'}
      ]},
      {t:'This Week — Weekly Entry', qa:[
        {q:'What is Bar Revenue?', a:'Total bar sales for the week from your POS: spirits, beer, wine, and non-alcoholic. Pull from your POS end-of-week summary report.'},
        {q:'What is Bar COGS?', a:'Cost of Goods Sold. What you spent on bar product this week. Use your beverage invoice totals for the week, plus any product transferred in, minus any transferred out.'},
        {q:'What is the inventory count for?', a:'The count calculates actual product usage. Beginning inventory plus purchases minus ending inventory equals units used. That number is compared to what your POS says you sold to calculate variance. Count in bottles for spirits and units for beer.'},
        {q:'How does variance work?', a:'Variance is the difference between pours made from your inventory count and pours sold from your POS. The app converts bottles used into pours automatically using the standard pour you set in Bar Products. Enter pours sold from your POS sales mix report. Near zero variance means product and sales are aligned. Positive variance means more product left inventory than was rung in. Investigate over-pouring or theft.'},
        {q:'What is Pours Sold?', a:'What you enter manually from your POS sales mix report: the number of times that specific spirit was rung in during the week. Enter as individual shots or pours, not bottles.'}
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
        {q:'What is the minimum data needed for an audit?', a:'Your POS Beverages sales report for a minimum of 4 weeks. That alone produces a Tier 1 audit scoring the revenue and cost baseline sections. Every additional file you upload unlocks more scored sections. Inventory sheets unlock actual pour cost and variance. Payroll unlocks prime cost. Exception reports unlock theft risk indicators.'},
        {q:'When should I request my first audit?', a:'Request your first audit as soon as you sign up, before you change anything. This becomes your baseline score. It shows where you are starting from. After 30 days of using the app and entering data, request your second audit. The app automatically includes all your tracked weekly data, products, variance, and vendor logs in the second audit, making it significantly more detailed.'},
        {q:'How often can I request an audit?', a:'One audit per month, available at the start of each billing cycle. The countdown on the Profit Audit screen shows how many days until your next audit is available.'},
        {q:'How do I download my audit PDF?', a:'Click the Download PDF button on the Latest Audit card. The PDF generates directly in your browser with no email and no waiting. All past audits are also available for download in the Audit History table.'},
        {q:'What does the score comparison show?', a:'When you have two or more audits, the tracker shows your score change from the previous audit: overall points gained or lost, and the change per section. This is how you track whether the improvements you made between audits are showing up in the numbers.'}
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

        {q:'What is the Profit Audit and when should I request it?', a:'The Profit Audit is a comprehensive scored analysis of your bar\'s profit systems. Request your first audit in Week 1 — it acts as your baseline before you start making changes. After 30 days of using the app, request a second audit and it will automatically include all your tracked data for a much deeper analysis. After that, one audit per month is included with your subscription.'},
        {q:'Do I need to use every section?', a:'No. Start with Bar Products, Settings, and This Week. Add recipes, vendor watch, cash reconciliation, and shift check as you build the habit. The audit works with whatever data you have — more data submitted means more sections scored.'}
      ]},
      {t:'Bar Products', qa:[
        {q:'What is Standard Pour?', a:'The amount you pour per drink in ounces. Spirits are typically 1.25–1.5 oz. Wine by the glass is typically 5 oz. Draft beer is typically 14–16 oz. This number drives pour cost %, cost per pour, and the weekly variance calculation.'},
        {q:'What is Pour Cost %?', a:'Cost Per Pour divided by Menu Price. At 22% pour cost, every dollar of bar revenue costs 22 cents in product. Industry benchmark for spirits is 18–22%. If your blended pour cost consistently runs above 25%, investigate pour standards, recipe coverage, and inventory variance.'},
        {q:'What does Incomplete mean on a product?', a:'The product is missing one or more required fields — container size, standard pour, unit cost, or menu price. Incomplete products can\'t calculate pour cost or contribute to variance. Click Edit to see which fields are highlighted in red.'},
        {q:'Can I import products from my POS?', a:'Yes. Click Import on the Bar Products or Kitchen Products screen and upload a CSV or Excel file exported from your POS system. The app auto-detects your column names and lets you match them to the right fields. Products import instantly — any missing data shows as Incomplete and can be filled in afterwards.'}
      ]},
      {t:'Importing Products — Bar & Kitchen Setup', qa:[
        {q:'How does the product import work?', a:'Click the Import button on Bar Products or Kitchen Products. Upload a CSV or Excel file — your POS item export, a spreadsheet you already maintain, or your distributor order guide. The app reads your column headers and shows a mapping screen where you match each column to the right field. You confirm the mapping, click Import, and all products load instantly. Any product missing required data shows as Incomplete in red — you then fill those in one at a time.'},
        {q:'What columns does my file need?', a:'Only the product name column is truly required. Everything else is optional. The app auto-detects columns named Item, Name, Product, or Description for the name. It also recognizes Category, Vendor, Supplier, Size, Container, Pour, Cost, Unit Cost, Price, and Menu Price by common variations. If your column names are different you correct them on the mapping screen before importing.'},
        {q:'What if my product names in the file are different from what I want in the app?', a:'The import uses your file names as-is. After importing you can edit any product name by clicking Edit on that row. If your POS uses abbreviated names like TITOS 750 you can import them all and then rename the ones that matter — or just leave them as-is since name matching during weekly inventory import handles abbreviations automatically.'},
        {q:'Where do I export my product list from my POS?', a:'Toast: Menu → Menu Items → Export. Square: Items → Item Library → Export CSV. Lightspeed: Menu → Products → Export. Aloha: Maintenance → Menu → Items → Export. If your POS does not have a clean export, your distributor portal is often a better source — Sysco, US Foods, and PFG all have downloadable order guides in Excel that work well as a starting product list.'},
        {q:'What file formats work?', a:'CSV (.csv) and Excel (.xlsx or .xls). The first row of your file must be column headers — the app uses those to identify which column is which. Do not use files where the first row is a title or report name with the headers in row 2.'},
        {q:'What happens to products that are missing cost or pour size?', a:'They import successfully but are marked Incomplete in red. The product name appears, the category and vendor fill in if you had those columns, but the pour cost calculation stays blank until you add the missing fields. The alert bar at the top of the product list shows how many products are incomplete so you have a clear to-do list after import.'}
      ]},
      {t:'Importing Weekly Inventory & Variance Data', qa:[
        {q:'What can I import on the This Week steps?', a:'Three import buttons exist in the weekly data entry: Bar Inventory Count (Step 4) accepts your physical count sheet, Bar Variance (Step 5) accepts your POS sales mix report to auto-fill pours sold, and Food Inventory Count (Step 6) accepts your kitchen count sheet. All three work the same way — upload, the app matches product names, fills in the numbers, and you review the result.'},
        {q:'What file do I use for Step 4 Bar Inventory Count?', a:'Your physical bar inventory count sheet — whatever format you currently use to count bottles. The app looks for a product name column plus a Purchases or Received column and an Ending or On Hand column. Beginning inventory carries forward automatically from last week so you do not need that column. Export from your inventory system or use a spreadsheet you fill out manually during your count.'},
        {q:'How does name matching work when my count sheet has different names than my products?', a:'The app strips size descriptors like 750ml, 1.75L, 12oz, case, and compares the core brand name. TITOS VODKA 750ML matches Titos Handmade Vodka. MODELO ESPECIAL 12PK matches Modelo Especial. The match threshold is 45% similarity so it catches most common variations without creating bad matches. After import the status message tells you how many matched and lists anything that did not match so you can fill those in manually.'},
        {q:'What file do I use for Step 5 Bar Variance — POS Sales?', a:'Your POS Item Sales Report, Sales Mix, or Product Mix for the week. This report shows how many of each item was sold. The app uses the quantity sold column — not the dollar amount column — to fill in Pours Sold for each product. Export from your POS: Toast → Reports → Menu → Item Selection Report. Square → Reports → Item Sales. Aloha → Reports → Sales → Product Mix. Lightspeed → Reports → Sales → Sales by Item.'},
        {q:'My POS sales report has hundreds of items but I only have 20 bar products set up. What happens?', a:'The app only tries to match rows from your file to products that exist in your bar products list. Extra rows in the file that do not match any product are ignored. You will see "X products updated, Y not matched" — the Y not matched are the extra POS items that have no corresponding product in your setup, which is expected and not a problem.'},
        {q:'Can I import partial data and fill in the rest manually?', a:'Yes. Import fills in whatever it can match. Any product that did not match or was not in your file stays blank — you enter those manually in the table the same way you always would. Import is an accelerator, not a replacement for manual entry when needed.'},
        {q:'What file do I use for Step 6 Food Inventory Count?', a:'Your kitchen inventory count sheet. Works the same as the bar count import. Your inventory system (MarketMan, Craftable, BlueCart, Compeat) typically has a Physical Count export. Your food distributor (Sysco, US Foods, PFG) order history download also works as a purchases import. Save as CSV or Excel and upload.'}
      ]},
      {t:'This Week — Weekly Entry', qa:[
        {q:'What is Bar Revenue?', a:'Total bar sales for the week from your POS — spirits, beer, wine, and non-alcoholic. Pull from your POS end-of-week summary report.'},
        {q:'What is Bar COGS?', a:'Cost of Goods Sold — what you spent on bar product this week. Use your beverage invoice totals for the week, plus any product transferred in, minus any transferred out.'},
        {q:'What is the inventory count for?', a:'The count calculates actual product usage. Beginning inventory plus purchases minus ending inventory equals units used. That number is compared to what your POS says you sold to calculate variance. Count in bottles for spirits, units for beer.'},
        {q:'How does variance work?', a:'Variance is the difference between pours made from your inventory count and pours sold from your POS. The app converts bottles used into pours automatically using the standard pour you set in Bar Products. Enter pours sold from your POS sales mix report. Near zero variance means product and sales are aligned. Positive variance means more product left inventory than was rung in — investigate over-pouring or theft.'},
        {q:'What is Pours Sold?', a:'What you enter manually from your POS sales mix report — the number of times that specific spirit was rung in during the week. Enter as individual shots or pours, not bottles.'}
      ]},
      {t:'Shift Check', qa:[
        {q:'What is Shift Check for?', a:'A fast daily spot-check that takes under 60 seconds. Enter shift revenue and COGS from your POS and you immediately see the shift pour cost and whether it is on target. Running this daily catches problems before they compound into a full week of loss.'},
        {q:'What is Shift COGS?', a:'The bar product cost for that specific shift — spirits, beer, wine only. Do not include labor. Estimate from your weekly invoices divided by number of shifts, or use your POS cost report if available.'}
      ]},
      {t:'Recipe Library', qa:[
        {q:'What is the difference between Single Drink, Batch Cocktail, and Food Plate?', a:'Single Drink costs one cocktail made to order — enter pours of each spirit (1 = one standard pour, 0.5 = half pour). Batch Cocktail costs a large recipe made in advance — enter full bottles and mixer quantities, set yield and serving size, and the app calculates cost per drink. Food Plate costs a kitchen dish from your kitchen product list.'},
        {q:'What is Recipe Cost %?', a:'Total ingredient cost divided by menu price. A recipe that crosses its target cost after a vendor price change gets flagged automatically. Flagged recipes show in red in the Recipe column.'},
        {q:'What does the red alert bar mean?', a:'One or more recipes are above their target cost percentage. The type label under the recipe name turns red. Click Edit on any red recipe to see which ingredients are driving the cost over target.'}
      ]},
      {t:'Vendor Watch', qa:[
        {q:'How does Vendor Watch work?', a:'Select a product from your bar or kitchen product list. The vendor auto-fills from product setup. Enter the new invoice price and your weekly usage. The app calculates the cost change, the change percentage, and the annual dollar impact. Saving updates the product cost everywhere — product setup, any recipes using that ingredient, and the recipe flag check.'},
        {q:'What is Annual Impact?', a:'Cost change per unit multiplied by weekly usage multiplied by 52 weeks. A $1.25 per bottle increase at 4 bottles per week costs $260 per year. This makes small invoice changes visible in real terms.'},
        {q:'The Was and Now columns show the same price — what does that mean?', a:'The product cost on file was already updated to the new price before the log entry was created. The log stores the prices at the time you logged the change. If you see identical values, reload sample data and check — or delete and re-enter the log entry with the correct prices.'}
      ]},
      {t:'Theft Risk Scorecard', qa:[
        {q:'How do I score the indicators?', a:'Rate each indicator from 1 to 5. A score of 1 means strong controls are in place. A score of 5 means no controls exist. Be honest — the scorecard is only useful if it reflects reality. Run it every 60–90 days to track whether your control environment is improving.'},
        {q:'What is the target score?', a:'20 or below indicates strong controls. 21–35 is moderate risk with specific gaps to address. Above 35 is high risk requiring immediate attention.'}
      ]},
      {t:'Cash Reconciliation', qa:[
        {q:'How does the count work?', a:'Enter the quantity of each bill and coin denomination. The app calculates the total. Enter the expected cash from your POS for that shift and your opening bank separately. Over/short is counted cash minus expected cash — the opening bank is not included in that calculation.'},
        {q:'What is Opening Bank?', a:'The cash float placed in the drawer at the start of the shift. Not revenue — the starting change fund. It should not be counted as part of cash sales for the shift.'},
        {q:'What is the tolerance?', a:'The maximum dollar amount you consider acceptable for a drawer to be off. Set in Settings, defaults to $10. Within tolerance shows as OK in gold. Outside tolerance shows red. Consistent patterns on the same employee are worth investigating regardless of the tolerance setting.'}
      ]},
      {t:'Reports & History', qa:[
        {q:'What does the weekly history show?', a:'Every week you have entered, sorted newest first. Click any week to see the full breakdown — bar and food revenue, COGS, labor, pour cost, food cost, prime cost, and variance by product.'},
        {q:'What is the Annual Cost Calculator?', a:'Enter your annual revenue and current vs target cost percentages to see the annual dollar gap and what closing it is worth monthly and weekly. Pre-fills from your Settings data. Use it when presenting the business case for operational changes.'}
      ]},
      {t:'Profit Audit', qa:[
        {q:'How does the audit work?', a:'You upload your POS reports and any other data files you have. The app reads all submitted documents and produces a full scored PDF audit report — no waiting, no manual work. The report scores up to 6 sections depending on what data you submit. More data submitted means more sections scored and more specific action items.'},
        {q:'What is the minimum data needed for an audit?', a:'Your POS Beverages sales report for a minimum of 4 weeks. That alone produces a Tier 1 audit scoring the revenue and cost baseline sections. Every additional file you upload unlocks more scored sections — inventory sheets unlock actual pour cost and variance, payroll unlocks prime cost, exception reports unlock theft risk indicators.'},
        {q:'When should I request my first audit?', a:'Request your first audit as soon as you sign up — before you change anything. This becomes your baseline score. It shows where you are starting from. After 30 days of using the app and entering data, request your second audit. The app automatically includes all your tracked weekly data, products, variance, and vendor logs in the second audit, making it significantly more detailed.'},
        {q:'How often can I request an audit?', a:'One audit per month, available at the start of each billing cycle. The countdown on the Profit Audit screen shows how many days until your next audit is available.'},
        {q:'How do I download my audit PDF?', a:'Click the Download PDF button on the Latest Audit card. The PDF generates directly in your browser — no email, no waiting. All past audits are also available for download in the Audit History table.'},
        {q:'What does the score comparison show?', a:'When you have two or more audits, the tracker shows your score change from the previous audit — overall points gained or lost, and the change per section. This is how you track whether the improvements you made between audits are showing up in the numbers.'}
      ]},
      {t:'Settings', qa:[
        {q:'What targets should I set?', a:'Bar Pour Cost: 22% is the standard industry target for full-service operations. Food Cost: 32% for full-service, lower for bar-heavy concepts. Prime Cost: 60% or below is the target for sustainable profitability. Labor targets depend heavily on your concept — 28–30% for bar labor is common. Adjust all targets to match your specific operation and ownership goals.'},
        {q:'How do I change my password?', a:'Go to Settings, scroll to the Account section, enter your new password twice, and click Update Password. Password must be at least 8 characters.'},
        {q:'What does Load Sample Data do?', a:'Populates every section of the app with realistic sample data — 10 bar products, 10 kitchen products, 7 recipes, 8 weeks of weekly data, 14 shift checks, 10 cash reconciliation entries, vendor log entries, theft scorecards, and two sample audit reports with downloadable PDFs. Use it to see every screen populated before entering your own data.'},
        {q:'What does Clear All Data do?', a:'Wipes all your data and resets the app to empty, keeping only your settings and targets. Use this when you are done testing with sample data and ready to start entering your real operation\'s numbers.'}
      ]},
      {t:'Getting Started Checklist', qa:[
        {q:'What is the Getting Started checklist?', a:'A 4-week guided setup that tells you exactly what to do in what order to get the full value of the app. Each task links directly to the relevant screen. Check off tasks as you complete them — progress is saved automatically.'},
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
