'use strict';

/* ── Tooltip engine ── */
const TT = {
  _cur: null,
  _box: document.getElementById('tt-box'),
  defs: {
    'container-size': {t:'Container Size',b:'The total size of the bottle, can, or keg you purchase. Pick from the list   the app converts to ounces automatically.',e:'750ml bottle of vodka = 25.4 oz'},
    'std-pour':       {t:'Standard Pour',b:'How many ounces you pour per drink. Used to calculate Cost Per Pour and track inventory variance.',e:'Spirits: 1.5 oz · Wine: 5 oz · Draft: 16 oz'},
    'unit-cost':      {t:'Unit Cost',b:'What you pay per bottle, can, or keg. Use your invoice price.',e:'Case of Tito\'s 750ml costs $180 = $15/bottle'},
    'menu-price':     {t:'Menu Price',b:'What you charge the guest per drink or serving.',e:'$10 for a cocktail · $6 for a draft beer'},
    'pour-cost-pct':  {t:'Pour Cost %',b:'Cost Per Pour divided by Menu Price. Lower is better. Industry benchmark 18-22%.',e:'$0.35 cost / $8 menu price = 4.4%'},
    'sh-bar-pour':    {t:'Bar Pour Cost % Target',b:'The pour cost percentage you are trying to hit on bar product. Industry benchmark is 22%. High-volume bars run 18-20%. If you are above 26% you have a cost or theft problem. Adjust this to match your ownership goal.',e:'22% is the standard starting benchmark'},
    'sh-food-cost':   {t:'Food Cost % Target',b:'Food cost as a percentage of food revenue. Industry benchmark is 28-32% depending on concept. Full-service restaurants typically run 30-32%. Fast casual runs lower. Set this to your target, not your current number.',e:'32% is the standard starting benchmark'},
    'sh-bar-labor':   {t:'Bar Labor % Target',b:'Bar staff payroll divided by bar revenue. Includes bartenders, barbacks, and bar management. Does not include kitchen or floor staff. Industry benchmark is 25-30%.',e:'28% is the standard starting benchmark'},
    'sh-food-labor':  {t:'Food Labor % Target',b:'Kitchen and food staff payroll divided by food revenue. Includes cooks, prep, and kitchen management. Full-service kitchen benchmark is 28-32%.',e:'30% is the standard starting benchmark'},
    'sh-prime-cost':  {t:'Prime Cost % Target',b:'Combined COGS and labor as a percentage of total revenue. The single most important number in your operation. Below 60% is healthy. Above 65% and you have a problem that weekly data will surface fast.',e:'60% is the standard starting benchmark'},
    'sh-cash-tol':    {t:'Cash Over/Short Tolerance',b:'The maximum dollar amount you consider acceptable for a drawer to be off before flagging it. Cash Reconciliation uses this threshold to show green or red on each shift count.',e:'$10 is typical. Anything over $10 over or short triggers a flag'},
    'pours-bottle':   {t:'Pours Made',b:'Actual pours calculated from your inventory count. Bottles used × pours per bottle. This is what actually left the bar this week.',e:'3.4 bottles used × 16.9 pours per bottle = 57.5 pours made'},
    'cost-pour':      {t:'Cost Per Pour',b:'Unit Cost ÷ Pours Per Bottle. What one drink costs you. Calculated automatically.',e:'$15 bottle ÷ 16.9 pours = $0.89/pour'},
    'kitchen-unit':   {t:'Unit of Measure',b:'The unit you order and count this product in.',e:'Chicken: lb · Lime juice: each · Margarita mix: bag'},
    'kitchen-cost':   {t:'Unit Cost',b:'What you pay per unit of this product.',e:'Chicken: $3.20/lb · Lime carton: $4.50/each'},
    'recipe-pours':   {t:'Pours',b:'How many standard pours of this spirit go in this drink. 1 = one standard pour.',e:'1 pour rum + 0.5 pour triple sec'},
    'recipe-bottles': {t:'Bottles',b:'How many full bottles go into the batch. Use decimals for partial bottles.',e:'2 bottles tequila + 0.5 bottle triple sec'},
    'batch-yield':    {t:'Batch Yield',b:'Total amount this batch makes. Pick the unit   app converts to oz to calculate servings.',e:'1 gallon frozen margarita mix = 128 oz'},
    'serving-size':   {t:'Serving Size',b:'How much goes in one drink. App divides yield by serving size to get servings per batch.',e:'5 oz per drink from 128 oz batch = 25.6 drinks'},
    'servings-batch': {t:'Servings Per Batch',b:'Batch Yield ÷ Serving Size. Calculated automatically. Verify this makes sense.',e:'128 oz ÷ 5 oz = 25.6 drinks'},
    'recipe-cost-pct':{t:'Recipe Cost %',b:'Total ingredient cost ÷ Menu Price.',e:'$1.20 cost ÷ $8 menu price = 15%'},
    'plate-yield':    {t:'Plates Per Batch',b:'How many plates this recipe produces. Most single-plate recipes are 1.',e:'A pot of chili serving 10 = plate yield of 10'},
    'bar-revenue':    {t:'Bar Revenue',b:'Total bar sales for the week from your POS. Include all drink sales.',e:'Your POS end-of-week bar department total'},
    'bar-cogs':       {t:'COGS',b:'Cost of Goods Sold   what you spent on bar product. Invoices + transfers in − transfers out.',e:'Weekly liquor invoice total: $2,340'},
    'bar-labor':      {t:'Labor',b:'Bar staff payroll   bartenders, barbacks, bar manager. Not kitchen or floor staff.',e:'Bartender hours × hourly rate'},
    'prime-cost':     {t:'Prime Cost %',b:'(Total Bar COGS + Total Food COGS + Total Labor) ÷ Total Revenue. The most important single number in your operation. Target: 60% or below. Above 65% is a warning sign.',e:'($4,200 bar COGS + $3,800 food COGS + $6,200 labor) ÷ $24,000 revenue = 60.0%'},
    'theoretical':    {t:'Pours Sold (POS)',b:'Number of pours/shots of this product rung in on your POS this week. Pull from your POS sales mix report. Enter as individual shots, not bottles.',e:'POS shows 85 shots of Tito\'s vodka sold this week = enter 85'},
    'variance-units': {t:'Variance (Pours)',b:'Pours Made minus Pours Sold. Near zero = controlled. Positive = more poured than sold (over-pouring or theft). Negative = more rung in than used (check POS entries).',e:'87 pours made, 85 sold = +2 variance (within normal range)'},
    'prev-cost':      {t:'Previous Cost',b:'The Unit Cost currently on file   pulled automatically from product setup.',e:'Tito\'s was $14.50/bottle'},
    'new-cost':       {t:'New Invoice Cost',b:'The price on your most recent invoice for this product.',e:'New invoice shows $15.75/bottle'},
    'weekly-usage':   {t:'Weekly Usage',b:'How many units you typically use per week. Used to calculate Annual Impact $.',e:'4 bottles of Tito\'s per week'},
    'annual-impact':  {t:'Annual Impact $',b:'Cost Change $ × Weekly Usage × 52 weeks.',e:'+$1.25/bottle × 4/week × 52 = +$260/year'},
    'inv-beg':        {t:'Beginning Inventory',b:'Count of bottles/units on hand at the start of this period. Carried forward from last week\'s ending count.',e:'You had 4.5 bottles of Tito\'s at start of week'},
    'inv-purchases':  {t:'Purchases',b:'Bottles/units received from deliveries during the week. Count what arrived on invoices, not what was ordered.',e:'Received 6 bottles from your weekly liquor order'},
    'inv-end':        {t:'Ending Inventory',b:'Physical count of bottles/units on hand right now. Count partial bottles as decimals.',e:'3.5 bottles remaining = 3 full + one half-full'},
    'inv-used':       {t:'Units Used',b:'Beginning + Purchases − Ending = actual consumption. Calculated automatically. In bottles for bar products.',e:'4.5 + 6 − 3.5 = 7 bottles used this week'},
    'shift-cogs':     {t:'Shift COGS (Product Only)',b:'Bar product cost for this shift   spirits, beer, wine. Do not include labor. Estimate from your weekly invoices divided by number of shifts, or use your POS cost report if available.',e:'Weekly $2,400 bar COGS ÷ 6 shifts = $400/shift'},
    'opening-bank':   {t:'Opening Bank',b:'Cash in the drawer at shift start. Your starting float   not counted as revenue.',e:'Standard opening bank: $200'},
    'expected-cash':  {t:'Expected Cash from POS',b:'Cash sales total from your POS for this shift.',e:'POS shows $840 in cash sales for the PM shift'},
    'cash-tolerance': {t:'Over/Short Tolerance',b:'Max dollar amount you consider acceptable for a drawer to be off.',e:'$10 tolerance: $9 over or short = OK. $11 = flagged'},
    // Revenue Recovery tooltips
    'r-bar-revenue':    {t:'Bar Revenue',b:'Total bar sales for the week from your POS. Include all drink and beverage sales from the bar department.',e:'Your POS end-of-week bar department total'},
    'r-floor-revenue':  {t:'Floor Revenue',b:'Total dining room or floor sales for the week. Food and beverage sold tableside by servers.',e:'Your POS end-of-week dining room or floor department total'},
    'r-covers':         {t:'Covers',b:'Total guests served during the week. Used to calculate check average. Pull from your POS end-of-week guest count.',e:'POS shows 412 guests served this week'},
    'r-check-avg':      {t:'Check Average',b:'Total Revenue divided by Covers. What the average guest spent. This is the most controllable revenue number in your operation. Industry benchmark for a full-service bar and restaurant is $35 to $45. If you are below your target, your team is not suggestive selling or your menu mix is pulling low.',e:'$14,800 revenue / 412 covers = $35.92 check average'},
    'r-bar-labor':      {t:'Bar Labor %',b:'Bar staff payroll divided by bar revenue. Includes bartenders, barbacks, and bar management. Industry benchmark is 25 to 30%. Above 32% means you are over-scheduled relative to volume or not driving enough bar revenue per shift.',e:'$3,200 bar labor / $11,400 bar revenue = 28%'},
    'r-kitchen-labor':  {t:'Kitchen Labor %',b:'Kitchen and prep staff payroll divided by food revenue. Includes line cooks, prep cooks, dishwashers, and kitchen management. Full-service kitchen benchmark is 28 to 32%. Below 26% can mean understaffing that affects quality and speed.',e:'$3,800 kitchen labor / $12,600 food revenue = 30%'},
    'r-floor-labor':    {t:'Floor Labor %',b:'Front-of-house service staff payroll divided by floor revenue. Includes servers, food runners, hosts, and floor management. Benchmark is 28 to 34%. High floor labor percentage usually means too many servers on the floor relative to covers or low check averages pulling revenue down.',e:'$2,900 floor labor / $9,200 floor revenue = 31.5%'},
    'r-lunch-rplh':     {t:'Lunch RPLH Target',b:'Revenue Per Labor Hour target for your lunch daypart. Lunch RPLH is typically lower than dinner because checks are smaller and the meal period is shorter. Set this based on your average lunch check and typical cover counts per server.',e:'$9,400 lunch revenue / 188 hours = $50 RPLH'},
    'r-dinner-rplh':    {t:'Dinner RPLH Target',b:'Revenue Per Labor Hour target for your dinner daypart. Dinner RPLH should be higher than lunch due to larger checks, more upsell opportunity, and longer seat times with higher beverage attachment. Benchmark for full-service dinner is $65 to $85.',e:'$14,800 dinner revenue / 197 hours = $75 RPLH'},
    'r-bar-rplh':       {t:'Bar RPLH Target',b:'Revenue Per Labor Hour target for your bar. Bar RPLH can be high when volume is strong because a single bartender handles multiple covers simultaneously. Benchmark is $55 to $75. Low bar RPLH usually means too many bartenders on shift for the volume.',e:'$8,400 bar revenue / 129 hours = $65 RPLH'},
    'r-event-close':    {t:'Event Close Rate',b:'Percentage of event inquiries that convert to confirmed bookings. This is your sales conversion rate for the events and catering pipeline. Industry benchmark is 35 to 45%. Below 30% means your follow-up process, pricing, or proposal quality needs attention.',e:'18 inquiries, 8 booked = 44% close rate'},
    'r-wage-bar':       {t:'Bar Staff Hourly Wage',b:'Average hourly rate for bar staff including bartenders and barbacks. Used by the Labor Budget Calculator to convert your labor percentage target into a maximum schedulable hours number. Enter your blended average if rates vary across staff.',e:'2 bartenders at $15 and 1 barback at $12 = $14 blended average'},
    'r-wage-kitchen':   {t:'Kitchen Staff Hourly Wage',b:'Average hourly rate for kitchen staff including line cooks, prep cooks, and dishwashers. Used to calculate your kitchen labor budget in hours. Does not include salaried kitchen management.',e:'Line cooks at $16, prep at $13, dish at $11 = $13.50 blended average'},
    'r-wage-floor':     {t:'Floor Staff Hourly Wage',b:'Average hourly rate for front-of-house staff including servers, food runners, and hosts. Used to calculate your floor labor budget in hours. Enter your tipped staff base wage, not their total compensation with tips.',e:'Servers at $2.13 base plus tip credit, or $12 if non-tipped market'},
    // This Week shared tooltips
    'tw-week-num':      {t:'Week Number',b:'Sequential week number for your records. Week 1 is your first week entering data. The system carries this forward automatically each week. Only adjust if you are entering a catch-up week out of sequence.',e:'Week 12 means you have 12 weeks of data in the system'},
    'tw-period-end':    {t:'Period End Date',b:'The last day of the week you are entering. Most operations close their week on Sunday. Be consistent week over week so your trend data lines up correctly.',e:'Sunday October 13 closes a Monday through Sunday accounting week'},
    'r-sv-covers':      {t:'Server Covers',b:'Total guests this server personally served during the week. Pull from your POS server sales report. This is the denominator in check average — must be guest count, not table count.',e:'Server handled 148 guests this week'},
    'r-sv-sales':       {t:'Server Total Sales',b:'Total dollar sales this server rang during the week. Pull from your POS server sales report. Food and beverage combined.',e:'Server rang $5,340 in total sales this week = $36.08 check average'},
    't-ig-followers':   {t:'Instagram Followers',b:'Your current total follower count on Instagram. Log weekly to track growth rate. A consistent upward trend means your content is reaching new people. Flat or declining means posting frequency or content quality needs attention.',e:'1,240 followers this week vs 1,210 last week = 30 new followers'},
    't-fb-followers':   {t:'Facebook Followers',b:'Your current total follower count on your Facebook business page. Facebook reach is lower than Instagram for most bars but the page matters for the 35-plus demographic, event promotion, and local search signals.',e:'2,100 Facebook page followers'},
    // Audit intake tooltips
    'at-ann-bar-rev':   {t:'Annual Bar Revenue',b:'Your total bar and beverage sales for the last 12 months. Used to calculate your annual dollar gap on pour cost and prime cost. Estimate is fine. The audit converts percentage gaps into real dollar figures using this number.',e:'$480,000 annual bar revenue — a 2% pour cost gap = $9,600 per year recoverable'},
    'at-ann-food-rev':  {t:'Annual Food Revenue',b:'Your total food sales for the last 12 months. Used to calculate your annual dollar gap on food cost. The more accurate the number, the more precise your gap calculations will be.',e:'$320,000 annual food revenue — a 3% food cost gap = $9,600 per year recoverable'},
    'at-pos-bev':       {t:'POS Sales Report — Beverages',b:'Your bar department sales from your POS. Daily or weekly beverage revenue by category. Minimum 4 weeks. Export from Toast, Square, Aloha, or any POS as Excel or CSV.',e:'Toast: Reports > Sales > Sales by Category > Bar'},
    'at-bar-inv':       {t:'Bar Inventory Count Sheets',b:'Physical bar inventory counts with opening count, purchases received, and closing count per product. Minimum 1 week. Best results with 4 weeks.',e:'Opening 12 bottles + 6 purchased - 14 closing = 4 used'},
    'at-exception':     {t:'POS Exception Report',b:'Voids, comps, and no-sale transactions by employee. Shows which employees are voiding checks, issuing comps without approval, and opening the drawer without a sale.',e:'Toast: Reports > Labor > Exception Report'},
    'at-cash':          {t:'Cash Drawer Reconciliation',b:'Daily or weekly cash variance records showing how much each drawer was over or short per shift. Used to identify cash handling gaps and shift-level patterns.',e:'Drawer over $12 on Friday close — pattern over 4 weeks'},
    'at-bev-inv':       {t:'Beverage Invoices',b:'All beverage delivery invoices for the audit period. Used to verify what was delivered versus ordered and to track price changes from your distributors.',e:'Your weekly liquor distributor invoices'},
    'at-vendor':        {t:'Vendor Price List',b:'Current pricing from your distributors or your most recent invoices. Used to identify price drift and negotiation opportunities. 4 weeks shows recent changes. 12 weeks shows the full drift pattern.',e:'Your distributor price sheet or line items on recent invoices'},
    'at-pos-food':      {t:'POS Sales Report — Food',b:'Kitchen department sales from your POS. Daily or weekly food revenue by category. Send the same date range as your beverage POS report.',e:'Toast: Reports > Sales > Sales by Category > Food'},
    'at-kit-inv':       {t:'Kitchen Inventory Count Sheets',b:'Physical kitchen counts with opening count, purchases, and closing count by product. Used to calculate actual food cost and identify waste and variance.',e:'Opening 10 lbs beef + 5 purchased - 8 closing = 7 lbs used'},
    'at-food-inv':      {t:'Food Invoices',b:'All food delivery invoices for the audit period. Used to verify delivery accuracy and track food cost against purchases.',e:'Your Sysco, US Foods, or produce vendor invoices'},
    'at-recipe':        {t:'Recipe Costing Sheet',b:'Your current recipe costs with ingredients, quantities, and cost per dish. The highest-value file in the audit. Without it, food cost analysis is category-level only. With it the audit calculates yield-corrected cost on every dish and ranks every repricing opportunity by annual dollar impact.',e:'Recipe card showing your burger costs $4.20 to make and sells for $14'},
    'at-prep':          {t:'Daily Prep Sheets',b:'Production logs showing what was prepped versus used by shift. Used to identify production loss, over-prep waste, and yield issues by station.',e:'Prep sheet showing 40 portions prepped, 28 sold, 12 unaccounted'},
    'at-waste':         {t:'Daily Waste Logs',b:'Waste recorded by category for the audit period. Used to calculate weekly spoilage cost and identify waste patterns by product or station.',e:'Waste log showing $340 in produce waste last week'},
    'at-payroll':       {t:'Payroll or Time Clock Data',b:'Hours worked by employee and shift for the audit period. Used to calculate verified prime cost, labor percentage by department, and RPLH. Weekly totals accepted if shift-level detail is not available.',e:'Toast: Reports > Labor > Timeclock Detail'},
    'ra-ann-bar-rev':   {t:'Annual Bar Revenue',b:'Your total bar and beverage sales for the last 12 months. Used to calculate annual revenue gaps and scale check average impact to annual dollar figures. Estimate is fine.',e:'$480,000 annual bar revenue — a $2 check average gap x 15,000 covers = $30,000 per year recoverable'},
    'ra-ann-food-rev':  {t:'Annual Food Revenue',b:'Your total food and dining room sales for the last 12 months. Used alongside bar revenue to calculate total operation size and scale gap calculations to annual dollar impact.',e:'$320,000 annual food revenue'},
    'ra-pos-daily':     {t:'POS Daily Sales Summary',b:'Total revenue by day broken down by category: food, beverage, total. The most important file in the revenue audit. Minimum 4 weeks. Export from your POS as Excel or CSV.',e:'Toast: Reports > Sales > Daily Sales Summary'},
    'ra-menu-mix':      {t:'Menu Sales Mix Report',b:'Items sold and revenue by menu item or category. Item-level detail gives the most complete analysis. Used to identify category concentration and menu engineering opportunities.',e:'Toast: Reports > Menu > Item Selection Report'},
    'ra-menu-prices':   {t:'Menu Price List',b:'Your current menu with item names and selling prices. Used to identify pricing gaps and contribution margin opportunities.',e:'Your current printed menu or a PDF of your menu'},
    'ra-server-sales':  {t:'Server Sales Report',b:'Check average, covers served, and total sales by server for the audit period. The highest-value file in the revenue audit. Unlocks two full scored sections on server performance.',e:'Toast: Reports > Labor > Server Sales Report'},
    'ra-upsell':        {t:'Server Upsell Report',b:'Appetizer captures, dessert captures, and add-on revenue by server per shift. Shows which servers are executing the upsell sequence and which are not.',e:'Toast: Reports > Labor > Product Mix by Server'},
    'ra-preshift':      {t:'Pre-Shift Briefing Log',b:'Any records showing whether pre-shift briefings are running and what is covered. Used to assess whether a performance standard is being communicated to the team.',e:'A weekly pre-shift agenda document or meeting notes'},
    'ra-labor-sched':   {t:'Weekly Labor Schedule',b:'Scheduled hours by position and department with labor cost. Used to calculate RPLH, labor percentage, and schedule efficiency against revenue.',e:'Your scheduling software export — 7shifts, HotSchedules, Excel'},
    'ra-timeclock':     {t:'Time Clock Actuals',b:'Actual hours worked by employee and shift for the audit period. Used to identify clock drift, actual versus scheduled hours, and verified overtime cost.',e:'Toast: Reports > Labor > Timeclock Detail'},
    'ra-labor-dept':    {t:'Labor by Department',b:'Separate labor cost tracking for bar, kitchen, and floor. Used to identify which department is driving labor overage and to set department-level targets.',e:'Payroll breakdown showing bar $3,200, kitchen $4,100, floor $2,800'},
    'ra-events':        {t:'Event Revenue Records',b:'One record per event with date, covers, F&B minimum, and actual spend. Minimum 3 months. Used to calculate event frequency, average event revenue, and minimum compliance rate.',e:'Private dining log showing 8 events last month at average $3,400 spend'},
    'ra-catering':      {t:'Catering Revenue Records',b:'One record per catering booking with date, guests, package type, and total revenue. Used to assess catering program performance and repeat client rate.',e:'Catering log or your booking software export'},
    'ra-rate-card':     {t:'Private Dining Rate Card',b:'Current pricing for private dining including room fees, F&B minimums, and per-head options. Used to assess pricing position and minimum structure against market benchmarks.',e:'Your private dining or events package PDF'},
    'ta-gbp-profile':    {t:'GBP Full Profile Screenshot',b:'A screenshot of your Google Business Profile as it appears in Google Maps or Search. Capture the full listing including name, address, phone, hours, website link, category, and the photo and review summary. Phone screenshots are fine.',e:'Search your bar name on Google Maps and screenshot the full listing panel'},
    'ta-gbp-insights':   {t:'GBP Insights Export',b:'Monthly impressions, search queries, direction requests, and phone calls from your GBP dashboard. Go to your Google Business Profile, click Performance, and screenshot or export the overview. Shows how many people found you and what they did next.',e:'GBP dashboard: Performance > Overview > Screenshot'},
    'ta-analytics':      {t:'Website Analytics',b:'Monthly sessions, bounce rate, top pages, and menu page performance. Export from Google Analytics, Squarespace, Wix, or any analytics platform. A screenshot of the overview dashboard is accepted. This is the highest-value file in the traffic audit.',e:'Google Analytics: Reports > Overview > Screenshot or Export'},
    'ta-mobile-site':    {t:'Mobile Homepage Screenshot',b:'A screenshot of your homepage as it appears on a phone. Open your website on your phone and take a screenshot. Shows whether your phone number, address, and call-to-action are visible without scrolling.',e:'Open your website on your phone and screenshot what appears above the fold'},
    'ta-google-reviews': {t:'Google Review Page Screenshot',b:'Screenshot of your Google listing showing your star rating, total review count, and the most recent 5 to 10 reviews. In Google Maps click your listing and scroll down to Reviews. Capture the rating, review count, and recent review text.',e:'Google Maps > Your Listing > Scroll to Reviews > Screenshot'},
    'ta-yelp':           {t:'Yelp Listing Screenshot',b:'Screenshot of your Yelp business page showing star rating, review count, and recent reviews. Submit if you have a Yelp listing. Skip this if you do not have one.',e:'yelp.com > Search your bar name > Screenshot your listing'},
    'ta-search':         {t:'Search Results Screenshots',b:'Open an incognito or private browser window so your personal search history does not affect results. Search for your bar type and city, then your neighborhood and bar. Screenshot the full results page including the Google Maps pack at the top.',e:'Incognito Chrome: search "sports bar Austin" > screenshot full results page'},
    'ta-instagram':      {t:'Instagram Profile Screenshot',b:'Screenshot of your Instagram profile showing follower count, post count, bio, and the most recent 9 to 12 posts in grid view. Go to your profile page and screenshot. Phone screenshot is fine.',e:'Open Instagram > Your Profile > Screenshot the full profile page'},
    'ta-facebook':       {t:'Facebook Page Screenshot',b:'Screenshot of your Facebook business page showing follower count and recent posts. Go to your Facebook page and screenshot the overview.',e:'Facebook > Your Business Page > Screenshot'},
    'ta-ig-analytics':   {t:'Instagram Analytics Screenshot',b:'Screenshot from Instagram Insights showing reach, impressions, and engagement for the last 30 days. Only available on business or creator accounts. In Instagram go to Professional Dashboard and select Insights.',e:'Instagram > Professional Dashboard > Insights > Screenshot'},
    'ta-delivery':       {t:'Delivery Platform Dashboard Screenshot',b:'Screenshot of your merchant dashboard on DoorDash, Uber Eats, or Grubhub showing your current rating, photo count, and menu status. Log into the merchant portal for each platform and screenshot the overview page. Submit one screenshot per platform.',e:'DoorDash Merchant Portal > Your Restaurant > Overview > Screenshot'},
    'ta-email':          {t:'Email Platform Screenshot',b:'Screenshot of your email platform dashboard showing list size, last send date, and any campaign performance visible on the overview screen. Works with Mailchimp, Klaviyo, Constant Contact, or any email platform.',e:'Mailchimp > Audience > Overview > Screenshot showing list size and last send'},
    'ta-email-analytics':{t:'Email Analytics Export',b:'Campaign performance history showing open rate, click rate, and unsubscribe rate for the last 6 to 12 months. Export from your email platform as PDF or CSV.',e:'Mailchimp: Reports > All Campaigns > Export CSV'},
    'r-labor-hours':    {t:'Labor Hours',b:'Total hours worked by all staff in this department for the week. Pull from your scheduling system or time clock.',e:'8 bartenders × avg 30 hrs = 240 bar labor hours'},
    'r-labor-cost':     {t:'Labor Cost',b:'Total wages paid to this department for the week. Exclude tips unless you have a tip pool that affects your payroll cost.',e:'240 hours × $15/hr avg = $3,600 bar labor cost'},
    'r-labor-pct':      {t:'Labor %',b:'Labor Cost ÷ Revenue for this department. Compare to your target. Over target means you are overstaffed or understaffed in productivity.',e:'$3,600 labor ÷ $12,000 bar revenue = 30%'},
    'r-rplh':           {t:'RPLH',b:'Revenue Per Labor Hour. Revenue ÷ Hours Worked. Measures how efficiently your labor is generating revenue. Low RPLH means overstaffed relative to volume.',e:'$8,400 dinner revenue ÷ 112 hours = $75 RPLH'},
    'r-rplh-target':    {t:'RPLH Target',b:'Your goal for revenue generated per labor hour by daypart. Set in Settings. Lunch targets are typically lower than dinner due to lower average checks.',e:'Dinner target $75 RPLH · Lunch target $50 RPLH'},
    'r-spread':         {t:'Performance Spread',b:'Top server check average minus bottom server check average. Under $10 indicates a consistent team. Over $20 means no coaching standard is being enforced.',e:'Top server $52 avg, bottom $24 avg = $28 spread'},
    'r-contrib-margin': {t:'Contribution Margin',b:'Menu Price minus Food or Pour Cost. What each item actually contributes to covering overhead and profit after product cost.',e:'$14 burger − $4.20 cost = $9.80 contribution margin'},
    'r-cost-pct':       {t:'Cost %',b:'Item Cost ÷ Menu Price. How much of each sale goes to product. Lower is better. Target varies by category.',e:'$4.20 cost ÷ $14.00 price = 30% food cost'},
    'r-wkly-covers':    {t:'Weekly Covers',b:'How many times this item is sold in a typical week. Used in Menu Engineering to calculate volume ranking and total weekly contribution.',e:'House burger sells 85 times per week'},
    'r-fb-minimum':     {t:'F&B Minimum',b:'The minimum food and beverage spend required to book the private dining room or event space for that date and time.',e:'Saturday dinner buyout requires $3,500 F&B minimum'},
    'r-event-revenue':  {t:'Event Revenue',b:'Actual total spent by the event party including food, beverages, and any room fee. Compare to the F&B minimum to track compliance.',e:'Party spent $4,200 vs $3,500 minimum   20% above minimum'},
    'r-daypart-rev':    {t:'Daypart Revenue',b:'Total revenue generated during this specific daypart from your POS. Bar = all bar department sales. Lunch = all dining room sales during lunch service. Dinner = all dining room sales during dinner service.',e:'Dinner POS total for the week: $8,400'},
    'r-daypart-hrs':    {t:'Daypart Labor Hours',b:'Total hours worked by all staff scheduled to this daypart. Pull from your scheduling system or time clock by job code or shift.',e:'6 servers x 5 hr lunch shift = 30 lunch labor hours'},
    'r-upsell-calc':    {t:'Upsell Revenue Calculator',b:'Shows the weekly and annual revenue gap between your current team check average and your target. Use this number in pre-shift to make the gap visible to your team.',e:'$33 current avg vs $38 target x 400 covers = $2,000/week gap'},
    'r-labor-budget-calc': {t:'Labor Budget Calculator',b:'Converts your revenue forecast and labor target percentage into a maximum schedulable hours number. Write the schedule to this number, not to what you think you need.',e:'$9,200 floor revenue x 30% target = $2,760 budget / $13.50 wage = 204 hours'},
    'r-optimal-hrs':    {t:'Optimal Hours',b:'Revenue forecast divided by your RPLH target. This is the maximum labor hours you can schedule for this shift to hit your RPLH goal.',e:'$6,000 forecast / $75 RPLH target = 80 hours maximum'},
    'r-price-new':      {t:'Proposed New Price',b:'The price you are considering for this item. The calculator shows you the margin impact and breakeven before you commit to the change.',e:'Current price $13.00, considering raising to $15.00'},
    'r-vol-change':     {t:'Estimated Volume Change',b:'How much you expect covers to change as a percentage if you change the price. Negative means fewer covers. Use 0 if you expect no change.',e:'-10% means you expect to sell 10% fewer of this item at the new price'},
    'r-contrib-margin-eng': {t:'Contribution Margin',b:'Menu price minus item cost. What each sale contributes to covering overhead and profit after product cost is deducted.',e:'$15 price - $4.50 cost = $10.50 contribution margin'},
    'r-event-covers':   {t:'Event Covers',b:'Total guests at the event. Used with F&B minimum to calculate per-head minimum and track whether events are on pace.',e:'40-guest corporate dinner'},
    // Traffic Recovery tooltips
    't-google-rating':  {t:'Google Rating',b:'Your current star rating on Google. The industry benchmark is 4.3 or higher. Below 4.0 is a direct revenue impact. Guests filter by rating before choosing a venue.',e:'4.6 stars from 312 reviews'},
    't-review-vel':     {t:'Review Velocity',b:'New reviews received per month. Consistent new reviews signal to Google that your business is active and relevant. Target 8 or more per month.',e:'12 new reviews this month'},
    't-response-rate':  {t:'Response Rate',b:'Percentage of reviews you have responded to. Industry benchmark is 75 percent or higher. Responding to every review, positive and negative, is a direct ranking signal.',e:'Responded to 38 of 50 reviews = 76%'},
    't-monthly-sessions':{t:'Monthly Website Sessions',b:'Total visits to your website per month. Benchmark is 2,000 or more for a typical bar or restaurant. Under 500 means your digital presence is not driving meaningful discovery traffic.',e:'1,840 sessions last month'},
    't-bounce-rate':    {t:'Bounce Rate',b:'Percentage of visitors who leave without viewing a second page. Above 70 percent means your homepage is not converting visitors to menu, reservations, or contact.',e:'62% bounce rate'},
    't-social-posts':   {t:'Monthly Posts',b:'Total posts across Instagram and Facebook combined for the month. Benchmark is 12 or more. Consistency matters more than volume. Posting 3 times per week beats a burst of daily posts followed by silence.',e:'14 posts last month (10 IG, 4 FB)'},
    't-digital-score':  {t:'Digital Presence Score',b:'Composite score across all 7 traffic categories: Google Business Profile, website, reviews, search and SEO, social media, delivery platforms, and email. Industry average is 58. Target is 65 or higher.',e:'Score of 71 puts you in the top 30% of operators in your market'},
    't-google-total':   {t:'Google Reviews',b:'Your all-time total review count on Google. A high total builds trust before a guest reads a single review. New reviews each month matter more for ranking, but the running total is the first number guests see.',e:'312 total reviews at 4.6 stars'},
    't-yelp-rating':    {t:'Yelp Rating',b:'Your current star rating on Yelp. Yelp ratings run lower than Google because the platform filters reviews aggressively, but anything under 4.0 costs you bookings. Many guests still check Yelp first.',e:'4.1 stars on Yelp from 88 reviews'},
    't-yelp-total':     {t:'Yelp Reviews',b:'Your all-time total review count on Yelp. A thin Yelp listing signals a business that is not engaged. Even when Google is your main channel, keep the Yelp count growing.',e:'88 total Yelp reviews'},
    't-delivery-active':{t:'Delivery Platform Active',b:'Whether you currently have a live, order-taking listing on this delivery platform. Each platform is its own discovery channel where guests browse and order from whoever shows up. Being absent means missed orders.',e:'Set Yes once your menu is live and accepting orders'},
    't-delivery-rating':{t:'Delivery Platform Rating',b:'Your current star rating on this delivery platform. Delivery ratings drive feed placement. A low rating pushes your listing down where fewer guests see it. Benchmark is 4.5 stars or higher.',e:'4.6 stars on DoorDash'},
    't-delivery-photos':{t:'Photo Count',b:'Number of photos on this delivery platform listing. Platforms favor listings with strong food photography in search and feed placement. Aim for 20 or more clear, well-lit shots.',e:'24 photos on the DoorDash menu'},
    't-email-list':     {t:'Email List Size',b:'Total contacts on your email marketing list. An owned email list is the one marketing channel no algorithm controls. Benchmark is 500 or more for an established bar or restaurant.',e:'740 contacts on the list'},
    't-emails-sent':    {t:'Emails Sent Per Month',b:'How many marketing emails or campaigns you sent in the last month. A list you never email is a dead asset. Send at least once a month, and weekly when you have offers or events.',e:'4 emails sent this month, one per week'},
    't-email-open':     {t:'Email Open Rate',b:'Percentage of recipients who opened your most recent email. Industry benchmark is 20% or higher. A low open rate usually means weak subject lines or sending at the wrong time.',e:'28 of 100 recipients opened = 28% open rate'},
    't-loyalty-active': {t:'Loyalty Program',b:'Whether you run a loyalty or rewards program for repeat guests. A simple loyalty program turns one-time delivery and walk-in guests into regulars and gives you a reason to collect contact info.',e:'Set Yes if you run points, punch cards, or a rewards app'},
    't-loyalty-members':{t:'Loyalty Members',b:'How many guests are enrolled in your loyalty program. Track this weekly. A growing membership means your sign-up process is working at the table and at checkout.',e:'420 enrolled loyalty members'},
    't-gbp-photos':     {t:'Photo Count',b:'Total photos on your Google Business Profile. Listings with more photos get more clicks and direction requests. Benchmark is 100 or more across food, drinks, the room, and the exterior.',e:'GBP shows 134 photos across all categories'},
    't-gbp-posts':      {t:'GBP Posts Per Month',b:'How many Google Business Profile posts you published in the last month. Posts such as offers, events, and updates signal to Google that the listing is active. Benchmark is 8 or more per month.',e:'10 GBP posts this month: 4 events, 6 offers'},
    't-review-age':     {t:'Most Recent Review Age',b:'How many days ago your newest review was posted, on any platform. If the most recent review is more than 14 days old, your review flow has gone quiet. Prompt guests this week.',e:'Newest review posted 6 days ago'},
    't-review-patterns':{t:'Negative Patterns Noted',b:'Recurring complaints or themes you see across recent reviews, such as slow service, noise, or a specific dish. Logging the pattern is the first step. Fix the root cause in the operation, not just the public reply.',e:'"Slow service on weekends" appears in 4 of the last 10 reviews'},
    't-search-keyword': {t:'Primary Local Keyword',b:'The exact phrase a guest would type into Google to find a bar like yours. Pick one phrase that names your city and concept, then use it in your Google Business Profile, page titles, and posts.',e:'"austin sports bar" or "downtown nashville cocktail bar"'},
    't-search-citations':{t:'Citation Count',b:'Roughly how many online directories list your business, including Google, Yelp, Apple Maps, TripAdvisor, and local sites. More consistent citations build local search authority. Benchmark is 40 or more.',e:'Listed on about 35 directories'},
    't-web-duration':   {t:'Avg Session Duration',b:'The average number of seconds a visitor spends on your website per visit. Short sessions mean visitors are not finding what they came for. Benchmark is 90 seconds or more.',e:'Google Analytics shows a 105 second average session'},
    't-web-source':     {t:'Top Traffic Source',b:'Where most of your website visitors come from. Strong local SEO should make Organic Search your leading source. If Direct or Social leads, you are relying on people who already know you rather than new discovery.',e:'Analytics shows Organic Search drives 52% of sessions'},
    't-social-engagement':{t:'IG Engagement Rate',b:'Likes, comments, saves, and shares as a percentage of your follower count, averaged across recent posts. Benchmark is 2% or higher. Low engagement means followers see your posts but do not interact.',e:'31 average interactions on 1,200 followers = 2.6%'},
    't-social-fbposts': {t:'Facebook Posts Per Month',b:'How many posts you published on your Facebook page in the last month. Facebook reach is lower than Instagram, but the page still matters for events and the 35-plus crowd. Cross-post to keep it warm.',e:'8 Facebook posts this month'},
    't-social-mix':     {t:'Content Mix',b:'An honest read on what your recent posts mostly show. A balanced mix of food, people, and the room outperforms a feed that is all promotions or all reposts. Pick the option that best describes your last 10 posts.',e:'Mostly food close-ups with a few event flyers = Balanced'},
    't-email-lastsend': {t:'Last Send Date',b:'The date you last sent a marketing email to your list. If it has been more than a month, the list is going cold, recipients forget who you are, and open rates fall.',e:'Last campaign sent October 8'},
    't-email-frequency':{t:'Send Frequency',b:'How often you typically email your list. Weekly or every two weeks keeps the list warm and engaged. Rarely or Never means the list is a dead asset, so move to at least monthly.',e:'A weekly Thursday email announcing the weekend lineup'},
    't-email-growth':   {t:'List Growth Mechanism',b:'How new contacts get added to your email list. A passive list shrinks over time. A website signup form, an in-store capture point, or WiFi login capture all keep it growing.',e:'WiFi login capture adds about 30 contacts a week'},
    // Inventory Control tooltips
    'ic-par-level':     {t:'Par Level',b:'The target quantity to keep on hand for this product. When a count drops below par, the Order Sheet flags it for reordering. Set it to cover normal usage between deliveries plus a small safety buffer.',e:'You use 6 bottles of well vodka a week and order weekly, so par is 8'},
    'ic-reorder-point': {t:'Reorder Point',b:'The on-hand quantity that should trigger a reorder. Set it a little above zero so you never run out before the next delivery arrives. The Order Sheet flags any product at or below this point.',e:'A reorder point of 2 bottles means you reorder once only 2 are left'},
    'ic-pours-container':{t:'Pours Per Container',b:'Container Size divided by Pour Size. How many standard pours one full container yields. Calculated automatically.',e:'A 750ml bottle of 25.4 oz at a 1.5 oz pour = 16.9 pours'},
  },
  show(icon) {
    const id = icon.dataset.tt;
    const def = this.defs[id];
    if (!def) return;
    if (this._cur === icon) { this.hide(); return; }
    this._cur = icon;
    document.getElementById('tt-title').textContent = def.t;
    document.getElementById('tt-body').textContent  = def.b;
    const eg = document.getElementById('tt-eg');
    if (def.e) { eg.textContent = 'Example: ' + def.e; eg.style.display = ''; }
    else eg.style.display = 'none';
    this._box.style.display = 'block';
    this._box.classList.remove('on');
    const rect = icon.getBoundingClientRect();
    const bw = 260, bh = this._box.offsetHeight || 100;
    let left = rect.right + 8, top = rect.top - 4;
    if (left + bw > window.innerWidth - 12) left = rect.left - bw - 8;
    if (top + bh > window.innerHeight - 12) top = window.innerHeight - bh - 12;
    if (top < 8) top = 8;
    this._box.style.left = left + 'px';
    this._box.style.top = top + 'px';
    requestAnimationFrame(() => this._box.classList.add('on'));
  },
  hide() {
    this._cur = null;
    this._box.classList.remove('on');
    setTimeout(() => { if (!this._box.classList.contains('on')) this._box.style.display = 'none'; }, 150);
  }
};

document.addEventListener('click', ev => {
  const icon = ev.target.closest('.tt');
  if (icon) { ev.stopPropagation(); TT.show(icon); }
  else TT.hide();
});
document.addEventListener('scroll', () => TT.hide(), true);

/* ── App ── */
const App = {
  data: null,
  inventoryData: null,   // ic_ keys — ic_data table (see Rule 21)
  laborData: null,       // lc_ keys — lc_data table
  shiftData: null,       // sc_ keys — sc_data table
  subscription: { status: 'inactive', plan: null, active_modules: [], period_end: null },

  async init() {
    await DB.init();
    window.onerror = (msg, src, line, col, err) => {
      const el = document.getElementById('content-area');
      if (el) el.innerHTML = '<div class="screen" style="color:var(--red);font-family:monospace;font-size:12px;white-space:pre-wrap;">ERROR: ' + msg + '\nLine: ' + line + '\n' + (err ? err.stack : '') + '</div>';
    };
    if (!window.SUPABASE_URL) {
      await this.loadAllData();
      this.boot();
      return;
    }
    // Check if this is a password recovery link before checking session
    const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
    const isRecovery = hashParams.get('type') === 'recovery';
    if (isRecovery) {
      // Show set password screen immediately   onAuthChange will fire PASSWORD_RECOVERY
      this.showAuth();
      DB.onAuthChange(async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          ['auth-login','auth-reset','auth-set-password'].forEach(x => {
            const el = document.getElementById(x);
            if (el) el.style.display = x === 'auth-set-password' ? '' : 'none';
          });
        } else if (event === 'SIGNED_IN' && session) {
          await this.loadAllData();
          this.subscription = await DB.getSubscription();
          this.boot();
        } else if (event === 'SIGNED_OUT') {
          this.data = null;
          this.subscription = { status: 'inactive', plan: null, active_modules: [], period_end: null };
          this.showAuth();
        }
      });
      return;
    }
    const session = await DB.getSession();
    if (session) {
      await this.loadAllData();
      this.subscription = await DB.getSubscription();
      this.boot();
    } else {
      this.showAuth();
    }
    DB.onAuthChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        // Show password reset screen instead of booting into the app
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('app').classList.add('hidden');
        document.getElementById('ob-overlay').classList.add('hidden');
        const hw = document.getElementById('hub-wrapper');
        if (hw) hw.style.display = 'none';
        // Switch to the set-new-password panel
        ['auth-login','auth-reset','auth-set-password'].forEach(x => {
          const el = document.getElementById(x);
          if (el) el.style.display = x === 'auth-set-password' ? '' : 'none';
        });
      } else if (event === 'SIGNED_IN' && session) {
        await this.loadAllData();
        this.subscription = await DB.getSubscription();
        this.boot();
      } else if (event === 'SIGNED_OUT') {
        this.data = null;
        this.subscription = { status: 'inactive', plan: null, active_modules: [], period_end: null };
        this.showAuth();
      }
    });
  },

  boot() {
    document.getElementById('auth-screen').style.display = 'none';
    this.updatePeriod();
    // Sidebar toggle — assign (not addEventListener) so repeated boot() calls
    // don't stack handlers and cancel each other out
    const toggleBtn = document.getElementById('sidebar-toggle');
    if (toggleBtn) toggleBtn.onclick = () => {
      document.getElementById('app').classList.toggle('sidebar-collapsed');
    };
    if (!this.data.settings.onboarding_complete) {
      Onboarding.start();
    } else {
      this.showHub();
    }
  },

  showHub() {
    // Full screen hub - hide the app shell, show a standalone container
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('ob-overlay').classList.add('hidden');
    // Hide the sidebar/topbar shell, render hub directly into body
    document.getElementById('app').classList.add('hidden');
    let hubWrap = document.getElementById('hub-wrapper');
    if (!hubWrap) {
      hubWrap = document.createElement('div');
      hubWrap.id = 'hub-wrapper';
      hubWrap.style.cssText = 'position:fixed;inset:0;overflow-y:auto;background:var(--bg);z-index:100;';
      document.body.appendChild(hubWrap);
    }
    hubWrap.style.display = 'block';
    S.Hub.render(hubWrap);
  },

  showApp(module) {
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('ob-overlay').classList.add('hidden');
    document.getElementById('auth-screen').style.display = 'none';
    const hw = document.getElementById('hub-wrapper');
    if (hw) hw.style.display = 'none';
    // Swap sidebar nav based on module
    this._activeModule = module || this._activeModule || 'profit';
    this._renderNav(this._activeModule);
  },

  _activeModule: 'profit',

  _renderNav(module) {
    const nav = document.getElementById('sidebar-nav');
    if (!nav) return;
    if (module === 'revenue') {
      nav.innerHTML = Revenue.navHTML();
    } else if (module === 'traffic') {
      nav.innerHTML = Traffic.navHTML();
    } else if (module === 'inventory') {
      nav.innerHTML = Inventory.navHTML();
    } else if (module === 'shift') {
      nav.innerHTML = Shift.navHTML();
    } else if (module === 'labor') {
      nav.innerHTML = Labor.navHTML();
    } else {
      nav.innerHTML = ProfitNav.html();
    }
    // Rewire nav click handlers
    nav.querySelectorAll('.nav-item[data-screen]').forEach(el => {
      el.addEventListener('click', () => App.navigate(el.dataset.screen));
    });
    nav.querySelectorAll('.nav-item[data-nav="hub"]').forEach(el => {
      el.addEventListener('click', () => App.showHub());
    });
  },

  showAuth() {
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('app').classList.add('hidden');
    document.getElementById('ob-overlay').classList.add('hidden');
    const hw = document.getElementById('hub-wrapper');
    if (hw) hw.style.display = 'none';
    // Show success banner if landing from Stripe checkout
    const params = new URLSearchParams(window.location.search);
    const banner = document.getElementById('checkout-success-msg');
    if (banner) banner.style.display = params.get('checkout') === 'success' ? 'block' : 'none';
    // Clean up the URL
    if (params.get('checkout')) window.history.replaceState({}, '', '/');
  },

  async save() {
    const r = await DB.writeData(this.data);
    if (!r.ok) console.error('Save failed:', r.error);
    return r.ok;
  },

  async saveKey(key) {
    const r = await DB.writeKey(key, this.data[key]);
    if (!r.ok) console.error('saveKey failed:', r.error);
    return r.ok;
  },

  // Load Recovery data plus the three Control data stores (Rule 21)
  async loadAllData() {
    this.data          = await DB.readData();
    this.inventoryData = await DB.readInventoryData();
    this.laborData     = await DB.readLaborData();
    this.shiftData     = await DB.readShiftData();
  },

  async saveInventory() {
    const r = await DB.writeInventoryData(this.inventoryData);
    if (!r.ok) console.error('saveInventory failed:', r.error);
    return r.ok;
  },

  async saveLabor() {
    const r = await DB.writeLaborData(this.laborData);
    if (!r.ok) console.error('saveLabor failed:', r.error);
    return r.ok;
  },

  async saveShift() {
    const r = await DB.writeShiftData(this.shiftData);
    if (!r.ok) console.error('saveShift failed:', r.error);
    return r.ok;
  },

  navigate(id) {
    this.updateNav(id);
    const content = document.getElementById('content-area');
    const actions = document.getElementById('topbar-actions');
    actions.innerHTML = '';

    // Revenue module screens
    if (this._activeModule === 'revenue') {
      const revTitles = {
        'hub':                    ['Recovery Hub', ''],
        'r-audit':            ['Revenue Audit', 'Monthly Score and Progress'],
        'r-dashboard':            ['Dashboard', 'Revenue Recovery'],
        'r-this-week':            ['This Week', 'Weekly Entry'],
        'r-server-check':         ['Server Check', ''],
        'r-menu-items':           ['Menu Items', ''],
        'r-menu-engineering':     ['Menu Engineering', ''],
        'r-labor-budget':         ['Labor Budget', ''],
        'r-rplh':                 ['RPLH Tracker', ''],
        'r-check-average':        ['Check Average', ''],
        'r-events':               ['Events and Catering', ''],
        'r-reports':              ['Reports and History', ''],
        'r-getting-started':      ['Getting Started', '30-Day Setup'],
        'r-resources':            ['Resources', ''],
        'r-help':                 ['Help and FAQ', ''],
        'r-settings':             ['Settings', 'Revenue Recovery'],
      };
      const revScreens = {
        'r-audit':            S.RevenueAudit,
        'r-dashboard':        S.RevenueDashboard,
        'r-this-week':        S.RevenueThisWeek,
        'r-server-check':     S.RevenueServerCheck,
        'r-menu-items':       S.RevenueMenuItems,
        'r-menu-engineering': S.RevenueMenuEngineering,
        'r-labor-budget':     S.RevenueLaborBudget,
        'r-rplh':             S.RevenueRPLH,
        'r-check-average':    S.RevenueCheckAverage,
        'r-events':           S.RevenueEvents,
        'r-reports':          S.RevenueReports,
        'r-getting-started':  S.RevenueGettingStarted,
        'r-resources':        S.RevenueResources,
        'r-help':             S.RevenueHelp,
        'r-settings':         S.RevenueSettings,
      };
      const [title, sub] = revTitles[id] || [id, ''];
      document.getElementById('topbar-title').textContent = title;
      document.getElementById('topbar-sub').textContent = sub;
      const screen = revScreens[id];
      if (screen) screen.render(content, actions);
      else content.innerHTML = '<div class="screen"><p style="color:var(--t3);">Coming soon.</p></div>';
      return;
    }

    // Traffic module screens
    if (this._activeModule === 'traffic') {
      const trafficTitles = {
        'hub':              ['Recovery Hub', ''],
        't-dashboard':      ['Dashboard', 'Traffic Recovery'],
        't-audit':          ['Traffic Audit', 'Monthly Score and Progress'],
        't-this-week':      ['This Week', 'Weekly Entry'],
        't-gbp':            ['Google Business Profile', ''],
        't-reviews':        ['Review Tracker', ''],
        't-search':         ['Search and SEO', ''],
        't-website':        ['Website Scorecard', ''],
        't-social':         ['Social Media', ''],
        't-delivery':       ['Delivery Platforms', ''],
        't-email':          ['Email and Loyalty', ''],
        't-reports':        ['Reports and History', ''],
        't-getting-started':['Getting Started', '30-Day Setup'],
        't-resources':      ['Resources', ''],
        't-help':           ['Help and FAQ', ''],
        't-settings':       ['Settings', 'Traffic Recovery'],
      };
      const trafficScreens = {
        't-dashboard':      S.TrafficDashboard,
        't-audit':          S.TrafficAudit,
        't-this-week':      S.TrafficThisWeek,
        't-gbp':            S.TrafficGBP,
        't-reviews':        S.TrafficReviews,
        't-search':         S.TrafficSearch,
        't-website':        S.TrafficWebsite,
        't-social':         S.TrafficSocial,
        't-delivery':       S.TrafficDelivery,
        't-email':          S.TrafficEmail,
        't-reports':        S.TrafficReports,
        't-getting-started':S.TrafficGettingStarted,
        't-resources':      S.TrafficResources,
        't-help':           S.TrafficHelp,
        't-settings':       S.TrafficSettings,
      };
      const [title, sub] = trafficTitles[id] || [id, ''];
      document.getElementById('topbar-title').textContent = title;
      document.getElementById('topbar-sub').textContent = sub;
      const screen = trafficScreens[id];
      if (screen) screen.render(content, actions);
      else content.innerHTML = '<div class="screen"><p style="color:var(--t3);">Coming soon.</p></div>';
      return;
    }

    // Inventory Control module screens
    if (this._activeModule === 'inventory') {
      const icTitles = {
        'hub':                 ['Recovery Hub', ''],
        'ic-dashboard':        ['Dashboard', 'Inventory Control'],
        'ic-product-setup':    ['Products', 'Inventory Control'],
        'ic-locations':        ['Locations', 'Inventory Control'],
        'ic-vendors':          ['Vendors', 'Inventory Control'],
        'ic-take-inventory':   ['Take Inventory', 'Inventory Control'],
        'ic-count-history':    ['Count History', 'Inventory Control'],
        'ic-spot-check':       ['Spot Check', 'Inventory Control'],
        'ic-receive-delivery': ['Receive Delivery', 'Inventory Control'],
        'ic-delivery-history': ['Delivery History', 'Inventory Control'],
        'ic-order-sheet':      ['Order Sheet', 'Inventory Control'],
        'ic-order-history':    ['Order History', 'Inventory Control'],
        'ic-report-usage':     ['Usage Report', 'Inventory Control'],
        'ic-report-variance':  ['Variance Report', 'Inventory Control'],
        'ic-report-stock':     ['Stock Report', 'Inventory Control'],
        'ic-report-movers':    ['Top Movers', 'Inventory Control'],
        'ic-help':             ['Help and FAQ', 'Inventory Control'],
      };
      const icScreens = {
        'ic-dashboard':      S.InventoryDashboard,
        'ic-product-setup':  S.InventoryProducts,
        'ic-locations':      S.InventoryLocations,
        'ic-vendors':        S.InventoryVendors,
        'ic-take-inventory': S.InventoryTakeInventory,
        'ic-count-history':  S.InventoryCountHistory,
        'ic-spot-check':     S.InventorySpotCheck,
        'ic-receive-delivery': S.InventoryReceiveDelivery,
        'ic-delivery-history': S.InventoryDeliveryHistory,
        'ic-order-sheet':     S.InventoryOrderSheet,
        'ic-order-history':   S.InventoryOrderHistory,
        'ic-report-usage':    S.InventoryUsageReport,
        'ic-report-variance': S.InventoryVarianceReport,
        'ic-report-stock':    S.InventoryStockReport,
        'ic-report-movers':   S.InventoryMoversReport,
        'ic-help':            S.InventoryHelp,
      };
      const [icTitle, icSub] = icTitles[id] || [id, ''];
      document.getElementById('topbar-title').textContent = icTitle;
      document.getElementById('topbar-sub').textContent = icSub;
      const icScreen = icScreens[id];
      if (icScreen) icScreen.render(content, actions);
      else content.innerHTML = '<div class="screen"><p style="color:var(--t3);">Coming soon.</p></div>';
      return;
    }

    // Shift Control module screens
    if (this._activeModule === 'shift') {
      const scTitles = {
        'hub':                   ['Recovery Hub', ''],
        'sc-dashboard':          ['Dashboard', 'Shift Control'],
        'sc-active-shift':       ['Active Shift', 'Shift Control'],
        'sc-log-shift':          ['Log a Shift', 'Shift Control'],
        'sc-shift-history':      ['Shift History', 'Shift Control'],
        'sc-cash-drop':          ['Cash Drop', 'Shift Control'],
        'sc-safe-log':           ['Safe Log', 'Shift Control'],
        'sc-variance-log':       ['Variance Log', 'Shift Control'],
        'sc-86-list':            ['86 List', 'Shift Control'],
        'sc-void-comp':          ['Void and Comp Log', 'Shift Control'],
        'sc-maintenance':        ['Maintenance Log', 'Shift Control'],
        'sc-opening-checklist':  ['Opening Checklist', 'Shift Control'],
        'sc-closing-checklist':  ['Closing Checklist', 'Shift Control'],
        'sc-checklist-templates':['Checklist Templates', 'Shift Control'],
        'sc-reports-shift':      ['Shift Reports', 'Shift Control'],
        'sc-reports-cash':       ['Cash Reports', 'Shift Control'],
        'sc-reports-ops':        ['Operations Reports', 'Shift Control'],
        'sc-help':               ['Help and FAQ', 'Shift Control'],
      };
      const scScreens = {
        'sc-dashboard': S.ShiftDashboard,
        'sc-active-shift': S.ShiftActiveShift,
        'sc-log-shift': S.ShiftLogShift,
        'sc-shift-history': S.ShiftHistory,
        'sc-cash-drop': S.ShiftCashDrop,
        'sc-safe-log': S.ShiftSafeLog,
        'sc-variance-log': S.ShiftVarianceLog,
        'sc-86-list': S.Shift86List,
        'sc-void-comp': S.ShiftVoidComp,
        'sc-maintenance': S.ShiftMaintenance,
        'sc-opening-checklist': S.ShiftOpeningChecklist,
        'sc-closing-checklist': S.ShiftClosingChecklist,
        'sc-checklist-templates': S.ShiftChecklistTemplates,
        'sc-reports-shift': S.ShiftReportsShift,
        'sc-reports-cash': S.ShiftReportsCash,
        'sc-reports-ops': S.ShiftReportsOps,
        'sc-help': S.ShiftHelp,
      };
      const [scTitle, scSub] = scTitles[id] || [id, ''];
      document.getElementById('topbar-title').textContent = scTitle;
      document.getElementById('topbar-sub').textContent = scSub;
      const scScreen = scScreens[id];
      if (scScreen) scScreen.render(content, actions);
      else content.innerHTML = '<div class="screen"><p style="color:var(--t3);">Coming soon.</p></div>';
      return;
    }

    // Labor Control module screens
    if (this._activeModule === 'labor') {
      const lcTitles = {
        'hub':                   ['Recovery Hub', ''],
        'lc-dashboard':          ['Dashboard', 'Labor Control'],
        'lc-build-schedule':     ['Build Schedule', 'Labor Control'],
        'lc-schedule-templates': ['Schedule Templates', 'Labor Control'],
        'lc-schedule-history':   ['Schedule History', 'Labor Control'],
        'lc-log-hours':          ['Log Hours', 'Labor Control'],
        'lc-daily-view':         ['Daily View', 'Labor Control'],
        'lc-weekly-summary':     ['Weekly Summary', 'Labor Control'],
        'lc-staff-roster':       ['Staff Roster', 'Labor Control'],
        'lc-positions':          ['Positions', 'Labor Control'],
        'lc-tip-log':            ['Tip Log', 'Labor Control'],
        'lc-tip-pool':           ['Tip Pool Calculator', 'Labor Control'],
        'lc-tip-history':        ['Tip History', 'Labor Control'],
        'lc-reports':            ['Labor Reports', 'Labor Control'],
        'lc-overtime-watch':     ['Overtime Watch', 'Labor Control'],
        'lc-callout-log':        ['Call-Out Log', 'Labor Control'],
        'lc-help':               ['Help and FAQ', 'Labor Control'],
      };
      const lcScreens = {
        'lc-positions': S.LaborPositions,
        'lc-staff-roster': S.LaborStaffRoster,
        'lc-build-schedule': S.LaborBuildSchedule,
        'lc-schedule-history': S.LaborScheduleHistory,
        'lc-schedule-templates': S.LaborScheduleTemplates,
      };
      const [lcTitle, lcSub] = lcTitles[id] || [id, ''];
      document.getElementById('topbar-title').textContent = lcTitle;
      document.getElementById('topbar-sub').textContent = lcSub;
      const lcScreen = lcScreens[id];
      if (lcScreen) lcScreen.render(content, actions);
      else content.innerHTML = '<div class="screen"><p style="color:var(--t3);">Coming soon.</p></div>';
      return;
    }

    const titles = {
      'hub':           ['Recovery Hub', ''],
      'dashboard':     ['Dashboard', 'Profit Recovery'],
      'this-week':     ['This Week', 'Weekly Entry'],
      'shift-check':   ['Shift Check', ''],
      'bar-products':  ['Bar Products', ''],
      'kitchen-products': ['Kitchen Products', ''],
      'recipe-library':['Recipe Library', ''],
      'vendor-watch':  ['Vendor Watch', ''],
      'theft-risk':    ['Theft Risk Scorecard', ''],
      'cash-recon':    ['Cash Reconciliation', ''],
      'reports':       ['Reports & History', ''],
      'settings':      ['Settings', 'Profit Recovery'],
      'help':          ['Help and FAQ', ''],
      'audit-tracker': ['Profit Audit', 'Monthly Score & Progress'],
      'resources':     ['Resources', 'Tools, Templates & Checklists'],
      'getting-started': ['Getting Started', '30-Day Setup Checklist']
    };

    const screens = {
      'hub':           S.Hub,
      'dashboard':     S.Dashboard,
      'this-week':     S.ThisWeek,
      'shift-check':   S.ShiftCheck,
      'bar-products':  S.BarProducts,
      'kitchen-products': S.KitchenProducts,
      'recipe-library':S.RecipeLibrary,
      'vendor-watch':  S.VendorWatch,
      'theft-risk':    S.TheftRisk,
      'cash-recon':    S.CashRecon,
      'reports':       S.Reports,
      'settings':      S.Settings,
      'help':          S.Help,
      'audit-tracker': S.AuditTracker,
      'resources':     S.Resources,
      'getting-started': S.GettingStarted
    };

    const [title, sub] = titles[id] || [id, ''];
    document.getElementById('topbar-title').textContent = title;
    document.getElementById('topbar-sub').textContent = sub;

    const screen = screens[id];
    if (screen) screen.render(content, actions);
    else content.innerHTML = '<div class="screen"><p style="color:var(--t3);">Coming soon.</p></div>';
  },

  updateNav(id) {
    document.querySelectorAll('.nav-item, .sidebar-btn').forEach(el => el.classList.remove('active'));
    const el = document.getElementById('nav-' + id);
    if (el) el.classList.add('active');
    // Settings gear button should stay active for all three settings screens
    if (id === 'r-settings' || id === 't-settings') {
      document.getElementById('nav-settings')?.classList.add('active');
    }
  },

  updatePeriod() {
    const el = document.getElementById('sidebar-period');
    if (!el) return;
    const weeks = this.data?.weeks || [];
    if (weeks.length > 0) {
      const w = weeks[weeks.length - 1];
      el.textContent = 'Week ' + w.week_num + '   ' + (w.period_end || '');
    } else {
      el.textContent = 'No data yet';
    }
  },

  fmtCurrency(n, decimals) {
    if (isNaN(n) || n == null) return ' ';
    const d = decimals !== undefined ? decimals : (Math.abs(n) < 10 ? 2 : 0);
    return '$' + Number(n).toLocaleString('en-US', {minimumFractionDigits:d, maximumFractionDigits:d});
  },

  fmtPct(n, d=1) {
    if (isNaN(n) || n == null) return ' ';
    return Number(n).toFixed(d) + '%';
  },

  /* ── Unified audit score system (0-100) ──────────────────────────────────
     One scale for every audit score in all three sections:
       70-100  Strong        gold
       50-69   Below Target  white
       0-49    Critical      red                                          */
  scoreColor(s) { s = Number(s) || 0; return s >= 70 ? 'var(--gold)' : s >= 50 ? 'var(--w)' : 'var(--red)'; },
  scoreHex(s)   { s = Number(s) || 0; return s >= 70 ? '#C9A84C'     : s >= 50 ? '#ffffff'  : '#C03828'; },
  scoreLabel(s) { s = Number(s) || 0; return s >= 70 ? 'Strong'      : s >= 50 ? 'Below Target' : 'Critical'; },

  // Slim 0-100 scale bar with red / neutral / gold zones and a marker at the score.
  scoreBar(score) {
    const s = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
    return '<div style="margin-top:10px;max-width:300px;">'
      + '<div style="display:flex;height:7px;border-radius:4px;overflow:hidden;">'
      +   '<div style="width:50%;background:var(--red);"></div>'
      +   '<div style="width:20%;background:var(--t2);"></div>'
      +   '<div style="width:30%;background:var(--gold);"></div>'
      + '</div>'
      + '<div style="position:relative;height:0;">'
      +   '<div style="position:absolute;top:-10px;left:' + s + '%;width:3px;height:13px;background:var(--w);border-radius:2px;transform:translateX(-1.5px);box-shadow:0 0 0 1.5px var(--surface);"></div>'
      + '</div>'
      + '<div style="display:flex;margin-top:6px;font-size:8px;font-weight:700;letter-spacing:0.5px;color:var(--t3);">'
      +   '<span style="width:50%;">CRITICAL</span>'
      +   '<span style="width:20%;text-align:center;">BELOW TGT</span>'
      +   '<span style="width:30%;text-align:right;">STRONG</span>'
      + '</div>'
    + '</div>';
  },

  /* ── Reusable trend chart ─────────────────────────────────────────────────
     opts: { title, points:[{label,value}], target (optional), suffix (optional) }
     Returns a chart-card. Needs 2+ non-null values or shows a prompt.        */
  trendChart(opts) {
    const pts  = (opts.points || []).filter(Boolean);
    const vals = pts.map(p => p.value).filter(v => v != null);
    const title = opts.title || 'Trend';
    const head = '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:12px;">' + esc(title) + '</div>';
    if (vals.length < 2) {
      return '<div class="chart-card" style="padding:20px 24px 16px;">' + head
        + '<div style="text-align:center;padding:16px 0;color:var(--t4);font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Enter at least 2 weeks to see this trend</div></div>';
    }
    const W = 700, H = 170, PAD = { t:24, r:18, b:34, l:46 };
    const cw = W - PAD.l - PAD.r, ch = H - PAD.t - PAD.b;
    let minV = Math.min(...vals), maxV = Math.max(...vals);
    if (opts.target != null) { minV = Math.min(minV, opts.target); maxV = Math.max(maxV, opts.target); }
    const span = (maxV - minV) * 0.15 || 1;
    const minY = minV - span, maxY = maxV + span;
    const xs = i => PAD.l + (pts.length > 1 ? (i/(pts.length-1))*cw : cw/2);
    const ys = v => PAD.t + ch - ((v-minY)/(maxY-minY||1))*ch;
    const valid = pts.map((p,i) => p.value != null ? { x:xs(i), y:ys(p.value) } : null).filter(Boolean);
    let d = 'M' + valid[0].x.toFixed(1) + ',' + valid[0].y.toFixed(1);
    for (let i = 1; i < valid.length; i++) {
      const cp = (valid[i].x - valid[i-1].x) * 0.35;
      d += ' C' + (valid[i-1].x+cp).toFixed(1) + ',' + valid[i-1].y.toFixed(1) + ' ' + (valid[i].x-cp).toFixed(1) + ',' + valid[i].y.toFixed(1) + ' ' + valid[i].x.toFixed(1) + ',' + valid[i].y.toFixed(1);
    }
    // Gradient area fill under the line — matches the module dashboard charts
    const base = (PAD.t + ch).toFixed(1);
    const area = d.replace('M' + valid[0].x.toFixed(1) + ',', 'M' + valid[0].x.toFixed(1) + ',' + base + ' L' + valid[0].x.toFixed(1) + ',')
      + ' L' + valid[valid.length-1].x.toFixed(1) + ',' + base + ' Z';
    const gid = 'tg' + Math.random().toString(36).slice(2,7);
    const dots = pts.map((p,i) => p.value != null ? '<circle cx="' + xs(i).toFixed(1) + '" cy="' + ys(p.value).toFixed(1) + '" r="4" fill="#0A1520" stroke="#C9A84C" stroke-width="2"/>' : '').join('');
    const xl = pts.map((p,i) => '<text x="' + xs(i).toFixed(1) + '" y="' + (H-8) + '" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-family="Barlow,sans-serif" font-size="10" font-weight="600">' + esc(String(p.label||'')) + '</text>').join('');
    const yt = [minY, (minY+maxY)/2, maxY].map(v => '<line x1="' + PAD.l + '" y1="' + ys(v).toFixed(1) + '" x2="' + (W-PAD.r) + '" y2="' + ys(v).toFixed(1) + '" stroke="rgba(255,255,255,0.06)" stroke-width="1"/><text x="' + (PAD.l-8) + '" y="' + (ys(v)+4).toFixed(1) + '" text-anchor="end" fill="rgba(255,255,255,0.25)" font-family="Barlow,sans-serif" font-size="10" font-weight="600">' + (Math.round(v*10)/10) + '</text>').join('');
    const tl = opts.target != null
      ? '<line x1="' + PAD.l + '" y1="' + ys(opts.target).toFixed(1) + '" x2="' + (W-PAD.r) + '" y2="' + ys(opts.target).toFixed(1) + '" stroke="#C9A84C" stroke-width="1" stroke-dasharray="5,5" opacity="0.35"/><text x="' + (W-PAD.r+4) + '" y="' + (ys(opts.target)+4).toFixed(1) + '" fill="rgba(201,168,76,0.55)" font-family="Barlow,sans-serif" font-size="9" font-weight="700">TGT</text>'
      : '';
    return '<div class="chart-card" style="padding:20px 24px 14px;">' + head
      + '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block;overflow:visible;">'
      + '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#C9A84C" stop-opacity="0.18"/><stop offset="100%" stop-color="#C9A84C" stop-opacity="0.01"/></linearGradient></defs>'
      + yt + tl
      + '<path d="' + area + '" fill="url(#' + gid + ')" stroke="none"/>'
      + '<path d="' + d + '" fill="none" stroke="#C9A84C" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>'
      + dots + xl
      + '</svg></div>';
  },

  nextWeekNum() {
    const weeks = this.data?.weeks || [];
    if (weeks.length === 0) return 1;
    return Math.max(...weeks.map(w => w.week_num || 0)) + 1;
  },

  nextSunday() {
    const d = new Date();
    const diff = (7 - d.getDay()) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
  },

  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }
};

/* ── Global screen namespace (declared in index.html before screen scripts) ── */

/* ── Tooltip helper ── */
function tt(id) {
  return '<span class="tt" data-tt="' + id + '">?</span>';
}

/* ── HTML escape ── */
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ── Reviewed-on staleness note ── */
function reviewedNote(iso) {
  if (!iso) return '';
  const then = new Date(iso);
  if (isNaN(then.getTime())) return '';
  const days = Math.floor((Date.now() - then.getTime()) / 86400000);
  const when = days <= 0 ? 'today' : days === 1 ? 'yesterday' : days + ' days ago';
  const stale = days > 30;
  return '<div style="font-size:11px;color:' + (stale ? 'var(--gold)' : 'var(--t3)')
    + ';margin-bottom:10px;">Last reviewed ' + when
    + (stale ? ' — consider updating' : '') + '</div>';
}

/* ── Auth UI ── */
function wireAuth() {
  const show = (id) => {
    ['auth-login','auth-reset'].forEach(x => document.getElementById(x).style.display = x===id?'':'none');
  };
  document.getElementById('show-reset')?.addEventListener('click',  () => show('auth-reset'));
  document.getElementById('show-login2')?.addEventListener('click', () => show('auth-login'));

  document.getElementById('login-btn')?.addEventListener('click', async () => {
    const email = document.getElementById('login-email').value.trim();
    const pass  = document.getElementById('login-password').value;
    const err   = document.getElementById('login-error');
    const btn   = document.getElementById('login-btn');
    if (!email || !pass) { err.textContent='Enter email and password.'; err.style.display='block'; return; }
    btn.textContent='Signing in...'; btn.disabled=true;
    const {error} = await DB.signIn(email, pass);
    btn.textContent='Sign In'; btn.disabled=false;
    if (error) { err.textContent=error.message; err.style.display='block'; }
    else err.style.display='none';
  });

  ['login-email','login-password'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => { if (e.key==='Enter') document.getElementById('login-btn')?.click(); });
  });

  document.getElementById('reset-btn')?.addEventListener('click', async () => {
    const email = document.getElementById('reset-email').value.trim();
    const msg   = document.getElementById('reset-msg');
    const btn   = document.getElementById('reset-btn');
    if (!email) { msg.style.color='var(--red)'; msg.textContent='Enter your email.'; msg.style.display='block'; return; }
    btn.textContent='Sending...'; btn.disabled=true;
    const {error} = await DB.resetPassword(email);
    btn.textContent='Send Reset Link'; btn.disabled=false;
    msg.style.color = error ? 'var(--red)' : 'var(--gold)';
    msg.textContent = error ? error.message : 'Reset link sent. Check your email.';
    msg.style.display='block';
  });

  document.getElementById('set-pw-btn')?.addEventListener('click', async () => {
    const pw1 = document.getElementById('set-pw1').value;
    const pw2 = document.getElementById('set-pw2').value;
    const msg = document.getElementById('set-pw-msg');
    const btn = document.getElementById('set-pw-btn');
    if (!pw1 || pw1.length < 8) { msg.style.color='var(--red)'; msg.textContent='Password must be at least 8 characters.'; msg.style.display='block'; return; }
    if (pw1 !== pw2) { msg.style.color='var(--red)'; msg.textContent='Passwords do not match.'; msg.style.display='block'; return; }
    btn.textContent='Saving...'; btn.disabled=true;
    const { data: updateData, error } = await DB._sb.auth.updateUser({ password: pw1 });
    if (error) {
      btn.textContent='Set Password and Sign In'; btn.disabled=false;
      msg.style.color='var(--red)'; msg.textContent=error.message; msg.style.display='block';
    } else {
      msg.style.color='var(--gold)'; msg.textContent='Password set. Signing you in...'; msg.style.display='block';
      // Manually boot since SIGNED_IN may not re-fire after updateUser
      await App.loadAllData();
      App.subscription = await DB.getSubscription();
      App.boot();
    }
  });

  document.getElementById('signout-btn')?.addEventListener('click', async () => {
    await DB.signOut();
    App.showAuth();
  });
}

/* ── Boot ── */
document.addEventListener('DOMContentLoaded', () => {
  // Nav items are injected dynamically   wired in App._renderNav()
  // Settings button routes to correct settings screen based on active module
  document.getElementById('nav-settings')?.addEventListener('click', () => {
    const screen = App._activeModule === 'revenue' ? 'r-settings' : App._activeModule === 'traffic' ? 't-settings' : 'settings';
    App.navigate(screen);
  });
  wireAuth();
  App.init();
});
