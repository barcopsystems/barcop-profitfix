'use strict';

/* ── Tooltip engine ── */
const TT = {
  _cur: null,
  _box: document.getElementById('tt-box'),
  defs: {
    'container-size': {t:'Container Size',b:'The total size of the bottle, can, or keg you purchase. Pick from the list, Bar Cop converts to ounces automatically.',e:'750ml bottle of vodka = 25.4 oz'},
    'std-pour':       {t:'Standard Pour',b:'How many ounces you pour per drink. Used to calculate Cost Per Pour and track inventory variance.',e:'Spirits: 1.5 oz · Wine: 5 oz · Draft: 16 oz'},
    'unit-cost':      {t:'Unit Cost',b:'What you pay per bottle, can, or keg. Use your invoice price.',e:'Case of Tito\'s 750ml costs $180 = $15/bottle'},
    'menu-price':     {t:'Menu Price',b:'What you charge the guest per drink or serving.',e:'$10 for a cocktail · $6 for a draft beer'},
    'pour-cost-pct':  {t:'Pour Cost %',b:'Cost Per Pour divided by Menu Price. Lower is better. Industry benchmark 18-22%.',e:'$0.35 cost / $8 menu price = 4.4%'},
    'sh-bar-pour':    {t:'Bar Pour Cost % Target',b:'The pour cost percentage you are trying to hit on bar product. Industry benchmark is 22%. High-volume bars run 18-20%. If you are above 26% you have a cost or theft problem. Adjust this to match your ownership goal.',e:'22% is the standard starting benchmark'},
    'sh-food-cost':   {t:'Food Cost % Target',b:'Food cost as a percentage of food revenue. Industry benchmark is 28-32% depending on concept. Full-service restaurants typically run 30-32%. Fast casual runs lower. Set this to your target, not your current number.',e:'32% is the standard starting benchmark'},
    'sh-bar-labor':   {t:'Bar Labor % Target',b:'Bar staff payroll divided by bar revenue. Includes bartenders, barbacks, and bar management. Does not include kitchen or floor staff. Industry benchmark is 25-30%.',e:'28% is the standard starting benchmark'},
    'sh-food-labor':  {t:'Food Labor % Target',b:'Kitchen and food staff payroll divided by food revenue. Includes cooks, prep, and kitchen management. Full-service kitchen benchmark is 28-32%.',e:'30% is the standard starting benchmark'},
    'sh-labor-cost':  {t:'Labor Cost % Target',b:'Total labor (bar plus kitchen plus floor) divided by total revenue. Industry benchmark is around 30% for a full-service operation. Set this to your target, not your current number.',e:'30% is the standard starting benchmark'},
    'sh-prime-cost':  {t:'Prime Cost % Target',b:'Combined COGS and labor as a percentage of total revenue. The single most important number in your operation. Below 60% is healthy. Above 65% and you have a problem that weekly data will surface fast.',e:'60% is the standard starting benchmark'},
    'sh-cash-tol':    {t:'Cash Over/Short Tolerance',b:'The maximum dollar amount you treat as acceptable for a drawer to be off before flagging it. Cash Reconciliation uses this threshold to show green or red on each shift count.',e:'$10 is typical. Anything over $10 over or short triggers a flag'},
    'cc-pos-expected':{t:'Expected Cash (POS)',b:'What your POS says should be in the drawer: opening bank plus cash sales, minus any payouts or drops. Bar Cop compares your counted cash to this and flags the over or short.',e:'Opening bank $300 + $642 cash sales = $942 expected'},
    'hs-ann-bar-rev': {t:'Annual Bar Revenue',b:'Your total bar and beverage sales for the last 12 months. This is the base number Bar Cop multiplies against every bar metric to show the real dollar weight of each gap. A 2-point pour cost overage on $480,000 in bar sales is $9,600 a year walking out the door, not an abstract percentage. The audit, the weekly money readout, the recovery scoreboard, and every dashboard dollar figure scale off this number. Estimate is fine. Most operators know their bar number within a few thousand. The closer it is to your real top line, the more honest every weekly and annual figure in the app gets.',e:'$480,000 annual bar revenue scales a 2% pour cost gap to $9,600 per year'},
    'hs-ann-food-rev':{t:'Annual Food Revenue',b:'Your total food sales for the last 12 months. Bar Cop scales every food cost gap, prime cost gap, and labor figure into annual dollar terms using this number. A 3-point food cost overage on $320,000 in food sales reads as $9,600 a year. Without it, Bar Cop can still calculate percentages but the dollar impact stays abstract. Estimate is fine if you do not have the exact figure on hand. Update it any time you pull a more accurate total off your books or your accountant gives you a year-end number.',e:'$320,000 annual food revenue scales a 3% food cost gap to $9,600 per year'},
    'pours-bottle':   {t:'Pours Made',b:'Actual pours calculated from your inventory count. Bottles used × pours per bottle. This is what actually left the bar this week.',e:'3.4 bottles used × 16.9 pours per bottle = 57.5 pours made'},
    'cost-pour':      {t:'Cost Per Pour',b:'Unit Cost ÷ Pours Per Bottle. What one drink costs you. Calculated automatically.',e:'$15 bottle ÷ 16.9 pours = $0.89/pour'},
    'kitchen-unit':   {t:'Unit of Measure',b:'The unit you order and count this product in.',e:'Chicken: lb · Lime juice: each · Margarita mix: bag'},
    'kitchen-cost':   {t:'Unit Cost',b:'What you pay per unit of this product.',e:'Chicken: $3.20/lb · Lime carton: $4.50/each'},
    'recipe-pours':   {t:'Pours',b:'How many standard pours of this spirit go in this drink. 1 = one standard pour.',e:'1 pour rum + 0.5 pour triple sec'},
    'recipe-bottles': {t:'Bottles',b:'How many full bottles go into the batch. Use decimals for partial bottles.',e:'2 bottles tequila + 0.5 bottle triple sec'},
    'batch-yield':    {t:'Batch Yield',b:'Total amount this batch makes. Pick the unit, Bar Cop converts to oz to calculate servings.',e:'1 gallon frozen margarita mix = 128 oz'},
    'serving-size':   {t:'Serving Size',b:'How much goes in one drink. Bar Cop divides yield by serving size to get servings per batch.',e:'5 oz per drink from 128 oz batch = 25.6 drinks'},
    'servings-batch': {t:'Servings Per Batch',b:'Batch Yield ÷ Serving Size. Calculated automatically. Verify this makes sense.',e:'128 oz ÷ 5 oz = 25.6 drinks'},
    'recipe-cost-pct':{t:'Recipe Cost %',b:'Total ingredient cost ÷ Menu Price.',e:'$1.20 cost ÷ $8 menu price = 15%'},
    'plate-yield':    {t:'Plates Per Batch',b:'How many plates this recipe produces. Most single-plate recipes are 1.',e:'A pot of chili serving 10 = plate yield of 10'},
    'bar-revenue':    {t:'Bar Revenue',b:'Total bar sales for the week from your POS. Include all drink sales.',e:'Your POS end-of-week bar department total'},
    'bar-cogs':       {t:'COGS',b:'Cost of Goods Sold. What you spent on bar product. Invoices + transfers in − transfers out.',e:'Weekly liquor invoice total: $2,340'},
    'bar-labor':      {t:'Labor',b:'Bar staff payroll. Bartenders, barbacks, bar manager. Not kitchen or floor staff.',e:'Bartender hours × hourly rate'},
    'prime-cost':     {t:'Prime Cost %',b:'(Total Bar COGS + Total Food COGS + Total Labor) ÷ Total Revenue. The most important single number in your operation. Target: 60% or below. Above 65% is a warning sign.',e:'($4,200 bar COGS + $3,800 food COGS + $6,200 labor) ÷ $24,000 revenue = 60.0%'},
    'theoretical':    {t:'Pours Sold (POS)',b:'Number of pours/shots of this product rung in on your POS this week. Pull from your POS sales mix report. Enter as individual shots, not bottles.',e:'POS shows 85 shots of Tito\'s vodka sold this week = enter 85'},
    'variance-units': {t:'Variance (Pours)',b:'Pours Made minus Pours Sold. Near zero = controlled. Positive = more poured than sold (over-pouring or theft). Negative = more rung in than used (check POS entries).',e:'87 pours made, 85 sold = +2 variance (within normal range)'},
    'prev-cost':      {t:'Previous Cost',b:'The Unit Cost currently on file. Pulled automatically from product setup.',e:'Tito\'s was $14.50/bottle'},
    'new-cost':       {t:'New Invoice Cost',b:'The price on your most recent invoice for this product.',e:'New invoice shows $15.75/bottle'},
    'weekly-usage':   {t:'Weekly Usage',b:'How many units you typically use per week. Used to calculate Annual Impact $.',e:'4 bottles of Tito\'s per week'},
    'annual-impact':  {t:'Annual Impact $',b:'Cost Change $ × Weekly Usage × 52 weeks.',e:'+$1.25/bottle × 4/week × 52 = +$260/year'},
    'inv-beg':        {t:'Beginning Inventory',b:'Count of bottles/units on hand at the start of this period. Carried forward from last week\'s ending count.',e:'You had 4.5 bottles of Tito\'s at start of week'},
    'inv-purchases':  {t:'Purchases',b:'Bottles/units received from deliveries during the week. Count what arrived on invoices, not what was ordered.',e:'Received 6 bottles from your weekly liquor order'},
    'inv-end':        {t:'Ending Inventory',b:'Physical count of bottles/units on hand right now. Count partial bottles as decimals.',e:'3.5 bottles remaining = 3 full + one half-full'},
    'inv-used':       {t:'Units Used',b:'Beginning + Purchases − Ending = actual consumption. Calculated automatically. In bottles for bar products.',e:'4.5 + 6 − 3.5 = 7 bottles used this week'},
    'shift-cogs':     {t:'Shift COGS (Product Only)',b:'Bar product cost for this shift: spirits, beer, wine. Do not include labor. Estimate from your weekly invoices divided by number of shifts, or use your POS cost report if available.',e:'Weekly $2,400 bar COGS ÷ 6 shifts = $400/shift'},
    'opening-bank':   {t:'Opening Bank',b:'Cash in the drawer at shift start. Your starting float. Not counted as revenue.',e:'Standard opening bank: $200'},
    'expected-cash':  {t:'Expected Cash from POS',b:'Cash sales total from your POS for this shift.',e:'POS shows $840 in cash sales for the PM shift'},
    'cash-tolerance': {t:'Over/Short Tolerance',b:'Max dollar amount you treat as acceptable for a drawer to be off.',e:'$10 tolerance: $9 over or short = OK. $11 = flagged'},
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
    // This Week shared tooltips
    'tw-week-num':      {t:'Week Number',b:'Sequential week number for your records. Week 1 is your first week entering data. Bar Cop carries this forward automatically each week. Only adjust if you are entering a catch-up week out of sequence.',e:'Week 12 means you have 12 weeks of data in Bar Cop'},
    'tw-period-end':    {t:'Period End Date',b:'The last day of the week you are entering. Most operations close their week on Sunday. Be consistent week over week so your trend data lines up correctly.',e:'Sunday October 13 closes a Monday through Sunday accounting week'},
    'r-sv-covers':      {t:'Server Covers',b:'Total guests this server personally served during the week. Pull from your POS server sales report. This is the denominator in check average, so it must be guest count, not table count.',e:'Server handled 148 guests this week'},
    'r-sv-sales':       {t:'Server Total Sales',b:'Total dollar sales this server rang during the week. Pull from your POS server sales report. Food and beverage combined.',e:'Server rang $5,340 in total sales this week = $36.08 check average'},
    't-ig-followers':   {t:'Instagram Followers',b:'Your current total follower count on Instagram. Log weekly to track growth rate. A consistent upward trend means your content is reaching new people. Flat or declining means posting frequency or content quality needs attention.',e:'1,240 followers this week vs 1,210 last week = 30 new followers'},
    't-fb-followers':   {t:'Facebook Followers',b:'Your current total follower count on your Facebook business page. Facebook reach is lower than Instagram for most bars but the page matters for the 35-plus demographic, event promotion, and local search signals.',e:'2,100 Facebook page followers'},
    // Audit intake tooltips
    'at-ann-bar-rev':   {t:'Annual Bar Revenue',b:'Your total bar and beverage sales for the last 12 months. Used to calculate your annual dollar gap on pour cost and prime cost. Estimate is fine. The audit converts percentage gaps into real dollar figures using this number.',e:'$480,000 annual bar revenue, a 2% pour cost gap = $9,600 per year recoverable'},
    'at-ann-food-rev':  {t:'Annual Food Revenue',b:'Your total food sales for the last 12 months. Used to calculate your annual dollar gap on food cost. The more accurate the number, the more precise your gap calculations will be.',e:'$320,000 annual food revenue, a 3% food cost gap = $9,600 per year recoverable'},
    'at-pos-bev':       {t:'POS Sales Report (Beverages)',b:'Your bar department sales from your POS. Daily or weekly beverage revenue by category. Minimum 4 weeks. Export from Toast, Square, Aloha, or any POS as Excel or CSV.',e:'Toast: Reports > Sales > Sales by Category > Bar'},
    'at-bar-inv':       {t:'Bar Inventory Count Sheets',b:'Physical bar inventory counts with opening count, purchases received, and closing count per product. Minimum 1 week. Best results with 4 weeks.',e:'Opening 12 bottles + 6 purchased - 14 closing = 4 used'},
    'at-exception':     {t:'POS Exception Report',b:'Voids, comps, and no-sale transactions by employee. Shows which employees are voiding checks, issuing comps without approval, and opening the drawer without a sale.',e:'Toast: Reports > Labor > Exception Report'},
    'at-cash':          {t:'Cash Drawer Reconciliation',b:'Daily or weekly cash variance records showing how much each drawer was over or short per shift. Used to identify cash handling gaps and shift-level patterns.',e:'Drawer over $12 on Friday close, repeated pattern over 4 weeks'},
    'at-bev-inv':       {t:'Beverage Invoices',b:'All beverage delivery invoices for the audit period. Used to verify what was delivered versus ordered and to track price changes from your distributors.',e:'Your weekly liquor distributor invoices'},
    'at-vendor':        {t:'Vendor Price List',b:'Current pricing from your distributors or your most recent invoices. Used to identify price drift and negotiation opportunities. 4 weeks shows recent changes. 12 weeks shows the full drift pattern.',e:'Your distributor price sheet or line items on recent invoices'},
    'at-pos-food':      {t:'POS Sales Report (Food)',b:'Kitchen department sales from your POS. Daily or weekly food revenue by category. Send the same date range as your beverage POS report.',e:'Toast: Reports > Sales > Sales by Category > Food'},
    'at-kit-inv':       {t:'Kitchen Inventory Count Sheets',b:'Physical kitchen counts with opening count, purchases, and closing count by product. Used to calculate actual food cost and identify waste and variance.',e:'Opening 10 lbs beef + 5 purchased - 8 closing = 7 lbs used'},
    'at-food-inv':      {t:'Food Invoices',b:'All food delivery invoices for the audit period. Used to verify delivery accuracy and track food cost against purchases.',e:'Your Sysco, US Foods, or produce vendor invoices'},
    'at-recipe':        {t:'Recipe Costing Sheet',b:'Your current recipe costs with ingredients, quantities, and cost per dish. The highest-value file in the audit. Without it, food cost analysis is category-level only. With it the audit calculates yield-corrected cost on every dish and ranks every repricing opportunity by annual dollar impact.',e:'Recipe card showing your burger costs $4.20 to make and sells for $14'},
    'at-prep':          {t:'Daily Prep Sheets',b:'Production logs showing what was prepped versus used by shift. Used to identify production loss, over-prep waste, and yield issues by station.',e:'Prep sheet showing 40 portions prepped, 28 sold, 12 unaccounted'},
    'at-waste':         {t:'Daily Waste Logs',b:'Waste recorded by category for the audit period. Used to calculate weekly spoilage cost and identify waste patterns by product or station.',e:'Waste log showing $340 in produce waste last week'},
    'at-payroll':       {t:'Payroll or Time Clock Data',b:'Hours worked by employee and shift for the audit period. Used to calculate verified prime cost, labor percentage by department, and RPLH. Weekly totals accepted if shift-level detail is not available.',e:'Toast: Reports > Labor > Timeclock Detail'},
    'ra-ann-bar-rev':   {t:'Annual Bar Revenue',b:'Your total bar and beverage sales for the last 12 months. Used to calculate annual revenue gaps and scale check average impact to annual dollar figures. Estimate is fine.',e:'$480,000 annual bar revenue, a $2 check average gap x 15,000 covers = $30,000 per year recoverable'},
    'ra-ann-food-rev':  {t:'Annual Food Revenue',b:'Your total food and dining room sales for the last 12 months. Used alongside bar revenue to calculate total operation size and scale gap calculations to annual dollar impact.',e:'$320,000 annual food revenue'},
    'ra-pos-daily':     {t:'POS Daily Sales Summary',b:'Total revenue by day broken down by category: food, beverage, total. The most important file in the revenue audit. Minimum 4 weeks. Export from your POS as Excel or CSV.',e:'Toast: Reports > Sales > Daily Sales Summary'},
    'ra-menu-mix':      {t:'Menu Sales Mix Report',b:'Items sold and revenue by menu item or category. Item-level detail gives the most complete analysis. Used to identify category concentration and menu engineering opportunities.',e:'Toast: Reports > Menu > Item Selection Report'},
    'ra-menu-prices':   {t:'Menu Price List',b:'Your current menu with item names and selling prices. Used to identify pricing gaps and contribution margin opportunities.',e:'Your current printed menu or a PDF of your menu'},
    'ra-server-sales':  {t:'Server Sales Report',b:'Check average, covers served, and total sales by server for the audit period. The highest-value file in the revenue audit. Unlocks two full scored sections on server performance.',e:'Toast: Reports > Labor > Server Sales Report'},
    'ra-upsell':        {t:'Server Upsell Report',b:'Appetizer captures, dessert captures, and add-on revenue by server per shift. Shows which servers are executing the upsell sequence and which are not.',e:'Toast: Reports > Labor > Product Mix by Server'},
    'ra-preshift':      {t:'Pre-Shift Briefing Log',b:'Any records showing whether pre-shift briefings are running and what is covered. Used to assess whether a performance standard is being communicated to the team.',e:'A weekly pre-shift agenda document or meeting notes'},
    'ra-labor-sched':   {t:'Weekly Labor Schedule',b:'Scheduled hours by position and department with labor cost. Used to calculate RPLH, labor percentage, and schedule efficiency against revenue.',e:'Your scheduling software export (7shifts, HotSchedules, Excel)'},
    'ra-timeclock':     {t:'Time Clock Actuals',b:'Actual hours worked by employee and shift for the audit period. Used to identify clock drift, actual versus scheduled hours, and verified overtime cost.',e:'Toast: Reports > Labor > Timeclock Detail'},
    'ra-labor-dept':    {t:'Labor by Department',b:'Separate labor cost tracking for bar, kitchen, and floor. Used to identify which department is driving labor overage and to set department-level targets.',e:'Payroll breakdown showing bar $3,200, kitchen $4,100, floor $2,800'},
    'ra-events':        {t:'Event Revenue Records',b:'One record per event with date, covers, F&B minimum, and actual spend. Minimum 3 months. Used to calculate event frequency, average event revenue, and minimum compliance rate.',e:'Private dining log showing 8 events last month at average $3,400 spend'},
    'ra-catering':      {t:'Catering Revenue Records',b:'One record per catering booking with date, guests, package type, and total revenue. Used to assess catering program performance and repeat client rate.',e:'Catering log or your booking software export'},
    'ra-rate-card':     {t:'Private Dining Rate Card',b:'Current pricing for private dining including room fees, F&B minimums, and per-head options. Used to assess pricing position and minimum structure against market benchmarks.',e:'Your private dining or events package PDF'},
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
    'r-event-revenue':  {t:'Event Revenue',b:'Actual total spent by the event party including food, beverages, and any room fee. Compare to the F&B minimum to track compliance.',e:'Party spent $4,200 vs $3,500 minimum, 20% above minimum'},
    'r-daypart-rev':    {t:'Daypart Revenue',b:'Total revenue generated during this specific daypart from your POS. Bar = all bar department sales. Lunch = all dining room sales during lunch service. Dinner = all dining room sales during dinner service.',e:'Dinner POS total for the week: $8,400'},
    'r-daypart-hrs':    {t:'Daypart Labor Hours',b:'Total hours worked by all staff scheduled to this daypart. Pull from your scheduling system or time clock by job code or shift.',e:'6 servers x 5 hr lunch shift = 30 lunch labor hours'},
    'r-upsell-calc':    {t:'Upsell Revenue Calculator',b:'Shows the weekly and annual revenue gap between your current team check average and your target. Use this number in pre-shift to make the gap visible to your team.',e:'$33 current avg vs $38 target x 400 covers = $2,000/week gap'},
    'r-price-new':      {t:'Proposed New Price',b:'The price you are considering for this item. The calculator shows you the margin impact and breakeven before you commit to the change.',e:'Current price $13.00, considering raising to $15.00'},
    'r-vol-change':     {t:'Estimated Volume Change',b:'How much you expect covers to change as a percentage if you change the price. Negative means fewer covers. Use 0 if you expect no change.',e:'-10% means you expect to sell 10% fewer of this item at the new price'},
    'r-contrib-margin-eng': {t:'Contribution Margin',b:'Menu price minus item cost. What each sale contributes to covering overhead and profit after product cost is deducted.',e:'$15 price - $4.50 cost = $10.50 contribution margin'},
    'r-event-covers':   {t:'Event Covers',b:'Total guests at the event. Used with F&B minimum to calculate per-head minimum and track whether events are on pace.',e:'40-guest corporate dinner'},
    // Inventory Control tooltips
    'ic-par-level':     {t:'Par Level',b:'The target quantity to keep on hand for this product. When a count drops below par, the Order Sheet flags it for reordering. Set it to cover normal usage between deliveries plus a small safety buffer.',e:'You use 6 bottles of well vodka a week and order weekly, so par is 8'},
    'ic-reorder-point': {t:'Reorder Point',b:'The on-hand quantity that should trigger a reorder. Set it a little above zero so you never run out before the next delivery arrives. The Order Sheet flags any product at or below this point.',e:'A reorder point of 2 bottles means you reorder once only 2 are left'},
    'ic-par-window':    {t:'Window (weeks)',b:'How many recent weeks of counts Bar Cop averages to read your usage. A wider window smooths out one busy or slow week; a tighter window reacts faster to a real change in how fast something moves.',e:'8 weeks averages roughly two months of real draw'},
    'ic-par-buffer':    {t:'Buffer (%)',b:'Extra cushion added on top of expected usage so a busy stretch does not run you dry before the next delivery. Higher buffer means fewer stock-outs but more cash tied up in stock.',e:'A 30% buffer on 10 units of usage suggests a par of 13'},
    'ic-par-cycle':     {t:'Default Delivery Cycle',b:'How often you reorder, in days. Bar Cop reads each product\'s real cycle from its vendor\'s Delivery Days when those are set, and falls back to this default when they are not. A par covers one cycle of usage plus the buffer.',e:'Order weekly = 7 days. A vendor delivering Mon and Thu works out to about every 3 to 4 days'},
    'ic-pours-container':{t:'Pours Per Container',b:'Container Size divided by Pour Size. How many standard pours one full container yields. Calculated automatically.',e:'A 750ml bottle of 25.4 oz at a 1.5 oz pour = 16.9 pours'},
    'ic-product-name':  {t:'Product Name',b:'How this product shows up everywhere in Bar Cop: Take Inventory, Order Sheet, Receive Delivery, Profit Recovery reports. Use the name your bar staff would say at a glance, not the distributor SKU.',e:'Use "Tito\'s Handmade Vodka 750ml" rather than "TITOS-VOD-750-USA"'},
    'ic-brand':         {t:'Brand',b:'The producer or label, kept separate from product name so reports can group by brand. Optional, leave blank if it does not apply.',e:'Tito\'s · Republic National · Austin Beerworks'},
    'ic-subcategory':   {t:'Sub-Category',b:'Groups your product list by style so you can scan what you carry at a glance. Pick a suggestion or type your own; products with the same sub-category group together on the Products list and Set Locations.',e:'Liquor: Vodka, Bourbon, Tequila · Wine: Red, White, Sparkling · Bottle Beer: Domestic, Import, Craft'},
    'ic-primary-vendor':{t:'Primary Vendor',b:'The vendor you order this product from. Set up vendors on the Vendors screen first. The Order Sheet groups reorder suggestions by vendor, and Email to Vendor pulls the right contact info from this field.',e:'Republic National for spirits, Glazer\'s for beer, Sysco for food'},
    'ic-primary-location':{t:'Primary Location',b:'The physical spot in your bar or kitchen where this product lives. Set up locations on the Locations screen. Take Inventory walks you through one location at a time so counting matches the way you move through the room.',e:'Front Bar · Back Bar · Walk-In Cooler · Dry Storage'},
    'ic-bottle-size':   {t:'Bottle Size',b:'The size of one bottle in ounces. For spirits and wine this drives how many pours you get per bottle and the cost per pour. Pick from the list, Bar Cop converts ml to oz automatically.',e:'750ml = 25.4 oz · 1L = 33.8 oz · 1.75L = 59.2 oz'},
    'ic-bottle-size-beer':{t:'Bottle Size',b:'How big each individual bottle is. The cost-per-pour math for bottle beer uses Cost per Case divided by Case Size, not this field, but it is here so reports can show what is in the bottle.',e:'12 oz domestic · 16 oz tall boy · 22 oz bomber'},
    'ic-keg-size':      {t:'Keg Size',b:'The total volume of one full keg. 1/2 BBL is the standard size (1984 oz, about 124 pints). 1/4 BBL is half that. 1/6 BBL is one-third. Pick from the list, Bar Cop converts to ounces.',e:'1/2 BBL = 1984 oz · 1/4 BBL = 992 oz · 1/6 BBL = 661 oz'},
    'ic-case-size':     {t:'Case Size',b:'How many bottles come in one case. Bottle beer is ordered, received, and counted in cases, so this is the number Bar Cop divides your cost-per-case by to get the per-bottle cost the math needs.',e:'Common case sizes: 6, 12, 18, 24, 30'},
    'ic-unit-type':     {t:'Unit Type',b:'The unit you buy and count this item in. Picking the right unit keeps par levels and cost-per-unit consistent across vendors and reports.',e:'lb for items by weight · each for items counted individually · case or bag for bulk · gallon or quart for liquids'},
    'ic-cost-per-bottle':{t:'Cost per Bottle',b:'What you pay your vendor for one bottle, taken straight off the invoice. Bar Cop divides by pours per bottle to get the cost per pour the menu math needs. When a delivery comes in at a new price and you confirm it on Receive Delivery, Bar Cop updates this cost for you, so you never have to remember to.',e:'Case of Tito\'s 750ml at $180 = $15 per bottle'},
    'ic-cost-per-case': {t:'Cost per Case',b:'What you pay for one full case. Bar Cop divides by Case Size to get the per-bottle cost, so pour cost percentage stays accurate. Enter per-case, not per-bottle. When a delivery comes in at a new price and you confirm it on Receive Delivery, Bar Cop updates this cost for you, so you never have to remember to.',e:'A case of 24 Modelo Especial at $32.40 = $32.40 per case (Bar Cop figures the $1.35 per bottle)'},
    'ic-cost-per-keg':  {t:'Cost per Keg',b:'What you pay your distributor for one full keg. Bar Cop divides by pours per keg (keg size divided by pour size) to get the cost-per-pour the menu math needs. When a delivery comes in at a new price and you confirm it on Receive Delivery, Bar Cop updates this cost for you, so you never have to remember to.',e:'1/2 BBL of Pearl Snap at $165 with a 16 oz pour: 1984 oz / 16 = 124 pours, $165 / 124 = $1.33 per pint'},
    'ic-cost-per-unit': {t:'Cost per Unit',b:'What you pay per unit you set in Unit Type. Pull from your most recent invoice for that item. When a delivery comes in at a new price and you confirm it on Receive Delivery, Bar Cop updates this cost for you, so you never have to remember to.',e:'Ground beef at $4.20 per pound, romaine at $22 per case, simple syrup at $3.50 per quart'},
    'ic-draft-pour':    {t:'Standard Pour',b:'Your standard glass size for this draft, usually 16 oz for a pint. Cost per Pour uses this number. If you also serve pitchers, growlers, or half-pours, each one is a separate menu item in Revenue Recovery with its own recipe that draws the right ounces from this keg (a 60 oz pitcher recipe pulls 60 oz). Variance against your POS adds them all up correctly.',e:'16 oz pint is standard. 12 oz "small" and 60 oz pitcher live as separate menu items in Revenue Recovery'},
    'ic-notes':         {t:'Notes',b:'Free-form notes for your own reference. Anything that helps you or a new manager understand this product. Does not show up on operational screens.',e:'Substitute for Espolon when out, vendor only delivers Tuesday, holiday seasonal item'},
    'ic-cost-per-bottle-calc':{t:'Cost per Bottle',b:'Cost per Case divided by Case Size. Per-bottle cost Bar Cop uses for pour cost math.',e:'$32.40 case / 24 bottles = $1.35 per bottle'},
    'ic-bottles-per-case':{t:'Bottles per Case',b:'Echo of the Case Size you set above, shown alongside the per-bottle cost for quick sanity check.',e:'24 bottles in a case of standard domestic beer'},
    'pb-yield':       {t:'Batch Yield',b:'How much the entire batch makes when you finish it. Set the amount and the unit. Bar Cop divides this by the serving size to figure out how many servings one batch yields.',e:'A frozen margarita mix that makes 1 gallon = 1 + gallons'},
    'pb-serving':     {t:'Serving Size',b:'How much one drink or plate pulls from the batch. Bar Cop divides the batch yield by this to get servings per batch, then splits the batch cost across them.',e:'5 oz of mix per frozen margarita'},
    'pb-spb':         {t:'Servings Per Batch',b:'Batch Yield divided by Serving Size. How many servings one finished batch makes. Calculated for you from the two fields to its left.',e:'1 gallon (128 oz) at 5 oz a serving = 25.6 servings'},
    'pb-ing-qty':     {t:'Quantity',b:'How much of this ingredient the whole batch uses, in the product\'s own unit: bottles for spirits and wine, units for everything else. The line cost is this times the product\'s current cost.',e:'2 bottles of tequila in the margarita mix'},
    'ic-liquor-pour':   {t:'Pour Size',b:'Your standard pour for this liquor, the amount that goes into a single well drink or shot. Cost per Pour is built off this. Leave it on your house standard; if you also sell doubles or happy hour pours, add them under Other Sizes Sold.',e:'A 1.5 oz pour out of a 25.4 oz bottle yields about 16.9 pours'},
    'ic-liquor-pour-price':{t:'Pour Price',b:'What a single standard pour of this liquor rings up for on its own, a well drink or a shot. This sets the pour cost percent for the standard pour. Other prices like doubles or happy hour go under Other Sizes Sold.',e:'A $7 well pour on a $1.10 cost pour is a 16% pour cost'},
    'ic-wine-glass-size':{t:'Glass Size',b:'The size of one pour by the glass, in ounces. This drives how many glasses you get out of a bottle and the cost per glass. Selling this wine only by the bottle? Set the glass size equal to the bottle size so one pour is the whole bottle.',e:'A 6 oz glass out of a 25.4 oz bottle is about 4.2 glasses'},
    'ic-wine-glass-price':{t:'Glass Price',b:'What one glass of this wine sells for. This sets the pour cost percent for the by-the-glass pour. If you also sell the whole bottle at a different price, add it under Other Sizes Sold.',e:'An $8 glass on a $1.65 cost glass is a 21% pour cost'},
    'ic-draft-pour-price':{t:'Pour Price',b:'What your standard draft pour sells for, usually the pint price. This sets the pour cost percent for the standard pour. Pitchers, half-pours, and happy hour go under Other Sizes Sold, each with its own price.',e:'A $6 pint on a $1.33 cost pour is a 22% pour cost'},
    'ic-beer-bottle-price':{t:'Price per Bottle',b:'What one bottle of this beer rings up for. Bottle beer is sold by the bottle, so this is the per-bottle menu price. Cost per Case divided by Case Size gives the per-bottle cost behind your pour cost percent.',e:'A $6 bottle on a $1.35 per-bottle cost is a 22% pour cost'},
    'ic-serving-sizes': {t:'Other Sizes Sold',b:'The other ways this same bottle or keg sells, beyond your standard pour above. Each size carries its own price and shows its own pour cost, because a bigger or discounted size is a different margin. Your shelf is still counted as one pool; this just captures the extra price points so each size reads honest.',e:'A 60 oz pitcher at $18 added alongside your standard pour'},
    'ic-serving-sizes-liquor':{t:'Other Pours Sold',b:'Other pours of this liquor beyond your standard pour above. A double at twice the ounces, a happy hour pour at a lower price, a tall well. Each carries its own price and reads its own pour cost, because a discounted or larger pour is a different margin. The bottle is still one counted pool.',e:'Standard 1.5 oz at $7, plus a Double at 3 oz / $12 added here'},
    'ic-serving-sizes-wine':{t:'Other Sizes Sold',b:'Other ways this wine sells beyond the glass above. The common one is by the bottle: add a size set to the bottle ounces, priced at your bottle price. A split or half-bottle is the same idea at its own size. Each reads its own pour cost. The shelf is still one counted pool.',e:'Glass 6 oz at $8, plus a Bottle at 25.4 oz / $21 added here'},
    'ic-serving-sizes-draft':{t:'Other Sizes Sold',b:'Other sizes this draft sells beyond your standard pour above. A 12 oz short, a 60 oz pitcher, a happy hour pint. Each carries its own price and reads its own pour cost, because a pitcher and a pint are different margins. The keg is still one counted pool.',e:'Pint 16 oz at $7, plus a Pitcher at 60 oz / $18 added here'},
    'sp-restock':     {t:'Restocked Mid-Shift',b:'Full bottles you brought up from storage and added to the bar after the pre-shift count. Bar Cop adds these to what you started with, so the amount used comes out honest.',e:'Pre-shift 3 bottles, restocked 6 mid-shift, post-shift 4 means you used 5, not 1'},
    'sp-restock-keg': {t:'Restocked Mid-Shift',b:'Fresh kegs you tapped after the pre-shift count. Bar Cop adds them to the keg you started with so the pour count stays honest across a keg change.',e:'Started near empty, blew the keg and tapped a fresh one, count the fresh keg here'},
    'dr-bank':        {t:'Default Opening Bank',b:'The starting cash this drawer normally opens with. Bar Cop pre-fills the opening bank when you start a shift on this drawer, so you are not retyping it every day. Leave it blank if the bank varies.',e:'Main bar opens with $300 every night'},
    'cs-tolerance':   {t:'Cash Variance Tolerance',b:'The most a drawer can be off before Bar Cop flags it. A count under this stays green; over it flags the shift on the Variance Log, Cash Reconciliation, and the Handoff Report.',e:'$10 tolerance: a drawer $7 short is fine, $14 short flags'},
    'ccs-threshold':  {t:'Comp Authorization Threshold',b:'Comps above this dollar amount require a manager in the Authorized By field on the Void and Comp Log. Default $25. Set it to 0 to disable the warning entirely.'},
    'sp-pos-pours':   {t:'POS Pours Sold',b:'Pours your POS rang in for this product this shift. Bar Cop compares it to what your pre and post counts say you poured. A large gap points to overpouring, give-aways, or theft.',e:'Counts say 40 pours left the bottle, POS rang 33, that is 7 pours unaccounted for'},
    'sp-pos-btl':     {t:'POS Bottles Sold',b:'Bottles your POS rang in for this beer this shift. Bar Cop compares it to the bottles your counts say left the cooler. A gap is give-aways, walk-offs, or theft.',e:'Counts say 48 bottles left the cooler, POS rang 44, that is 4 bottles unaccounted for'},
    'rd-qty':         {t:'Qty Received',b:'How many you actually counted off the truck, not what the invoice claims. If it comes up short of what you ordered, Bar Cop flags the line so you can claim the credit. Bottle beer is counted in cases.',e:'Ordered 6, only 5 showed up, enter 5'},
    'rd-price':       {t:'Unit Price',b:'What the vendor charged per unit on this invoice. It pre-fills from your master cost. Change it to match the invoice and Bar Cop flags the difference so you can apply the new cost or dispute it. Bottle beer price is per case.',e:'Master cost $14.50, invoice shows $15.75, enter 15.75'},
    'em-qty':         {t:'Quantity',b:'How many empty containers you are logging in this entry. Count the actual empties you are clearing. Bar Cop knows the unit from the product: kegs for draft, bottles for everything else.',e:'18 empty bottles pulled off the bar = 18'},
    'em-deposit':     {t:'Deposit',b:'The deposit charged per container, if there is one. Bar Cop multiplies it by the quantity to track the money you can claim back when you return them. Leave it blank when there is no deposit.',e:'5 cents a can in a deposit state = 0.05'},
    'adj-qty':        {t:'Quantity',b:'How much you are adjusting out or in, in the unit shown next to it. Bar Cop multiplies it by the product cost to estimate the dollar value of the write-off or the find.',e:'3 bottles of well vodka damaged in storage = 3'},
    'rpt-u-usage':    {t:'Usage Data',b:'Per-product consumption for the period: starting stock, purchases, ending, units used, and the cost and theoretical sales behind it.'},
    'rpt-u-totals':   {t:'Usage Totals',b:'The period rolled up: total usage cost, theoretical sales and profit, broken out by category.'},
    'rpt-u-history':  {t:'Usage History',b:'Usage cost and theoretical profit for every count period, so you can watch the trend over time.'},
    'rpt-m-fast':     {t:'Fast Movers',b:'Your top products by usage dollars this period. Ranked by money so a cheap high-volume item and a pricey low-volume one compare fairly.'},
    'rpt-m-slow':     {t:'Slow Movers',b:'Your bottom products by usage dollars. Slow movers tie up cash and risk spoiling. Filter by category to compare like with like.'},
    'rpt-m-trend':    {t:'Trend vs Prior',b:'How each product moved this period versus the period before, biggest swing first. Spot a product taking off or falling off.'},
    'rpt-m-vendor':   {t:'Vendor Spend',b:'Your usage cost grouped by vendor. Shows who you spend the most with, your leverage when you sit down to negotiate pricing.'},
    'rpt-s-category': {t:'By Category',b:'Current on-hand value from your latest count, grouped by category, with each category\'s share of your total stock.'},
    'rpt-s-location': {t:'By Location',b:'Current on-hand value grouped by where it is stored, so you know how much cash sits in each room.'},
    'rpt-s-prior':    {t:'vs Last Count',b:'How your stock value changed from the last count to this one, by category. Rising value can mean you are over-ordering.'},
    'rpt-s-highest':  {t:'Highest Value',b:'The ten products holding the most cash on your shelves right now.'},
    'rpt-s-lowest':   {t:'Lowest Value',b:'The ten products holding the least value on hand right now.'},
    'rpt-s-dead':     {t:'Dead Stock',b:'Products you are holding value in but barely touched this period. Dead cash and spoilage risk, your cue to stop re-ordering or cut the item.'},
    'rpt-v-sales':    {t:'Sales Variance',b:'What your poured product should have rung up versus what the POS actually rang. A gap is product that left without a matching sale.'},
    'rpt-v-usage':    {t:'Usage Variance',b:'What your counts say you used versus what the POS sold, after comps and waste, in each category\'s own unit: ounces, pours and bottles for liquor and wine, ounces and kegs for draft, bottles and cases for bottle beer, quarts for mixers, and the ingredient\'s own unit for food. Positive variance is unexplained loss: over-pour, theft, over-portioning, or a count error.'},
    'vr-unmatched':   {t:'Unmatched POS Products',b:'POS rows that did not line up with a product or a menu item by name. Map each one to the right product or menu item from the dropdown, or leave it skipped if it is not something you track. Menu items like cocktails and plates explode through their recipe, so each ingredient gets its share of the variance.'},
    'vr-std-liquor':  {t:'Liquor Standard',b:'Liquor is poured by the ounce, so a little variance is normal from over-pour and spillage. Set the most you will accept; anything over this percent flags to investigate, below it is OK. Keep it tight to catch heavy free-pouring and theft. Change it to your own pour discipline.'},
    'vr-std-wine':    {t:'Wine Standard',b:'Wine by the glass carries a touch more variance than liquor because of the last glass in the bottle. Set the most you will accept; over it flags. Wine sold by the bottle is judged under By the Bottle instead, not here.'},
    'vr-std-draft':   {t:'Draft Standard',b:'Draft runs the widest because foam, line cleaning, and keg ends all cost ounces. Set the most you will accept; over it flags. Loosen or tighten it to match your tap system.'},
    'vr-std-bottle':  {t:'By the Bottle Standard',b:'Covers anything sold by the bottle: bottle beer, wine by the bottle, and champagne splits. It is simple bottle-in, bottle-out, so there is no pour variance to forgive. Bar Cop flags the moment this many bottles are unaccounted, after comps and waste come out. Set it to 1 to catch every missing bottle, higher to allow for honest miscounts.'},
    'vr-std-misc':    {t:'Mixer Standard',b:'Mixers are measured by eye in the quart, so the line sits wider. Set the most you will accept; over it usually means waste or a recipe that has drifted from the pour. Adjust to taste.'},
    'vr-std-food':    {t:'Food Standard',b:'Food carries real yield and trim loss, but over-portioning is a true cost leak. Set the most you will accept; over it flags. Tighten or loosen it to match how tightly your kitchen portions.'},
    'lws-min-wage':   {t:'State Minimum Wage',b:'The hourly minimum wage in your state. Bar Cop uses it for one thing: the tip-credit check on the payroll worksheet. If a tipped employee\'s base wage plus their tip share comes out below this for the week, Bar Cop flags the row on Pay Periods so you can make up the difference before payroll runs. Leave it blank if your state does not allow a tip credit or you do not run tip-credit math. This value is for planning and payroll review only. Verify the current wage and tip-credit rules for your jurisdiction before processing payroll.'},
    'bs-tmpl-name':   {t:'Template Name',b:'Name this week to also save it as a reusable template when you save the schedule. Leave it blank to just post the schedule with no template. If you loaded a template, its name is already here: keep it to update that template, or change it to save a new one under the new name.'},
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

    // Browser back/forward walks the in-app history stack instead of leaving
    // the site. _navigationLock suppresses re-pushing while popstate handles
    // the navigation so we don't grow the history stack on every back-step.
    window.addEventListener('popstate', (e) => {
      if (!e.state) return;
      this._navigationLock = true;
      try {
        if (e.state.mode === 'hub') {
          this.showHub();
        } else if (e.state.screen) {
          if (e.state.module && e.state.module !== this._activeModule) this.showApp(e.state.module);
          this.navigate(e.state.screen);
        }
      } finally {
        this._navigationLock = false;
      }
    });
    this._wireSyncLifecycle();
    this._initFloatNav();
    if (new URLSearchParams(window.location.search).get('demo') === '1') {
      await this.startDemo();
      return;
    }
    if (!window.SUPABASE_URL) {
      await this.loadAllData();
      this.boot();
      return;
    }
    // Check if this is a password recovery OR invite link before checking session.
    // Recovery: Supabase fires PASSWORD_RECOVERY. Invite: Supabase fires SIGNED_IN
    // (but the user has no password yet, so we still show the set-password panel
    // so they can sign in normally next time).
    const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
    const linkType = hashParams.get('type');
    const needsPasswordSetup = linkType === 'recovery' || linkType === 'invite';
    if (needsPasswordSetup) {
      this.showAuth();
      let inviteSetupArmed = linkType === 'invite';
      DB.onAuthChange(async (event, session) => {
        if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && inviteSetupArmed)) {
          // Show the set-password panel (used by both recovery and first-invite flows)
          ['auth-login','auth-reset','auth-set-password'].forEach(x => {
            const el = document.getElementById(x);
            if (el) el.style.display = x === 'auth-set-password' ? '' : 'none';
          });
          inviteSetupArmed = false;  // consume the one invite SIGNED_IN event
        } else if (event === 'SIGNED_IN' && session) {
          // Same visibility-change guard as the main handler below: Supabase v2
          // re-fires SIGNED_IN on tab focus, don't re-boot if already booted.
          if (this._bootedUserId === session.user?.id) return;
          this._bootedUserId = session.user?.id || null;
          await this.loadAllData();
          this.subscription = await DB.getSubscription();
          this.boot();
        } else if (event === 'SIGNED_OUT') {
          this._bootedUserId = null;
          this.data = null;
          this.subscription = { status: 'inactive', plan: null, active_modules: [], period_end: null };
          this.showAuth();
        }
      });
      return;
    }
    const session = await DB.getSession();
    if (session) {
      this._bootedUserId = session.user?.id || null;
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
        // Supabase v2 re-emits SIGNED_IN whenever the tab regains visibility
        // (e.g., closing a print pop-up). Without this guard, the handler
        // re-runs boot() and bounces the operator back to Hub Dashboard,
        // losing whatever module/screen they were on.
        if (this._bootedUserId === session.user?.id) return;
        this._bootedUserId = session.user?.id || null;
        await this.loadAllData();
        this.subscription = await DB.getSubscription();
        this.boot();
      } else if (event === 'SIGNED_OUT') {
        this._bootedUserId = null;
        this.data = null;
        this.subscription = { status: 'inactive', plan: null, active_modules: [], period_end: null };
        this.showAuth();
      }
    });
  },

  /* ── Demo mode ────────────────────────────────────────────────────────────
     ?demo=1 boots a sandboxed, fully populated demo: no auth, no persistence,
     resets on every load. Paid-value actions (running audits, PDF export, AI
     insights) are gated behind sign-up via demoBlock(). */
  demoMode: false,

  async startDemo() {
    this.demoMode = true;
    DB._demo = true;
    this.data          = DB._defaultData();
    this.inventoryData = {};
    this.laborData     = {};
    this.shiftData     = {};
    this.subscription  = { status:'demo', plan:'demo', active_modules:['profit','revenue','cash'], period_end:null };
    await S.HubSettings.loadSample();
    window.print = function () { App.demoBlock('Exporting to PDF'); };
    this._mountDemoBanner();
    this.showHub();
  },

  _mountDemoBanner() {
    if (document.getElementById('demo-banner')) return;
    document.body.classList.add('demo');
    const style = document.createElement('style');
    style.id = 'demo-css';
    style.textContent =
      'body.demo #app{margin-top:40px;height:calc(100vh - 40px);}'
      + 'body.demo #hub-wrapper{top:40px !important;}'
      + '#demo-banner{position:fixed;top:0;left:0;right:0;height:40px;z-index:200;'
      + 'display:flex;align-items:center;gap:14px;padding:0 16px;background:var(--gold);'
      + 'color:#000;box-shadow:0 2px 8px rgba(0,0,0,0.45);}';
    document.head.appendChild(style);
    const bar = document.createElement('div');
    bar.id = 'demo-banner';
    bar.innerHTML = '<span style="font-size:11px;font-weight:700;letter-spacing:0.03em;flex:1;">'
      + 'Bar Cop demo. Explore every screen freely. Running audits, exporting PDFs, and AI insights are sign-up only.</span>'
      + '<button id="demo-signup-btn" style="background:#000;color:var(--gold);border:none;border-radius:3px;'
      + 'font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;padding:7px 16px;cursor:pointer;flex-shrink:0;">Sign Up Now</button>';
    document.body.appendChild(bar);
    document.getElementById('demo-signup-btn').addEventListener('click', () => { window.location.href = '/'; });
  },

  // Gate a paid-value action in demo mode. Returns true (and shows a sign-up
  // prompt) when blocked, false when the action may proceed.
  demoBlock(actionLabel) {
    if (!this.demoMode) return false;
    const m = document.createElement('div');
    m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.78);z-index:9500;display:flex;align-items:center;justify-content:center;padding:24px;';
    m.innerHTML = '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:8px;padding:30px;max-width:430px;text-align:center;">'
      + '<div style="font-size:15px;font-weight:800;color:var(--w);margin-bottom:10px;">Sign Up to Continue</div>'
      + '<div style="font-size:13px;color:var(--t2);line-height:1.65;margin-bottom:22px;">' + esc(actionLabel)
      + ' is part of the full Bar Cop platform. The demo lets you explore every screen freely, with sample data, before you sign up.</div>'
      + '<button class="btn btn-primary" id="demo-go" style="width:100%;">Sign Up Now</button>'
      + '<button class="btn btn-ghost btn-sm" id="demo-stay" style="margin-top:10px;">Keep Exploring</button>'
      + '</div>';
    document.body.appendChild(m);
    m.querySelector('#demo-go').addEventListener('click', () => { window.location.href = '/'; });
    m.querySelector('#demo-stay').addEventListener('click', () => m.remove());
    m.addEventListener('click', e => { if (e.target === m) m.remove(); });
    return true;
  },

  boot() {
    document.getElementById('auth-screen').style.display = 'none';
    this.updatePeriod();
    // Recurring operating expenses: fill in any elapsed months on load so Books
    // reflects them even if the operator never opens the Operating Expenses page.
    try { if (window.S && S.HubOperatingExpenses && S.HubOperatingExpenses.catchUpRecurring) S.HubOperatingExpenses.catchUpRecurring(); } catch (e) { console.error('recurring catch-up', e); }
    // Sidebar toggle — assign (not addEventListener) so repeated boot() calls
    // don't stack handlers and cancel each other out
    const toggleBtn = document.getElementById('sidebar-toggle');
    if (toggleBtn) toggleBtn.onclick = () => {
      document.getElementById('app').classList.toggle('sidebar-collapsed');
    };
    // Proto top-nav collapse toggle (same behavior as the sidebar-logo toggle,
    // which is hidden in the proto shell).
    const tnCollapse = document.getElementById('tn-collapse');
    if (tnCollapse) tnCollapse.onclick = () => {
      document.getElementById('app').classList.toggle('sidebar-collapsed');
    };
    // Proto top-nav: mobile menu burger opens the off-canvas sidebar; the two
    // utility icon buttons open the Hub Settings / Help views.
    const tnBurger = document.getElementById('tn-mobile-burger');
    if (tnBurger) tnBurger.onclick = () => App.openMobileNav();
    const tnSettings = document.getElementById('tn-settings');
    if (tnSettings) tnSettings.onclick = () => { if (window.S && S.HubSettingsHome) S.HubSettingsHome.open(); };
    const tnHelp = document.getElementById('tn-help');
    if (tnHelp) tnHelp.onclick = () => this.openPageHelp();
    const tnDate = document.getElementById('tn-date');
    if (tnDate) tnDate.textContent = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const tnLogo = document.querySelector('.tn-logo');
    if (tnLogo) { tnLogo.style.cursor = 'pointer'; tnLogo.title = 'Go to The Hub'; tnLogo.onclick = () => this.showHub(); }
    // Mobile sidebar: hamburger button in the topbar opens the off-canvas
    // sidebar below the 768px breakpoint. Backdrop click closes it. Module
    // nav clicks also close it (wired in _renderNav). No-op on desktop where
    // the sidebar-open class is never set.
    const hbBtn = document.getElementById('topbar-hamburger');
    if (hbBtn) hbBtn.onclick = () => {
      document.getElementById('app').classList.toggle('sidebar-open');
    };
    const bdrop = document.getElementById('sidebar-backdrop');
    if (bdrop) bdrop.onclick = () => {
      document.getElementById('app').classList.remove('sidebar-open');
    };
    const closeBtn = document.getElementById('sidebar-mobile-close');
    if (closeBtn) closeBtn.onclick = () => {
      document.getElementById('app').classList.remove('sidebar-open');
    };
    // Staff role: skip Hub and onboarding entirely, land on the Staff Hub
    // (a simplified tile view of their accessible tasks across all modules).
    // Admin and viewer get the normal flow.
    const role = (window.DB && DB.role && DB.role()) || null;
    if (role === 'staff') {
      this.showStaffHub();
      this._promptSync();
      return;
    }
    if (!this.data.settings.onboarding_complete) {
      Onboarding.start();
    } else if (!this.setupMeetsThreshold() && window.S && S.HubGettingStarted) {
      // Returning user, onboarding done, but setup hasn't crossed the
      // Foundation + 1 audit threshold yet. Default-land on Getting Started
      // so the next action is one click away. They can still navigate to
      // the Hub Dashboard manually via the sidebar.
      S.HubGettingStarted.open();
      this._promptSync();
    } else {
      this.showHub();
      this._promptSync();
    }
    this._renderViewerBanner();
    this.renderAccountSwitcher();
  },

  // Persistent banner shown to viewer role so they know writes are blocked.
  _renderViewerBanner() {
    const existing = document.getElementById('viewer-banner');
    const role = (window.DB && DB.role && DB.role()) || null;
    if (role !== 'viewer') { if (existing) existing.remove(); return; }
    if (existing) return;
    const bar = document.createElement('div');
    bar.id = 'viewer-banner';
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9400;background:rgba(20,20,20,0.92);color:var(--gold);border-bottom:1px solid var(--gold);text-align:center;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:5px 10px;';
    bar.textContent = 'Viewer access — read-only';
    document.body.appendChild(bar);
  },

  // Offline sync prompt (Section 14). If a write failed while offline, the
  // local copy was kept and the store marked pending. On load, offer to push
  // those changes to the server. The local data is already loaded, so nothing
  // is lost if the operator defers.
  async _promptSync() {
    if (!DB.hasPendingSync() || document.getElementById('sync-banner')) return;
    const bar = document.createElement('div');
    bar.id = 'sync-banner';
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9500;background:var(--gold);'
      + 'color:#000;display:flex;align-items:center;gap:14px;padding:9px 18px;'
      + 'font-size:12px;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,0.45);';
    const btnDark = 'background:#000;color:var(--gold);border:none;';
    const btnGhost = 'background:transparent;border:1px solid rgba(0,0,0,0.45);color:#000;';
    const btnBase = 'border-radius:3px;font-size:11px;font-weight:800;letter-spacing:1px;'
      + 'text-transform:uppercase;padding:6px 14px;cursor:pointer;flex-shrink:0;';
    bar.innerHTML = '<span style="flex:1;">Changes you saved on this device while offline have not reached the server yet.</span>'
      + '<button id="sync-now" style="' + btnDark + btnBase + '">Sync Now</button>'
      + '<button id="sync-later" style="' + btnGhost + btnBase + '">Later</button>';
    document.body.appendChild(bar);
    document.getElementById('sync-later').onclick = () => bar.remove();
    document.getElementById('sync-now').onclick = async () => {
      const btn = document.getElementById('sync-now');
      btn.disabled = true; btn.textContent = 'Syncing...';
      const r = await DB.syncPending();
      if (r.ok) {
        bar.innerHTML = '<span style="flex:1;">All offline changes are synced.</span>';
        setTimeout(() => bar.remove(), 2500);
      } else {
        btn.disabled = false; btn.textContent = 'Retry';
        const span = bar.querySelector('span');
        if (span) span.textContent = 'Still cannot reach the server. Your changes are safe on this device. '
          + 'Try again once you have a connection.';
      }
    };
  },

  // ── Offline sync lifecycle ──────────────────────────────────────────────────
  // Three pieces wired once at init time:
  //   Fix A — offline indicator pill while navigator.onLine is false
  //   Fix B — auto-fire syncPending() on the online event
  //   Fix C — surface the sync banner the moment a write lands in the pending
  //           queue (rather than waiting for next page reload)
  _wireSyncLifecycle() {
    window.addEventListener('offline', () => this._showOfflinePill());
    window.addEventListener('online', () => {
      this._hideOfflinePill();
      this._autoSync();
    });
    window.addEventListener('bcop:pending-write', () => {
      if (this.data) this._promptSync();
    });
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this._showOfflinePill();
    }
  },

  _showOfflinePill() {
    if (document.getElementById('offline-pill')) return;
    const pill = document.createElement('div');
    pill.id = 'offline-pill';
    pill.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:9600;'
      + 'background:var(--gold-tint);color:var(--t1);border:1px solid var(--gold-tint-bord);'
      + 'border-radius:14px;padding:5px 14px;font-size:11px;font-weight:700;letter-spacing:1px;'
      + 'text-transform:uppercase;box-shadow:0 2px 10px rgba(0,0,0,0.5);';
    pill.textContent = 'Offline. Saves staying on this device.';
    document.body.appendChild(pill);
  },

  _hideOfflinePill() {
    const pill = document.getElementById('offline-pill');
    if (pill) pill.remove();
  },

  async _autoSync() {
    if (!DB.hasPendingSync()) return;
    const r = await DB.syncPending();
    if (r.ok && r.synced > 0) {
      const existing = document.getElementById('sync-banner');
      if (existing) existing.remove();
      const toast = document.createElement('div');
      toast.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:9600;'
        + 'background:var(--gold);color:#000;border-radius:3px;padding:7px 16px;'
        + 'font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;'
        + 'box-shadow:0 2px 10px rgba(0,0,0,0.5);';
      toast.textContent = 'Synced ' + r.synced + ' offline ' + (r.synced === 1 ? 'change.' : 'changes.');
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2800);
    } else if (!r.ok) {
      // Auto-sync failed even though we are online. Surface the manual banner
      // so the operator can retry on their own time.
      this._promptSync();
    }
  },

  showHub(opts) {
    opts = opts || {};
    // If a Hub overlay modal is currently open, close it (returns user to
    // the dashboard already rendered underneath). Skip when called via
    // {fromOverlayClose: true} so we don't recurse.
    if (!opts.fromOverlayClose) {
      const modal = document.getElementById('hub-modal');
      if (modal && modal.style.display === 'flex') {
        this.closeHubOverlay();
        return;
      }
    }
    // Staff role: real Hub shows financial data they shouldn't see. Redirect
    // to the Staff Hub (tile view of their accessible tasks).
    const role = (window.DB && DB.role && DB.role()) || null;
    if (role === 'staff') {
      this.showStaffHub();
      return;
    }
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
    // Clear any blur from a prior overlay open
    hubWrap.style.filter = '';
    hubWrap.style.pointerEvents = '';
    S.Hub.render(hubWrap);
    document.body.classList.add('chrome-on');     // shared top nav sits above the Hub too
    document.body.classList.add('hub-dashboard'); // dashboard view = no sidebar (full-width)
    this._activeScreenObj = this._hubHelpShim('hub'); // nav "i" → Hub directions
    this._curHubSection = null;                       // Hub dashboard is not a section
    this._renderProtoTopnav('hub');               // Hub link active, no section active
    this.renderAccountSwitcher();
    this._recordLocation({ mode: 'hub', module: null, screen: 'hub', label: 'Hub' });
  },

  // ── Hub overlay modal (Phase 2 polish) ──────────────────────────────────────
  // Open a Hub-owned screen (Settings, Help, Getting Started, etc.) as a modal
  // overlay on top of the Hub Dashboard instead of replacing the dashboard
  // entirely. The dashboard stays visible underneath with a blur filter so the
  // operator never loses their context.
  openHubOverlay(renderFn) {
    // Ensure Hub Dashboard is rendered first (showing the user the layout
    // behind the modal). If we're in a module view or auth, call showHub first.
    const wrap = document.getElementById('hub-wrapper');
    const wrapVisible = wrap && wrap.style.display !== 'none';
    if (!wrapVisible) this.showHub();
    const hubWrap = document.getElementById('hub-wrapper');
    // Apply blur to dashboard behind
    if (hubWrap) {
      hubWrap.style.filter = 'blur(5px)';
      hubWrap.style.pointerEvents = 'none';
    }
    // Create or reuse modal
    let modal = document.getElementById('hub-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'hub-modal';
      modal.style.cssText = 'position:fixed;inset:0;z-index:200;display:none;align-items:flex-start;justify-content:center;padding:40px 20px;overflow-y:auto;background:rgba(0,0,0,0.55);';
      document.body.appendChild(modal);
      modal.addEventListener('click', (ev) => {
        if (ev.target === modal) this.closeHubOverlay();
      });
    }
    // Build a fresh panel each open so prior content is cleared
    modal.innerHTML = '<div class="hub-modal-panel" style="background:var(--bg);border:1px solid var(--b1);border-radius:8px;max-width:920px;width:100%;max-height:calc(100vh - 80px);overflow-y:auto;position:relative;box-shadow:0 8px 40px rgba(0,0,0,0.55);"></div>';
    const panel = modal.querySelector('.hub-modal-panel');
    modal.style.display = 'flex';
    // Install Esc-to-close once
    if (!this._hubOverlayEscWired) {
      document.addEventListener('keydown', (ev) => {
        const m = document.getElementById('hub-modal');
        if (ev.key === 'Escape' && m && m.style.display === 'flex') {
          this.closeHubOverlay();
        }
      });
      this._hubOverlayEscWired = true;
    }
    // Render the screen content into the panel
    if (typeof renderFn === 'function') renderFn(panel);
  },

  closeHubOverlay() {
    const modal = document.getElementById('hub-modal');
    if (modal) {
      modal.style.display = 'none';
      modal.innerHTML = '';
    }
    const wrap = document.getElementById('hub-wrapper');
    if (wrap) {
      wrap.style.filter = '';
      wrap.style.pointerEvents = '';
    }
  },

  // ── Full-page Hub screen (sidebar stays mounted, content area swaps) ──
  // Hub-level screens render into the Hub content area, replacing the
  // dashboard tiles. The Hub sidebar stays mounted and interactive on the
  // left so the operator can navigate to other Hub items. The Hub topbar
  // gets rewritten to show "TITLE | Back to Dashboard" mirroring the module
  // shell pattern (e.g., "PROFIT AUDIT | Back to Dashboard" inside the
  // Profit Recovery system).
  //
  // Call signature:
  //   App.openHubFullPage('Bar Cop Audit', mount => renderFn(mount), 'bar-cop-audit');
  //
  // The third arg is the sidebar action key (data-hub-action) so we can
  // light up the matching nav item. Back to Dashboard re-renders the Hub
  // via App.showHub(), restoring the default topbar (bar name + date) and
  // putting the active state back on "The Hub".
  openHubFullPage(title, renderFn, activeAction) {
    // Backward-compat: caller can pass just renderFn if title is unused.
    if (typeof title === 'function') { renderFn = title; title = ''; }
    const wrap = document.getElementById('hub-wrapper');
    const wrapVisible = wrap && wrap.style.display !== 'none';
    if (!wrapVisible) this.showHub();
    // Sidebar context: Blueprint (and any 'none' page) keeps the full-width
    // dashboard mode (no sidebar); Bar Cop Audit mounts its own context
    // sidebar; everything else falls back to the default Hub sidebar.
    const _sideCtx = this._HUB_SIDEBAR_OF_ACTION[activeAction] || 'grabbag';
    this._curHubSection = (_sideCtx === 'audit' || _sideCtx === 'books' || _sideCtx === 'settings') ? _sideCtx : null;
    if (_sideCtx === 'none') {
      document.body.classList.add('hub-dashboard');     // full-width, no sidebar
    } else {
      document.body.classList.remove('hub-dashboard');  // a sub-page is open → show the sidebar
      if (window.S && S.Hub && S.Hub.renderSidebar) S.Hub.renderSidebar(_sideCtx);
    }
    this._renderProtoTopnav(this._GLOBAL_OF_ACTION[activeAction] || '');  // highlight this page's global link
    const content = document.querySelector('.hub-app .content');
    if (!content) {
      this.openHubOverlay(renderFn);
      return;
    }
    // The Hub Dashboard overrides .content to padding:24px. Module screens
    // render into a .content with no padding (.screen adds its own).
    // Reset padding to 0 for full-page screens so the .screen wrapper inside
    // them controls spacing the same way module screens do.
    content.style.padding = '0';
    // Update the Hub topbar to show the page title. We preserve the existing
    // hamburger button that hub.js rendered into topbar-left (so the operator
    // can open the sidebar from any Hub-level screen on mobile) and only swap
    // the title text + clear the date subtitle. If the hamburger is missing
    // for any reason, we inject one and wire its click handler.
    const topbarLeft = document.querySelector('.hub-app .topbar .topbar-left');
    if (topbarLeft && title) {
      let hamburger = topbarLeft.querySelector('.topbar-hamburger');
      if (!hamburger) {
        hamburger = document.createElement('button');
        hamburger.className = 'topbar-hamburger';
        hamburger.id = 'hub-topbar-hamburger';
        hamburger.setAttribute('aria-label', 'Open sidebar');
        hamburger.type = 'button';
        hamburger.innerHTML = '<svg viewBox="0 0 17 17" fill="none"><rect x="2" y="4" width="13" height="1.5" rx="0.75" fill="currentColor"/><rect x="2" y="8" width="13" height="1.5" rx="0.75" fill="currentColor"/><rect x="2" y="12" width="13" height="1.5" rx="0.75" fill="currentColor"/></svg>';
        hamburger.addEventListener('click', () => {
          document.querySelector('.hub-app')?.classList.toggle('sidebar-open');
        });
        topbarLeft.insertBefore(hamburger, topbarLeft.firstChild);
      }
      // Update the title element (the <h1 class="topbar-title"> rendered by
      // hub.js) and clear the date subtitle so it does not flash old content
      // while the operator is on a Hub-level page.
      let titleEl = topbarLeft.querySelector('.topbar-title');
      if (titleEl) {
        titleEl.textContent = title;
      } else {
        titleEl = document.createElement('div');
        titleEl.className = 'topbar-title';
        titleEl.textContent = title;
        topbarLeft.appendChild(titleEl);
      }
      const subEl = topbarLeft.querySelector('.topbar-sub');
      if (subEl) subEl.textContent = '';
    }
    // Clear topbar-right so prior screen actions don't bleed across.
    const topbarRight = document.querySelector('.hub-app .topbar .topbar-right');
    if (topbarRight) topbarRight.innerHTML = '';
    // Light up the matching sidebar entry so the operator can see at a
    // glance which Hub section they are in.
    if (activeAction) this.setActiveHubNav(activeAction);
    // Point the nav "i" page-help at this Hub-shell page's directions (null =
    // fall back to the full Help and FAQ); clears any stale module screen.
    this._activeScreenObj = this._hubHelpShim(activeAction);
    // Hand the screen the content element directly so .screen wrapper
    // padding behaves identically to module screens.
    content.innerHTML = '';
    if (typeof renderFn === 'function') renderFn(content);
  },

  // Inject screen-specific action buttons into the Hub topbar-right area
  // (mirrors how module screens set this.actions.innerHTML during render).
  // Pass HTML for the buttons; wire click handlers from the screen after.
  setHubTopbarActions(actionsHtml) {
    const topbarRight = document.querySelector('.hub-app .topbar .topbar-right');
    if (topbarRight) topbarRight.innerHTML = actionsHtml || '';
  },

  // Toggle the .active class on the Hub sidebar nav item whose data-hub-action
  // matches the given key. Pass null to clear all. CSS at .nav-item.active
  // paints the gold icon and white label that signals "you are here."
  setActiveHubNav(action) {
    document.querySelectorAll('.hub-app .nav-item').forEach(el => el.classList.remove('active'));
    if (action) {
      const el = document.querySelector('.hub-app .nav-item[data-hub-action="' + action + '"]');
      if (el) el.classList.add('active');
    }
    this.wireNavAccordion(document.querySelector('.hub-app .sidebar-nav'));
  },

  // ── Account switcher (Phase 2 Item 27a) ─────────────────────────────────────
  // Renders a dropdown in the topbar showing all bars the user belongs to.
  // Hidden when the user has only one account. Switching reloads the page so
  // every cached data structure starts fresh under the new account context.
  // Called from boot(), showApp(), and the Hub render.
  async renderAccountSwitcher() {
    if (!window.DB || !DB.listMyAccounts) return;
    const accounts = await DB.listMyAccounts();
    const activeId = (DB._accountId) || (DB._getStoredActiveAccountId && DB._getStoredActiveAccountId());
    const isMulti  = !!(accounts && accounts.length > 1);
    // Cache for the mobile drawer's location chip (built synchronously).
    this._acctList = accounts || [];
    this._acctActiveId = activeId;
    // Both topbars (module + hub) have their own switcher slot -- populate both
    ['topbar-account-switcher', 'hub-topbar-account-switcher'].forEach(slotId => {
      const slot = document.getElementById(slotId);
      if (!slot) return;
      if (!isMulti) {
        slot.style.display = 'none';
        slot.innerHTML = '';
        return;
      }
      const active = accounts.find(a => a.id === activeId) || accounts[0];
      const options = accounts.map(a => {
        const sel = a.id === active.id ? ' selected' : '';
        return '<option value="' + esc(a.id) + '"' + sel + '>' + esc(a.name) + '</option>';
      }).join('');
      slot.style.display = 'flex';
      slot.style.cssText = 'display:flex;align-items:center;gap:8px;';
      slot.innerHTML = '<span style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);">Viewing</span>'
        + '<select class="acct-switcher at-qsel" style="font-weight:600;">' + options + '</select>';
      const sel = slot.querySelector('.acct-switcher');
      sel.addEventListener('change', (ev) => {
        const newId = ev.target.value;
        if (newId && newId !== active.id) DB.setActiveAccount(newId);
      });
    });
    // Group Dashboard button -- multi-loc only. Mounts in both topbars so the
    // operator can pop the cross-bar comparison from any screen without losing
    // their current context. Opens as a modal overlay, not a full-page route.
    ['topbar-group-dashboard', 'hub-topbar-group-dashboard'].forEach(slotId => {
      const slot = document.getElementById(slotId);
      if (!slot) return;
      if (!isMulti) {
        slot.style.display = 'none';
        slot.innerHTML = '';
        return;
      }
      slot.style.cssText = 'display:flex;align-items:center;';
      slot.innerHTML = '<button class="tn-grp-btn" id="' + slotId + '-btn" title="Group Dashboard">'
        + '<svg viewBox="0 0 17 17" fill="none"><rect x="2" y="2" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="9.5" y="2" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="2" y="9.5" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="9.5" y="9.5" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/></svg>'
        + '<span>Group</span></button>';
      slot.querySelector('button')?.addEventListener('click', () => {
        if (window.S && S.HubGroupDashboard) S.HubGroupDashboard.open();
      });
    });
    // Sidebar multi-loc slots (mobile-only via CSS). Location switcher only
    // -- Group Dashboard is intentionally not exposed on mobile because the
    // 8-column comparison table does not fit on a phone screen. Multi-loc
    // operators on a phone can still switch bars from here; comparison view
    // stays a desktop tool.
    ['sidebar-multi-loc', 'hub-sidebar-multi-loc'].forEach(slotId => {
      const slot = document.getElementById(slotId);
      if (!slot) return;
      if (!isMulti) { slot.innerHTML = ''; return; }
      const active = accounts.find(a => a.id === activeId) || accounts[0];
      const options = accounts.map(a => {
        const sel = a.id === active.id ? ' selected' : '';
        return '<option value="' + esc(a.id) + '"' + sel + '>' + esc(a.name) + '</option>';
      }).join('');
      slot.innerHTML = '<div class="sidebar-multi-loc-label">Viewing</div>'
        + '<select class="smm-switcher">' + options + '</select>';
      const sel = slot.querySelector('.smm-switcher');
      sel?.addEventListener('change', (ev) => {
        const newId = ev.target.value;
        if (newId && newId !== active.id) DB.setActiveAccount(newId);
      });
    });
  },

  // ── Role-based access (Phase 2 Items 25 + 25b) ─────────────────────────────
  // Per-screen access goes through DB's granular permission system. Each
  // screen maps to a permission group (DB.SCREEN_GROUPS). Each non-admin user
  // has a permissions object stored on their membership: { groupKey: 'add' |
  // 'edit' }. Helpers here just delegate to DB. Admin sees all; Viewer sees
  // all read-only; Staff sees only what their permissions grant.
  // Hub-level always-accessible screens (settings, getting-started, etc.) are
  // listed separately because they're not in SCREEN_GROUPS.
  HUB_ALWAYS: new Set(['hub-help', 'hub-support', 'hub-report-bug']),

  canAccess(screenId) {
    if (this.HUB_ALWAYS.has(screenId)) return true;
    return (window.DB && DB.screenAllowed) ? DB.screenAllowed(screenId) : true;
  },

  canSeeModule(module) {
    // A module is visible if the user has access to at least one screen in it.
    if (!window.DB || !DB.SCREEN_GROUPS) return true;
    for (const screen of Object.keys(DB.SCREEN_GROUPS)) {
      if (this._moduleOf(screen) === module && DB.screenAllowed(screen)) return true;
    }
    return false;
  },

  canWrite() {
    return !(window.DB && DB.role && DB.role() === 'viewer');
  },

  canEdit(screen) {
    return (window.DB && DB.screenCanEdit) ? DB.screenCanEdit(screen) : true;
  },

  canAdd(screen) {
    return (window.DB && DB.screenCanAdd) ? DB.screenCanAdd(screen) : true;
  },

  // Staff Hub tiles: one per permission group, in display order.
  // Used by showStaffHub() to render the staff landing page.
  STAFF_TILES: [
    // Inventory Control
    { group:'inventory-dashboard', label:'Inventory Overview',       module:'inventory', screen:'ic-dashboard',         moduleName:'Inventory Control' },
    { group:'take-inventory',      label:'Take Inventory',           module:'inventory', screen:'ic-take-inventory',    moduleName:'Inventory Control' },
    { group:'receive-delivery',    label:'Receive Delivery',         module:'inventory', screen:'ic-receive-delivery',  moduleName:'Inventory Control' },
    { group:'place-orders',        label:'Place Orders',             module:'inventory', screen:'ic-order-sheet',       moduleName:'Inventory Control' },
    { group:'spot-check',          label:'Spot Check',               module:'inventory', screen:'ic-spot-check',        moduleName:'Inventory Control' },
    { group:'manage-products',     label:'Manage Products & Vendors',module:'inventory', screen:'ic-product-setup',     moduleName:'Inventory Control' },
    { group:'inventory-reports',   label:'Inventory Reports',        module:'inventory', screen:'ic-report-stock',      moduleName:'Inventory Control' },
    // Labor Control
    { group:'labor-dashboard',     label:'Labor Overview',           module:'labor',     screen:'lc-dashboard',         moduleName:'Labor Control' },
    { group:'log-hours',           label:'Log Hours',                module:'labor',     screen:'lc-log-hours',         moduleName:'Labor Control' },
    { group:'log-tips',            label:'Tip Tracking',             module:'labor',     screen:'lc-tip-log',           moduleName:'Labor Control' },
    { group:'view-schedule',       label:'View Schedule',            module:'labor',     screen:'lc-schedule-history',  moduleName:'Labor Control' },
    { group:'manage-schedule',     label:'Manage Schedule',          module:'labor',     screen:'lc-build-schedule',    moduleName:'Labor Control' },
    { group:'manage-staff',        label:'Manage Staff & Positions', module:'labor',     screen:'lc-staff-roster',      moduleName:'Labor Control' },
    { group:'time-off',            label:'Time Off Log',             module:'labor',     screen:'lc-time-off',          moduleName:'Labor Control' },
    { group:'call-out-log',        label:'Call-Out Log',             module:'labor',     screen:'lc-callout-log',       moduleName:'Labor Control' },
    { group:'labor-reports',       label:'Labor History',            module:'labor',     screen:'lc-reports',           moduleName:'Labor Control' },
    // Shift Control
    { group:'shift-dashboard',     label:'Shift Overview',           module:'shift',     screen:'sc-dashboard',         moduleName:'Shift Control' },
    { group:'cash-mgmt',           label:'Cash Management',          module:'shift',     screen:'sc-cash-control',      moduleName:'Shift Control' },
    { group:'checklists',          label:'Opening / Closing Checklists', module:'shift', screen:'sc-checklists',        moduleName:'Shift Control' },
    { group:'void-comp',           label:'Void / Comp Log',          module:'shift',     screen:'sc-void-comp',         moduleName:'Shift Control' },
    { group:'waste',               label:'Waste / Spill Log',        module:'shift',     screen:'sc-waste',             moduleName:'Shift Control' },
    { group:'maintenance',         label:'Maintenance Log',          module:'shift',     screen:'sc-maintenance',       moduleName:'Shift Control' },
    // Recovery
    { group:'profit-recovery',     label:'Profit Recovery',          module:'profit',    screen:'dashboard',            moduleName:'Profit Recovery' },
    { group:'revenue-recovery',    label:'Revenue Recovery',         module:'revenue',   screen:'r-dashboard',          moduleName:'Revenue Recovery' },
    { group:'cash-recovery',       label:'Cash Recovery',            module:'cash',      screen:'c-dashboard',          moduleName:'Cash Recovery' },
    { group:'events',              label:'Events',                   module:'events',    screen:'ev-dashboard',         moduleName:'Events' }
  ],

  // Pick the first accessible screen as a non-admin user's landing.
  // Falls back to ic-take-inventory if nothing matches (shouldn't happen for
  // a properly-permissioned staff user).
  staffLanding() {
    for (const t of this.STAFF_TILES) {
      if (this.canAccess(t.screen)) return { module: t.module, screen: t.screen };
    }
    return { module: 'inventory', screen: 'ic-take-inventory' };
  },

  // Staff Hub: simplified landing page with one tile per accessible screen.
  // Replaces the real Hub (financial overview) for staff role since they
  // shouldn't see financial data, AND gives them a way to move between the
  // operational modules (without it they'd be stuck in one module's sidebar).
  showStaffHub() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('ob-overlay').classList.add('hidden');
    document.getElementById('app').classList.add('hidden');
    document.body.classList.remove('chrome-on');
    let wrap = document.getElementById('hub-wrapper');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'hub-wrapper';
      wrap.style.cssText = 'position:fixed;inset:0;overflow-y:auto;background:var(--bg);z-index:100;';
      document.body.appendChild(wrap);
    }
    wrap.style.display = 'block';
    wrap.style.overflowY = 'auto';

    const userEmail = DB._user?.email || '';
    const accessibleTiles = this.STAFF_TILES.filter(t => this.canAccess(t.screen));

    const tiles = accessibleTiles.map(t => {
      return '<div class="staff-tile" data-screen="' + t.screen + '" data-module="' + t.module + '" '
        + 'style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:22px 24px;cursor:pointer;transition:border-color 0.15s, background 0.15s;">'
        + '<div style="font-size:13px;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:1.5px;">' + t.label + '</div>'
        + '<div style="font-size:11px;color:var(--t3);margin-top:6px;letter-spacing:0.5px;">' + t.moduleName + '</div>'
        + '</div>';
    }).join('');

    const empty = accessibleTiles.length === 0
      ? '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:24px;font-size:13px;color:var(--t2);line-height:1.6;">You do not have access to any sections yet. Ask the account admin to grant you access from the User Accounts page.</div>'
      : '';

    wrap.innerHTML = '<div style="max-width:880px;margin:0 auto;padding:40px 24px;">'
      + '<div style="font-size:18px;font-weight:800;color:var(--w);letter-spacing:0.5px;margin-bottom:6px;">Welcome back</div>'
      + (userEmail ? '<div style="font-size:12px;color:var(--t3);margin-bottom:30px;">Signed in as ' + userEmail + '</div>' : '<div style="margin-bottom:30px;"></div>')
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:14px;">Your Tasks</div>'
      + (tiles ? '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;">' + tiles + '</div>' : empty)
      + '<div style="margin-top:40px;padding-top:20px;border-top:1px solid var(--b2);display:flex;justify-content:flex-end;">'
      +   '<button class="btn btn-ghost" id="staff-signout">Sign Out</button>'
      + '</div>'
      + '</div>';

    wrap.querySelectorAll('.staff-tile').forEach(tile => {
      tile.addEventListener('click', () => {
        const mod = tile.dataset.module;
        const screen = tile.dataset.screen;
        this.showApp(mod);
        this.navigate(screen);
      });
      tile.addEventListener('mouseenter', () => { tile.style.borderColor = 'var(--gold)'; });
      tile.addEventListener('mouseleave', () => { tile.style.borderColor = 'var(--b1)'; });
    });
    document.getElementById('staff-signout')?.addEventListener('click', async () => {
      await DB.signOut();
      this.showAuth();
    });
  },

  showApp(module) {
    // Close any open Hub overlay modal before entering a module view
    this.closeHubOverlay && this.closeHubOverlay();
    if (!this.canSeeModule(module)) {
      // Staff trying to enter a non-operational module — bounce to their landing
      const land = this.staffLanding();
      module = land.module;
      this._pendingStaffRedirect = land.screen;
    }
    const appEl = document.getElementById('app');
    appEl.classList.remove('hidden');
    appEl.classList.add('proto');                 // module shell uses the new grid layout
    document.body.classList.add('chrome-on');      // show the shared top nav
    document.getElementById('ob-overlay').classList.add('hidden');
    document.getElementById('auth-screen').style.display = 'none';
    const hw = document.getElementById('hub-wrapper');
    if (hw) hw.style.display = 'none';
    // Swap sidebar nav based on module
    this._activeModule = module || this._activeModule || 'profit';
    this._renderNav(this._activeModule);
    this._renderProtoTopnav(this._activeModule);
    this.renderAccountSwitcher();
    if (this._pendingStaffRedirect) {
      const target = this._pendingStaffRedirect;
      this._pendingStaffRedirect = null;
      setTimeout(() => this.navigate(target), 0);
    }
  },

  _activeModule: 'profit',

  // The Hub + the 6 main sections, in Hub-sidebar order. Drives the section
  // switcher (the dark dropdown at the top of every section sidebar) so the
  // operator jumps straight between sections without routing back through the
  // Hub. Bar Cop Audit / Accounting / Operations / Setup / Support are not
  // here on purpose — they live inside the Hub, reached via "The Hub".
  SECTIONS: [
    ['hub',       'The Hub'],
    ['profit',    'Profit Recovery'],
    ['revenue',   'Revenue Recovery'],
    ['cash',      'Cash Recovery'],
    ['events',    'Events'],
    ['inventory', 'Inventory Control'],
    ['labor',     'Labor Control'],
    ['shift',     'Shift Control'],
  ],

  // The dashboard screen each module lands on when entered.
  _SECTION_DASH: { profit: 'dashboard', revenue: 'r-dashboard', cash: 'c-dashboard', events: 'ev-dashboard', inventory: 'ic-dashboard', labor: 'lc-dashboard', shift: 'sc-dashboard' },

  // Markup for the section switcher. currentKey defaults to the active module
  // (set before the module nav renders); the Hub sidebar passes 'hub'. Text
  // only, no chevron. The menu lists all sections; the current one is marked.
  sectionSelectorHTML(currentKey) {
    const cur = currentKey || this._activeModule || 'hub';
    const found = this.SECTIONS.find(s => s[0] === cur);
    const label = found ? found[1] : 'The Hub';
    const rows = this.SECTIONS.map(([k, l]) =>
      '<div class="sec-switch-item' + (k === cur ? ' current' : '') + '" data-sec="' + k + '">' + esc(l) + '</div>'
    ).join('');
    // The 4-box dashboard icon in front of the section name is a direct link to
    // this section's dashboard (it replaces the old standalone Dashboard nav
    // row). Clicking the icon goes to the dashboard; clicking the rest of the
    // selector opens the switcher. Collapsed, only the icon shows.
    const dashIcon = '<svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2.5 4.2l1.2 1.2 2-2.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 4h6.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M2.5 8.7l1.2 1.2 2-2.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 8.5h6.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M2.5 13.2l1.2 1.2 2-2.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 13h6.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';
    return '<div class="sec-switch" data-cur="' + cur + '">'
      + '<div class="sec-switch-btn">'
      +   '<span class="sec-switch-dash" title="' + esc(label) + ' dashboard">' + dashIcon + '</span>'
      +   '<span class="sec-switch-label">' + esc(label) + '</span>'
      + '</div>'
      + '<div class="sec-switch-menu" hidden>' + rows + '</div>'
      + '</div>';
  },

  // Jump to a section's dashboard (or the Hub) from the switcher. showApp hides
  // the Hub wrapper and shows the module shell, so this works from anywhere.
  jumpToSection(key) {
    if (key === 'hub') { this.showHub(); return; }
    const screen = this._SECTION_DASH[key];
    if (!screen) return;
    this.showApp(key);
    this.navigate(screen);
  },

  _renderNav(module) {
    const nav = document.getElementById('sidebar-nav');
    if (!nav) return;
    if (module === 'revenue') {
      nav.innerHTML = Revenue.navHTML();
    } else if (module === 'cash') {
      nav.innerHTML = Cash.navHTML();
    } else if (module === 'events') {
      nav.innerHTML = Events.navHTML();
    } else if (module === 'inventory') {
      nav.innerHTML = Inventory.navHTML();
    } else if (module === 'shift') {
      nav.innerHTML = Shift.navHTML();
    } else if (module === 'labor') {
      nav.innerHTML = Labor.navHTML();
    } else {
      nav.innerHTML = ProfitNav.html();
    }
    // Mobile-style sidebar sections: render in the mobile drawer's style (group-
    // icon accordion headers, icon-less nested links, open drop-down lit). A
    // Dashboard leaf is injected at the top (the mobile panel's Dashboard row),
    // routing to the section dashboard. Scoped via .nav-mstyle so the other
    // sections keep the standard accordion. (wireNavAccordion adds group icons.)
    const MSTYLE_SECTIONS = ['inventory', 'labor', 'shift', 'events', 'profit', 'revenue', 'cash'];
    const mstyle = MSTYLE_SECTIONS.indexOf(module) !== -1;
    nav.classList.toggle('nav-mstyle', mstyle);
    nav._mstyleClosed = false;
    if (mstyle) {
      const dashScreen = this._SECTION_DASH[module];
      const firstSec = nav.querySelector('.nav-section');
      if (dashScreen && firstSec && !nav.querySelector('#nav-' + dashScreen)) {
        const dleaf = document.createElement('div');
        dleaf.className = 'nav-item nav-leaf';
        dleaf.id = 'nav-' + dashScreen;
        dleaf.dataset.screen = dashScreen;
        const dleafLabel = (['inventory', 'labor', 'shift', 'cash'].indexOf(module) !== -1) ? 'Close The Week' : (module === 'events' ? 'Book The Events' : 'Dashboard');
        dleaf.innerHTML = '<svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2.5 4.2l1.2 1.2 2-2.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 4h6.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M2.5 8.7l1.2 1.2 2-2.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 8.5h6.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M2.5 13.2l1.2 1.2 2-2.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 13h6.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg><span class="nav-label">' + dleafLabel + '</span>';
        firstSec.parentNode.insertBefore(dleaf, firstSec);
      }
    }
    // Rewire nav click handlers, filtering out items the current role can't access
    nav.querySelectorAll('.nav-item[data-screen]').forEach(el => {
      if (!App.canAccess(el.dataset.screen)) {
        el.style.display = 'none';
        el.classList.add('role-hidden');
      } else {
        el.addEventListener('click', () => {
          // Close the mobile sidebar after the click so the navigated screen
          // gets full width on phones. No-op on desktop where the class is
          // never set.
          document.getElementById('app')?.classList.remove('sidebar-open');
          App.navigate(el.dataset.screen);
        });
      }
    });
    nav.querySelectorAll('.nav-item[data-nav="hub"]').forEach(el => {
      el.addEventListener('click', () => App.showHub());
    });
    // Report a Bug opens the shared bug-report flow (same as the Hub sidebar).
    nav.querySelectorAll('.nav-item[data-nav="report-bug"]').forEach(el => {
      el.addEventListener('click', () => {
        document.getElementById('app')?.classList.remove('sidebar-open');
        if (window.S && S.HubReportBug && S.HubReportBug.openModal) S.HubReportBug.openModal();
      });
    });
    // Hide section headers with no visible items below them
    nav.querySelectorAll('.nav-section').forEach(sec => {
      let hasVisible = false;
      let sib = sec.nextElementSibling;
      while (sib && !sib.classList.contains('nav-section')) {
        if (sib.classList.contains('nav-item') && sib.style.display !== 'none') {
          hasVisible = true; break;
        }
        sib = sib.nextElementSibling;
      }
      if (!hasVisible) sec.style.display = 'none';
    });
    // Mobile-style: a group with a single visible link flattens to a top-level
    // leaf (matches the mobile menu) — drop the header and make the lone item a
    // .nav-leaf (its icon shows, it sits outside any drop-down). _navGroups
    // excludes .nav-leaf, so it is never folded back into the previous group.
    // DESKTOP sidebars render as a flat icon list with a divider between groups
    // (no drop-down headers), app-wide. The mobile drawer is built separately
    // (from each section's source navHTML) and is unaffected. Reversible: set
    // `flat` to false here (and in hub.js renderSidebar) to restore the accordion.
    const flat = mstyle;
    if (flat) {
      nav.classList.remove('nav-mstyle');
      nav.classList.add('nav-flat');
      App._flatSidebar(nav, {});
    } else {
      App.wireNavAccordion(nav);
    }
  },

  // Turn a freshly-rendered desktop sidebar into a flat icon list: drop the group
  // headers, leave a divider line between groups, keep every link's icon. Mirrors
  // the mstyle cleanups (no Report a Bug, Help and FAQ → Help, opts.items label
  // remaps). The mobile drawer is built separately and is unaffected.
  _flatSidebar(nav, opts) {
    if (!nav) return;
    opts = opts || {};
    const iren = Object.assign({ 'Help and FAQ': 'Help' }, opts.items || {});
    nav.querySelectorAll('.nav-item[data-nav="report-bug"], .nav-item[data-hub-action="report-bug"]').forEach(el => el.remove());
    nav.querySelectorAll('.nav-item .nav-label').forEach(l => { const t = (l.textContent || '').trim(); if (iren[t]) l.textContent = iren[t]; });
    nav.querySelectorAll('.nav-section').forEach(sec => {
      // Drop a header whose whole group is empty or role-hidden (no stray divider).
      let hasItem = false, sib = sec.nextElementSibling;
      while (sib && !sib.classList.contains('nav-section')) {
        if (sib.classList.contains('nav-item') && sib.style.display !== 'none' && !sib.classList.contains('role-hidden')) { hasItem = true; break; }
        sib = sib.nextElementSibling;
      }
      // No divider before the FIRST group — nothing above it to separate from
      // (e.g. the Audits sidebar has no Dashboard leaf).
      let hasPrev = false, p = sec.previousElementSibling;
      while (p) { if (p.classList.contains('nav-item')) { hasPrev = true; break; } p = p.previousElementSibling; }
      if (!hasItem || !hasPrev) { sec.remove(); return; }
      const div = document.createElement('div');
      div.className = 'nav-divider';
      sec.parentNode.replaceChild(div, sec);
    });
  },

  // ── Collapsible sub-group sidebar (accordion) ─────────────────────────────
  // Section sidebars have ~7 sub-groups (COUNTS, ORDERING, …); showing them all
  // is too long. Each .nav-section header collapses its group: the group holding
  // the active page is open, the rest closed, single-open on click. Wired
  // idempotently after each nav render + navigation so it survives rebuilds.
  _navGroups(navEl) {
    const groups = [];
    navEl.querySelectorAll('.nav-section').forEach(sec => {
      const items = [];
      let sib = sec.nextElementSibling;
      while (sib && !sib.classList.contains('nav-section')) {
        if (sib.classList.contains('nav-item') && !sib.classList.contains('role-hidden') && !sib.classList.contains('nav-leaf')) items.push(sib);
        sib = sib.nextElementSibling;
      }
      if (items.length) groups.push({ sec, items });
    });
    return groups;
  },
  _setNavGroup(g, open) {
    g.items.forEach(it => { it.style.display = open ? '' : 'none'; });
    g.sec.classList.toggle('nav-sec-open', open);
  },
  wireNavAccordion(navEl) {
    if (!navEl) return;
    try {
      navEl.classList.add('nav-acc');
      const groups = this._navGroups(navEl);
      if (!groups.length) return;
      groups.forEach(g => {
        if (!g.sec.querySelector('.nav-sec-chev')) {
          const c = document.createElement('span');
          c.className = 'nav-sec-chev';
          g.sec.appendChild(c);
        }
      });
      // Mobile-style sidebars (Inventory trial): give each drop-down header its
      // group icon, from the same map the mobile drawer uses. Idempotent.
      if (navEl.classList.contains('nav-mstyle')) {
        const gic = App._NAV_GROUP_IC || {};
        groups.forEach(g => {
          if (g.sec.querySelector('.nav-sec-ic')) return;
          const svg = gic[g.sec.dataset.gkey || (g.sec.textContent || '').trim()];
          if (!svg) return;
          const span = document.createElement('span');
          span.className = 'nav-sec-ic';
          span.innerHTML = '<svg viewBox="0 0 17 17" fill="none">' + svg + '</svg>';
          g.sec.insertBefore(span, g.sec.firstChild);
        });
      }
      if (!navEl._accWired) {
        navEl.addEventListener('click', (ev) => {
          // Mobile-style: clicking a MAIN leaf (e.g. Dashboard) closes every
          // open drop-down so the leaf becomes the lone highlighted item.
          const leaf = ev.target.closest('.nav-item.nav-leaf');
          if (leaf && navEl.contains(leaf)) {
            App._navGroups(navEl).forEach(g => App._setNavGroup(g, false));
            navEl.classList.remove('nav-grp-open');
            return;
          }
          const sec = ev.target.closest('.nav-section');
          if (!sec || !navEl.contains(sec)) return;
          const gs = App._navGroups(navEl);
          const wasOpen = sec.classList.contains('nav-sec-open');
          gs.forEach(g => App._setNavGroup(g, !wasOpen && g.sec === sec));
          navEl.classList.toggle('nav-grp-open', !wasOpen);
        });
        navEl._accWired = true;
      }
      if (navEl.classList.contains('nav-mstyle')) {
        // Page-derived open: the drop-down holding the ACTIVE page is opened (so a
        // deep-link — e.g. a cross-section Fix step — landing on a nested page
        // opens its group). A leaf or no active page opens nothing (never a
        // default/first group). Clicking a header re-opens single-open until the
        // next navigation. The lone open drop-down is the gold/lit row.
        const active = navEl.querySelector('.nav-item.active');
        let openSec = null;
        if (active && !active.classList.contains('nav-leaf')) {
          let p = active.previousElementSibling;
          while (p && !p.classList.contains('nav-section')) p = p.previousElementSibling;
          openSec = p;
        }
        groups.forEach(g => App._setNavGroup(g, g.sec === openSec));
        navEl.classList.toggle('nav-grp-open', !!openSec);
        return;
      }
      // Open the group with the active item; else keep one open; else the first.
      const active = navEl.querySelector('.nav-item.active');
      let openSec = null;
      if (active) {
        let p = active.previousElementSibling;
        while (p && !p.classList.contains('nav-section')) p = p.previousElementSibling;
        openSec = p;
      }
      if (!openSec) {
        const cur = groups.find(g => g.sec.classList.contains('nav-sec-open'));
        openSec = cur ? cur.sec : groups[0].sec;
      }
      groups.forEach(g => this._setNavGroup(g, g.sec === openSec));
    } catch (e) {}
  },

  // Transform a freshly-rendered mobile-style sidebar (module shell or Hub
  // shell) before wireNavAccordion runs: (1) drop the Report a Bug link (being
  // re-homed elsewhere); (2) flatten any group with a single visible link into
  // a top-level leaf (its icon shows, no drop-down — matches the mobile menu);
  // (3) apply desktop group-label remaps (the icon stays keyed to the ORIGINAL
  // name via data-gkey, so the glyph matches mobile); (4) shorten the section
  // Help link to "Help". Source navHTML + the mobile menu are untouched.
  _mstyleSidebar(nav, opts) {
    if (!nav) return;
    opts = opts || {};
    const gren = opts.groups || {};                                  // group-header (drop-down) label remaps
    const iren = Object.assign({ 'Help and FAQ': 'Help' }, opts.items || {});  // link-label remaps (Help shortened everywhere)
    nav.querySelectorAll('.nav-item[data-nav="report-bug"], .nav-item[data-hub-action="report-bug"]').forEach(el => el.remove());
    nav.querySelectorAll('.nav-section').forEach(sec => {
      const items = [];
      let sib = sec.nextElementSibling;
      while (sib && !sib.classList.contains('nav-section')) {
        if (sib.classList.contains('nav-item') && sib.style.display !== 'none' && !sib.classList.contains('role-hidden')) items.push(sib);
        sib = sib.nextElementSibling;
      }
      if (items.length === 1) { items[0].classList.add('nav-leaf'); sec.remove(); return; }
      const label = (sec.textContent || '').trim();
      if (gren[label]) { sec.dataset.gkey = label; sec.textContent = gren[label]; }
    });
    nav.querySelectorAll('.nav-item .nav-label').forEach(l => { const t = (l.textContent || '').trim(); if (iren[t]) l.textContent = iren[t]; });
  },

  // PROTO (design prototype): the new full-width top nav + restyled sidebar,
  // scoped to the Shift section only so the other six sections render unchanged.
  // Adds the .proto class to #app and fills #proto-topnav with the logo + flat
  // section tabs; clears it for every other section. Reorg/visual only, no new
  // features. Tabs reuse jumpToSection, the same hop the section switcher does.
  // The shared two-row top nav (body-level, above #app and #hub-wrapper). Called
  // by showApp (context = the active module) and showHub (context = 'hub'). The
  // shell DOM is static in index.html so the relocated account-switcher nodes
  // survive re-renders; we refill the global links + section pills and (once)
  // move the switcher up. body.chrome-on (set by the callers) shows the bar.
  _PROTO_GLOBAL:   [['hub','Hub'],['flowmap','Blueprint'],['audit','Audits'],['events','Events'],['books','Books']],
  _PROTO_RECOVERY: [['profit','Profit'],['revenue','Revenue'],['cash','Cash']],
  _PROTO_CONTROL:  [['inventory','Inventory'],['labor','Labor'],['shift','Shift']],
  // Maps an openHubFullPage activeAction to the global top-nav link to highlight.
  _GLOBAL_OF_ACTION: { 'bar-cop-audit': 'audit', 'books-home': 'books', 'books': 'books', 'weekly-pnl': 'books', 'year-end': 'books', 'operating-expenses': 'books', 'expense-history': 'books', 'permits': 'books', 'flowmap': 'flowmap' },
  // Which Hub-shell sidebar a full-page action mounts. 'none' = keep the
  // full-width dashboard mode (Blueprint); 'audit'/'books' = those context
  // sidebars; missing = the default Hub sidebar. Settings gets its own in the
  // next phase of the nav sweep.
  _HUB_SIDEBAR_OF_ACTION: { 'bar-cop-audit': 'audit', 'books-home': 'books', 'books': 'books', 'weekly-pnl': 'books', 'year-end': 'books', 'operating-expenses': 'books', 'expense-history': 'books', 'permits': 'books', 'settings-home': 'settings', 'settings': 'settings', 'settings-profile': 'settings', 'settings-targets': 'settings', 'getting-started': 'settings', 'user-accounts': 'settings', 'user-account': 'settings', 'user-team': 'settings', 'audit-help': 'audit', 'books-help': 'books', 'settings-help': 'settings', 'flowmap': 'none' },

  // Page directions for the nav "i" button on Hub-shell pages. Those pages open
  // via openHubFullPage (not navigate), so they never register an
  // _activeScreenObj on their own and the "i" had nothing to show. Keyed by the
  // page's activeAction; openHubFullPage/showHub install the matching shim.
  // Pages not listed fall back to the full Help and FAQ. Sections: {h, p:[...]}.
  _HUB_HELP: {
    'hub': { title: 'How the Hub Works', sections: [
      { h: 'What this is', p: ['Your home screen and the cross-system command center. The Hub pulls the headline number from every part of Bar Cop into one view so you read the whole operation at a glance: what you have recovered, what is still on the table, your operation health, and what to work on right now. Tap any tile or row to jump straight to the screen behind it.'] },
      { h: 'The Where You Stand card', p: ['Total Monthly Opportunity is every recovery and revenue dollar your audits have surfaced but you have not closed yet. Recovery Scoreboard, in gold, is the proven dollars you have actually put back, counted only after a fix is marked implemented and measured. Bar Cop Audit is your latest operation-health score with the days until the next one is due. The Bar Cop Briefing button on this card writes a short read of the whole operation from your logged numbers, and refreshes once a week.'] },
      { h: 'Audit Scores', p: ['Your Profit, Revenue, and Cash audit scores side by side, each with its score bar, the leak or opportunity it carries per week, the change since the last audit, and a Run Audit button when one is due. Run each on the weekly rhythm to keep the trend honest.'] },
      { h: 'Weekly Gaps and Priority Action Items', p: ['Weekly Gaps reads off this week\'s numbers: the dollars leaking now, ranked biggest first, each one a tap from its fix. Priority Action Items ranks every move your audits surfaced by monthly dollar impact, so the highest-value work is always on top. Before you have run an audit, this becomes a Start Here guide with the three steps to your first recovery number.'] },
      { h: 'Alerts', p: ['Everything worth a look today, split into Critical and Watch: a metric off target, or an audit scoring low, overdue, or never run. All Clear shows only when your weekly metrics are on target and every audit is current and at or above target.'] },
      { h: 'Key Metrics and Trend', p: ['Key Metrics is your six headline numbers, each against its target and colored only when it slips. The Cost and Revenue Trend charts bar pour cost, check average, and prime cost over the last eight weeks; hover a point for that week\'s reading.'] },
      { h: 'Setup and multiple bars', p: ['While setup is unfinished, a banner up top tracks how far along you are and jumps to the checklist. If you run more than one bar, a Viewing switcher and a Group button appear in the top bar: switch the active bar, or open the Group Dashboard to compare headline numbers across all of them.'] }
    ] },
    'flowmap': { title: 'Blueprint', sections: [
      { h: 'What this is', p: ['The Blueprint shows how your data moves through Bar Cop, left to right: your Control sections capture it, This Week rolls it into a P&L, Recovery and the Bar Cop Audit diagnose where money is leaking, the Fix Process closes the gaps, and the Hub and Books report it.'] },
      { h: 'How to use it', p: ['Tap any box to see exactly what feeds it and what it feeds, with a button to open that screen. Use it to trace where a number you logged ends up, or how one part of Bar Cop connects to another.'] }
    ] },
    'bar-cop-audit': { title: 'How the Bar Cop Audit Works', sections: [
      { h: 'What this is', p: [
        'Your weekly read on how well the whole operation is being run, separate from the Profit, Revenue, and Cash audits that hunt for dollars to recover. This one answers a different question: is the place being run with discipline. It scores entirely from the data you already log across Inventory, Shift, and Labor Control, so there is nothing to upload.',
        'The Operational Health score up top is the average of the six sub-scores that have enough data behind them. It needs at least three of the six covered to show a number; below that it reads N/A and fills in as you log more.'
      ] },
      { h: 'The six sub-scores', p: [
        'Operational Discipline: are the daily and weekly procedures getting done. Opening and closing checklists, inventory counts and spot checks on schedule, shifts logged, your recovery audits run on time, and the maintenance backlog kept clear.',
        'Cash Integrity: your cash variance trend against the revenue handled, a drawer counted on every shift, large voids and comps authorized, and cash dropped on the shifts that take real money.',
        'Inventory Execution: counts and spot checks on schedule, vendor discrepancies resolved instead of aging, and spot checks coming back clean.',
        'Labor Hygiene: scheduled hours matching actual, callouts and overtime under control, certifications current, coaching notes being written, and your wage policy set.',
        'Recovery Action: did you act on what Bar Cop surfaced. Fixes logged against the gaps your recovery audits raised, and how many of those produced real favorable movement.',
        'Operational Consistency: how steady the operation runs week to week. Low swing in covers, labor percent, and pour cost over the last eight weeks is the mark of a disciplined operation.'
      ] },
      { h: 'How each one is scored', p: ['Open any Section to see its breakdown: every component that fed the sub-score, with its own number and the count behind it. A component with no data to judge shows N/A and is left out of the math, never counted as a zero, so a barely-used system never drags down a score it could not see. A sub-score needs at least two scorable components before it shows a number.'] },
      { h: 'Recovery Activity', p: ['The stat strip under the score tracks whether the recovery loop is moving: gaps surfaced by your latest audits, fixes you logged in the last 30 days, dollars recovered to date, and fixes still being measured before their result is in.'] },
      { h: 'Top Operational Exposures', p: ['The action list: the cross-system items worth handling now, worst first. Red is act-now (a high-priority maintenance item, an aging vendor credit, a permit about to lapse), amber is a watch. Open jumps you to the exact screen to work it. Bar Cop Briefing is a short written read of the whole audit, and Export PDF saves it.'] },
      { h: 'Recurring Patterns', p: ['Problems that keep showing up over a rolling 90 days: the same cashier short again and again, voids stacking on one shift type, chronic shrinkage on one product, a vendor with repeated discrepancies, or labor blowing out on the same day of week. Each names the pattern and a screen to act on it.'] },
      { h: 'Landing and history', p: ['The landing holds the Generate button (run it once a week; it scores your trailing 30 days), the latest audit with its six section scores, and the Audit History list of past runs to reopen. Every audit is saved so you can watch the trend. The sidebar links across to your Profit, Revenue, and Cash audits, which live with their Recovery Fix Systems.'] }
    ] },
    'books-home': { title: 'How the Books Overview Works', sections: [
      { h: 'What this page is', p: ['The Books overview: your back office at a glance. Books builds the files your accountant needs (Weekly P&L Brief, Month-End Books, Annual Review) and tracks your permits, licenses, and operating expenses. This page rolls it all up from what you have logged, so the numbers match the Month-End file.'] },
      { h: 'What you see', p: ['The tiles up top show this month\'s revenue net of comps, prime cost, year-to-date revenue, and how many permit renewals are due. The Current Month card is a mini P&L for the month so far. Recent Months lists the last several months, and the side panel shows Coming Due when a renewal is near, or your Year-to-Date bottom line when nothing is due. Before you have logged anything, a Get Started strip points you at logging your first week, adding your fixed bills, and entering your permits.'] },
      { h: 'How to use it', p: ['Use the Quick Actions to jump to Month-End Books, the Weekly P&L Brief, Annual Review, or Operating Expenses. Books for Accountant on the Current Month card opens the month-end file. Everything here is read-only; the work happens on the pages it links to.'] }
    ] },
    'settings-home': { title: 'How the Settings Overview Works', sections: [
      { h: 'What this is', p: ['Where you set up Bar Cop and manage your account. Business Profile holds your operation details and service periods. Recovery Targets are the benchmarks Bar Cop measures you against.'] },
      { h: 'This page', p: ['While you are setting up, it shows how far along you are with a Continue Setup button. After that, it is a snapshot of how Bar Cop is tuned: your account and plan, your profile, sales, service periods, and your targets, each with a quick Edit link so you can sanity-check it without opening every form. Admins also get a Manage Members shortcut to the team. Getting Started walks you through setup step by step and drops off once you are done.'] }
    ] },
    'weekly-pnl': { title: 'How the Weekly P&L Brief Works', sections: [
      { h: 'What this page is', p: ['Builds your weekly revenue, COGS, and labor into an Excel file you can hand to a bookkeeper or open in QuickBooks, Xero, or any spreadsheet. It is the lighter, more frequent companion to the Month-End Books file.'] },
      { h: 'How to use it', p: ['Pick a range: the last completed week, the last four, the last thirteen for a quarter, year to date, all saved weeks, or a custom range. Click Download File to save it. What is in the file is listed on the page.'] },
      { h: 'Before you file', p: ['These numbers come from what you have logged. It is a worksheet, not a filed financial statement. Your accountant should review and verify it before you file anything or close your books.'] }
    ] },
    'books': { title: 'How Month-End Books Works', sections: [
      { h: 'What this page is', p: ['Builds the month-end close: one Excel workbook plus a one-page owner summary PDF. It pulls every number together from what you already log, the accountant-grade deliverable behind the Books section.'] },
      { h: 'How to use it', p: ['Pick the month to close. On the page you get that month\'s Snapshot, the income statement for the month and year to date, plus a Sales Tax card with the estimated tax you collected. Those are a quick on-screen read to eyeball before anything leaves; the worksheet your accountant works from is the Generate File download. Generate File builds the workbook, which adds inventory valuation, a cash reconciliation trail, a void and comp log, the Form 8027 tip worksheet, variance and shrinkage, labor cost, and the sales tax sheet. A December close also adds a year-end tax helper. Owner Summary gives you the one-page PDF.'] },
      { h: 'Before you file', p: ['Bar Cop pulls these from what you have logged. It is a software tool, not a CPA or tax preparer. Your accountant should look it over before you file anything or close the books.'] }
    ] },
    'year-end': { title: 'How the Annual Review Works', sections: [
      { h: 'What this page is', p: ['The annual roll-up: your full year in one place for tax season and for your own read on how the year went. Run it for a closed year, or for the current year so far. It is built from the same logged data as your weekly and monthly numbers, so it ties out to the Month-End file.'] },
      { h: 'How to use it', p: ['Pick the year, then Generate File for the annual workbook or Executive Summary for the PDF. What is in the file is listed on the page.'] },
      { h: 'What is in it', p: ['The workbook holds an annual summary, a P&L by month, inventory valuation, a labor cost trend, the Form 8027 tip worksheet, a cash control summary, your audit history, operational events, and a 1099 vendor worksheet (the vendors you paid $600 or more, a starting point for issuing 1099s). The PDF is a few-page executive read of the same year.'] },
      { h: 'Before you file', p: ['These numbers come from what you have logged. It is a worksheet, not a filed tax return or audited statement. Hand it to your accountant to verify before you file anything or make a material decision.'] }
    ] },
    'permits': { title: 'How Permits and Licenses Work', sections: [
      { h: 'What this page is', p: ['Tracks your permits and licenses by renewal date so none of them lapse. Add each one with its type, next renewal date, recurrence, and last cost, and Bar Cop watches the calendar for you.'] },
      { h: 'How the statuses work', p: ['A renewal more than 30 days out is On Track. Within 30 days is due soon and within 14 is more urgent, both flagged amber; once the date passes it is Expired, in red. Anything due soon or expired shows under Needs Attention here and under Coming Due on the Books overview. Use the chips to filter the list by status.'] },
      { h: 'Marking one renewed', p: ['When you renew a permit, click Mark Renewed and enter the cost paid and the next renewal date (Bar Cop suggests it from the recurrence). That advances the renewal date and logs the cost to Operating Expenses under Licenses and Permits, so your bookkeeper does not enter it twice.'] },
      { h: 'Good to know', p: ['Bar Cop tracks the dates you enter. It does not verify that a permit or license is valid, current, or accepted by any agency, and it is not legal advice. Confirm requirements and deadlines with your issuing agency.'] }
    ] },
    'operating-expenses': { title: 'How Operating Expenses Work', sections: [
      { h: 'What this page is', p: ['Where you log the bills that are not COGS or hourly labor: rent, utilities, insurance, marketing, professional fees, software, and the rest. These roll into the Month-End income statement so it shows a real operating income instead of stopping at prime cost.'] },
      { h: 'This month and next', p: ['The page shows this month and next month, each split into Recurring (the same bill every month) and Variable (the ones that change). Next month lists your recurring bills as Expected before they post. The full back-record lives on Expense History, its own page in the sidebar.'] },
      { h: 'Recurring bills', p: ['Check Recurring on a bill that hits the same amount every month, rent, insurance, a software subscription, and Bar Cop logs it automatically each month and projects it onto your Cash Forecast. By default it recurs until you stop it, which is how most bills run. Only fill in "Ends after" when a bill stops after a fixed number of payments. To cancel one, hit Stop on the bill or on its Expected next-month row: past months stay on your books and it drops off going forward, including the Forecast. For a bill that moves around each month, like a utility, leave it Variable and use Repeat to copy last month forward and set the new amount.'] },
      { h: 'Importing', p: ['Switch the Add form to Import File and drop a CSV or Excel export. Map the columns once (date and amount are required), and the rows import; anything already logged is skipped.'] },
      { h: 'Good to know', p: ['Do not enter repairs and maintenance or 3rd-party platform fees here, those are tracked in Shift Control and the weekly P&L so Books does not count them twice.'] }
    ] },
    'expense-history': { title: 'How Expense History Works', sections: [
      { h: 'What this page is', p: ['The full record of every operating expense you have logged. Operating Expenses only shows this month and next so the close stays focused; the long view back across the year lives here. The by-category breakdown sits on top, the dated log below.'] },
      { h: 'One shared ledger', p: ['This is the same record as Operating Expenses, just the back catalog. An expense you edit or delete here changes that one record everywhere it shows, including the Month-End income statement and your year-to-date totals, so you fix a miskeyed bill once and it is right everywhere.'] },
      { h: 'Filter and export', p: ['The range chips, This Month, Last Month, Year to Date, Last 12 Months, or All Time, scope both the log and the category totals. Export PDF saves the full filtered list. You can edit or delete any past entry right from its row.'] }
    ] },
    'settings-profile': { title: 'How the Business Profile Works', sections: [
      { h: 'What this page is', p: ['Your operation\'s identity: bar name and location, your annual bar and food sales, your taxes, and the service periods you run. One-time setup you revisit when something changes. Each section saves on its own with its Save button.'] },
      { h: 'Taxes and payroll', p: ['Set your sales tax rate, how often you file (monthly or quarterly), and your payroll tax percentage once here. Cash, Books, and Events all read them, so you enter them in one place: the Month-End Sales Tax worksheet uses your rate, and Cash Position uses them to size the money you have collected but already owe.'] },
      { h: 'Service periods', p: ['Turn on the dayparts you run, like Brunch, Lunch, Dinner, and Late Night. These set every shift-type field across Bar Cop, across the schedule and the Recovery daypart breakdowns. Add a custom one if your venue runs something different.'] }
    ] },
    'settings-targets': { title: 'How Recovery Targets Work', sections: [
      { h: 'What this page is', p: [
        'Every target here sets the line your real numbers get measured against across the Profit and Revenue systems: the audits, the dashboards, This Week, and the Fix steps. Hit the target and the number reads green. Miss it and Bar Cop flags the gap and prices what it is worth to close.',
        'Industry defaults are pre-filled so you have a working line on day one. Set each one to your own goal as you learn your numbers. Each section saves on its own with its Save Data button.'
      ] },
      { h: 'Profit targets', p: [
        'Bar Pour Cost %: your liquor, beer, and wine cost as a share of bar sales. The lower the number, the more you keep on every pour. Most bars run 18 to 24 percent; the default is 22. Bar Cop grades your real pour cost against this on the Profit Audit and flags the categories running over.',
        'Food Cost %: your food cost as a share of food sales. Full-service kitchens usually run 28 to 35 percent; the default is 32. Set it to the margin your menu is priced for.',
        'Labor Cost %: total labor, hourly and salary, as a share of total sales. Most full-service operations target 28 to 32 percent; the default is 30. This is the line Labor Control and the schedule build toward.',
        'Prime Cost %: pour cost plus food cost plus labor, the one number that decides whether the doors stay open. Keep it under 60 to 65 percent of sales; the default is 60. Get prime cost right and the rest of the P&L usually follows.'
      ] },
      { h: 'Revenue targets', p: [
        'Check Average: the average guest check you are aiming for. Bar Cop measures your real check average against it and sizes the upsell opportunity in dollars. Raise it as your menu and service push add-ons.',
        'Lunch, Dinner, and Bar RPLH: revenue per labor hour, the sales each worked labor hour brings in, set separately for each daypart since a slow lunch and a packed bar are not the same job. Build Schedule uses these to set target hours, so a higher RPLH target tightens the schedule.',
        'Event Close Rate: the share of event inquiries you turn into booked events. The Events system grades your booking pipeline against it. Set it to the close rate your sales process should hold.'
      ] }
    ] },
    'getting-started': { title: 'How Getting Started Works', sections: [
      { h: 'What this page is', p: ['The setup checklist that turns a blank account into a working one, grouped into four phases: Foundation, Baseline Diagnosis, Capture System, and Weekly Work.'] },
      { h: 'How to use it', p: ['Work the steps top to bottom. Each one has a Go button that drops you on the exact screen to do it, and you check it off when done. The phases build on each other: Foundation sets your profile and targets, Baseline runs your first audits, Capture builds the operational engine, and Weekly Work is the ongoing rhythm.'] },
      { h: 'When it is done', p: ['Once every step is checked, Getting Started drops off the Settings sidebar on its own so it is not in your way. Your setup status always lives on the Settings overview.'] }
    ] },
    'user-account': { title: 'How Your Account Works', sections: [
      { h: 'What this page is', p: ['Your personal account controls: your password, your subscription, a full data backup, and, outside the demo, the testing tools.'] },
      { h: 'Password and backup', p: ['Set a new password any time. Export Backup saves everything in your account (settings, weekly numbers, audits, and all your Inventory, Labor, and Shift records) to one file you keep offsite. Restore from Backup loads one of those files back to recover your data or move it to another account.'] },
      { h: 'Subscription', p: ['Your plan and status show here. Manage Billing opens the secure billing portal to update your card, see past invoices, or change the plan.'] },
      { h: 'Testing tools', p: ['Outside the demo only. Load Sample Data fills every system with realistic records so you can see how the calculations and layouts behave. Clear All Data wipes every record and starts fresh. Reset Onboarding replays the first-run setup walkthrough. These are for setting up and testing, not daily use.'] }
    ] },
    'user-team': { title: 'How Team Members Work', sections: [
      { h: 'What this page is', p: ['Where you invite the rest of your team, set what each person can see, and manage who already has access. Admins only.'] },
      { h: 'Roles', p: ['Admin sees everything. Viewer is read-only on all data, useful for a bookkeeper. Staff gets only the sections you check, with optional edit and delete on each, so a bartender sees what they need and nothing more.'] },
      { h: 'Inviting', p: ['Enter an email, pick a role, and for Staff check the sections to grant. Check Access to give a section, and Allow Edit/Delete to let them change existing entries; left unchecked, Staff can add new entries but not alter past ones. Send Invite emails a new person a link to set their password; if they already have a Bar Cop account they are added straight to your team with no email. Bar Cop never asks for SSNs, bank details, or anything you would not keep in a binder.'] },
      { h: 'Managing members', p: ['Everyone on the account lists below the invite form, with a Pending tag until they accept. Change anyone\'s role from the dropdown on their row. Edit Access re-opens the permissions grid for a Staff member so you can adjust what they see. Remove takes a person off the account and cuts their access on the spot. You cannot change your own role or remove yourself.'] }
    ] },
    'audit-help': { title: 'Bar Cop Audit Help', sections: [
      { p: ['The full Help and FAQ for the Bar Cop Audit: what it measures, the weekly rhythm, and how it relates to your Profit, Revenue, and Cash audits.'] },
      { h: 'Finding an answer', p: ['Pick a topic along the top, or type a word in the search box to pull every matching question at once.'] },
      { h: 'Directions for a specific page', p: ['Open the page you have a question about and tap this same info i button for its step-by-step. This FAQ covers the why.'] }
    ] },
    'books-help': { title: 'Books Help', sections: [
      { p: ['The full Help and FAQ for Books: the accounting deliverables, how Permits and Operating Expenses work, and where the numbers come from.'] },
      { h: 'Finding an answer', p: ['Pick a topic along the top, or type a word in the search box to pull every matching question at once.'] },
      { h: 'Directions for a specific page', p: ['Open the page you have a question about and tap this same info i button for its step-by-step. This FAQ covers the why.'] }
    ] },
    'settings-help': { title: 'Settings Help', sections: [
      { p: ['The full Help and FAQ for Settings: what each settings area does and how your account and team work.'] },
      { h: 'Finding an answer', p: ['Pick a topic along the top, or type a word in the search box to pull every matching question at once.'] },
      { h: 'Directions for a specific page', p: ['Open the page you have a question about and tap this same info i button for its step-by-step. This FAQ covers the why.'] }
    ] }
  },
  _hubHelpShim(action) {
    const h = this._HUB_HELP[action];
    if (!h) return null;
    return { showHowTo: () => App.showHelpModal(h.title, h.sections) };
  },
  // Pages rebuilt in the un-box language carry their own page header, so the old
  // topbar title bar is hidden for them (see navigate). Grows page by page.
  _CONVERTED: new Set(['dashboard', 'this-week', 'profit-forecast', 'profit-fix', 'audit-tracker', 'recovery-playbook', 'r-playbook', 't-playbook', 'r-audit', 't-audit', 't-presence', 't-this-week', 't-forecast', 't-fix', 't-dashboard', 't-help', 'r-dashboard', 'r-fix', 'r-this-week', 'r-forecast', 'r-server-check', 'r-menu-items', 'r-menu-engineering', 'r-price-calc', 'r-dog-test', 'r-help', 'recipe-cost-analysis', 'vendor-tracker', 'vendor-watch', 'vendor-scorecard', 'vendor-discrepancy', 'theft-risk', 'sales-integrity', 'cash-recon', 'help', 'ev-dashboard', 'ev-bookings', 'ev-calendar', 'ev-regulars', 'ev-pricing', 'ev-help', 'sc-drawers', 'sc-cash-control', 'sc-cash-history', 'sc-walked-tabs', 'sc-void-comp', 'sc-waste', 'sc-maintenance', 'sc-checklists', 'sc-checklist-templates', 'sc-help', 'sc-dashboard', 'lc-dashboard', 'lc-build-schedule', 'lc-schedule-history', 'lc-log-hours', 'lc-pay-periods', 'lc-payroll-export', 'lc-tip-log', 'lc-tip-pool', 'lc-tip-history', 'lc-reports', 'lc-overtime-watch', 'lc-callout-log', 'lc-time-off', 'lc-positions', 'lc-staff-roster', 'lc-wage-settings', 'lc-help', 'ic-dashboard', 'ic-take-inventory', 'ic-count-history', 'ic-spot-check', 'ic-receive-delivery', 'ic-delivery-history', 'ic-order-sheet', 'ic-order-history', 'ic-par-suggestions', 'ic-transfers', 'ic-adjustments', 'ic-empties', 'ic-report-usage', 'ic-report-variance', 'ic-report-stock', 'ic-report-movers', 'ic-product-setup', 'ic-locations', 'ic-vendors', 'ic-prep-batches', 'ic-help', 'c-dashboard', 'c-fix', 'c-trapped', 'c-purchasing', 'c-forecast', 'c-audit', 'c-playbook', 'c-position', 'c-bridge', 'c-capital', 'c-help']),
  _protoGlobalClick(g) {
    if (g === 'hub')     return this.showHub();
    if (g === 'flowmap') return (window.S && S.FlowMap) ? S.FlowMap.open() : null;
    if (g === 'audit') return (window.S && S.HubBarCopAudit) ? S.HubBarCopAudit.open() : null;
    if (g === 'books') return (window.S && S.HubBooksHome)   ? S.HubBooksHome.open()   : null;
    if (g === 'events') return this.jumpToSection('events');
  },
  _renderProtoTopnav(context) {
    const globalEl = document.getElementById('tn-global');
    if (globalEl) {
      globalEl.innerHTML = this._PROTO_GLOBAL.map(([k, l]) =>
        '<div class="tn-glink' + (k === context ? ' active' : '') + '" data-g="' + k + '">' + esc(l) + '</div>').join('');
      globalEl.querySelectorAll('.tn-glink[data-g]').forEach(el =>
        el.addEventListener('click', () => App._protoGlobalClick(el.dataset.g)));
    }
    const secEl = document.getElementById('tn-sections');
    if (secEl) {
      const pill = ([k, l]) => '<div class="tn-sec' + (k === context ? ' active' : '') + '" data-sec="' + k + '">' + esc(l) + '</div>';
      secEl.innerHTML = '<span class="tn-grp-label">Control:</span>'
        + this._PROTO_CONTROL.map(pill).join('')
        + '<span class="tn-grp-label" style="margin-left:16px;">Recovery:</span>'
        + this._PROTO_RECOVERY.map(pill).join('');
      secEl.querySelectorAll('.tn-sec[data-sec]').forEach(el =>
        el.addEventListener('click', () => App.jumpToSection(el.dataset.sec)));
    }
    // Relocate the account/location switcher + group dashboard into the top nav
    // (once). renderAccountSwitcher fills them by id, so moving the nodes is safe.
    const acct = document.getElementById('tn-acct');
    if (acct) {
      ['topbar-account-switcher', 'topbar-group-dashboard'].forEach(id => {
        const node = document.getElementById(id);
        if (node && node.parentElement !== acct) acct.appendChild(node);
      });
    }
  },

  // Section sub-group (drop-down) icons, keyed by the ORIGINAL sub-group name.
  // Shared by the mobile drawer (accordion headers) and the desktop mobile-style
  // sidebar. Only drop-down HEADERS use these; nested links stay icon-less.
  _NAV_GROUP_IC: {
    'Analysis':'<circle cx="7" cy="7" r="4.3" stroke="currentColor" stroke-width="1.3"/><path d="M10.2 10.2l4 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
    'Weekly':'<rect x="2" y="3.5" width="13" height="11" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 2v3M11.5 2v3M2 8h13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
    'Leaks':'<path d="M8.5 2.2C8.5 2.2 4 7.4 4 10.4a4.5 4.5 0 0 0 9 0C13 7.4 8.5 2.2 8.5 2.2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>',
    'Menu and Pricing':'<path d="M7.8 2.2H3.2a1 1 0 0 0-1 1v4.6a1 1 0 0 0 .3.7l6 6a1 1 0 0 0 1.4 0l4.6-4.6a1 1 0 0 0 0-1.4l-6-6a1 1 0 0 0-.7-.3z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="5.4" cy="5.4" r="1" fill="currentColor"/>',
    'Performance':'<path d="M2 12l4-4 3 3 5.5-6M11 5h3.5v3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
    'History':'<path d="M5 4.5h9M5 8.5h9M5 12.5h9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="2.6" cy="4.5" r="0.7" fill="currentColor"/><circle cx="2.6" cy="8.5" r="0.7" fill="currentColor"/><circle cx="2.6" cy="12.5" r="0.7" fill="currentColor"/>',
    'Digital Presence':'<circle cx="8.5" cy="8.5" r="6" stroke="currentColor" stroke-width="1.3"/><path d="M2.5 8.5h12M8.5 2.5c2.5 3 2.5 9 0 12M8.5 2.5c-2.5 3-2.5 9 0 12" stroke="currentColor" stroke-width="1.2"/>',
    'Social and Delivery':'<path d="M3 4.2a1.4 1.4 0 0 1 1.4-1.4h8.2A1.4 1.4 0 0 1 14 4.2v5a1.4 1.4 0 0 1-1.4 1.4H7l-3.4 2.8V10.6h-.2A1.4 1.4 0 0 1 3 9.2v-5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>',
    'Audit':'<circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 8.5l2 2L12 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
    'By Recovery System':'<path d="M8.5 2L2 5.3l6.5 3.3L15 5.3 8.5 2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M2 8.7l6.5 3.3L15 8.7M2 12l6.5 3.3L15 12" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>',
    'Counts':'<rect x="3.5" y="3" width="10" height="12" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M6.5 3V1.7h4V3M6 7.5h5M6 10.5h3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
    'Ordering':'<path d="M2 2.5h2l1.7 8h7l1.6-6H5.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6.5" cy="14" r="1.2" stroke="currentColor" stroke-width="1.3"/><circle cx="12" cy="14" r="1.2" stroke="currentColor" stroke-width="1.3"/>',
    'Receiving':'<rect x="1.5" y="5" width="9" height="7" rx="1" stroke="currentColor" stroke-width="1.3"/><path d="M10.5 7.5h2.5l2 2.5v2h-4.5" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="4.5" cy="13" r="1.3" stroke="currentColor" stroke-width="1.3"/><circle cx="12" cy="13" r="1.3" stroke="currentColor" stroke-width="1.3"/>',
    'Operations':'<circle cx="8.5" cy="8.5" r="2" stroke="currentColor" stroke-width="1.3"/><path d="M8.5 2v1.5M8.5 13.5V15M2 8.5h1.5M13.5 8.5H15M3.8 3.8l1.1 1.1M12.1 12.1l1.1 1.1M3.8 13.2l1.1-1.1M12.1 4.9l1.1-1.1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
    'Reports':'<rect x="3" y="2" width="11" height="13" rx="1" stroke="currentColor" stroke-width="1.3"/><path d="M6 11V8M8.5 11V6M11 11v-2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
    'Setup':'<path d="M10.8 2.6a3.4 3.4 0 0 0-4 4.4l-4.3 4.3 2.2 2.2 4.3-4.3a3.4 3.4 0 0 0 4.4-4l-2 2-1.5-.4-.4-1.5 2-2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>',
    'Scheduling':'<rect x="2" y="3" width="13" height="12" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M2 7h13M5.5 2v3M11.5 2v3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M6 10h2M9.5 10h1.5M6 12.5h2M9.5 12.5h1.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
    'Tips':'<circle cx="8.5" cy="8.5" r="6" stroke="currentColor" stroke-width="1.3"/><path d="M8.5 5v7M6.7 6.8h3a1 1 0 0 1 0 2H7.2a1 1 0 0 0 0 2h3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
    'Payroll':'<rect x="2" y="4.5" width="13" height="8" rx="1" stroke="currentColor" stroke-width="1.3"/><circle cx="8.5" cy="8.5" r="2" stroke="currentColor" stroke-width="1.3"/><path d="M4.5 6.5v4M12.5 6.5v4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
    'Shifts':'<circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M8.5 5v4l2.5 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
    'Cash':'<rect x="2" y="5" width="13" height="7" rx="1" stroke="currentColor" stroke-width="1.3"/><path d="M5 5V3.5h7V5M8.5 7.3v2.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8.5" cy="8.5" r="1.4" stroke="currentColor" stroke-width="1.2"/>',
    'Free Up Cash':'<rect x="2.5" y="6.5" width="12" height="8" rx="1.3" stroke="currentColor" stroke-width="1.3"/><path d="M5.2 6.5V4.8a3.3 3.3 0 0 1 6.6 0V6.5" stroke="currentColor" stroke-width="1.3"/><circle cx="8.5" cy="10.3" r="1.4" stroke="currentColor" stroke-width="1.2"/>',
    'Cash Flow':'<path d="M2.5 11l3-3.5 2.5 2.5L11 5.5l3.5 3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.5 14h12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
    'Checklists':'<path d="M7 4.5h7.5M7 8.5h7.5M7 12.5h7.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M2.5 4l1 1 1.6-1.9M2.5 8l1 1 1.6-1.9M2.5 12l1 1 1.6-1.9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>',
    'Accounting':'<rect x="3" y="2.5" width="11" height="12" rx="0.5" stroke="currentColor" stroke-width="1.3"/><path d="M3 5.5h11M6 8.5h5M6 10.5h5M6 12.5h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
    'Settings':'<path d="M3 5h5M11.5 5h2.5M3 12h2.5M10 12h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="9.5" cy="5" r="1.7" stroke="currentColor" stroke-width="1.3"/><circle cx="6.5" cy="12" r="1.7" stroke="currentColor" stroke-width="1.3"/>',
    'Account':'<circle cx="8.5" cy="6" r="2.8" stroke="currentColor" stroke-width="1.3"/><path d="M3 14.5c0-2.7 2.5-4.5 5.5-4.5s5.5 1.8 5.5 4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
    'Bookings':'<rect x="2.5" y="3.5" width="12" height="11" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M2.5 6.5h12M5.5 2v3M11.5 2v3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M5.5 10h6M5.5 12h3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
    'Support':'<circle cx="8.5" cy="8.5" r="6.3" stroke="currentColor" stroke-width="1.3"/><circle cx="8.5" cy="8.5" r="2.5" stroke="currentColor" stroke-width="1.3"/><path d="M4 4l2.7 2.7M10.3 10.3L13 13M13 4l-2.7 2.7M6.7 10.3L4 13" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>'
  },

  // Unified mobile navigation drawer (App.openMobileNav). On phones the top-nav
  // global links + the Control/Recovery row are hidden, so the burger opens this
  // ACCORDION: tap a section to expand its pages, so the whole menu stays compact
  // and scannable. Each section's pages are parsed live from its own sidebar
  // source, so the page list and routing are never duplicated here.
  openMobileNav() {
    // Burger is a toggle: it stays visible above the sheet, so tapping it while
    // open slides the menu back down.
    const _ex = document.getElementById('tn-mnav');
    if (_ex) {
      const _exov = document.getElementById('tn-mnav-ov');
      _ex.style.transform = 'translateY(100%)';
      if (_exov) _exov.style.opacity = '0';
      setTimeout(() => { if (_exov) _exov.remove(); _ex.remove(); }, 240);
      return;
    }
    document.getElementById('tn-mnav-ov')?.remove();
    const S2 = window.S || {};
    const hubWrap = document.getElementById('hub-wrapper');
    const onHub = hubWrap && hubWrap.style.display !== 'none';
    // Which drop-down opens on reopen is driven by the LIVE current page (read
    // off the active sidebar item), NOT by tracking menu clicks. A multi-page
    // group auto-opens only when the page you are actually on lives under it, so
    // a nested-link nav keeps that drop-down open while ANY other navigation (a
    // main link, or a page in another section, by whatever route) leaves every
    // drop-down closed. The page row itself is never highlighted.
    const liveNav = onHub ? document.querySelector('.hub-app .sidebar-nav') : document.getElementById('sidebar-nav');
    const activeEl = liveNav ? liveNav.querySelector('.nav-item.active') : null;
    const activeId = activeEl ? (activeEl.dataset.screen || activeEl.dataset.hubAction || '') : '';

    // Parse a section's sidebar HTML into its sub-groups, each with its pages, so
    // the mobile menu keeps the COUNTS / ORDERING / … structure and is never one
    // giant flat list.
    const groupsOf = (htmlFn) => {
      const out = [];
      try {
        const tmp = document.createElement('div');
        tmp.innerHTML = htmlFn() || '';
        let cur = null;
        Array.from(tmp.children).forEach(el => {
          if (el.classList && el.classList.contains('nav-section')) {
            cur = { group: (el.textContent || '').trim(), pages: [] };
            out.push(cur);
          } else if (el.classList && el.classList.contains('nav-item')) {
            if (el.dataset.nav === 'report-bug') return;
            const action = el.dataset.hubAction || '';
            if (action === 'report-bug' || action === 'contact-support') return;
            const label = (el.querySelector('.nav-label')?.textContent || '').trim();
            if (!label) return;
            if (!cur) { cur = { group: '', pages: [] }; out.push(cur); }
            cur.pages.push({ label, action, screen: el.dataset.screen || '', icon: (el.querySelector('.nav-icon') ? el.querySelector('.nav-icon').innerHTML : '') });
          }
        });
      } catch (e) {}
      return out.filter(g => g.pages.length);
    };
    const routePage = (p) => {
      if (p.screen) { App.openScreen(p.screen); return; }   // module pages + recovery-audit jumps
      const r = {
        'bar-cop-audit':      () => S2.HubBarCopAudit && S2.HubBarCopAudit.open(),
        'audit-help':         () => S2.HubAuditHelp && S2.HubAuditHelp.open(),
        'weekly-pnl':         () => S2.Reports && S2.Reports._openQboModal(),
        'books':              () => S2.HubBooks && S2.HubBooks.open(),
        'year-end':           () => S2.HubYearEnd && S2.HubYearEnd.open(),
        'permits':            () => S2.HubPermits && S2.HubPermits.open(),
        'operating-expenses': () => S2.HubOperatingExpenses && S2.HubOperatingExpenses.open(),
        'expense-history':    () => S2.HubExpenseHistory && S2.HubExpenseHistory.open(),
        'books-help':         () => S2.HubBooksHelp && S2.HubBooksHelp.open(),
        'getting-started':    () => S2.HubGettingStarted && S2.HubGettingStarted.open(),
        'settings-profile':   () => S2.HubSettings && S2.HubSettings.open('business-profile'),
        'settings-targets':   () => S2.HubSettings && S2.HubSettings.open('recovery-targets'),
        'user-account':       () => S2.HubUserAccounts && S2.HubUserAccounts.open('account'),
        'user-team':          () => S2.HubUserAccounts && S2.HubUserAccounts.open('team'),
        'settings-help':      () => S2.HubSettingsHelp && S2.HubSettingsHelp.open(),
        'help':               () => S2.HubHelp && S2.HubHelp.open()
      };
      if (r[p.action]) r[p.action]();
    };
    const navHtml = (k) => { try {
      if (k === 'inventory') return Inventory.navHTML();
      if (k === 'labor')     return Labor.navHTML();
      if (k === 'shift')     return Shift.navHTML();
      if (k === 'events')    return Events.navHTML();
      if (k === 'profit')    return ProfitNav.html();
      if (k === 'revenue')   return Revenue.navHTML();
      if (k === 'audit')     return S2.Hub._auditSidebarHTML();
      if (k === 'books')     return S2.Hub._booksSidebarHTML();
      if (k === 'settings')  return S2.Hub._settingsSidebarHTML();
    } catch (e) {} return ''; };

    // Build the nav tree as nodes for a drill-in (push) menu. A node has groups
    // of rows; a leaf row navigates, a parent row pushes its child node. Only one
    // flat, uniform list shows at a time, so it stays clean however deep the nav
    // goes. The section/sub-group holding the current page are marked so the menu
    // opens drilled-in there with that page highlighted.
    const IC = {
      hub:'<rect x="2" y="2" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="9" y="2" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="2" y="9" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.3"/>',
      blueprint:'<rect x="2" y="3" width="13" height="11" rx="1" stroke="currentColor" stroke-width="1.3"/><path d="M5 6.5h3M5 9.5h5M11.5 6v4.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
      audit:'<circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 8.5l2 2L12 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
      events:'<rect x="2" y="3.5" width="13" height="11" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 2v3M11.5 2v3M2 8h13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
      books:'<rect x="3" y="2.5" width="11" height="12" rx="0.5" stroke="currentColor" stroke-width="1.3"/><path d="M3 5.5h11M6 8.5h5M6 10.5h5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
      settings:'<circle cx="8.5" cy="8.5" r="2" stroke="currentColor" stroke-width="1.3"/><path d="M8.5 2v1.5M8.5 13.5V15M2 8.5h1.5M13.5 8.5H15M3.8 3.8l1.1 1.1M12.1 12.1l1.1 1.1M3.8 13.2l1.1-1.1M12.1 4.9l1.1-1.1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
      inventory:'<path d="M2.5 5L8.5 2l6 3v7l-6 3-6-3V5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M2.5 5l6 3 6-3M8.5 8v7" stroke="currentColor" stroke-width="1.2"/>',
      labor:'<circle cx="6" cy="6" r="2.6" stroke="currentColor" stroke-width="1.3"/><path d="M1.8 14c0-2.6 1.9-4.2 4.2-4.2s4.2 1.6 4.2 4.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M11.5 4.2a2.4 2.4 0 0 1 0 4.6M12 14c0-2.4-1.3-3.9-3-4.1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
      shift:'<circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M8.5 5v4l2.5 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
      profit:'<path d="M2 13h11M4 13V8M7.5 13V4M11 13V9.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
      revenue:'<path d="M2 13l4-5 3 3 4.5-7M10 4h4v4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
      cash:'<circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M8.5 4.7v7.6M10.6 6.3c-.4-.6-1.2-1-2.1-1-1.2 0-2.1.6-2.1 1.6 0 2.1 4.3 1.1 4.3 3.2 0 1-.9 1.6-2.2 1.6-1 0-1.8-.4-2.2-1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>',
      help:'<circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M7 6.5a1.5 1.5 0 0 1 3 0c0 1-1.5 1.5-1.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8.5" cy="12" r="0.6" fill="currentColor"/>',
      bug:'<ellipse cx="8.5" cy="9" rx="3.5" ry="4.5" stroke="currentColor" stroke-width="1.3"/><path d="M5 9H2.5M14.5 9H12M5.5 5L4 3.5M11.5 5L13 3.5M5.5 13L4 14.5M11.5 13L13 14.5M8.5 4.5V3M7 4a2 2 0 0 1 3 0" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
      dash:'<path d="M2.5 4.2l1.2 1.2 2-2.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 4h6.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M2.5 8.7l1.2 1.2 2-2.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 8.5h6.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M2.5 13.2l1.2 1.2 2-2.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 13h6.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>'
    };
    // Group (drop-down) icons live on App._NAV_GROUP_IC (shared with the desktop
    // mobile-style sidebar). Only accordion HEADERS use them; nested links don't.
    const GIC = App._NAV_GROUP_IC;
    const pageItem = (p) => ({ label: p.label, id: p.screen || p.action, icon: p.icon || '', go: () => routePage(p) });
    // Mobile-only label remaps (do NOT touch the desktop sidebars).
    const GROUP_REMAP = { audit: { 'By Recovery System': 'Recovery Audits' }, events: { 'Bookings': 'Scheduling' } };
    const PAGE_REMAP  = {};
    // A section node lists its sub-groups as single-open ACCORDIONS (they expand
    // inline) plus any leaf pages. Leaf rows (Dashboard, single-page groups, Help)
    // keep their icons; the accordion sub-group HEADERS now carry a group icon
    // too. The only rows with no icon are the final links nested under a drop-down.
    const sectionNode = (label, key, homeFn, homeLabel, panelTitle) => {
      const sgs = groupsOf(() => navHtml(key));
      const gr = GROUP_REMAP[key] || {};
      const pr = PAGE_REMAP[key] || {};
      const mkPage = (p) => { const it = pageItem(p); if (pr[it.label]) it.label = pr[it.label]; if (it.label === 'Help and FAQ') it.label = 'Help'; return it; };
      const items = [];
      const homeId = App._SECTION_DASH[key] || ({ books: 'books-home', settings: 'settings-home' })[key] || '';
      if (homeFn) items.push({ label: homeLabel || 'Dashboard', icon: IC.dash, home: true, id: homeId, go: homeFn });
      sgs.forEach(g => {
        if (g.pages.length === 1) {
          items.push(mkPage(g.pages[0]));
        } else {
          items.push({ label: gr[g.group] || g.group, groupKey: g.group, icon: GIC[g.group] || '', pages: g.pages.map(mkPage), open: !!activeId && g.pages.some(p => (p.screen || p.action) === activeId) });
        }
      });
      return { title: panelTitle || label, items: items, _key: key };
    };
    const drill = (label, key, homeFn, homeLabel, icon, panelTitle) => {
      return { label: label, key: key, icon: icon, node: sectionNode(label, key, homeFn, homeLabel, panelTitle) };
    };

    const root = { title: 'Bar Cop Menu', groups: [
      { label: 'Go to', items: [
        { label: 'Hub', icon: IC.hub, go: () => App.showHub() },
        { label: 'Blueprint', icon: IC.blueprint, go: () => S2.FlowMap && S2.FlowMap.open() },
        drill('Audits', 'audit', null, null, IC.audit),
        drill('Events', 'events', () => App.jumpToSection('events'), 'Dashboard', IC.events),
        drill('Books', 'books', () => S2.HubBooksHome && S2.HubBooksHome.open(), 'Dashboard', IC.books),
        drill('Settings', 'settings', () => S2.HubSettingsHome && S2.HubSettingsHome.open(), 'Dashboard', IC.settings, 'App Settings')
      ]},
      { label: 'Control', items: [
        drill('Inventory', 'inventory', () => App.jumpToSection('inventory'), 'Dashboard', IC.inventory),
        drill('Labor', 'labor', () => App.jumpToSection('labor'), 'Dashboard', IC.labor),
        drill('Shift', 'shift', () => App.jumpToSection('shift'), 'Dashboard', IC.shift)
      ]},
      { label: 'Recovery', items: [
        drill('Profit', 'profit', () => App.jumpToSection('profit'), 'Dashboard', IC.profit),
        drill('Revenue', 'revenue', () => App.jumpToSection('revenue'), 'Dashboard', IC.revenue),
        drill('Cash', 'cash', () => App.jumpToSection('cash'), 'Dashboard', IC.cash)
      ]},
      { label: 'Support', items: [
        { label: 'Help', icon: IC.help, go: () => S2.HubHelp && S2.HubHelp.open() }
      ]}
    ]};

    // ── DOM shell (inline-positioned so it shows even against a cached CSS) ──
    // Full-width sheet that slides UP from the bottom (the burger lives top-right;
    // a side-drawer would fight it). Sits below the top nav so the logo + burger
    // stay visible and the burger toggles it open/closed.
    const ov = document.createElement('div');
    ov.id = 'tn-mnav-ov';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9000;opacity:0;transition:opacity .18s ease;';
    const panel = document.createElement('div');
    panel.id = 'tn-mnav';
    panel.style.cssText = 'position:fixed;left:0;right:0;bottom:0;top:var(--navh);width:100%;background:var(--surface);border-top:1px solid var(--b1);box-shadow:0 -8px 30px rgba(0,0,0,0.45);z-index:9001;transform:translateY(100%);transition:transform .24s ease;display:flex;flex-direction:column;overflow:hidden;';
    const close = () => { panel.style.transform = 'translateY(100%)'; ov.style.opacity = '0'; setTimeout(() => { ov.remove(); panel.remove(); }, 240); };
    const fire = (fn) => { close(); setTimeout(() => { try { fn(); } catch (e) {} }, 30); };

    const headEl = document.createElement('div');
    headEl.className = 'mnav-head';
    const bodyEl = document.createElement('div');
    bodyEl.className = 'mnav-body';
    panel.appendChild(headEl);
    panel.appendChild(bodyEl);

    // Open drilled into the section you are in (module via _activeModule, hub via
    // _curHubSection), so reopening the menu on ANY of its pages — the dashboard
    // included — returns to that section's menu with the current page highlighted.
    const curKey = onHub ? (App._curHubSection || '') : (App._activeModule || '');
    const stack = [root];
    if (curKey) {
      let secItem = null;
      root.groups.forEach(grp => grp.items.forEach(it => { if (it.key === curKey) secItem = it; }));
      if (secItem) stack.push(secItem.node);
    }

    const mkRow = (label, type, on, icon) => {
      const r = document.createElement('div');
      r.className = 'mnav-row' + (type === 'page' ? ' mnav-page' : '') + (on ? ' on' : '');
      const ic = '<span class="mnav-ic-slot">' + (icon ? '<svg class="mnav-ic" viewBox="0 0 17 17" fill="none">' + icon + '</svg>' : '') + '</span>';
      let chev = '';
      if (type === 'drill') chev = '<span class="mnav-chev">›</span>';
      else if (type === 'acc') chev = '<span class="mnav-chev mnav-acc-chev">›</span>';
      r.innerHTML = '<span class="mnav-l">' + ic + esc(label) + '</span>' + chev;
      return r;
    };

    const render = () => {
      const node = stack[stack.length - 1];
      const canBack = stack.length > 1;
      headEl.innerHTML = (canBack ? '<button class="mnav-back" type="button" aria-label="Back">‹</button>' : '<span class="mnav-back-sp"></span>')
        + '<span class="mnav-title">' + esc(node.title) + '</span>'
        + '<button class="mnav-x" type="button" aria-label="Close">×</button>';
      headEl.querySelector('.mnav-x').addEventListener('click', close);
      const backBtn = headEl.querySelector('.mnav-back');
      if (backBtn) backBtn.addEventListener('click', () => { stack.pop(); render(); });

      bodyEl.innerHTML = '';
      // Flat list with a divider between groups (matches the desktop sidebar).
      // No accordions on either level; the two-level drill stays.
      let started = false;
      const divider = () => { if (started) { const d = document.createElement('div'); d.className = 'mnav-divider'; bodyEl.appendChild(d); } started = true; };
      if (node.groups) {
        // Multi-unit only: a location dropdown above the Hub link, styled like the
        // audit intake "Select Answer" selects. Switching a unit reloads into that
        // account.
        const accts = App._acctList || [];
        if (accts.length > 1) {
          const active = accts.find(a => a.id === App._acctActiveId) || accts[0];
          const loc = document.createElement('div');
          loc.className = 'mnav-loc';
          loc.innerHTML = '<div class="mnav-loc-label">Viewing</div>'
            + '<select class="at-qsel mnav-loc-sel">'
            + accts.map(a => '<option value="' + esc(a.id) + '"' + (a.id === active.id ? ' selected' : '') + '>' + esc(a.name) + '</option>').join('')
            + '</select>';
          loc.querySelector('.mnav-loc-sel').addEventListener('change', (ev) => {
            const id = ev.target.value;
            if (id && id !== active.id) fire(() => { if (window.DB && DB.setActiveAccount) DB.setActiveAccount(id); });
          });
          bodyEl.appendChild(loc);
          started = true;
        }
        // Level 1 (root): each category is a divider-separated block. Section rows
        // drill in (with a chevron); Hub/Blueprint/Support navigate.
        node.groups.forEach(grp => {
          const items = grp.items || [];
          if (!items.length) return;
          divider();
          items.forEach(it => {
            const row = mkRow(it.label, it.node ? 'drill' : '', false, it.icon);
            row.addEventListener('click', () => {
              if (it.node) { stack.push(it.node); render(); bodyEl.scrollTop = 0; }
              else if (it.go) { fire(it.go); }
            });
            bodyEl.appendChild(row);
          });
        });
      } else {
        // Level 2 (section): the Dashboard leaf, then every page as a flat row
        // (with its icon), a divider between the source sub-groups. No accordions.
        node.items.forEach(it => {
          divider();
          if (it.pages) {
            it.pages.forEach(p => {
              const pr = mkRow(p.label, '', !!p.id && p.id === activeId, p.icon);
              pr.addEventListener('click', () => fire(p.go));
              bodyEl.appendChild(pr);
            });
          } else {
            const row = mkRow(it.label, '', !!it.id && it.id === activeId, it.icon);
            row.addEventListener('click', () => fire(it.go));
            bodyEl.appendChild(row);
          }
        });
      }
    };

    render();
    ov.addEventListener('click', close);
    document.body.appendChild(ov);
    document.body.appendChild(panel);
    requestAnimationFrame(() => { ov.style.opacity = '1'; panel.style.transform = 'translateY(0)'; });
  },

  // Which module a screen id belongs to (by prefix; profit screens have none)
  _moduleOf(id) {
    if (/^ic-/.test(id)) return 'inventory';
    if (/^lc-/.test(id)) return 'labor';
    if (/^sc-/.test(id)) return 'shift';
    if (/^ev-/.test(id)) return 'events';
    if (/^r-/.test(id))  return 'revenue';
    if (/^c-/.test(id))  return 'cash';
    return 'profit';
  },

  // Navigate to any screen, switching the active module first if needed.
  // The deep-link target of every Fix Layer step and every Getting Started Go button.
  openScreen(id) {
    if (!id) return;
    // Hub-owned screens open as modal overlays, not as module screens.
    // navigate() already handles these but we still need to short-circuit so
    // showApp isn't called (which would briefly flash a module shell).
    if (id === 'settings') { S.HubSettings.open(); return; }
    if (id === 'settings-profile') { S.HubSettings.open('business-profile'); return; }
    if (id === 'settings-targets') { S.HubSettings.open('recovery-targets'); return; }
    if (id === 'getting-started') { S.HubGettingStarted.open(); return; }
    // Hub Accounting deliverables a fix step can deep-link to.
    if (id === 'weekly-pnl') { if (window.S && S.Reports && S.Reports._openQboModal) S.Reports._openQboModal(); return; }
    if (id === 'books') { if (window.S && S.HubBooks && S.HubBooks.open) S.HubBooks.open(); return; }
    const mod = this._moduleOf(id);
    // Show the app shell if we're not already in it (e.g., coming from a Hub
    // overlay modal, where the app shell is hidden). showApp also closes any
    // open overlay so the user actually sees the navigated screen.
    const appHidden = document.getElementById('app')?.classList.contains('hidden');
    if (mod !== this._activeModule || appHidden) this.showApp(mod);
    this.navigate(id);
  },

  // ── Breadcrumb back-link state ───────────────────────────────────────────
  // The topbar shows "[Page Title] | Back to [last page]" so the operator can
  // jump back to the last location with a single click, no matter how deep
  // the cross-module deep-link took them. Browser back also walks the
  // history stack pushed below.
  _currentLocation: null,
  _previousLocation: null,
  _navigationLock: false,

  _pushHistory(loc) {
    if (this._navigationLock) return;
    try { history.pushState({ screen: loc.screen, module: loc.module, mode: loc.mode }, ''); }
    catch (e) { /* ignore history failures */ }
  },

  // ── Floating nav: back (within a screen's view pages, any depth) + back-to-top ──
  // navigate() resets this stack to the screen's landing. A screen enters a
  // sub-view (a detail/history page rendered in place) via App.pushView(fn);
  // the floating back button (goBack) returns one level, the landing being the
  // base. No per-page back buttons, no layout impact.
  _viewStack: [],
  _viewCur: null,
  pushView(fn) {
    if (typeof fn !== 'function') return;
    if (!this._viewStack) this._viewStack = [];
    this._viewStack.push(this._viewCur || (() => {}));
    this._viewCur = fn;
    fn();
    this._updateFloatNav();
    const c = this._activeContentEl();
    if (c) c.scrollTop = 0;
  },
  goBack() {
    if (!this._viewStack || !this._viewStack.length) return;
    this._viewCur = this._viewStack.pop();
    if (typeof this._viewCur === 'function') this._viewCur();
    this._updateFloatNav();
  },
  _updateFloatNav() {
    const back = document.getElementById('fn-back');
    if (back) back.classList.toggle('show', !!(this._viewStack && this._viewStack.length));
  },
  _activeContentEl() {
    if (this._scrollEl && this._scrollEl.offsetParent !== null) return this._scrollEl;
    return [...document.querySelectorAll('.content')].find(el => el.offsetParent !== null)
      || document.querySelector('.content');
  },
  _initFloatNav() {
    const back = document.getElementById('fn-back');
    const up = document.getElementById('fn-up');
    if (back) back.addEventListener('click', () => this.goBack());
    if (up) up.addEventListener('click', () => {
      const el = this._activeContentEl();
      if (el && el.scrollTo) el.scrollTo({ top: 0, behavior: 'smooth' });
      else if (el) el.scrollTop = 0;
    });
    // Capture phase so a scroll on whichever .content is active is caught.
    document.addEventListener('scroll', (e) => {
      const el = e.target;
      if (el && el.classList && el.classList.contains('content')) {
        this._scrollEl = el;
        const u = document.getElementById('fn-up');
        if (u) u.classList.toggle('show', el.scrollTop > 400);
      }
    }, true);
  },

  _updateBackLink() {
    // Inline back link removed. Sidebar nav (including The Hub entry) handles
    // navigation; the topbar carries the page title only. _previousLocation
    // is still tracked because other systems read it (bug report context,
    // forward-alerts deep-link target labels, etc.).
    const sub = document.getElementById('topbar-sub');
    if (sub) sub.innerHTML = '';
  },

  _goBackOne() {
    if (!this._previousLocation) return;
    const t = this._previousLocation;
    if (t.mode === 'hub') {
      this.showHub();
    } else {
      if (t.module && t.module !== this._activeModule) this.showApp(t.module);
      this.navigate(t.screen);
    }
  },

  _recordLocation(newLoc) {
    // Same location as before — just refresh the back link (label may have
    // changed) without rotating previous/current.
    const cur = this._currentLocation;
    if (cur && cur.mode === newLoc.mode && cur.module === newLoc.module && cur.screen === newLoc.screen) {
      this._currentLocation = newLoc;
      this._updateBackLink();
      return;
    }
    this._previousLocation = this._currentLocation;
    this._currentLocation = newLoc;
    this._updateBackLink();
    this._pushHistory(newLoc);
  },

  _afterNavigate(id) {
    const title = document.getElementById('topbar-title')?.textContent || id;
    this._recordLocation({ mode: 'app', module: this._activeModule, screen: id, label: title });
    const v = this._VIEW_STAMP[id]; if (v) this.stampFixView(v);
  },

  // Profit Fix view-tracking: stamp the day a "review/read this screen" target
  // was opened, so the Fix steps that are reviews (not records) can verify
  // against it. Keyed to the screen the operator actually lands on.
  _VIEW_STAMP: { 'dashboard': 'dashboard', 'theft-risk': 'theft-risk', 'vendor-tracker': 'vendor-tracker', 'vendor-watch': 'vendor-tracker', 'vendor-scorecard': 'vendor-tracker', 'vendor-discrepancy': 'vendor-tracker', 'r-menu-engineering': 'r-menu-engineering', 'lc-overtime-watch': 'lc-overtime-watch', 'lc-reports': 'lc-reports', 'c-trapped': 'c-trapped', 'c-purchasing': 'c-purchasing', 'c-forecast': 'c-forecast', 'ic-par-suggestions': 'ic-par-suggestions', 'ic-vendors': 'ic-vendors' },
  stampFixView(key) {
    if (!this.data) return;
    this.data.fix_views = this.data.fix_views || {};
    const t = this.todayLocal();
    if (this.data.fix_views[key] !== t) { this.data.fix_views[key] = t; this.saveKey('fix_views'); }
  },

  showAuth() {
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('app').classList.add('hidden');
    document.body.classList.remove('chrome-on');
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

  // Both save paths persist config only: the 19 unbounded recovery/hub logs
  // live row-per-record in core_events now (see EVENT_STORES.core), so the
  // user_data blob never re-stores them. saveKey's `key` is already mutated on
  // this.data by the caller; we just write the stripped blob. Every event
  // write-site goes through putRecord/removeRecord instead.
  async save() {
    const r = await DB.writeData(this._configBlob('core', this.data));
    if (!r.ok) console.error('Save failed:', r.error);
    return r.ok;
  },

  async saveKey(key) {
    const r = await DB.writeData(this._configBlob('core', this.data));
    if (!r.ok) console.error('saveKey failed:', r.error);
    return r.ok;
  },

  // Mark a Hub Getting Started task as complete. Called from every save
  // handler that corresponds to a setup task — saving targets, generating
  // an audit, logging a shift, etc. Idempotent: re-calling on an already-
  // done task is a no-op so callers can be liberal.
  markSetupDone(taskId) {
    if (!taskId || !this.data) return;
    this.data.hub_setup_progress = this.data.hub_setup_progress || {};
    if (this.data.hub_setup_progress[taskId]) return;
    this.data.hub_setup_progress[taskId] = new Date().toISOString();
    this.saveKey('hub_setup_progress');
  },

  // Is setup "meaningful enough" to default-land on the Hub Dashboard? Yes
  // once Foundation is complete (profile + targets) AND at least one audit
  // has run. Below that threshold, returning users default-land on Hub
  // Getting Started so they have a clear next action. Catch-up banner on
  // the Hub Dashboard handles the manual-navigation case for partial setups.
  setupMeetsThreshold() {
    if (!this.data) return false;
    // Operator explicitly dismissed the Getting Started auto-redirect.
    if (this.data.settings && this.data.settings.gs_dismissed) return true;
    const p = this.data.hub_setup_progress || {};
    // Count how many setup items the operator has actually checked off.
    const checkedCount = Object.keys(p).filter(k => k.indexOf('gs_') === 0 && p[k]).length;
    // Lenient path: 3+ items checked = operator is engaged, stop forcing them
    // back to Getting Started on every signin. (Onboarding auto-checks one
    // item on landing, so this is really "2 more clicks" to dismiss.)
    if (checkedCount >= 3) return true;
    // Strict path: Profile + Targets + at least one Audit (the original rule).
    if (!p.gs_profile || !p.gs_targets) return false;
    return !!(p.gs_p_audit || p.gs_r_audit || p.gs_t_audit);
  },

  // Load Recovery data plus the three Control data stores (Rule 21)
  async loadAllData() {
    this._setupDismissed = false;   // setup banner dismiss is per-login; a fresh login shows it again
    this.data          = await DB.readData();
    this.inventoryData = await DB.readInventoryData();
    this.laborData     = await DB.readLaborData();
    this.shiftData     = await DB.readShiftData();
    // Inventory + Shift event logs live row-per-record now; fill them from the
    // rolling window after the config blobs load. (Inventory: counts,
    // deliveries, orders, transfers, empties, adjustments, spot checks. Shift:
    // shifts, void/comps, cash drops, variances, safe log, 86 list,
    // maintenance, walked tabs, waste, checklist runs.)
    await this.loadEventStores('ic');
    await this.loadEventStores('sc');
    await this.loadEventStores('lc');
    // Core / Recovery event logs (Profit pass): weeks, theft scores, variance
    // investigations, vendor discrepancies, audits -> core_events rows.
    await this.loadEventStores('core');
    // Pre-fetch the accounts list so the Hub sidebar can render the
    // Locations section synchronously (multi-account users only).
    if (DB.listMyAccounts) { await DB.listMyAccounts(); }
  },

  // Convert a delivery line_items[i] entry to total bottles. Used wherever
  // Container-unit quantity from a delivery line. The canonical inventory unit
  // for every category is the container it is ordered, received and counted in:
  // a CASE for bottle beer, a bottle for liquor/wine, a keg for draft, the stock
  // unit for food. Delivery line qty is always stored in that container unit, so
  // this is a straight read (bottle beer qty is in cases, not bottles).
  unitsFromDeliveryLine(li) {
    if (!li) return 0;
    return parseFloat(li.qty) || 0;
  },

  // Every location a product is stocked in. Products carry a locations[]
  // array (a SKU can live in many spots — walk-in, main bar, back bar, tubs).
  // Back-compat: products created before multi-location only have a single
  // primary_location, so fall back to that. Returns [] if neither is set.
  // Used by counting (a product appears under each of its locations) and by
  // every on-hand reader (which sums the product's per-location count lines).
  productLocations(p) {
    if (!p) return [];
    if (Array.isArray(p.locations) && p.locations.length) return p.locations.slice();
    return p.primary_location ? [p.primary_location] : [];
  },

  // Shared modal/popup host. Renders `html` into a fixed full-screen overlay so
  // a form can pop OVER the current page instead of swapping it out. `layer`
  // sets z-index: 9000 for a base popup, 9100 for one opened from inside
  // another popup (keeps nested modals stacking correctly). Returns the overlay.
  openModal(html, opts) {
    opts = opts || {};
    const id = opts.id || 'app-modal';
    const layer = opts.layer || 9000;
    let host = document.getElementById('app-modal-host');
    if (!host) { host = document.createElement('div'); host.id = 'app-modal-host'; document.body.appendChild(host); }
    const old = document.getElementById(id);
    if (old) old.remove();
    const overlay = document.createElement('div');
    overlay.id = id;
    overlay.style.cssText = 'position:fixed;inset:0;z-index:' + layer + ';background:rgba(0,0,0,0.7);'
      + 'display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:32px 16px;';
    // Always-visible corner X so the popup closes without scrolling to a button.
    const closeX = opts.noClose ? '' : '<button type="button" class="app-modal-x" aria-label="Close" '
      + 'style="position:absolute;top:-4px;right:0;width:32px;height:32px;border:1px solid var(--b1);border-radius:6px;'
      + 'background:var(--surface);color:var(--t2);font-size:20px;line-height:1;cursor:pointer;z-index:2;">&times;</button>';
    overlay.innerHTML = '<div style="width:100%;max-width:' + (opts.maxWidth || 900) + 'px;margin:auto 0;position:relative;">' + closeX + html + '</div>';
    host.appendChild(overlay);
    const x = overlay.querySelector('.app-modal-x');
    if (x) x.addEventListener('click', () => App.closeModal(id));
    return overlay;
  },
  closeModal(id) {
    const el = document.getElementById(id || 'app-modal');
    if (el) el.remove();
  },

  // Shared "Get Started" setup box for the Control cockpits (Inventory / Labor /
  // Shift). Sits above the weekly cockpit and disappears once every step's data
  // exists. steps: [{ num, label, screen, done }]; sectionLabel e.g. 'Inventory'.
  // Step chips link to their setup screen via data-go (each cockpit's wire handles it).
  controlGetStarted(sectionLabel, steps) {
    if (!steps || !steps.length || steps.every(s => s.done)) return '';
    const numWord = { 1: 'One', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six' }[steps.length] || steps.length;
    const chip = s =>
      '<div data-go="' + s.screen + '" style="display:flex;align-items:center;gap:10px;cursor:pointer;flex:1;min-width:200px;padding:11px 13px;border:1px solid '
      + (s.done ? 'var(--b2)' : 'var(--gold-tint-bord)') + ';border-radius:8px;background:' + (s.done ? 'var(--input)' : 'var(--gold-tint)') + ';">'
      + '<span style="width:20px;height:20px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;'
      + (s.done ? 'background:var(--green);color:var(--bg);' : 'border:1px solid var(--t3);color:var(--t3);') + '">' + (s.done ? '&#10003;' : s.num) + '</span>'
      + '<span style="font-size:12px;font-weight:600;color:var(--t1);">' + esc(s.label) + '</span></div>';
    return '<div class="card form-card" style="margin-bottom:16px;">'
      + '<div class="card-title">Get Started</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:14px;">' + numWord + ' steps to getting started in ' + esc(sectionLabel) + ' Control.</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;">' + steps.map(chip).join('') + '</div>'
      + '</div>';
  },

  // Display unit for a product's Par / Order Qty / On-Hand columns. Bottle beer
  // pars/orders in cases, draft in kegs, liquor/wine in bottles; Food/Misc use
  // the product's unit_type (lb, each, case, qt…). Keeps every category's
  // quantity columns labeled the same way instead of baking the unit into the
  // product name.
  productUnit(p) {
    if (!p) return '';
    if (p.category === 'Bottle Beer') return 'cases';
    if (p.category === 'Draft Beer')  return 'kegs';
    if (p.category === 'Liquor' || p.category === 'Wine') return 'btls';
    return p.unit_type || '';
  },

  // Per-bottle cost for any product. For case-tracked Bottle Beer (case_size
  // > 0), unit_cost is stored as cost-per-case; divide by case_size to get
  // per-bottle. For everything else unit_cost is already per single
  // container, so pass through. Used everywhere inventory math multiplies
  // bottle counts by a cost (usage cost, COGS, stock value, variance dollars,
  // spot check, books inventory valuation).
  bottleCost(p) {
    if (!p || p.unit_cost == null) return null;
    const cost = parseFloat(p.unit_cost);
    if (isNaN(cost)) return null;
    if (p.category === 'Bottle Beer' && p.case_size && p.case_size > 0) {
      return cost / p.case_size;
    }
    return cost;
  },

  // Per-CONTAINER cost for inventory math (on-hand value, usage cost, COGS,
  // variance dollars, stock value, vendor watch, top movers, books valuation).
  // unit_cost is stored per container for EVERY category — per case for bottle
  // beer, per bottle for liquor/wine, per keg for draft, per stock unit for food
  // — so this is a straight read. The ONLY place a per-bottle cost is used is the
  // menu, because a beer is sold by the bottle: see bottleCost (menuItemCost,
  // recipes, spot-check pour variance, waste).
  unitCost(p) {
    if (!p || p.unit_cost == null) return null;
    const c = parseFloat(p.unit_cost);
    return isNaN(c) ? null : c;
  },
  // Per-container cost resolved from a count-item snapshot. Used when the source
  // product was deleted/disabled and we fall back to the unit_cost saved on the
  // count item (already per container).
  unitCostFromCountItem(it) {
    if (!it || it.unit_cost == null) return null;
    const c = parseFloat(it.unit_cost);
    return isNaN(c) ? null : c;
  },

  // True when a product is case-tracked bottle beer. The single predicate every
  // inventory screen should use instead of re-checking category + case_size.
  isCaseBeer(p) {
    return !!(p && p.category === 'Bottle Beer' && p.case_size && p.case_size > 0);
  },

  // Format a quantity with the product's container unit, e.g. "3.3 cases",
  // "12 btls", "2 kegs", "40 lb". Keeps every quantity column labeled so a
  // number is never ambiguous about which unit it is in. decimals defaults to a
  // tidy 1 place for fractional values, whole numbers print without a decimal.
  qtyWithUnit(p, n, decimals) {
    if (n == null || isNaN(n)) return '-';
    const num = Number(n);
    const txt = (num % 1 === 0) ? String(num) : num.toFixed(decimals == null ? 1 : decimals);
    const u = this.productUnit(p);
    return u ? (txt + ' ' + u) : txt;
  },

  // Abbreviated container unit for the count Full / Open / Total columns: cases
  // -> cs, bottles -> btls, kegs -> kegs, plus the common food units. Falls back
  // to whatever unit is on file. Single source so every inventory section reads
  // identically.
  unitAbbr(unit) {
    const u = (unit || '').toString().trim().toLowerCase();
    const map = {
      cases: 'cs', case: 'cs', cs: 'cs',
      kegs: 'kegs', keg: 'kegs',
      bottles: 'btls', bottle: 'btls', btls: 'btls', btl: 'btls',
      each: 'ea', ea: 'ea', units: 'ea', unit: 'ea',
      pounds: 'lbs', pound: 'lbs', lbs: 'lbs', lb: 'lbs',
      ounces: 'oz', ounce: 'oz', oz: 'oz',
      quarts: 'qt', quart: 'qt', qt: 'qt',
      gallons: 'gal', gallon: 'gal', gal: 'gal',
      liters: 'L', liter: 'L', l: 'L'
    };
    return map[u] || u;
  },

  // The Full / Open / Total column strings for one counted product, formatted
  // IDENTICALLY everywhere a count is listed (Take Inventory review, Count
  // History detail, and any future inventory section — keep them all on this).
  // Bottle beer counts full cases, an open count of loose bottles, and totals in
  // cases; everything else is in its container unit, abbreviated. Pass the
  // product (may be null — falls back to vals.category/unit_type) plus the raw
  // count fields. Returns { full, open, total } display strings.
  countCols(p, vals) {
    vals = vals || {};
    const total = vals.total || 0;
    const caseSize = vals.caseSize != null ? vals.caseSize : ((p && p.case_size) || 0);
    const isBeer = (((p && p.category) || vals.category) === 'Bottle Beer') && caseSize > 0;
    if (isBeer) {
      const cases = vals.cases != null ? vals.cases : Math.floor(total);
      const loose = vals.loose != null ? vals.loose : Math.round((total - Math.floor(total)) * caseSize);
      return { full: cases + ' cs', open: loose + ' btls', total: total.toFixed(2) + ' cs' };
    }
    const u = this.unitAbbr(this.productUnit(p || { category: vals.category, unit_type: vals.unit_type }));
    const us = u ? ' ' + u : '';
    return {
      full:  (vals.fulls || 0) + us,
      open:  (vals.partial || 0).toFixed(1) + us,
      total: total.toFixed(1) + us
    };
  },

  // Shared usage builder for the count-pair reports (Usage, Variance, Top
  // Movers, Dynamic Pars, Dashboard). Returns a per-product map of the raw
  // building blocks in CONTAINER units (cases for bottle beer, bottles for
  // liquor/wine, kegs for draft, stock unit for food). Each report layers its
  // own policy on top: floor at zero, subtract comps/waste (Variance only),
  // derive theoretical sales, etc. Centralizing this kills the unit drift that
  // came from five separate copies of the same math.
  //   start/end : ic_counts records (start older, end newer)
  //   deliveries: ic_deliveries (purchases dated in (start.date, end.date])
  // Per product: { product, name, category, starting, ending, purchases,
  //   rawUsed (= starting + purchases - ending, NOT floored), unitCost (per
  //   container, null if unknown), isCaseBeer, servingsPerUnit (bottles per case
  //   for beer, pours_per_container otherwise), ozPerUnit }.
  computeUsagePair(start, end, deliveries) {
    const out = {};
    const sMap = {}, eMap = {};
    ((start && start.items) || []).forEach(it => {
      if (sMap[it.product_id]) sMap[it.product_id].total = (sMap[it.product_id].total || 0) + (it.total || 0);
      else sMap[it.product_id] = { ...it };
    });
    ((end && end.items) || []).forEach(it => {
      if (eMap[it.product_id]) eMap[it.product_id].total = (eMap[it.product_id].total || 0) + (it.total || 0);
      else eMap[it.product_id] = { ...it };
    });
    const purch = {};
    (deliveries || [])
      .filter(d => d.date && start && end && d.date > start.date && d.date <= end.date)
      .forEach(d => (d.line_items || []).forEach(li => {
        purch[li.product_id] = (purch[li.product_id] || 0) + this.unitsFromDeliveryLine(li);
      }));
    const prods = (this.inventoryData && this.inventoryData.ic_products) || [];
    Object.keys(eMap).forEach(pid => {
      if (!sMap[pid]) return;
      const ei = eMap[pid], si = sMap[pid];
      const p = prods.find(x => x.id === pid) || {};
      const starting  = parseFloat(si.total) || 0;
      const ending    = parseFloat(ei.total) || 0;
      const purchases = purch[pid] || 0;
      const isCaseBeer = this.isCaseBeer(p);
      const unitCost = (p.unit_cost != null) ? this.unitCost(p) : this.unitCostFromCountItem(ei);
      const servingsPerUnit = isCaseBeer ? p.case_size : (p.pours_per_container || null);
      const ozPerUnit = isCaseBeer
        ? (p.container_size_oz != null ? p.case_size * p.container_size_oz : null)
        : (p.container_size_oz != null ? p.container_size_oz : null);
      out[pid] = {
        product: p, name: ei.name || p.name || '(unnamed)', category: ei.category || p.category || '',
        starting, ending, purchases, rawUsed: starting + purchases - ending,
        unitCost: unitCost != null ? unitCost : null,
        isCaseBeer, servingsPerUnit, ozPerUnit
      };
    });
    return out;
  },

  // Staff picker <option> markup. Used by every form that asks for a person
  // (manager, cashier, server, witness, recorded-by, etc.) so the operator
  // picks from the roster instead of free-typing a name that might not
  // match anyone. Returns option HTML; caller wraps in <select id=...>.
  //
  // selectedId can be either a staff_id (preferred, post-Phase-0) or a
  // legacy name string from records that pre-date the staff_id field. The
  // helper resolves a legacy name to its staff_id automatically and selects
  // that option, so edit-mode forms preselect the right person.
  //
  // opts:
  //   placeholder   First-option label. Default: "Select staff..."
  //   optional      If true, placeholder reads as the empty pick.
  //   filter        Function(staff) returning bool. Limit to a custom subset.
  //   audience      'supervisor' | 'service' | 'kitchen' | 'all' (default). The
  //                 named audience for this picker: supervisor = Management dept
  //                 or Shift Lead (Manager / Authorized By / MOD); service = Bar
  //                 or Front of House (Server / bartender / cashier); kitchen =
  //                 Kitchen dept (cook pickers); all = everyone.
  //
  // App.staffById(id) resolves an id back to the staff record at save time.
  staffOptions(selectedId, opts) {
    opts = opts || {};
    const roster = ((this.laborData && this.laborData.lc_staff) || []);
    let pool = roster.filter(s => s.status !== 'Inactive');
    // Narrow to the people who belong in this kind of picker.
    if (opts.audience === 'supervisor') pool = pool.filter(s => this.isSupervisor(s));
    else if (opts.audience === 'service') pool = pool.filter(s => this.isService(s));
    else if (opts.audience === 'kitchen') pool = pool.filter(s => this.isKitchen(s));
    if (opts.filter) pool = pool.filter(opts.filter);

    // Resolve a legacy name → id so old records preselect correctly.
    let resolvedId = selectedId || '';
    if (resolvedId && !pool.some(s => s.id === resolvedId)) {
      const byName = pool.find(s => s.name === resolvedId);
      if (byName) resolvedId = byName.id;
    }

    // One consistent shape for every staff picker: a flat list, alphabetical by
    // name (no position optgroups — the audience already narrows who shows up).
    const sorted = pool.slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    let h = '<option value="">' + esc(opts.placeholder || 'Select staff...') + '</option>';
    sorted.forEach(s => {
      h += '<option value="' + esc(s.id) + '"' + (resolvedId === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>';
    });

    // Preserve a selected value that isn't in the (filtered) pool so an edit
    // never silently drops the record's staff link: an inactive or off-audience
    // staff member shows their real name (+ "(inactive)" when inactive); a true
    // legacy free-text value shows "(not on roster)".
    if (selectedId && !pool.some(s => s.id === selectedId) && !pool.some(s => s.name === selectedId)) {
      const off = roster.find(s => s.id === selectedId || s.name === selectedId);
      // A generated id (lowercase base36 with a digit, no spaces) that resolves
      // to nobody is an orphan — a stale draft value or a removed staff link.
      // Drop it so the picker shows the placeholder, never a raw id like
      // "mq6z6dgi6nvu". A genuine legacy free-text name is still preserved.
      const looksLikeOrphanId = /[0-9]/.test(selectedId) && !/\s/.test(selectedId) && selectedId === selectedId.toLowerCase();
      if (off) {
        h += '<option value="' + esc(off.id) + '" selected>' + esc(off.name + (off.status === 'Inactive' ? ' (inactive)' : '')) + '</option>';
      } else if (!looksLikeOrphanId) {
        h += '<option value="' + esc(selectedId) + '" selected>' + esc(selectedId + ' (not on roster)') + '</option>';
      }
    }

    return h;
  },

  // A staff member who can run a shift and authorize as a manager: anyone in the
  // Management department, plus hourly staff flagged Shift Lead on the roster.
  // Drives the Manager / Authorized By / Manager-on-Duty pickers.
  isSupervisor(s) {
    if (!s) return false;
    if (s.shift_lead) return true;
    const positions = (this.laborData && this.laborData.lc_positions) || [];
    const p = positions.find(x => x.id === s.position_id);
    return !!(p && (p.department || '') === 'Management');
  },

  // Front-of-house service staff who ring sales and own tabs: anyone in the Bar
  // or Front of House department. Drives the Server pickers.
  isService(s) {
    if (!s) return false;
    const positions = (this.laborData && this.laborData.lc_positions) || [];
    const p = positions.find(x => x.id === s.position_id);
    const d = (p && p.department) || '';
    return d === 'Bar' || d === 'Front of House';
  },

  // Back-of-house staff: anyone in the Kitchen department. Drives cook pickers.
  isKitchen(s) {
    if (!s) return false;
    const positions = (this.laborData && this.laborData.lc_positions) || [];
    const p = positions.find(x => x.id === s.position_id);
    return ((p && p.department) || '') === 'Kitchen';
  },

  // True if the staff member's position is flagged Tipped in Positions. Accepts a
  // record or a staff_id. Drives tipped-only preloads (Tip Log batch entry) and
  // the tip-credit check. Pairs with the per-position `tipped` boolean.
  isTipped(s) {
    if (typeof s === 'string') s = this.staffById(s);
    if (!s) return false;
    const positions = (this.laborData && this.laborData.lc_positions) || [];
    const p = positions.find(x => x.id === s.position_id);
    return !!(p && p.tipped);
  },

  // The Position record for a staff member (or null).
  positionFor(s) {
    if (typeof s === 'string') s = this.staffById(s);
    if (!s) return null;
    return ((this.laborData && this.laborData.lc_positions) || []).find(x => x.id === s.position_id) || null;
  },
  // Per-position tip-out: percent of THIS role's sales it tips out (servers,
  // bartenders > 0; bussers/barbacks/runners = 0). 0 for a non-tipped position.
  tipOutPctFor(s) {
    const p = this.positionFor(s);
    const v = p && p.tipped ? parseFloat(p.tip_out_pct) : 0;
    return (v && v > 0) ? v : 0;
  },
  // Tip-out role, derived from the per-position %: 'earner' = a tipped role that
  // tips out (rings sales, % > 0); 'support' = a tipped role that only receives
  // (% = 0); null = not tipped.
  tipRole(s) {
    const p = this.positionFor(s);
    if (!p || !p.tipped) return null;
    return (parseFloat(p.tip_out_pct) || 0) > 0 ? 'earner' : 'support';
  },
  // True if the house uses tip-outs at all (any tipped position tips out a %).
  // Drives whether the Tip Log shows the tip-out form vs the simple one.
  tipOutEnabled() {
    return ((this.laborData && this.laborData.lc_positions) || []).some(p => p.tipped && (parseFloat(p.tip_out_pct) || 0) > 0);
  },
  // Net tip income for one tip record: gross tips minus any tip-out this person
  // paid out, plus any tip-out they received. This is the honest figure the
  // tip-credit check and payroll worksheet read — Bar Cop computes the amount;
  // how it is physically paid out is the operator's payroll process, not ours.
  netTips(t) {
    if (!t) return 0;
    const gross = (parseFloat(t.cash_tips) || 0) + (parseFloat(t.card_tips) || 0);
    return gross - (parseFloat(t.tip_out_paid) || 0) + (parseFloat(t.tip_out_received) || 0);
  },

  // The logical "shift" a tip entry or tip pool belongs to = its day + service
  // period. A deterministic key both the Tip Log and the Tip Pool compute the
  // same way, so Books / Year-End / Tip History / pay periods keep joining tips
  // to their pool without depending on a live shift record. Replaces the old
  // sc_shifts id as the tip anchor.
  tipShiftKey(date, period) {
    return (date || '') + '|' + (period || '');
  },

  // Resolve a staff_id (or legacy name) to the staff record. Save handlers
  // call this to denormalize the picked staff into a name field for display
  // alongside the id for joins.
  staffById(id) {
    if (!id) return null;
    const list = ((this.laborData && this.laborData.lc_staff) || []);
    return list.find(s => s.id === id) || list.find(s => s.name === id) || null;
  },

  // Cash variance tolerance for a register: how far its drawer can be off before
  // a reconcile flags. Set per-register on the Add Register form (cash_tolerance);
  // default $10 so it is never blank. Pass a register id (or record). Every cash
  // screen + the POS cash import resolve tolerance through here so the rule lives
  // in one place. The safe count uses a fixed $10, not a register tolerance.
  drawerTolerance(drawerOrId) {
    const d = (drawerOrId && typeof drawerOrId === 'object') ? drawerOrId
            : (drawerOrId ? this.drawerById(drawerOrId) : null);
    if (d && d.cash_tolerance != null && d.cash_tolerance !== '') {
      const n = parseFloat(d.cash_tolerance);
      if (!isNaN(n)) return n;
    }
    return 10;
  },

  // Drawer / register <option> markup for cash forms. Same pattern as
  // staffOptions: handles legacy free-text values, sorts alphabetical,
  // appends "(unsaved)" for any value not on the saved list so historical
  // records do not lose their drawer association on edit.
  drawerOptions(selectedId, opts) {
    opts = opts || {};
    const all = ((this.shiftData && this.shiftData.sc_drawers) || [])
      .filter(d => d.active !== false);

    let resolvedId = selectedId || '';
    if (resolvedId && !all.some(d => d.id === resolvedId)) {
      const byName = all.find(d => d.name === resolvedId);
      if (byName) resolvedId = byName.id;
    }

    let h = '<option value="">' + esc(opts.placeholder || 'Select drawer...') + '</option>';
    all.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(d => {
      h += '<option value="' + esc(d.id) + '"' + (resolvedId === d.id ? ' selected' : '') + '>' + esc(d.name) + '</option>';
    });

    if (selectedId && !all.some(d => d.id === selectedId) && !all.some(d => d.name === selectedId)) {
      h += '<option value="' + esc(selectedId) + '" selected>' + esc(selectedId) + ' (unsaved)</option>';
    }
    return h;
  },

  drawerById(id) {
    if (!id) return null;
    const list = ((this.shiftData && this.shiftData.sc_drawers) || []);
    return list.find(d => d.id === id) || list.find(d => d.name === id) || null;
  },

  // ── Service periods (dayparts) — operator-configurable ──────────────────────
  // The operator picks the services they run in App Settings / onboarding; stored
  // in settings.service_periods as [{id,name,start,end}]. SHIFT_TYPES (the names)
  // is DERIVED from this, so every shift-type consumer follows the operator's set
  // with no per-file change. Defaults below until they set their own.
  SERVICE_PERIOD_PRESETS: [
    { name: 'Breakfast',  start: '06:00', end: '11:00' },
    { name: 'Brunch',     start: '09:00', end: '14:00' },
    { name: 'Lunch',      start: '11:00', end: '16:00' },
    { name: 'Happy Hour', start: '15:00', end: '18:00' },
    { name: 'Dinner',     start: '16:00', end: '22:00' },
    { name: 'Late Night', start: '22:00', end: '02:00' },
    { name: 'Full Day',   start: '00:00', end: '23:59' }
  ],
  DEFAULT_SERVICE_PERIODS: [
    { id: 'sp_def_brunch', name: 'Brunch',     start: '09:00', end: '14:00' },
    { id: 'sp_def_lunch',  name: 'Lunch',      start: '11:00', end: '16:00' },
    { id: 'sp_def_dinner', name: 'Dinner',     start: '16:00', end: '22:00' },
    { id: 'sp_def_late',   name: 'Late Night', start: '22:00', end: '02:00' },
    { id: 'sp_def_full',   name: 'Full Day',   start: '00:00', end: '23:59' }
  ],
  servicePeriods() {
    const sp = this.data && this.data.settings && this.data.settings.service_periods;
    return (Array.isArray(sp) && sp.length) ? sp : this.DEFAULT_SERVICE_PERIODS;
  },
  // Canonical shift-type names, derived from the operator's service periods. Every
  // consumer reads from here so the list never drifts.
  get SHIFT_TYPES() { return this.servicePeriods().map(p => p.name); },
  // The service period whose time window contains "now" — drives the Open-the-Floor
  // auto-pick. Handles a window that wraps past midnight (Late Night); skips an
  // all-day catch-all unless nothing else matches; falls back to the most recently
  // started period, then the first.
  servicePeriodByTime(periods) {
    const list = periods || this.servicePeriods();
    if (!list.length) return null;
    const d = new Date();
    const now = d.getHours() * 60 + d.getMinutes();
    const min = t => { const a = String(t || '').split(':'); return (parseInt(a[0], 10) || 0) * 60 + (parseInt(a[1], 10) || 0); };
    const allDay = p => min(p.start) === 0 && min(p.end) >= 1439;
    const inWin = p => { const s = min(p.start), e = min(p.end); return e <= s ? (now >= s || now < e) : (now >= s && now < e); };
    const hit = list.find(p => !allDay(p) && inWin(p));
    if (hit) return hit;
    const started = list.filter(p => min(p.start) <= now).sort((a, b) => min(b.start) - min(a.start))[0];
    return started || list[0];
  },

  // Void/Comp comp reasons — the single dropdown on a comp. Each carries its own
  // loss-vs-expense classification so the operator picks one thing and Theft
  // Risk, Books, and Year-End all stay honest from one source. A comp is a LOSS
  // (a give-away that feeds Theft Risk) unless it is an internal-policy EXPENSE.
  // Only Staff Meal and Shift Drink are expense; every customer-facing comp,
  // including Marketing / Promo, is loss so it stays visible in the comp signal.
  // Voids keep their own reason list (they are not comps) over in sc-void-comp.
  SC_COMP_REASONS: [
    { value: 'Service Recovery',  cls: 'loss' },
    { value: 'Customer Goodwill', cls: 'loss' },
    { value: 'Manager Comp',      cls: 'loss' },
    { value: 'Regular / VIP',     cls: 'loss' },
    { value: 'Marketing / Promo', cls: 'loss' },
    { value: 'Staff Meal',        cls: 'expense' },
    { value: 'Shift Drink',       cls: 'expense' }
  ],
  // Classify a comp by its reason. Accepts a reason string (or a legacy category
  // value). Unknown/blank defaults to loss — the conservative call for Theft
  // Risk. Returns true for loss, false for policy expense.
  compReasonIsLoss(reason) {
    const r = String(reason || '');
    const hit = (this.SC_COMP_REASONS || []).find(x => x.value === r);
    if (hit) return hit.cls === 'loss';
    // Legacy category values from before the reason/category merge.
    if (r === 'Staff Meal' || r === 'Shift Drink') return false;
    return true;
  },

  // Overtime thresholds — federal 40 hr/week; "approaching" is the UI watch
  // line. Labor Dashboard, Overtime Watch, and Pay Periods all read from here
  // so the number can never desync across the three screens that act on it.
  OT_THRESHOLD: 40,
  OT_APPROACHING: 35,

  // Canonical product category groups. Replaces the duplicated BAR_CATS /
  // KITCHEN_CATS arrays in this-week.js, bar-products.js, kitchen-products.js,
  // and the inline isBar() check below.
  BAR_CATS: ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer'],
  KITCHEN_CATS: ['Food', 'Misc'],

  // Full Inventory Control product category list (the product form picker) and
  // the Food/Misc stock-unit list. Single source so take-inventory,
  // product-setup and the log forms never drift from each other.
  IC_CATEGORIES: ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer', 'Food', 'Misc'],
  IC_FOOD_UNIT_TYPES: ['lb', 'oz', 'each', 'case', 'bag', 'gallon', 'quart', 'pint', 'dozen'],

  // Canonical vendor discrepancy types. Used by vendor-discrepancy.js and
  // ic-receive-delivery.js flag-per-line flow so the type list stays unified.
  VENDOR_DISCREPANCY_TYPES: ['Price Overcharge', 'Short Count', 'Substitution', 'Damaged Goods', 'Other'],

  // Canonical Profit Audit section names. Used by audit-tracker.js in
  // extractSections, viewAudit sections array, and renderNarrative sections
  // array so the list never drifts across the three call sites.
  AUDIT_PROFIT_SECTION_NAMES: [
    'Bar Cost and Pour Control',
    'Theft and Loss Prevention',
    'Food Cost Control',
    'Vendor Control',
    'Prime Cost'
  ],

  // Categories on sc_void_comps records. A 30-year operator separates loss
  // (a comp given for service recovery, a void rung in error) from policy
  // expense (a staff meal eaten, a shift drink poured under house rules).
  // Conflating them inflates the Theft Risk score and lies to the P&L.
  // Loss categories feed Theft Risk; expense categories are tracked as a
  // separate cost line in Books and Year-End.
  VOID_COMP_CATEGORIES: ['Customer Comp', 'Service Recovery', 'Staff Meal', 'Shift Drink'],

  // Menu category groupings used across Revenue Recovery (r-menu-items,
  // r-menu-engineering, r-price-calc, r-dog-test, recipe-cost-analysis).
  // Promoted from per-file local arrays so the lists never drift.
  // Plate-side menu categories — what the operator picks on the Plate form.
  MENU_PLATE_CATEGORIES: ['Appetizers', 'Entrees', 'Desserts', 'Specials'],
  // Inventory Control product categories shown as available recipe ingredients.
  // Cocktail recipes draw from spirits, wine, beer, and the catch-all Misc bin.
  MENU_COCKTAIL_ING_CATS: ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer', 'Misc'],
  // Plate recipes draw from the Food category and Misc.
  MENU_PLATE_ING_CATS: ['Food', 'Misc'],
  // Direct-pour mapping: what IC categories show on the Inventory form,
  // grouped by their MENU category for the picker.
  MENU_INVENTORY_GROUPS: [
    { menuCat: 'Beer',         icCats: ['Bottle Beer', 'Draft Beer'] },
    { menuCat: 'Wine',         icCats: ['Wine'] },
    { menuCat: 'NA Beverages', icCats: ['Misc'] },
    // Packaged items bought and sold whole (bagged snacks, bottled NA, etc.).
    // Any Food or Misc product marked "Sold on the menu" lands here.
    { menuCat: 'Snacks',       icCats: ['Food', 'Misc'] }
  ],
  // Reverse map: IC product category → menu category (auto-derived on save).
  MENU_IC_TO_CAT: {
    'Bottle Beer': 'Beer',
    'Draft Beer':  'Beer',
    'Wine':        'Wine',
    'Misc':        'NA Beverages'
  },

  // 2nd-level tag on the catch-all Misc category. Misc lumps three different
  // kinds of thing (things you sell, things you cook/mix with, and pure
  // operating supplies), so this tag keeps each out of the wrong list:
  // NA Beverage shows in the Menu Items NA picker (and stays available as a
  // mixer); Drink Mixer / Food Ingredient are recipe ingredients only; the two
  // supply types stay out of every menu/recipe picker.
  MISC_TYPES: ['NA Beverage', 'Drink Mixer', 'Food Ingredient', 'Paper & To-Go', 'Cleaning & Supplies', 'Other'],
  MISC_SUPPLY_TYPES: ['Paper & To-Go', 'Cleaning & Supplies'],
  // Tagged as an NA beverage in Inventory (vs a mixer or a supply).
  miscSellable(p) { return !!p && p.category === 'Misc' && p.misc_type === 'NA Beverage'; },
  // Pure operating supply — not a recipe ingredient, not a menu item.
  miscIsSupply(p) { return !!p && p.category === 'Misc' && this.MISC_SUPPLY_TYPES.includes(p.misc_type); },

  // ── Resale items (bought and sold whole) ──────────────────────────────
  // A Food or Misc product the operator marked "Sold on the menu." Its cost
  // flows to the menu item per SERVING, not per purchased unit (a case of 30
  // bags costs cost/30 a bag), the same case→unit step Bottle Beer already
  // does. Beer/Wine/Draft are never resale here — they keep their own cost path.
  isResale(p) { return !!p && (p.category === 'Food' || p.category === 'Misc') && p.sold_on_menu === true; },
  resaleCostPerServing(p) {
    if (!p) return 0;
    const c = parseFloat(p.unit_cost); if (isNaN(c)) return 0;
    const n = parseFloat(p.servings_per_unit);
    return (n && n > 0) ? c / n : c;
  },
  // The per-sale cost of an inventory product when it is linked to a menu item:
  // resale items use cost per serving, bottle beer divides the case, everything
  // else is the straight per-container cost. One source for menuItemCost and the
  // Menu Items linked-product forms so they never disagree.
  menuLinkCost(p, pourOz) {
    if (!p) return 0;
    if (this.isResale(p)) return this.resaleCostPerServing(p);
    // Bottle beer is sold whole — one bottle is one serving — so the per-bottle
    // cost (cost per case / case size) is the menu cost.
    if (p.category === 'Bottle Beer') {
      const bc = this.bottleCost(p);
      return bc != null ? bc : (parseFloat(p.unit_cost) || 0);
    }
    // Poured beverages (Wine, Draft Beer, Liquor) are sold by the glass/pour, so
    // the menu cost is the cost of ONE pour, NEVER the whole bottle or keg. Honor
    // a per-item pour override, else the product's pour size.
    const unit = parseFloat(p.unit_cost) || 0;
    const container = parseFloat(p.container_size_oz) || 0;
    const pour = (pourOz != null && pourOz > 0) ? pourOz : (parseFloat(p.pour_size_oz) || 0);
    if (container > 0 && pour > 0) return unit * pour / container;
    if (p.cost_per_pour != null) return parseFloat(p.cost_per_pour) || 0;
    // No pour basis yet: a poured beverage's menu cost is the cost of one pour,
    // never the whole container, so report 0 (Incomplete) until pour data exists.
    return 0;
  },
  // ── Sub-category (product style) ──────────────────────────────────────
  // Starter suggestions per category for the Sub-Category datalist. The
  // operator picks one or types their own; matching values group the product
  // list (and Set Locations) by style so they can scan what they carry.
  SUBCAT_SUGGESTIONS: {
    'Liquor':      ['Vodka', 'Gin', 'Rum', 'Tequila', 'Mezcal', 'Bourbon', 'Rye', 'Whiskey', 'Scotch', 'Irish Whiskey', 'Brandy', 'Cognac', 'Liqueur', 'Amaro', 'Aperitif', 'Bitters', 'Other'],
    'Wine':        ['Red', 'White', 'Rosé', 'Sparkling', 'Champagne', 'Vermouth', 'Fortified', 'Dessert', 'Other'],
    'Bottle Beer': ['Domestic', 'Import', 'Craft', 'Cider', 'Seltzer', 'Non-Alcoholic', 'Other'],
    'Draft Beer':  ['IPA', 'Lager', 'Pilsner', 'Stout', 'Porter', 'Wheat', 'Ale', 'Sour', 'Cider', 'Other'],
    'Food':        ['Protein', 'Seafood', 'Produce', 'Dairy', 'Bakery', 'Dry Goods', 'Frozen', 'Sauces', 'Condiments', 'Spices', 'Other']
  },
  // Datalist values = the starter set + any sub-categories the operator has
  // already used for this category (so typos do not splinter a group).
  subcatSuggestions(category) {
    const starter = (this.SUBCAT_SUGGESTIONS && this.SUBCAT_SUGGESTIONS[category]) || [];
    const used = [];
    const prods = (this.inventoryData && this.inventoryData.ic_products) || [];
    prods.forEach(p => {
      if ((p.category || '') !== category) return;
      const s = (p.sub_category || '').trim();
      if (s && !starter.some(x => x.toLowerCase() === s.toLowerCase()) && !used.some(x => x.toLowerCase() === s.toLowerCase())) used.push(s);
    });
    return starter.concat(used.sort((a, b) => a.localeCompare(b)));
  },
  // Group products for the grouped product lists: by Misc Type for Misc, by
  // category for an 'All' view, else by Sub-Category. Returns ordered groups
  // [{key, items}] — starter order first, custom values alpha, blank ('') last.
  subcatGroups(prods, category) {
    const byCat  = !category || category === 'All';
    const isMisc = category === 'Misc';
    const keyOf  = p => byCat ? (p.category || '') : (isMisc ? (p.misc_type || '') : (p.sub_category || ''));
    let starter;
    if (byCat)       starter = this.IC_CATEGORIES || [];
    else if (isMisc) starter = this.MISC_TYPES || [];
    else             starter = (this.SUBCAT_SUGGESTIONS && this.SUBCAT_SUGGESTIONS[category]) || [];
    const order = {}; starter.forEach((s, i) => { order[String(s).toLowerCase()] = i; });
    const groups = {};
    prods.forEach(p => { const k = keyOf(p); (groups[k] = groups[k] || []).push(p); });
    const keys = Object.keys(groups).sort((a, b) => {
      if (a === '') return 1; if (b === '') return -1;
      const ia = order[a.toLowerCase()], ib = order[b.toLowerCase()];
      if (ia != null && ib != null) return ia - ib;
      if (ia != null) return -1;
      if (ib != null) return 1;
      return a.localeCompare(b);
    });
    return keys.map(k => ({ key: k, items: groups[k].slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')) }));
  },

  // The menu category an inventory product belongs to when linked to a menu
  // item. Drives the Menu Items category picker + the auto-derived category on
  // save. Returns '' when the product is not sellable on the menu.
  menuCatForProduct(p) {
    if (!p) return '';
    if (p.category === 'Bottle Beer' || p.category === 'Draft Beer') return 'Beer';
    if (p.category === 'Wine') return 'Wine';
    if (this.miscSellable(p) && p.sold_on_menu) return 'NA Beverages';
    if ((p.category === 'Food' || p.category === 'Misc') && p.sold_on_menu) return 'Snacks';
    return '';
  },

  // Target cost % defaults per menu category. Plate dishes target 32%,
  // single-drink cocktails target 22%, catering targets 28%. Operators
  // override per item; this is the default applied when a new item is created.
  MENU_TARGET_COST_PCT: { plate: 32, cocktail: 22, catering: 28 },

  // Revenue Events canonical enums.
  EVENT_TYPES: ['Private Dining', 'Buyout', 'Catering', 'Corporate', 'Social'],
  EVENT_STATUSES: ['Inquiry', 'Proposal Sent', 'Confirmed', 'Completed', 'Lost'],
  // Per-status color tokens. Confirmed = blue (committed), Proposal Sent =
  // amber (pending, watch state), Completed = gold (won), Lost = red,
  // Inquiry = neutral. All read from the CSS palette so the colors stay
  // consistent with the rest of Bar Cop's status system.
  EVENT_STATUS_COLOR: {
    'Completed':      'var(--gold)',
    'Confirmed':      'var(--blue)',
    'Proposal Sent':  'var(--amber)',
    'Inquiry':        'var(--t3)',
    'Lost':           'var(--red)'
  },

  // Reusable "How this works" modal. sections = [{ h:'Header', p:['para', ...] }].
  // A section with no h is intro paragraphs. Keeps step/explainer text off the
  // page itself (see memory: how-this-works-pattern).
  // Page directions render as a right-side slide-in panel (not a centered modal):
  // it reads as "reference that slid in," dismisses with Close or a click off it,
  // and never destroys anything.
  showHelpModal(title, sections) {
    const sh = t => '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin:18px 0 8px;">' + t + '</div>';
    const pp = t => '<p style="margin:0 0 10px;">' + t + '</p>';
    let body = '';
    (sections || []).forEach(s => { if (s.h) body += sh(s.h); (s.p || []).forEach(t => { body += pp(t); }); });

    const m = document.createElement('div');
    m.className = 'help-overlay';
    m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9000;opacity:0;transition:opacity .18s ease;';
    const box = document.createElement('div');
    box.className = 'help-panel';
    box.style.cssText = 'position:fixed;top:0;right:0;height:100%;width:420px;max-width:92vw;background:var(--surface);border-left:1px solid var(--b1);box-shadow:-10px 0 30px rgba(0,0,0,0.4);z-index:9001;display:flex;flex-direction:column;transform:translateX(100%);transition:transform .22s ease;';
    box.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--b2);flex-shrink:0;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);">' + title + '</div>'
      + '<button class="btn btn-ghost btn-sm" data-help-close>Close</button></div>'
      + '<div style="padding:20px;font-size:13px;color:var(--t2);line-height:1.75;overflow-y:auto;flex:1;">' + body + '</div>';
    const close = () => {
      box.style.transform = 'translateX(100%)';
      m.style.opacity = '0';
      setTimeout(() => { m.remove(); box.remove(); }, 230);
    };
    m.addEventListener('click', close);
    box.querySelector('[data-help-close]').addEventListener('click', close);
    document.body.appendChild(m);
    document.body.appendChild(box);
    requestAnimationFrame(() => { m.style.opacity = '1'; box.style.transform = 'translateX(0)'; });
  },

  // Shared report chrome: connected "folder" tabs + the panel they open into.
  // tabs = [[key, label, tooltipKey?], ...]. The active tab visually connects
  // to the panel, whose header shows the active report name + Export PDF. The
  // controls/tabs are no-print so Export targets just the report table.
  reportTabBar(tabs, activeKey) {
    return '<div class="rpt-tabs no-print">' + (tabs || []).map(t =>
      '<button class="rpt-tab' + (t[0] === activeKey ? ' on' : '') + '" data-tab="' + t[0] + '">' + esc(t[1]) + '</button>').join('') + '</div>';
  },
  reportPanel(tabs, activeKey, exportId, bodyHtml) {
    const active = (tabs || []).find(t => t[0] === activeKey) || (tabs || [])[0] || ['', '', ''];
    return '<div class="rpt-panel"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>' + esc(active[1]) + (active[2] ? ' ' + tt(active[2]) : '') + '</span>'
      + '<button class="btn btn-ghost btn-sm" id="' + exportId + '">Export PDF</button></div>'
      + bodyHtml + '</div>';
  },

  // Reusable empty / prerequisite state. Renders a centered card (real card
  // styling) with one or more numbered steps: gold badge + step title + a one
  // line description + an action button. A completed step flips its badge to a
  // gold check and swaps the button for a Done tag, so a half-set-up operator
  // sees exactly what is left. Renders into container and wires the buttons.
  // opts = { title, lead, steps:[{ title, desc, btn, screen, done }] }.
  setupCard(container, opts) {
    opts = opts || {};
    const steps = opts.steps || [];
    const rows = steps.map((s, i) => {
      const done = !!s.done;
      const badge = '<div class="setup-num' + (done ? ' done' : '') + '">' + (done ? '&#10003;' : (i + 1)) + '</div>';
      const action = done
        ? '<div class="setup-done-tag">Done</div>'
        : (s.btn && s.screen ? '<button class="btn btn-primary setup-go" data-go="' + esc(s.screen) + '">' + esc(s.btn) + '</button>' : '');
      return '<div class="setup-step">' + badge
        + '<div class="setup-step-body"><div class="setup-step-title">' + esc(s.title) + '</div>'
        + (s.desc ? '<div class="setup-step-desc">' + esc(s.desc) + '</div>' : '')
        + action + '</div></div>';
    }).join('');
    container.innerHTML = '<div class="screen"><div class="card setup-card">'
      + '<div class="card-title">' + esc(opts.title || 'Get Started') + '</div>'
      + (opts.lead ? '<div class="setup-lead">' + esc(opts.lead) + '</div>' : '')
      + rows
      + '<div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--b2);font-size:12px;color:var(--t3);line-height:1.5;">'
      + 'Need a hand? Tap the info <strong>i</strong> button at the top right for directions on this page, anytime.</div>'
      + '</div></div>';
    container.onclick = ev => {
      const go = ev.target.closest('.setup-go');
      if (go && go.dataset.go) App.navigate(go.dataset.go);
    };
  },

  // Collapsible form cards. The add/import forms on a landing page stay open by
  // default; this lets the operator tuck one away once they are past setup so the
  // list below rises up. State is a per-device view preference (localStorage),
  // not business data, so it is never written to the account. Collapsing hides
  // the body via CSS — the form stays mounted, so in-progress entries and the CSV
  // importer are preserved. Usage: put collapseToggle(key) just left of How This
  // Works in the title, wrap the card body in <div class="collapse-body">, route
  // the page's click delegation through toggleCollapse, and call applyCollapsed
  // after setting innerHTML.
  _collapseKey(key) { return 'barcop_collapse_' + key; },
  collapsed(key) {
    try { return localStorage.getItem(this._collapseKey(key)) === '1'; } catch (e) { return false; }
  },
  // Standard help button. Centralized so the label and style are a one-place
  // edit, not a per-page change. Ghost-button border kept on purpose — operators
  // want an obvious target, not a faint link.
  helpButton(id, label) {
    return '<button type="button" class="btn btn-ghost btn-sm" id="' + esc(id) + '">' + esc(label || 'How it works') + '</button>';
  },

  // ── Filter UI helpers: date presets + single-select chips ───────────────────
  // Kyle prefers click buttons over filter dropdowns ([[filter-chips-presets]]).
  // Small categorical filters render as chips; date ranges get preset buttons.
  DATE_PRESETS: [['this-week', 'This Week'], ['last-week', 'Last Week'], ['this-month', 'This Month'], ['last-4', 'Last 4 Weeks']],
  datePresetRange(key) {
    const today = this.todayLocal();
    const d = new Date(today + 'T00:00:00');
    const ymd = x => this.ymdLocal(x);
    const monday = new Date(d); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    if (key === 'this-week') return { from: ymd(monday), to: today };
    if (key === 'last-week') { const s = new Date(monday); s.setDate(s.getDate() - 7); const e = new Date(monday); e.setDate(e.getDate() - 1); return { from: ymd(s), to: ymd(e) }; }
    if (key === 'this-month') return { from: ymd(new Date(d.getFullYear(), d.getMonth(), 1)), to: today };
    if (key === 'last-4') { const s = new Date(d); s.setDate(s.getDate() - 27); return { from: ymd(s), to: today }; }
    if (key === 'last-12') { const s = new Date(d); s.setDate(s.getDate() - 83); return { from: ymd(s), to: today }; }
    if (key === 'all') return { from: '', to: '' };
    return { from: '', to: '' };
  },
  datePresetButtons(cls, presets) {
    return (presets || this.DATE_PRESETS).map(p =>
      '<button type="button" class="btn btn-ghost btn-sm ' + (cls || 'date-preset') + '" data-preset="' + p[0] + '">' + p[1] + '</button>').join('');
  },
  // Single-select filter chips. options = [{ v, label }] with v:'' as the "All"
  // chip. Active chip = --sel-active-bg (the active selector look); inactive is
  // ghost. Caller wires the class.
  filterChips(active, options, cls) {
    return options.map(o => {
      const on = (o.v || '') === (active || '');
      return '<button type="button" class="btn btn-sm ' + (cls || 'fc-chip') + '" data-v="' + esc(o.v || '') + '" style="'
        + (on ? 'background:var(--sel-active-bg);border:1px solid var(--gold-tint-bord);color:var(--t1);font-weight:700;'
              : 'background:transparent;border:1px solid var(--b1);color:var(--t2);') + '">' + esc(o.label) + '</button>';
    }).join('');
  },

  // ── In-memory form drafts (fixed-field forms) ───────────────────────────────
  // Keep a half-filled form alive across an in-screen re-render (a filter click)
  // and leaving the screen and coming back, without a leave-confirm popup or a
  // resume banner. The screen holds the draft in its own memory: capture it on
  // every input, then restore it after the form re-renders fresh. In-memory by
  // design, so it auto-clears on a full page reload (no stale-draft confusion);
  // only Save or Start Over resets it. captureDraft snapshots every id'd control
  // under `root`; restoreDraft writes them back, after which the screen re-runs
  // its own disclosure/calc wiring so the restored values take effect. Array-state
  // forms (Tip Log, Tip Pool) keep their own row state instead of using this.
  captureDraft(root) {
    if (!root) return null;
    const d = {};
    root.querySelectorAll('input[id], select[id], textarea[id]').forEach(el => {
      d[el.id] = (el.type === 'checkbox' || el.type === 'radio') ? el.checked : el.value;
    });
    return Object.keys(d).length ? d : null;
  },
  restoreDraft(root, draft) {
    if (!root || !draft) return;
    Object.keys(draft).forEach(id => {
      const el = root.querySelector('#' + id) || document.getElementById(id);
      if (!el) return;
      if (el.type === 'checkbox' || el.type === 'radio') el.checked = !!draft[id];
      else el.value = draft[id];
    });
  },

  // ── Page directions (the nav "i" button) ────────────────────────────────────
  // ONE universal help affordance lives in the top nav (next to Settings, always
  // visible incl. mobile). It opens the CURRENT page's directions in a slide-in
  // panel — no per-page help buttons, no tooltips cluttering the page. Reuses each
  // screen's existing showHowTo() as the content; falls back to the full Help and
  // FAQ when a screen has no directions of its own. _activeScreenObj is set on
  // every navigation (see navigate()).
  openPageHelp() {
    const s = this._activeScreenObj;
    if (s && typeof s.showHowTo === 'function') { s.showHowTo(); return; }
    if (window.S && S.HubHelp) S.HubHelp.open();
  },

  // A collapsible card header. The WHOLE header toggles the card open/closed; the
  // chevron is just a rotating visual indicator, so the operator does not have to
  // hit the tiny target. The help button on the right is excluded by the page's
  // click delegation (it is checked first). One header governs a group: its own
  // card body (wrapped in .collapse-body) plus any element tagged
  // data-collapse-group="<key>" — e.g. the drag/drop import card below the form.
  collapsibleCardTitle(key, titleText, rightHtml) {
    return '<div class="card-title card-collapse-head" data-collapse-key="' + esc(key) + '" '
      + 'style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>' + esc(titleText) + '</span>'
      + '<div style="display:flex;align-items:center;gap:10px;">'
      + '<span class="card-chevron" aria-hidden="true">&#9662;</span>'
      + (rightHtml || '')
      + '</div></div>';
  },
  _applyCollapseState(key, isCollapsed, root) {
    root = root || document;
    const head = root.querySelector('.card-collapse-head[data-collapse-key="' + key + '"]');
    const card = head ? head.closest('.card') : null;
    if (card) card.classList.toggle('collapsed', isCollapsed);
    root.querySelectorAll('[data-collapse-group="' + key + '"]').forEach(el => el.classList.toggle('collapse-off', isCollapsed));
  },
  applyCollapsed(root) {
    root = root || document;
    root.querySelectorAll('.card-collapse-head').forEach(head =>
      this._applyCollapseState(head.dataset.collapseKey, this.collapsed(head.dataset.collapseKey), root));
  },
  toggleCollapse(head) {
    if (!head) return;
    const key = head.dataset.collapseKey;
    const isCollapsed = !this.collapsed(key);
    try {
      if (isCollapsed) localStorage.setItem(this._collapseKey(key), '1');
      else localStorage.removeItem(this._collapseKey(key));
    } catch (e) { /* storage unavailable — toggle still works for this view */ }
    this._applyCollapseState(key, isCollapsed, head.closest('.screen') || document);
  },

  // ── PDF export ─────────────────────────────────────────────────────────────
  // Excel-style export: click -> native Save dialog (filename pre-filled) -> Save,
  // no browser print preview. Generates the PDF client-side from the on-screen
  // report DOM (card titles + .tbl tables + .calc tiles, skipping .no-print
  // chrome) so one helper serves every Export button. jsPDF + autoTable are
  // lazy-loaded from CDN the same way the XLSX import lib is.
  _ensurePDFLib() {
    if (this._pdfLibPromise) return this._pdfLibPromise;
    if (window.jspdf && window.jspdf.jsPDF) { this._pdfLibPromise = Promise.resolve(); return this._pdfLibPromise; }
    const load = src => new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    this._pdfLibPromise = load('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
      .then(() => load('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'));
    return this._pdfLibPromise;
  },

  _pdfDateStamp() {
    const d = new Date(), p = n => String(n).padStart(2, '0');
    return '' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate());
  },

  // Strip filename-illegal characters (Windows + macOS) from a string before it
  // goes into a download filename, so a bar or venue name like "Mike's Bar /
  // Grill" never produces an invalid name and a silently failed download.
  // Collapses whitespace; falls back to 'Bar Cop' if nothing usable is left.
  fileSafe(s) {
    const cleaned = String(s == null ? '' : s)
      .replace(/[\/\\:*?"<>|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned || 'Bar Cop';
  },

  // jsPDF's built-in fonts only encode Latin-1. A single character above U+00FF
  // (e.g. the "->" arrow, the trend triangles) corrupts the WHOLE string into
  // garbage ("&M&a&y&..."), so map the glyphs the app actually uses to ASCII and
  // drop anything else still outside Latin-1.
  _pdfSafe(s) {
    return String(s == null ? '' : s)
      .replace(/→/g, '->').replace(/←/g, '<-')
      .replace(/↑/g, 'up').replace(/↓/g, 'down')
      .replace(/▲/g, '+').replace(/▼/g, '-')
      .replace(/[–—]/g, '-')
      .replace(/[‘’′]/g, "'").replace(/[“”]/g, '"')
      .replace(/•/g, '-').replace(/ /g, ' ').replace(/…/g, '...')
      .replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/×/g, 'x')
      .replace(/[^\x00-\xFF]/g, '');
  },

  // Clean text of a node for the PDF: strip buttons, tooltips, and no-print chrome.
  _pdfNodeText(node) {
    if (!node) return '';
    const clone = node.cloneNode(true);
    clone.querySelectorAll('button, .no-print, .tt, .tt-badge, [data-tt]').forEach(el => el.remove());
    return this._pdfSafe((clone.textContent || '').replace(/\s+/g, ' ').trim());
  },

  _pdfTableData(table) {
    const headRow = table.querySelector('thead tr');
    const head = headRow ? [Array.from(headRow.children).map(th => this._pdfNodeText(th))] : [];
    let body = Array.from(table.querySelectorAll('tbody tr'))
      .filter(tr => !tr.closest('.no-print'))
      .map(tr => Array.from(tr.children).map(td => this._pdfNodeText(td)));
    if (!body.length && !head.length) return null;
    // Drop trailing columns that are empty across every row + header (action cols).
    const cols = Math.max(head[0] ? head[0].length : 0, ...body.map(r => r.length), 0);
    for (let c = cols - 1; c >= 0; c--) {
      const headEmpty = !head[0] || !(head[0][c] || '').trim();
      const bodyEmpty = body.every(r => !(r[c] || '').trim());
      if (headEmpty && bodyEmpty) {
        if (head[0]) head[0].splice(c, 1);
        body.forEach(r => r.splice(c, 1));
      } else break;
    }
    return { head, body, cols: (head[0] ? head[0].length : (body[0] ? body[0].length : 0)) };
  },

  // Walk a report container into ordered PDF blocks: headings, key/value tiles,
  // sub-headers, and tables — in document order, skipping no-print chrome.
  _collectPDFBlocks(root) {
    const blocks = [];
    root.querySelectorAll('.card-title, .sh, .pdf-para, .calc-item, table.tbl, .empty-title, .empty-sub, .alert-text').forEach(node => {
      if (node.closest('.no-print')) return;
      if (node.matches('table.tbl')) {
        const t = this._pdfTableData(node);
        if (t) blocks.push({ type: 'table', head: t.head, body: t.body, cols: t.cols });
      } else if (node.matches('.calc-item')) {
        const label = this._pdfNodeText(node.querySelector('.calc-label'));
        const val = this._pdfNodeText(node.querySelector('.calc-val'));
        const text = (label ? label + ': ' : '') + val;
        if (text.trim()) blocks.push({ type: 'kv', text });
      } else if (node.matches('.card-title')) {
        const text = this._pdfNodeText(node);
        if (text) blocks.push({ type: 'heading', text });
      } else if (node.matches('.sh')) {
        const text = this._pdfNodeText(node);
        if (text) blocks.push({ type: 'subheading', text });
      } else if (node.matches('.pdf-para')) {
        const text = this._pdfNodeText(node);
        if (text) blocks.push({ type: 'para', text });
      } else {
        const text = this._pdfNodeText(node);
        if (text) blocks.push({ type: 'note', text });
      }
    });
    return blocks;
  },

  async exportPDF(opts) {
    opts = opts || {};
    const title = opts.title || 'Report';
    // Prefer an explicit root. Otherwise pick the LAST .screen that actually holds
    // report content — the visible one — never the first/empty .screen in the DOM.
    let root = opts.root;
    if (!root) {
      const screens = Array.from(document.querySelectorAll('.screen'));
      root = screens.reverse().find(s => s.querySelector('table.tbl, .rpt-panel, .calc, .tbl-wrap'))
        || screens[0] || document.body;
    }
    if (!root) return;
    try { await this._ensurePDFLib(); }
    catch (e) { alert('Could not load the PDF engine. Check your connection and try again.'); return; }

    // A report with sub-tabs exports one tab at a time; tag the filename with the
    // active tab so each sub-report saves under its own name instead of clobbering
    // the last. Auto-read from the active .rpt-tab; opts.subtitle overrides.
    let subtitle = opts.subtitle || '';
    if (!subtitle) {
      const onTab = root.querySelector('.rpt-tab.on');
      if (onTab) subtitle = (onTab.textContent || '').replace(/\s+/g, ' ').trim();
    }

    const blocks = this._collectPDFBlocks(root);
    const maxCols = blocks.reduce((m, b) => b.type === 'table' ? Math.max(m, b.cols || 0) : m, 0);
    const orientation = opts.orientation || (maxCols > 7 ? 'landscape' : 'portrait');

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation, unit: 'pt', format: 'letter' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 40;
    let y = margin;

    const venue = (this.data && this.data.settings && this.data.settings.bar_name) || '';
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(20, 20, 20);
    doc.text(this._pdfSafe(opts.brand || 'Bar Cop'), margin, y);   // opts.brand: a customer-facing doc (an event agreement) brands as the venue, not Bar Cop
    doc.setFontSize(12);
    doc.text(this._pdfSafe(subtitle ? title + ' - ' + subtitle : title), pageW - margin, y, { align: 'right' });
    y += 16;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110, 110, 110);
    const dstr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const subVenue = opts.brand ? '' : (venue ? venue + '   |   ' : '');   // brand already shows the venue up top
    doc.text(this._pdfSafe(subVenue + dstr), margin, y);
    y += 8;
    doc.setDrawColor(205, 205, 205); doc.line(margin, y, pageW - margin, y);
    y += 16;

    const ensure = h => { if (y > pageH - 60 - h) { doc.addPage(); y = margin; } };
    blocks.forEach(b => {
      if (b.type === 'heading') {
        ensure(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(20, 20, 20);
        doc.text(b.text, margin, y); y += 16;
      } else if (b.type === 'subheading') {
        ensure(16); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(130, 130, 130);
        doc.text(b.text.toUpperCase(), margin, y); y += 13;
      } else if (b.type === 'kv' || b.type === 'note') {
        ensure(15); doc.setFont('helvetica', b.type === 'kv' ? 'bold' : 'normal'); doc.setFontSize(10); doc.setTextColor(45, 45, 45);
        doc.text(b.text, margin, y); y += 14;
      } else if (b.type === 'para') {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(55, 55, 55);
        this._pdfSafe(b.text).split('\n').forEach(seg => {
          doc.splitTextToSize(seg || ' ', pageW - 2 * margin).forEach(ln => { ensure(13); doc.text(ln, margin, y); y += 12.5; });
        });
        y += 6;
      } else if (b.type === 'table') {
        doc.autoTable({
          startY: y + 2,
          head: b.head, body: b.body,
          margin: { left: margin, right: margin },
          styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak', lineColor: [225, 225, 225], lineWidth: 0.5 },
          headStyles: { fillColor: [28, 28, 28], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [246, 246, 246] },
          theme: 'grid'
        });
        y = doc.lastAutoTable.finalY + 16;
      }
    });

    const pages = doc.internal.getNumberOfPages();
    // opts.footer: pass '' to drop the standard Bar Cop line (a customer-facing
    // agreement should not carry it); a string replaces it; omitted = the default.
    const footTxt = (opts.footer != null) ? opts.footer : 'Generated by Bar Cop. Figures are derived from your inputs; verify before relying on them.';
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(150, 150, 150);
      if (footTxt) doc.text(this._pdfSafe(footTxt), margin, pageH - 22);
      doc.text('Page ' + i + ' of ' + pages, pageW - margin, pageH - 22, { align: 'right' });
    }

    const tag = (opts.fileTag || subtitle || title).replace(/[^A-Za-z0-9]+/g, '');
    await this._savePDF(doc, 'BarCop_' + tag + '_' + this._pdfDateStamp() + '.pdf');
  },

  async _savePDF(doc, filename) {
    filename = App.fileSafe(filename);
    const blob = doc.output('blob');
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'PDF document', accept: { 'application/pdf': ['.pdf'] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return; // user cancelled the Save dialog
        // any other failure (e.g. lost user activation) -> fall back to download
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  },

  // ── Data-driven PDF builder ────────────────────────────────────────────────
  // For documents we generate FROM DATA (audits, books, checklists, handoff)
  // rather than by walking the DOM. Assumes the PDF lib is already loaded
  // (caller: await App._ensurePDFLib()). Chainable; mirrors exportPDF's header/
  // footer so every Bar Cop PDF looks the same. Auto-paginates.
  _pdfBuilder(title, opts) {
    opts = opts || {};
    const App = this;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: opts.orientation || 'portrait', unit: 'pt', format: 'letter' });
    const margin = 40;
    const b = {
      doc, margin, title,
      pageW: doc.internal.pageSize.getWidth(),
      pageH: doc.internal.pageSize.getHeight(),
      y: margin,
      get usableW() { return this.pageW - margin * 2; },
      _limit() { return this.pageH - 40; },
      _need(h) { if (this.y + h > this._limit()) { doc.addPage(); this.y = margin; } return this; },
      header(o) {
        o = o || {};
        const venue = (App.data && App.data.settings && App.data.settings.bar_name) || '';
        doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(20, 20, 20);
        doc.text('Bar Cop', margin, this.y);
        doc.setFontSize(12);
        doc.text(App._pdfSafe(o.right || title), this.pageW - margin, this.y, { align: 'right' });
        this.y += 16;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110, 110, 110);
        const meta = o.meta != null ? o.meta : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        doc.text(App._pdfSafe((venue ? venue + '   |   ' : '') + meta), margin, this.y);
        this.y += 8;
        doc.setDrawColor(205, 205, 205); doc.line(margin, this.y, this.pageW - margin, this.y);
        this.y += 16;
        return this;
      },
      sectionTitle(text) {
        this._need(26);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(150, 140, 90);
        doc.text(App._pdfSafe(String(text).toUpperCase()), margin, this.y);
        this.y += 5;
        doc.setDrawColor(225, 225, 225); doc.line(margin, this.y, this.pageW - margin, this.y);
        this.y += 13;
        return this;
      },
      heading(text, size) {
        size = size || 12;
        this._need(size + 8);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(size); doc.setTextColor(20, 20, 20);
        doc.text(App._pdfSafe(text), margin, this.y); this.y += size + 6;
        return this;
      },
      kv(label, value) {
        this._need(15);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(60, 60, 60);
        const lbl = App._pdfSafe(label + ':');
        doc.text(lbl, margin, this.y);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 30, 30);
        doc.text(App._pdfSafe(String(value == null ? '' : value)), margin + doc.getTextWidth(lbl) + 8, this.y);
        this.y += 15;
        return this;
      },
      paragraph(text, o) {
        o = o || {};
        const g = o.gray != null ? o.gray : 55;
        const sz = o.size || 10;
        doc.setFont('helvetica', o.italic ? 'italic' : 'normal'); doc.setFontSize(sz); doc.setTextColor(g, g, g);
        const lines = doc.splitTextToSize(App._pdfSafe(text), this.usableW);
        const lh = sz + 3;
        lines.forEach(ln => { this._need(lh); doc.text(ln, margin, this.y); this.y += lh; });
        this.y += 3;
        return this;
      },
      table(head, body, o) {
        o = o || {};
        this._need(44);
        doc.autoTable({
          startY: this.y,
          head: head ? [head.map(h => App._pdfSafe(h))] : undefined,
          body: (body || []).map(r => r.map(c => App._pdfSafe(c))),
          margin: { left: margin, right: margin, top: margin, bottom: 40 },
          columnStyles: o.columnStyles || {},
          styles: { fontSize: 8, cellPadding: 5, lineColor: [225, 225, 225], lineWidth: 0.5, overflow: 'linebreak', valign: 'middle' },
          headStyles: { fillColor: [28, 28, 28], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [246, 246, 246] },
          theme: 'grid'
        });
        this.y = doc.lastAutoTable.finalY + 14;
        return this;
      },
      spacer(h) { this.y += (h == null ? 10 : h); return this; },
      disclaimer(text) {
        this.y += 6;
        this._need(20);
        doc.setDrawColor(225, 225, 225); doc.line(margin, this.y, this.pageW - margin, this.y); this.y += 9;
        doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(130, 130, 130);
        doc.splitTextToSize(App._pdfSafe(text), this.usableW).forEach(ln => { this._need(10); doc.text(ln, margin, this.y); this.y += 9.5; });
        return this;
      },
      async save(filename) {
        const pages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pages; i++) {
          doc.setPage(i);
          doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(150, 150, 150);
          doc.text('Generated by Bar Cop. Figures are derived from your inputs; verify before relying on them.', margin, this.pageH - 22);
          doc.text('Page ' + i + ' of ' + pages, this.pageW - margin, this.pageH - 22, { align: 'right' });
        }
        await App._savePDF(doc, filename);
      }
    };
    return b;
  },

  // ── Menu Items ───────────────────────────────────────────────────────────
  // Single canonical store for every sellable thing on the menu. Each item
  // can OPTIONALLY have a recipe attached (ingredient breakdown). When a
  // recipe is present, the item's cost auto-computes from current product
  // prices; otherwise the manually-entered cost field is used.
  //
  // App.data.menu_items is the canonical store for everything sellable on the
  // menu. Each item has an OPTIONAL embedded `recipe` field (ingredients +
  // plate_yield). Edited from ONE screen: r-menu-items (Revenue Recovery).
  // Profit Recovery's Recipe Cost Analysis is a read-only ranked view that
  // bounces back to r-menu-items for any edits.
  //
  // Prep batches (frozen margarita mix, simple syrup, marinara base) are
  // reference data under Inventory Control per Rule 21 — App.inventoryData.
  // ic_prep_batches. Recipes can use them as ingredients alongside products.
  menuItems() {
    if (!this.data) return [];
    if (!Array.isArray(this.data.menu_items)) this.data.menu_items = [];
    return this.data.menu_items;
  },
  menuItemById(id) {
    return this.menuItems().find(m => m.id === id) || null;
  },
  prepBatches() {
    if (!this.inventoryData) return [];
    if (!Array.isArray(this.inventoryData.ic_prep_batches)) this.inventoryData.ic_prep_batches = [];
    return this.inventoryData.ic_prep_batches;
  },
  prepBatchById(id) {
    return this.prepBatches().find(b => b.id === id) || null;
  },
  // Backward-compat alias for any consumer still referencing the old
  // top-level batches array. Resolves to the new ic_prep_batches home.
  batches() { return this.prepBatches(); },

  // Compute effective cost for a menu item. Priority order:
  //   1. linked_product_id  → bottle/unit cost from the linked IC product
  //                            (used for Beer/Wine/NA — direct-pour items)
  //   2. recipe.ingredients → sum of ingredient costs at current prices
  //                            (used for cocktails / food plates)
  //   3. manual item.cost   → operator-typed fallback (Other category)
  //
  // Ingredient row shape: { source: 'product'|'batch', id, quantity }.
  // Legacy shape { product_id, quantity } is still recognized.
  menuItemCost(item) {
    if (!item) return null;

    // Linked product takes priority. For Bottle Beer with case_size,
    // bottleCost handles the per-case → per-bottle conversion.
    if (item.linked_product_id) {
      const prods = (this.inventoryData && this.inventoryData.ic_products) || [];
      const p = prods.find(x => x.id === item.linked_product_id);
      if (p) return this.menuLinkCost(p, item.pour_size_oz);
    }

    if (item.recipe && Array.isArray(item.recipe.ingredients) && item.recipe.ingredients.length) {
      const prods = (this.inventoryData && this.inventoryData.ic_products) || [];
      const batches = (this.inventoryData && this.inventoryData.ic_prep_batches) || [];
      const isBar = p => p && App.BAR_CATS.includes(p.category);

      const ingCost = ing => {
        const qty = parseFloat(ing.quantity) || 0;
        const src = ing.source || (ing.product_id ? 'product' : null);
        const id  = ing.id || ing.product_id;
        if (!src || !id) return (parseFloat(ing.cost_per_unit) || 0) * qty;

        if (src === 'batch') {
          const b = batches.find(x => x.id === id);
          if (!b) return 0;
          return (b.cost_per_serving || 0) * qty;
        }
        // product
        const p = prods.find(x => x.id === id);
        if (!p) return (parseFloat(ing.cost_per_unit) || 0) * qty;
        const unitCost = isBar(p)
          ? (item.recipe.mode === 'single'
              ? (p.cost_per_pour != null ? p.cost_per_pour : (this.bottleCost(p) || 0))
              : (this.bottleCost(p) != null ? this.bottleCost(p) : (p.unit_cost || 0)))
          : (p.unit_cost || 0);
        return unitCost * qty;
      };

      const tc = item.recipe.ingredients.reduce((s, ing) => s + ingCost(ing), 0);
      if (item.recipe.mode === 'food' && item.recipe.plate_yield > 0) {
        return tc / item.recipe.plate_yield;
      }
      return tc;
    }
    return parseFloat(item.cost) || 0;
  },

  // ── Menu cost vs target + cost-creep attribution ───────────────────────────
  // Per-item cost target: the item's own override, else the default for its kind
  // (food plate vs cocktail).
  menuTargetPct(item) {
    if (item && item.target_cost_pct != null && item.target_cost_pct !== '') return parseFloat(item.target_cost_pct);
    const food = !!(item && item.recipe && item.recipe.mode === 'food');
    return food ? this.MENU_TARGET_COST_PCT.plate : this.MENU_TARGET_COST_PCT.cocktail;
  },
  // Live cost percentage of a menu item against its menu price, plus its target.
  menuItemPct(item) {
    const cost = this.menuItemCost(item) || 0;
    const price = parseFloat(item && item.price) || 0;
    const pct = price > 0 ? cost / price * 100 : null;
    const target = this.menuTargetPct(item);
    return { cost, price, pct, target, over: (pct != null && target != null && pct > target + 0.05) };
  },
  // Menu items that reference any of the given inventory product ids — either a
  // linked product or a recipe ingredient sourced from a product. idSet = a Set.
  menuItemsUsingProducts(idSet) {
    if (!idSet || !idSet.size) return [];
    return this.menuItems().filter(it => {
      if (it.linked_product_id && idSet.has(it.linked_product_id)) return true;
      const ings = (it.recipe && Array.isArray(it.recipe.ingredients)) ? it.recipe.ingredients : [];
      return ings.some(ing => {
        const src = ing.source || (ing.product_id ? 'product' : null);
        const id  = ing.id || ing.product_id;
        return src === 'product' && id && idSet.has(id);
      });
    });
  },
  // Every menu item currently over its cost target (drives the cockpit count).
  menuItemsOverTarget() {
    return this.menuItems().map(it => this.menuItemPct(it)).filter(m => m.over);
  },

  // ── Perpetual on-hand (the CURRENT picture, not just the latest count) ───────
  // The reorder math + inventory value read current on-hand, which is NOT the
  // single latest count: a count can cover one location and skip products, so
  // each product's on-hand is the sum across its locations of the most-recent
  // value where that product@location was actually COUNTED. An item flagged
  // `counted:false` (operator skipped it) never overwrites a prior value, so a
  // count submitted with everything not counted changes nothing. Older counts
  // predate the flag, so their items are treated as counted. { pid: {onHand,value} }.
  _perpetualInventory() {
    const counts = [...((this.inventoryData && this.inventoryData.ic_counts) || [])]
      .sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());   // newest first
    const seen = {};      // "pid@@loc" already resolved to its newest counted value
    const byProd = {};
    counts.forEach(cnt => {
      (cnt.items || []).forEach(it => {
        if (it.counted === false) return;
        const key = it.product_id + '@@' + (it.location || 'Unassigned');
        if (seen[key]) return;
        seen[key] = true;
        const rec = byProd[it.product_id] || (byProd[it.product_id] = { onHand: 0, value: 0 });
        rec.onHand += (it.total || 0);
        rec.value  += (it.value || 0);
      });
    });
    return byProd;
  },
  currentOnHand() {
    const m = this._perpetualInventory();
    const out = {};
    Object.keys(m).forEach(pid => { out[pid] = m[pid].onHand; });
    return out;
  },
  currentInventoryValue() {
    const m = this._perpetualInventory();
    return Object.keys(m).reduce((s, pid) => s + (m[pid].value || 0), 0);
  },

  // True when every Getting Started step is checked off. The Hub sidebar uses
  // this to hide the Getting Started nav item once setup is fully complete,
  // so it does not clutter the sidebar for operators who have already worked
  // through the entire setup. Help and FAQ still deep-links to the screen for
  // anyone who wants to revisit. Auto-resurfaces if a new step is ever added.
  isSetupComplete() {
    if (!this.data) return false;
    const tasks = (window.S && S.HubGettingStarted && S.HubGettingStarted.TASKS) || [];
    if (!tasks.length) return false;
    const prog = this.data.hub_setup_progress || {};
    return tasks.every(t => !!prog[t.id]);
  },

  // ── Event-log stores (row-per-record; see db.js loadEvents/putEvent) ───────
  // Maps module + kind to the in-memory array it lives in. Config stays in the
  // blob; these arrays are filled from the events table on load and written one
  // row at a time via putRecord/removeRecord.
  EVENT_STORES: {
    ic: {
      table: 'ic_events',
      data: () => App.inventoryData,
      kinds: {
        count: 'ic_counts', delivery: 'ic_deliveries', order: 'ic_orders',
        transfer: 'ic_transfers', empty: 'ic_empties', adjustment: 'ic_adjustments',
        spot_check: 'ic_spot_checks', variance_run: 'ic_variance_runs'
      }
    },
    sc: {
      table: 'sc_events',
      data: () => App.shiftData,
      kinds: {
        shift: 'sc_shifts', void_comp: 'sc_void_comps', cash_drop: 'sc_cash_drops',
        variance: 'sc_variances', safe_log: 'sc_safe_log',
        maintenance: 'sc_maintenance', walked_tab: 'sc_walked_tabs',
        waste: 'sc_waste', checklist: 'sc_checklists',
        safe_count: 'sc_safe_counts'
      }
    },
    lc: {
      table: 'lc_events',
      data: () => App.laborData,
      kinds: {
        actual: 'lc_actuals', schedule: 'lc_schedules', tip: 'lc_tips',
        tip_pool: 'lc_tip_pools', callout: 'lc_callouts', pay_period: 'lc_pay_periods',
        time_off: 'lc_time_off'
      }
    },
    // Core / Recovery (Profit pass): unbounded recovery logs live row-per-record
    // in core_events. Config (settings, products, menu, targets, getting-started,
    // fix_progress/fix_activity, vestigial shifts/vendor_log/reconciliations) stays
    // in the user_data blob. fix_log moves in its own shared pass.
    core: {
      table: 'core_events',
      data: () => App.data,
      kinds: {
        week: 'weeks', theft_score: 'theft_scores',
        variance_investigation: 'variance_investigations',
        sales_review: 'sales_reviews',
        vendor_discrepancy: 'vendor_discrepancies', audit: 'audits', cash_audit: 'cash_audits', cash_outflow: 'cash_outflows',
        // Revenue pass — revenue_rate_cards stays in the blob (reusable pricing
        // templates / config); fix_log moves in its own shared pass.
        revenue_week: 'revenue_weeks', revenue_audit: 'revenue_audits',
        revenue_server_check: 'revenue_server_checks', menu_dog_test: 'menu_dog_tests',
        revenue_price_log: 'revenue_price_log',
        // Events section — unified booking record (row-per-record). Replaces the
        // old revenue_event; rate cards / regulars / calendar stay in the blob.
        booking: 'bookings',
        // Shared Recovery Scoreboard feed — one module-tagged kind.
        fix_log: 'fix_log',
        // Hub — executive monthly audit history. operating_expenses +
        // permits_compliance stay in the blob: financial/compliance data read by
        // arbitrary period, where the 24-month window would undercount.
        bar_cop_audit: 'bar_cop_audits'
      }
    }
  },

  // Fill a module's event arrays from the rolling window, in parallel. Overwrites
  // the arrays so the blob's stale copies are ignored.
  async loadEventStores(mod) {
    const store = this.EVENT_STORES[mod];
    if (!store) return;
    const dataObj = store.data();
    if (!dataObj) return;
    const kinds = Object.keys(store.kinds);
    const results = await Promise.all(kinds.map(k => DB.loadEvents(store.table, k)));
    kinds.forEach((k, i) => { dataObj[store.kinds[k]] = results[i] || []; });
    this.resetListState(mod);
  },

  // Append an older page of one kind ("Show older"). Returns the fetched rows.
  async loadOlder(mod, kind, beforeDate, limit) {
    const store = this.EVENT_STORES[mod];
    if (!store) return [];
    const dataObj = store.data();
    const key = store && store.kinds[kind];
    if (!dataObj || !key) return [];
    const older = await DB.loadEvents(store.table, kind, { before: beforeDate, limit: limit || 200 });
    if (!Array.isArray(dataObj[key])) dataObj[key] = [];
    const seen = new Set(dataObj[key].map(r => r && r.id));
    older.forEach(r => { if (r && !seen.has(r.id)) dataObj[key].push(r); });
    return older;
  },

  // Seed a module's event rows from the current in-memory arrays (sample data).
  // Clears existing rows first so a reload replaces rather than accumulates.
  async seedEventStores(mod) {
    const store = this.EVENT_STORES[mod];
    if (!store) return;
    const dataObj = store.data();
    if (!dataObj) return;
    await DB.clearEvents(store.table);
    for (const kind of Object.keys(store.kinds)) {
      const recs = dataObj[store.kinds[kind]] || [];
      // Defensive: an event row with no id is silently dropped by putEventsBulk
      // (this is what lost the audits on reload). Assign one in place so
      // the in-memory record and the seeded row stay in sync.
      recs.forEach(r => { if (r && r.id == null) r.id = this.uid(); });
      const res = await DB.putEventsBulk(store.table, kind, recs);
      if (res && res.ok === false) console.error('seedEventStores ' + mod + '/' + kind + ' failed', res.error);
    }
  },

  // Add or update one event record: updates the in-memory array AND persists one
  // row. True if saved or safely queued offline; reverts + false on hard failure
  // (viewer / no account).
  async putRecord(mod, kind, rec) {
    const store = this.EVENT_STORES[mod];
    if (!store) return false;
    const dataObj = store.data();
    const key = store.kinds[kind];
    if (!dataObj || !key || !rec || rec.id == null) return false;
    if (!Array.isArray(dataObj[key])) dataObj[key] = [];
    const arr = dataObj[key];
    const idx = arr.findIndex(x => x && x.id === rec.id);
    const prev = idx >= 0 ? arr[idx] : null;
    if (idx >= 0) arr[idx] = rec; else arr.push(rec);
    const r = await DB.putEvent(store.table, kind, rec);
    if (r.ok || r.offline) return true;
    const back = arr.findIndex(x => x && x.id === rec.id);
    if (prev) { if (back >= 0) arr[back] = prev; }
    else if (back >= 0) arr.splice(back, 1);
    return false;
  },

  // Persist many event rows of one kind in a SINGLE request (one round-trip
  // instead of N). The caller is expected to have already updated the in-memory
  // records in place — this only writes them. Used where a batch changes at once
  // (close / reopen a pay period locks or unlocks a whole week of logged hours);
  // turns a 5-10s per-row loop into one bulk upsert.
  async putRecordsBulk(mod, kind, recs) {
    const store = this.EVENT_STORES[mod];
    if (!store) return false;
    const list = (recs || []).filter(r => r && r.id != null);
    if (!list.length) return true;
    const res = await DB.putEventsBulk(store.table, kind, list);
    return !(res && res.ok === false);
  },

  async removeRecord(mod, kind, id) {
    const store = this.EVENT_STORES[mod];
    if (!store) return false;
    const dataObj = store.data();
    const key = store.kinds[kind];
    if (!dataObj || !key) return false;
    const arr = Array.isArray(dataObj[key]) ? dataObj[key] : [];
    const idx = arr.findIndex(x => x && x.id === id);
    const removed = idx >= 0 ? arr[idx] : null;
    if (idx >= 0) arr.splice(idx, 1);
    const r = await DB.removeEvent(store.table, kind, id);
    if (r.ok || r.offline) return true;
    if (removed) arr.splice(idx, 0, removed);
    return false;
  },

  // ── History list pagination ("Show older") ────────────────────────────────
  // History screens read a rolling 24-month window into memory. They render the
  // newest LIST_PAGE rows and offer "Show older" to reveal more: first the rest
  // of the loaded window, then (once that's exhausted, with no filter active)
  // the next older page pulled from the events table on demand for a rare
  // multi-year tax / insurance lookback. State is per module+kind, reset on a
  // fresh window load (login / reseed) by loadEventStores.
  LIST_PAGE: 50,
  _listState: {},
  _listKey(mod, kind) { return mod + '.' + kind; },

  // How many rows a list should currently display.
  listLimit(mod, kind) {
    const st = this._listState[this._listKey(mod, kind)];
    return (st && st.limit) || this.LIST_PAGE;
  },

  // Drop a module's display limits + paging flags (fresh window load).
  resetListState(mod) {
    const store = this.EVENT_STORES[mod];
    if (!store) return;
    Object.keys(store.kinds).forEach(k => { delete this._listState[this._listKey(mod, k)]; });
  },

  // Oldest business date currently loaded for a kind (YYYY-MM-DD), or null.
  // Uses the same date the events index is keyed on, so paging lines up.
  oldestLoadedDate(mod, kind) {
    const store = this.EVENT_STORES[mod];
    if (!store) return null;
    const dataObj = store.data();
    const key = store.kinds[kind];
    const arr = (dataObj && Array.isArray(dataObj[key])) ? dataObj[key] : [];
    let min = null;
    arr.forEach(r => { const d = DB._eventDate(r); if (d && (min == null || d < min)) min = d; });
    return min;
  },

  // Could older-than-window records plausibly exist on the server? True only
  // when the oldest loaded record sits within ~5 weeks of the window's old edge
  // (so the window is saturated and there's likely more beyond it), or we've
  // already pulled an older page. Keeps the DB fetch off young accounts and the
  // sample data, whose full history is already in memory.
  hasServerOlder(mod, kind) {
    const st = this._listState[this._listKey(mod, kind)];
    if (st && st.exhausted) return false;
    if (st && st.paged) return true;
    const oldest = this.oldestLoadedDate(mod, kind);
    if (!oldest) return false;
    const startMs = new Date(DB._windowStartDate() + 'T00:00:00').getTime();
    const oldestMs = new Date(oldest + 'T00:00:00').getTime();
    return (oldestMs - startMs) <= 35 * 86400000;
  },

  // Footer bar HTML for a history list. `list` = the array the screen is about
  // to slice (already filtered + sorted newest-first). `hasFilter` = whether a
  // filter is narrowing the view. Returns '' when there's nothing more to show.
  // The button's mode is baked in at render time so the shared click handler
  // just executes it: 'reveal' uncaps more loaded rows, 'server' fetches the
  // next older page (offered only on an unfiltered, fully-revealed list).
  showOlderBar(mod, kind, list, hasFilter) {
    const limit = this.listLimit(mod, kind);
    const fLen = Array.isArray(list) ? list.length : 0;
    const moreLoaded = fLen > limit;
    const store = this.EVENT_STORES[mod];
    const dataObj = store && store.data();
    const all = (dataObj && Array.isArray(dataObj[store.kinds[kind]])) ? dataObj[store.kinds[kind]] : [];
    const allShown = all.length <= limit;
    const wrap = inner => '<div style="text-align:center;padding:14px 0 4px;">' + inner + '</div>';
    const btn = (mode, label) => '<button class="btn btn-ghost btn-sm" data-show-older="1" data-older-mode="'
      + mode + '" data-older-mod="' + mod + '" data-older-kind="' + kind + '">' + label + '</button>';
    if (moreLoaded) return wrap(btn('reveal', 'Show older'));
    if (!hasFilter && allShown && this.hasServerOlder(mod, kind)) {
      return wrap(btn('server', 'Load records older than 24 months')
        + '<div style="font-size:10px;color:var(--t4);margin-top:6px;">Showing the last 24 months. '
        + 'Load older records for tax or insurance lookback.</div>');
    }
    const st = this._listState[this._listKey(mod, kind)];
    if (st && st.paged && !hasFilter) {
      return '<div style="text-align:center;padding:12px 0;color:var(--t4);font-size:11px;">All records loaded.</div>';
    }
    return '';
  },

  // Shared click handler for every history list's "Show older" button. Pass the
  // click target and the screen's list re-render. Fire-and-forget from a sync
  // onclick: check ev.target.closest('[data-show-older]') first, then call this.
  async handleShowOlder(target, reRender) {
    const btn = target && target.closest && target.closest('[data-show-older]');
    if (!btn) return false;
    const mod = btn.dataset.olderMod, kind = btn.dataset.olderKind, mode = btn.dataset.olderMode;
    const key = this._listKey(mod, kind);
    const st = this._listState[key] || {};
    if (mode === 'server') {
      const before = this.oldestLoadedDate(mod, kind);
      btn.disabled = true; btn.textContent = 'Loading...';
      const PAGE = 200;
      const older = before ? await this.loadOlder(mod, kind, before, PAGE) : [];
      st.paged = true;
      if (!older || older.length < PAGE) st.exhausted = true;
    }
    st.limit = (st.limit || this.LIST_PAGE) + this.LIST_PAGE;
    this._listState[key] = st;
    reRender && reRender();
    return true;
  },

  // Config-only slice of a module's data blob: everything that is NOT one of
  // its event arrays (those persist row-per-record in <mod>_events now). Used
  // so a config save never rewrites the unbounded event logs into the blob.
  _configBlob(mod, dataObj) {
    const store = this.EVENT_STORES[mod];
    const eventKeys = store ? new Set(Object.values(store.kinds)) : new Set();
    const out = {};
    Object.keys(dataObj || {}).forEach(k => { if (!eventKeys.has(k)) out[k] = dataObj[k]; });
    return out;
  },
  _inventoryConfig() { return this._configBlob('ic', this.inventoryData); },

  async saveInventory() {
    const r = await DB.writeInventoryData(this._inventoryConfig());
    if (!r.ok) console.error('saveInventory failed:', r.error);
    return r.ok;
  },

  async saveLabor() {
    const r = await DB.writeLaborData(this._configBlob('lc', this.laborData));
    if (!r.ok) console.error('saveLabor failed:', r.error);
    return r.ok;
  },

  async saveShift() {
    const r = await DB.writeShiftData(this._configBlob('sc', this.shiftData));
    if (!r.ok) console.error('saveShift failed:', r.error);
    return r.ok;
  },

  navigate(id) {
    // Role-based block: staff can't navigate to disallowed screens.
    // Bounce them to the Staff Hub so they can pick something they CAN do.
    if (!this.canAccess(id)) {
      const role = (window.DB && DB.role && DB.role()) || null;
      if (role === 'staff') { this.showStaffHub(); return; }
      const land = this.staffLanding();
      if (this._activeModule !== land.module) {
        this.showApp(land.module);
        return;
      }
      id = land.screen;
    }
    // Settings and Getting Started are Hub-owned views, never module screens —
    // open them in the Hub container regardless of where the call came from.
    if (id === 'settings') { S.HubSettings.open(); return; }
    if (id === 'getting-started') {
      S.HubGettingStarted.open();
      return;
    }
    // Landing on a screen is the base of its in-screen view history (floating back).
    this._currentScreenId = id;
    this._viewStack = [];
    this._viewCur = () => this.navigate(id);
    this._updateFloatNav();
    try {
    this._activeScreenObj = null;   // set per module block below; drives the nav "i" page-help button
    this.updateNav(id);
    // Hide the old topbar title bar on pages converted to the un-box language
    // (they carry their own page header); un-converted pages keep it.
    document.getElementById('app')?.classList.toggle('topbar-hidden', this._CONVERTED.has(id));
    const content = document.getElementById('content-area');
    const actions = document.getElementById('topbar-actions');
    actions.innerHTML = '';

    // The content host is reused across every module screen. Some screens wire
    // delegated handlers via content.onclick/onchange; others (e.g. the Variance
    // report) wire tabs with addEventListener and never reset the property. Clear
    // them on every navigation so a prior screen's handler can't bubble on the
    // next screen's clicks and render the wrong screen. Each screen re-establishes
    // whatever delegation it needs inside its own render.
    if (content) { content.onclick = null; content.onchange = null; content.oninput = null; }

    // Land at the top of a freshly navigated screen — the .content scroller
    // persists across screens, so without this a return visit inherits the
    // previous screen's scroll position (often well down the page).
    const _scroller = (content && content.closest('.content')) || document.querySelector('.content');
    if (_scroller) _scroller.scrollTop = 0;
    if (content) content.scrollTop = 0;
    if (typeof window !== 'undefined' && window.scrollTo) window.scrollTo(0, 0);

    // Events module screens
    if (this._activeModule === 'events') {
      const evTitles = {
        'hub':          ['Recovery Hub', ''],
        'ev-dashboard': ['Dashboard', 'Events'],
        'ev-bookings':  ['Bookings', 'Events'],
        'ev-calendar':  ['Calendar', 'Events'],
        'ev-regulars':  ['Regulars', 'Events'],
        'ev-pricing':   ['Pricing', 'Events'],
        'ev-help':      ['Help and FAQ', 'Events'],
      };
      const evScreens = {
        'ev-dashboard': S.EventsDashboard,
        'ev-bookings':  S.EventsBookings,
        'ev-calendar':  S.EventsCalendar,
        'ev-regulars':  S.EventsRegulars,
        'ev-pricing':   S.EventsPricing,
        'ev-help':      S.EventsHelp,
      };
      const [title, sub] = evTitles[id] || [id, ''];
      document.getElementById('topbar-title').textContent = title;
      document.getElementById('topbar-sub').textContent = sub;
      const screen = evScreens[id];
      if (screen) { this._activeScreenObj = screen; screen.render(content, actions); this._exportBtn(id, actions); }
      else content.innerHTML = '<div class="screen"><p style="color:var(--t3);">Coming soon.</p></div>';
      return;
    }

    // Revenue module screens
    if (this._activeModule === 'revenue') {
      const revTitles = {
        'hub':                    ['Recovery Hub', ''],
        'r-audit':            ['Revenue Audit', 'Monthly Score and Progress'],
        'r-playbook':         ['Revenue Playbook', 'The Strategy Behind the Fix'],
        'r-fix':                  ['Revenue Fix', 'Fix Process and Guidance'],
        'r-dashboard':            ['Dashboard', 'Revenue Recovery'],
        'r-forecast':             ['Revenue Forecast', 'Plan Next Week'],
        'r-this-week':            ['This Week', 'Weekly Entry'],
        'r-server-check':         ['Server Check', ''],
        'r-menu-items':           ['Menu Items', ''],
        'r-menu-engineering':     ['Menu Engineering', ''],
        'r-price-calc':           ['Price Calculator', ''],
        'r-dog-test':             ['Dog Test Tracker', ''],
        'r-help':                 ['Help and FAQ', ''],
      };
      const revScreens = {
        'r-audit':            S.RevenueAudit,
        'r-playbook':         S.RecoveryPlaybook,
        'r-fix':              S.RevenueFix,
        'r-dashboard':        S.RevenueDashboard,
        'r-forecast':         S.RevenueForecast,
        'r-this-week':        S.RevenueThisWeek,
        'r-server-check':     S.RevenueServerCheck,
        'r-menu-items':       S.RevenueMenuItems,
        'r-menu-engineering': S.RevenueMenuEngineering,
        'r-price-calc':       S.RevenuePriceCalc,
        'r-dog-test':         S.RevenueDogTest,
        'r-help':             S.RevenueHelp,
      };
      const [title, sub] = revTitles[id] || [id, ''];
      document.getElementById('topbar-title').textContent = title;
      document.getElementById('topbar-sub').textContent = sub;
      const screen = revScreens[id];
      if (screen) { this._activeScreenObj = screen; screen.render(content, actions); this._exportBtn(id, actions); }
      else content.innerHTML = '<div class="screen"><p style="color:var(--t3);">Coming soon.</p></div>';
      return;
    }


    // Cash Recovery module screens
    if (this._activeModule === 'cash') {
      const cashTitles = {
        'hub':           ['Recovery Hub', ''],
        'c-dashboard':   ['Close The Week', 'Cash Recovery'],
        'c-audit':       ['Cash Audit', 'Weekly Score and Progress'],
        'c-playbook':    ['Cash Playbook', 'The Strategy Behind the Fix'],
        'c-fix':         ['Cash Fix', 'Fix Process and Guidance'],
        'c-trapped':     ['Trapped Cash', 'Cash Recovery'],
        'c-purchasing':  ['Purchasing', 'Cash Recovery'],
        'c-capital':     ['Capital Efficiency', 'Cash Recovery'],
        'c-forecast':    ['Cash Forecast', 'Cash Recovery'],
        'c-position':    ['Cash Position', 'Cash Recovery'],
        'c-bridge':      ['Cash Bridge', 'Cash Recovery'],
        'c-help':        ['Help and FAQ', ''],
      };
      const cashScreens = {
        'c-dashboard':   S.CashDashboard,
        'c-audit':       S.CashAudit,
        'c-playbook':    S.RecoveryPlaybook,
        'c-fix':         S.CashFix,
        'c-trapped':     S.CashTrapped,
        'c-purchasing':  S.CashPurchasing,
        'c-capital':     S.CashCapital,
        'c-forecast':    S.CashForecast,
        'c-position':    S.CashPosition,
        'c-bridge':      S.CashBridge,
        'c-help':        S.CashHelp,
      };
      const [title, sub] = cashTitles[id] || [id, ''];
      document.getElementById('topbar-title').textContent = title;
      document.getElementById('topbar-sub').textContent = sub;
      const screen = cashScreens[id];
      if (screen) { this._activeScreenObj = screen; screen.render(content, actions); this._exportBtn(id, actions); }
      else content.innerHTML = '<div class="screen"><p style="color:var(--t3);">Coming soon.</p></div>';
      return;
    }

    // Inventory Control module screens
    if (this._activeModule === 'inventory') {
      const icTitles = {
        'hub':                 ['Recovery Hub', ''],
        'ic-dashboard':        ['Close The Week', 'Inventory Control'],
        'ic-product-setup':    ['Add Products', 'Inventory Control'],
        'ic-prep-batches':     ['Prep Batches', 'Inventory Control'],
        'ic-locations':        ['Set Locations', 'Inventory Control'],
        'ic-vendors':          ['List Vendors', 'Inventory Control'],
        'ic-take-inventory':   ['Take Inventory', 'Inventory Control'],
        'ic-count-history':    ['Count History', 'Inventory Control'],
        'ic-spot-check':       ['Spot Check', 'Inventory Control'],
        'ic-transfers':        ['Transfer Log', 'Inventory Control'],
        'ic-empties':          ['Empties Log', 'Inventory Control'],
        'ic-adjustments':      ['Adjustment Log', 'Inventory Control'],
        'ic-par-suggestions':  ['Dynamic Pars', 'Inventory Control'],
        'ic-receive-delivery': ['Receive Delivery', 'Inventory Control'],
        'ic-delivery-history': ['Delivery History', 'Inventory Control'],
        'ic-order-sheet':      ['Order Sheet', 'Inventory Control'],
        'ic-order-history':    ['Order History', 'Inventory Control'],
        'ic-report-usage':     ['Usage Report', 'Inventory Control'],
        'ic-report-variance':  ['Variance Report', 'Inventory Control'],
        'ic-report-stock':     ['Stock Report', 'Inventory Control'],
        'ic-report-movers':    ['Movement Report', 'Inventory Control'],
        'ic-help':             ['Help and FAQ', 'Inventory Control'],
      };
      const icScreens = {
        'ic-dashboard':      S.InventoryDashboard,
        'ic-product-setup':  S.InventoryProducts,
        'ic-prep-batches':   S.PrepBatches,
        'ic-locations':      S.InventoryLocations,
        'ic-vendors':        S.InventoryVendors,
        'ic-take-inventory': S.InventoryTakeInventory,
        'ic-count-history':  S.InventoryCountHistory,
        'ic-spot-check':     S.InventorySpotCheck,
        'ic-transfers':      S.InventoryTransfers,
        'ic-empties':        S.InventoryEmpties,
        'ic-adjustments':    S.InventoryAdjustments,
        'ic-par-suggestions': S.InventoryParSuggestions,
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
      if (icScreen) { this._activeScreenObj = icScreen; icScreen.render(content, actions); this._exportBtn(id, actions); }
      else content.innerHTML = '<div class="screen"><p style="color:var(--t3);">Coming soon.</p></div>';
      return;
    }

    // Shift Control module screens
    if (this._activeModule === 'shift') {
      const scTitles = {
        'hub':                   ['Recovery Hub', ''],
        'sc-dashboard':          ['Close The Week', 'Shift Control'],
        'sc-cash-control':       ['Cash Control', 'Shift Control'],
        'sc-cash-history':       ['Cash History', 'Shift Control'],
        'sc-void-comp':          ['Void and Comp Log', 'Shift Control'],
        'sc-waste':              ['Waste / Spill Log', 'Shift Control'],
        'sc-maintenance':        ['Maintenance Log', 'Shift Control'],
        'sc-walked-tabs':        ['Walked Tabs', 'Shift Control'],
        'sc-checklists':         ['Checklists', 'Shift Control'],        'sc-checklist-templates':['Checklist Templates', 'Shift Control'],
        'sc-drawers':            ['Drawers / Registers', 'Shift Control'],
        'sc-help':               ['Help and FAQ', 'Shift Control'],
      };
      const scScreens = {
        'sc-dashboard': S.ShiftDashboard,
        'sc-cash-control': S.ShiftCashControl,
        'sc-cash-history': S.ShiftCashHistory,
        'sc-void-comp': S.ShiftVoidComp,
        'sc-waste': S.ShiftWaste,
        'sc-maintenance': S.ShiftMaintenance,
        'sc-walked-tabs': S.ShiftWalkedTabs,
        'sc-checklists': S.ShiftChecklists,        'sc-checklist-templates': S.ShiftChecklistTemplates,
        'sc-drawers': S.ShiftDrawers,
        'sc-help': S.ShiftHelp,
      };
      const [scTitle, scSub] = scTitles[id] || [id, ''];
      document.getElementById('topbar-title').textContent = scTitle;
      document.getElementById('topbar-sub').textContent = scSub;
      const scScreen = scScreens[id];
      if (scScreen) { this._activeScreenObj = scScreen; scScreen.render(content, actions); this._exportBtn(id, actions); }
      else content.innerHTML = '<div class="screen"><p style="color:var(--t3);">Coming soon.</p></div>';
      return;
    }

    // Labor Control module screens
    if (this._activeModule === 'labor') {
      const lcTitles = {
        'hub':                   ['Recovery Hub', ''],
        'lc-dashboard':          ['Close The Week', 'Labor Control'],
        'lc-build-schedule':     ['Build Schedule', 'Labor Control'],        'lc-schedule-history':   ['Schedule History', 'Labor Control'],
        'lc-log-hours':          ['Log Hours', 'Labor Control'],
        'lc-pay-periods':        ['Pay Periods', 'Labor Control'],
        'lc-payroll-export':     ['Payroll Export', 'Labor Control'],
        'lc-positions':          ['Add Positions', 'Labor Control'],
        'lc-staff-roster':       ['Staff Roster', 'Labor Control'],
        'lc-wage-settings':      ['Wage Policy', 'Labor Control'],
        'lc-tip-log':            ['Tip Tracking', 'Labor Control'],
        'lc-tip-history':        ['Tip History', 'Labor Control'],
        'lc-reports':            ['Labor History', 'Labor Control'],
        'lc-overtime-watch':     ['Overtime Watch', 'Labor Control'],
        'lc-callout-log':        ['Call-Out Log', 'Labor Control'],
        'lc-time-off':           ['Time Off Log', 'Labor Control'],
        'lc-help':               ['Help and FAQ', 'Labor Control'],
      };
      const lcScreens = {
        'lc-dashboard': S.LaborDashboard,
        'lc-positions': S.LaborPositions,
        'lc-staff-roster': S.LaborStaffRoster,
        'lc-wage-settings': S.LaborWageSettings,
        'lc-build-schedule': S.LaborBuildSchedule,
        'lc-schedule-history': S.LaborScheduleHistory,        'lc-log-hours': S.LaborLogHours,
        'lc-pay-periods':    S.LaborPayPeriods,
        'lc-payroll-export': S.LaborPayrollExport,
        'lc-tip-log': S.LaborTipLog,
        'lc-tip-history': S.LaborTipHistory,
        'lc-overtime-watch': S.LaborOvertimeWatch,
        'lc-callout-log': S.LaborCalloutLog,
        'lc-time-off': S.LaborTimeOff,
        'lc-reports': S.LaborReports,
        'lc-help': S.LaborHelp,
      };
      const [lcTitle, lcSub] = lcTitles[id] || [id, ''];
      document.getElementById('topbar-title').textContent = lcTitle;
      document.getElementById('topbar-sub').textContent = lcSub;
      const lcScreen = lcScreens[id];
      if (lcScreen) { this._activeScreenObj = lcScreen; lcScreen.render(content, actions); this._exportBtn(id, actions); }
      else content.innerHTML = '<div class="screen"><p style="color:var(--t3);">Coming soon.</p></div>';
      return;
    }

    const titles = {
      'hub':           ['Recovery Hub', ''],
      'dashboard':     ['Dashboard', 'Profit Recovery'],
      'this-week':     ['This Week', 'Weekly Entry'],
      'profit-forecast':['Profit Forecast', ''],
      'recipe-cost-analysis':['Recipe Summary', ''],
      'vendor-tracker': ['Vendor Tracker', ''],
      'vendor-watch':  ['Vendor Tracker', ''],
      'vendor-scorecard': ['Vendor Tracker', ''],
      'vendor-discrepancy': ['Vendor Tracker', ''],
      'theft-risk':    ['Loss Prevention', ''],
      'sales-integrity': ['Sales Integrity', 'Shift Sales Review'],
      'cash-recon':    ['Over and Short', ''],
      'help':          ['Help and FAQ', ''],
      'audit-tracker': ['Profit Audit', 'Monthly Score & Progress'],
      'recovery-playbook': ['Profit Playbook', 'The Strategy Behind the Fix'],
      'profit-fix':    ['Profit Fix', 'Fix Process and Guidance']
    };

    const screens = {
      'hub':           S.Hub,
      'dashboard':     S.Dashboard,
      'this-week':     S.ThisWeek,
      'profit-forecast':S.ProfitForecast,
      'recipe-cost-analysis':S.RecipeCostAnalysis,
      'vendor-tracker': S.VendorTracker,
      'vendor-watch':  S.VendorTracker,
      'vendor-scorecard': S.VendorTracker,
      'vendor-discrepancy': S.VendorTracker,
      'theft-risk':    S.TheftRisk,
      'sales-integrity': S.SalesIntegrity,
      'cash-recon':    S.CashRecon,
      'help':          S.Help,
      'audit-tracker': S.AuditTracker,
      'recovery-playbook': S.RecoveryPlaybook,
      'profit-fix':    S.ProfitFix
    };

    const [title, sub] = titles[id] || [id, ''];
    document.getElementById('topbar-title').textContent = title;
    document.getElementById('topbar-sub').textContent = sub;

    // The three legacy vendor ids deep-link straight into the merged Vendor
    // Tracker on the matching tab; the nav uses 'vendor-tracker' (lands Scorecard).
    if (S.VendorTracker) {
      if (id === 'vendor-watch') S.VendorTracker.tab = 'watch';
      else if (id === 'vendor-discrepancy') S.VendorTracker.tab = 'discrepancies';
      else if (id === 'vendor-scorecard' || id === 'vendor-tracker') S.VendorTracker.tab = 'scorecard';
    }

    const screen = screens[id];
    if (screen) { this._activeScreenObj = screen; screen.render(content, actions); }
    else content.innerHTML = '<div class="screen"><p style="color:var(--t3);">Coming soon.</p></div>';
    } finally {
      this._afterNavigate(id);
    }
  },

  /* Report screens carry an Export PDF button (Rule 10). _exportBtn wires it to
     App.exportPDF, which generates a clean PDF of the on-screen report via jsPDF
     and opens a Save dialog. The set is every screen in a module's REPORTS
     section plus the three Recovery Reports and History screens. */
  _REPORT_SCREENS: {
    // Every report/history screen now carries its own in-content Export PDF
    // button, so none take the auto topbar export (no duplicate buttons).
  },
  _exportBtn(id, actions) {
    if (!this._REPORT_SCREENS[id] || !actions) return;
    if (actions.querySelector('.export-pdf-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'btn btn-ghost btn-sm export-pdf-btn';
    btn.textContent = 'Export PDF';
    btn.addEventListener('click', () => {
      const title = (document.getElementById('topbar-title')?.textContent || 'Report').trim();
      App.exportPDF({ title, root: document.getElementById('content-area') });
    });
    actions.appendChild(btn);
  },

  updateNav(id) {
    document.querySelectorAll('.nav-item, .sidebar-btn').forEach(el => el.classList.remove('active'));
    const el = document.getElementById('nav-' + id);
    if (el) el.classList.add('active');
    this.wireNavAccordion(document.getElementById('sidebar-nav'));
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
    // Currency always shows to the exact cent (accurate + honest). A caller can
    // still force whole dollars with fmtCurrency(n, 0) for projections/estimates
    // where cents would imply false precision.
    const d = decimals !== undefined ? decimals : 2;
    let v = Number(n);
    if (Number(v.toFixed(d)) === 0) v = 0;   // normalize -0 / tiny negatives so it never prints "$-0.00"
    return '$' + v.toLocaleString('en-US', {minimumFractionDigits:d, maximumFractionDigits:d});
  },

  // Phase 7: explode a menu item into per-product ounces consumed.
  // For 1 unit of the menu item sold, returns { product_id: oz } showing
  // exactly how much of each tracked inventory product was drawn down.
  //
  // Handles three menu item shapes:
  //   - Linked direct-pour (Beer/Wine/NA): uses menu_item.pour_size_oz if set,
  //     else the linked product's pour_size_oz, else container_size_oz (whole
  //     bottle). Returns { linked_id: oz }.
  //   - Recipe with product ingredients: for single-drink recipes, quantity is
  //     in pours so oz = qty × pour_size_oz. For food recipes, quantity is in
  //     product units (bottles, units) — oz = qty × container_size_oz for
  //     bar items, qty (as-is) for kitchen items measured in their own unit.
  //   - Recipe with prep batch ingredients: recursively explode the batch.
  //     batch contributes (qty / servings_per_batch) × each batch ingredient.
  //
  // Total result is then multiplied by sold_qty in the caller.
  explodeMenuItem(item, soldQty) {
    const result = {};
    if (!item) return result;
    soldQty = parseFloat(soldQty) || 0;
    if (soldQty <= 0) return result;
    const prods = (this.inventoryData?.ic_products) || [];
    const batches = (this.inventoryData?.ic_prep_batches) || [];
    const prodById  = (id) => prods.find(p => p.id === id);
    const batchById = (id) => batches.find(b => b.id === id);

    // Direct-pour linked item — one menu item sale draws one pour from the linked product
    if (item.linked_product_id) {
      const p = prodById(item.linked_product_id);
      if (p) {
        const oz = parseFloat(item.pour_size_oz) || parseFloat(p.pour_size_oz) || parseFloat(p.container_size_oz) || 0;
        if (oz > 0) result[p.id] = (result[p.id] || 0) + (oz * soldQty);
      }
      return result;
    }

    // Recipe with ingredients
    if (item.recipe && Array.isArray(item.recipe.ingredients)) {
      const isSingleDrink = item.recipe.mode === 'single';
      const plateYield = (item.recipe.mode === 'food' && item.recipe.plate_yield > 0) ? item.recipe.plate_yield : 1;
      const perUnit = soldQty / plateYield; // for food, plate_yield converts recipe into per-plate

      item.recipe.ingredients.forEach(ing => {
        const src = ing.source || (ing.product_id ? 'product' : null);
        const id  = ing.id || ing.product_id;
        const qty = parseFloat(ing.quantity) || 0;
        if (!src || !id || qty <= 0) return;

        if (src === 'batch') {
          const b = batchById(id);
          if (!b || !Array.isArray(b.ingredients)) return;
          // qty here is in "servings" — the batch yields servings_per_batch servings total.
          const spb = parseFloat(b.servings_per_batch) || 1;
          // Per batch serving, each batch ingredient contributes its quantity / spb.
          b.ingredients.forEach(bi => {
            const bp = prodById(bi.product_id || bi.id);
            if (!bp) return;
            const biQty = parseFloat(bi.quantity) || 0;
            if (biQty <= 0) return;
            // Batch ingredients are typically in product units (bottles/units).
            // Convert to oz when the underlying product has container_size_oz.
            const sizeOz = parseFloat(bp.container_size_oz) || 0;
            const unitsPerBatchServing = biQty / spb;
            const ozPerBatchServing = sizeOz > 0 ? unitsPerBatchServing * sizeOz : unitsPerBatchServing;
            result[bp.id] = (result[bp.id] || 0) + (ozPerBatchServing * qty * perUnit);
          });
          return;
        }

        // source === 'product'
        const p = prodById(id);
        if (!p) return;
        const isBar = ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer'].includes(p.category);
        let oz = 0;
        if (isBar && isSingleDrink) {
          // qty is in "pours" — multiply by pour_size_oz
          oz = qty * (parseFloat(p.pour_size_oz) || 0);
        } else if (isBar) {
          // Food / non-single use of bar product — qty is in bottles
          oz = qty * (parseFloat(p.container_size_oz) || 0);
        } else {
          // Kitchen + Misc mixers — quantity is already in the product's native
          // purchase unit (lb / each / dozen / qt of mixer), the same convention
          // menuItemCost uses with unit_cost, so the count (also native units)
          // and the recipe draw compare apples to apples. Previously a Misc
          // mixer in a cocktail was multiplied by a token pour_size_oz, charging
          // ~0 oz and producing a false ~99% variance.
          oz = qty;
        }
        result[p.id] = (result[p.id] || 0) + (oz * perUnit);
      });
    }

    return result;
  },

  // Phase 5: resolve the wage in effect for a staff member on a given date.
  // Walks wage_history newest-first: any entry with effective_date <= the
  // queried date means the new_wage applied from then onward. Falls back to
  // the staff member's current wage when no history is on file or every
  // entry's effective_date is after the queried date (meaning the wage was
  // the prior wage from the oldest entry — or the current wage if no history).
  wageForStaffOn(staffId, dateStr) {
    const staff = (this.laborData?.lc_staff || []).find(s => s.id === staffId);
    if (!staff) return 0;
    if (!dateStr) return staff.wage || 0;
    const history = Array.isArray(staff.wage_history) ? staff.wage_history.slice() : [];
    if (!history.length) return staff.wage || 0;
    // Sort newest effective_date first
    history.sort((a, b) => (b.effective_date || '').localeCompare(a.effective_date || ''));
    // Find the most recent change that took effect on or before the queried date
    const applies = history.find(h => (h.effective_date || '') <= dateStr);
    if (applies) return applies.new_wage != null ? applies.new_wage : (staff.wage || 0);
    // The queried date is BEFORE all changes — the prior_wage on the oldest
    // entry is what the staff member earned at that time.
    const oldest = history[history.length - 1];
    return oldest && oldest.prior_wage != null ? oldest.prior_wage : (staff.wage || 0);
  },

  // The ONE labor-cost target (% of revenue), read everywhere that needs a labor
  // target: Build Schedule's budget + all of Revenue Recovery. Single source of
  // truth = settings.targets.labor_cost_pct. Falls back to the old pre-2026-06-10
  // per-department fields (Profit bar/food, then Revenue bar/kitchen/floor) so
  // accounts seeded before the consolidation keep their effective number until
  // they next save a target. Default 30 (full-service norm).
  laborTargetPct() {
    const t = (this.data && this.data.settings && this.data.settings.targets) || {};
    if (t.labor_cost_pct != null && t.labor_cost_pct !== '') return Number(t.labor_cost_pct);
    if (t.bar_labor_cost_pct != null && t.food_labor_cost_pct != null)
      return (Number(t.bar_labor_cost_pct) + Number(t.food_labor_cost_pct)) / 2;
    const rt = (this.data && this.data.revenue_settings && this.data.revenue_settings.targets) || {};
    if (rt.bar_labor_pct != null && rt.kitchen_labor_pct != null && rt.floor_labor_pct != null)
      return (Number(rt.bar_labor_pct) + Number(rt.kitchen_labor_pct) + Number(rt.floor_labor_pct)) / 3;
    return 30;
  },

  // ── Salaried staff ──────────────────────────────────────────────────────
  // A salaried (exempt) staff member's labor cost is FIXED per period
  // (annual_salary / 52 per week), not hours * wage. Their per-day lc_actuals
  // rows still carry hours for coverage and RPLH, but those hours have no
  // hourly wage, so each row's cost is 0 and the fixed salary is added at the
  // weekly/period rollups via salariedCost(). Salaried = exempt: no overtime
  // (a salaried NON-exempt employee should be entered as Hourly so OT computes).
  isSalaried(staffOrId) {
    const s = (staffOrId && typeof staffOrId === 'object')
      ? staffOrId
      : (this.laborData?.lc_staff || []).find(x => x.id === staffOrId);
    return !!(s && s.pay_type === 'Salary');
  },
  // Is a staff member off on a date? Returns a reason string (the time-off type,
  // or "Regular day off") or null. Reads approved one-off Time Off (lc_time_off)
  // and the per-staff recurring days off (roster off_days = short weekday names).
  // Build Schedule uses this to warn before someone is scheduled on a day off.
  staffOffOn(staffId, dateStr) {
    if (!staffId || !dateStr) return null;
    const ds = String(dateStr).slice(0, 10);
    const to = ((this.laborData && this.laborData.lc_time_off) || []).find(t =>
      t && t.staff_id === staffId && t.status === 'Approved'
      && t.start_date && t.end_date && ds >= t.start_date && ds <= t.end_date);
    if (to) return to.type || 'Time off';
    const st = ((this.laborData && this.laborData.lc_staff) || []).find(s => s.id === staffId);
    if (st && Array.isArray(st.off_days) && st.off_days.length) {
      const d = new Date(ds + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
        if (st.off_days.indexOf(wd) >= 0) return 'Regular day off';
      }
    }
    return null;
  },
  // Fixed salaried labor cost accrued over [startDate, endDate] inclusive. Salary
  // accrues evenly every day; a full 7-day week equals annual_salary / 52. Only
  // Active salaried staff with a positive salary count. Returns { total, bar,
  // food } split by the staff member's position department (Profit's split:
  // department 'Bar' is bar, everything else is food), so This Week's bar/food
  // labor stays correct.
  salariedCost(startDate, endDate) {
    const out = { total: 0, bar: 0, food: 0 };
    if (!startDate || !endDate) return out;
    const sd = new Date(startDate + 'T00:00:00'), ed = new Date(endDate + 'T00:00:00');
    if (isNaN(sd.getTime()) || isNaN(ed.getTime())) return out;
    const days = Math.floor((ed.getTime() - sd.getTime()) / 86400000) + 1;
    if (days <= 0) return out;
    const weeks = days / 7;
    const posDept = {};
    ((this.laborData?.lc_positions) || []).forEach(p => { posDept[p.id] = p.department; });
    ((this.laborData?.lc_staff) || []).forEach(s => {
      if (!this.isSalaried(s) || s.status === 'Inactive') return;
      const annual = parseFloat(s.annual_salary);
      if (!annual || annual <= 0) return;
      const cost = (annual / 52) * weeks;
      out.total += cost;
      if (posDept[s.position_id] === 'Bar') out.bar += cost;
      else out.food += cost;
    });
    return out;
  },
  // Weekly salary cost for ONE staff member (annual_salary / 52), or 0 when the
  // staff member is not salaried or has no salary on file. Used by per-staff
  // and per-day rollups (Daily View, Weekly Summary, Pay Periods).
  staffWeeklySalary(staffOrId) {
    const s = (staffOrId && typeof staffOrId === 'object')
      ? staffOrId
      : (this.laborData?.lc_staff || []).find(x => x.id === staffOrId);
    if (!this.isSalaried(s) || (s && s.status === 'Inactive')) return 0;
    const annual = parseFloat(s && s.annual_salary);
    return annual && annual > 0 ? annual / 52 : 0;
  },

  // Canonical lc_actuals hours edit — one owner of the hours->wage->cost math so
  // Daily View and Weekly Summary can never drift from each other on a payroll
  // number. Honors a per-record wage override, else the staff member's effective
  // wage on the shift date; recomputes cost, stamps updated_at, persists one row.
  // No-op on a locked (closed pay-period) record.
  async updateActual(rec, fields) {
    fields = fields || {};
    if (!rec || rec.locked) return false;
    if (fields.hours != null && !isNaN(fields.hours) && fields.hours >= 0) {
      rec.hours = fields.hours;
      const wage = rec.wage != null ? rec.wage
        : (this.wageForStaffOn ? this.wageForStaffOn(rec.staff_id, rec.date) : 0);
      rec.cost = rec.hours * wage;
    }
    if (fields.notes != null) rec.notes = String(fields.notes).trim();
    rec.updated_at = new Date().toISOString();
    return await this.putRecord('lc', 'actual', rec);
  },

  // Logged hours for a staff member on a date, read from lc_actuals. Tip Log
  // and Tip Pool both auto-fill hours from here, so the lookup lives once.
  hoursFor(staffId, date) {
    if (!staffId || !date) return null;
    const a = ((this.laborData && this.laborData.lc_actuals) || []).find(x => x.staff_id === staffId && x.date === date);
    return a ? (a.hours || null) : null;
  },

  // Currently-open shift, if any. The 3rd+ consumer of this pattern, so it
  // lives in App so dropdowns can auto-fill manager / reported-by / counted-by
  // from one source of truth. Returns the most recently-started Open shift,
  // or null.
  activeShift() {
    const list = (this.shiftData && this.shiftData.sc_shifts) || [];
    const open = list.filter(s => s.status === 'Open');
    if (!open.length) return null;
    return open.slice().sort((a, b) =>
      new Date(b.created_at || b.date || 0).getTime() - new Date(a.created_at || a.date || 0).getTime()
    )[0];
  },
  activeManagerId() {
    const s = this.activeShift();
    return s ? (s.manager_id || '') : '';
  },

  // Day-of-week labels used by Revenue Forecast and the schedule builder.
  // Monday-first because most independent operators set their week that way.
  DAYS_MON_FIRST: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],

  // Local calendar date as 'YYYY-MM-DD'. ALWAYS use this for a date stamp,
  // never toISOString().slice(0,10) — that returns the UTC date, which rolls
  // to tomorrow on any evening west of UTC (Austin is UTC-5/6), so a shift
  // opened Thursday night would stamp Friday. Pass a Date, or omit for now.
  ymdLocal(d) {
    d = d || new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  },

  // Today's local date as 'YYYY-MM-DD'. The single source for every "today"
  // stamp in Bar Cop.
  todayLocal() { return this.ymdLocal(new Date()); },

  // Resolve the Monday of the week containing a given date string. Forecast
  // records are keyed by week_start (Monday) so every screen converts a
  // period_end (Sunday) or any in-week date to the canonical Monday key.
  weekStartFor(dateStr) {
    if (!dateStr) return '';
    const d = new Date(String(dateStr).length <= 10 ? dateStr + 'T00:00:00' : dateStr);
    if (isNaN(d.getTime())) return '';
    const wd = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - wd);
    return this.ymdLocal(d);
  },

  // Convert a Monday week_start to the Sunday period_end of the same week.
  periodEndFor(weekStart) {
    if (!weekStart) return '';
    const d = new Date(weekStart + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + 6);
    return this.ymdLocal(d);
  },

  // "Jun 8 - Jun 14" for a date range (single date when start is missing or equal
  // to end). The one source for every week-range chip label so the format stays
  // identical across This Week, Build Schedule, Log Hours, Overtime, and Reports.
  dateRangeLabel(start, end) {
    const f = ymd => { const d = new Date((ymd || '') + 'T00:00:00'); return isNaN(d.getTime()) ? (ymd || '') : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
    return (start && end && start !== end) ? f(start) + ' - ' + f(end) : f(end || start);
  },

  // Return the saved revenue_forecasts record for a given week_start (Monday),
  // or null. Accepts either a week_start or any in-week date.
  forecastForWeek(dateStr) {
    const ws = this.weekStartFor(dateStr);
    if (!ws) return null;
    const list = (this.data && Array.isArray(this.data.revenue_forecasts)) ? this.data.revenue_forecasts : [];
    return list.find(f => f.week_start === ws) || null;
  },

  // Auto-defaults for a coming week's forecast. Looks at the same weekday in
  // the last 8 weeks worth of shift revenue (sc_shifts), weighted toward the
  // newer weeks (linear 1..8). Returns per-day numbers plus the total. Used
  // when the operator opens the forecast screen for a week with no record yet.
  forecastDefaultsFor(weekStart) {
    const ws = this.weekStartFor(weekStart);
    if (!ws) return { per_day: {}, total: 0 };
    const shifts = (this.shiftData && this.shiftData.sc_shifts) || [];
    // Group revenue by date, summing bar + floor
    const revByDate = {};
    shifts.forEach(s => {
      if (!s.date) return;
      const r = (parseFloat(s.bar_revenue) || 0) + (parseFloat(s.floor_revenue) || 0);
      if (r <= 0) return;
      revByDate[s.date] = (revByDate[s.date] || 0) + r;
    });

    const start = new Date(ws + 'T00:00:00');
    const perDay = {};
    let total = 0;
    this.DAYS_MON_FIRST.forEach((day, idx) => {
      const target = new Date(start.getTime());
      target.setDate(target.getDate() + idx);
      const samples = [];
      // Look back up to 8 same-weekday occurrences before this week's day
      for (let back = 1; back <= 8; back++) {
        const probe = new Date(target.getTime());
        probe.setDate(probe.getDate() - back * 7);
        const key = this.ymdLocal(probe);
        if (revByDate[key] != null) samples.push(revByDate[key]);
      }
      let avg = 0;
      if (samples.length) {
        // Newest sample is samples[0]. Weight newer higher: weights = N..1.
        let wsum = 0, vsum = 0;
        samples.forEach((v, i) => {
          const w = samples.length - i;
          vsum += v * w;
          wsum += w;
        });
        avg = wsum > 0 ? Math.round(vsum / wsum) : 0;
      }
      perDay[day] = avg;
      total += avg;
    });
    return { per_day: perDay, total: total };
  },

  // Generate a blank worksheet as a clean PDF (header + an empty grid the
  // operator prints and fills by hand during the shift, then keys into Bar Cop
  // after close). Same engine + Save flow as exportPDF, so output and filename
  // are consistent across the app: BarCop_<Name>_Worksheet_<date>.pdf.
  // Usage: App.printBlankSheet({ title, subtitle, columns: [{label, width?}], rows? });
  async printBlankSheet(opts) {
    opts = opts || {};
    const title    = opts.title    || 'Worksheet';
    const subtitle = opts.subtitle || '';
    const cols     = opts.columns  || [];
    try { await this._ensurePDFLib(); }
    catch (e) { alert('Could not load the PDF engine. Check your connection and try again.'); return; }

    // Portrait is what operators expect for a hand-filled sheet. Only fall back to
    // landscape if the headers genuinely can't fit a portrait page (estimate widths
    // here since the doc/getTextWidth doesn't exist yet).
    const estHeaderW = cols.reduce((s, c) => s + (String(c.label || '').length * 4.7 + 16), 0);
    const orientation = estHeaderW > (612 - 80) ? 'landscape' : 'portrait';
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation, unit: 'pt', format: 'letter' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 40;
    const usableW = pageW - margin * 2;
    let y = margin;

    const venue = (this.data && this.data.settings && this.data.settings.bar_name) || '';
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(20, 20, 20);
    doc.text('Bar Cop', margin, y);
    doc.setFontSize(12);
    doc.text(this._pdfSafe(title), pageW - margin, y, { align: 'right' });
    y += 16;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110, 110, 110);
    const dstr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    doc.text(this._pdfSafe((venue ? venue + '   |   ' : '') + dstr), margin, y);
    y += 14;
    if (subtitle) {
      doc.setFontSize(9); doc.setTextColor(90, 90, 90);
      const wrapped = doc.splitTextToSize(this._pdfSafe(subtitle), usableW);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 11 + 4;
    }
    doc.setFontSize(9); doc.setTextColor(60, 60, 60);
    doc.text(this._pdfSafe('Completed by: ______________________________'), margin, y);
    y += 6;
    doc.setDrawColor(205, 205, 205); doc.line(margin, y, pageW - margin, y);
    y += 12;

    // Column widths: honor the call-site hint but never let a column fall below
    // its own header's width, so a long header (e.g. "Witnessed") can't wrap in a
    // skinny column. Narrow-header columns lock to that minimum; the rest flex to
    // fill the row exactly.
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    const reqW = cols.map(c => {
      const w = c.width ? String(c.width) : '';
      if (/%$/.test(w)) return (parseFloat(w) / 100) * usableW;
      if (/px$/.test(w)) return parseFloat(w) * 0.75;
      return usableW / Math.max(1, cols.length);
    });
    const minW = cols.map(c => doc.getTextWidth(this._pdfSafe(c.label || '')) + 14);
    const atMin = cols.map((c, i) => reqW[i] <= minW[i]);
    const fixedSum = cols.reduce((s, c, i) => s + (atMin[i] ? minW[i] : 0), 0);
    const flexSum  = cols.reduce((s, c, i) => s + (atMin[i] ? 0 : reqW[i]), 0);
    const flexAvail = Math.max(0, usableW - fixedSum);
    const columnStyles = {};
    cols.forEach((c, i) => {
      columnStyles[i] = { cellWidth: atMin[i] ? minW[i] : (flexSum > 0 ? reqW[i] * (flexAvail / flexSum) : minW[i]) };
    });

    // One page, always: fit the body rows to the space between the header block and
    // the footer, stretching each row to fill the page. Operators print as many
    // copies as they need, so a worksheet never spills onto a near-empty 2nd page.
    const footerReserve = 30;
    // 14pt safety below the table so autoTable (whose own bottom margin we set to
    // footerReserve) never bumps the last row onto a second page.
    const availH = pageH - y - footerReserve - 14;
    const headerRowH = 20;
    const minBodyRowH = 26;
    // Optional pre-filled rows (e.g. a guided worksheet that prints the steps
    // into the grid). When omitted, the sheet fills the page with blank rows.
    const preRows = (Array.isArray(opts.bodyRows) && opts.bodyRows.length) ? opts.bodyRows : null;
    const nRows = preRows ? preRows.length : Math.max(1, Math.floor((availH - headerRowH) / minBodyRowH));
    const bodyRowH = (availH - headerRowH) / nRows;

    const head = [cols.map(c => this._pdfSafe(c.label || ''))];
    const body = preRows
      ? preRows.map(r => cols.map((c, i) => this._pdfSafe(String(r[i] != null ? r[i] : ''))))
      : Array.from({ length: nRows }, () => cols.map(() => ''));
    doc.autoTable({
      startY: y,
      head, body,
      margin: { left: margin, right: margin, top: margin, bottom: footerReserve },
      columnStyles,
      styles: { fontSize: 9, cellPadding: { top: 4, bottom: 4, left: 6, right: 6 }, lineColor: [150, 150, 150], lineWidth: 0.5, overflow: 'linebreak', valign: 'middle' },
      bodyStyles: { minCellHeight: bodyRowH },
      headStyles: { fillColor: [235, 235, 235], textColor: 30, fontStyle: 'bold', fontSize: 9, minCellHeight: headerRowH, halign: 'left', valign: 'middle' },
      theme: 'grid'
    });

    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(150, 150, 150);
      doc.text('Enter completed entries into Bar Cop after shift close.', margin, pageH - 22);
      doc.text('Page ' + i + ' of ' + pages, pageW - margin, pageH - 22, { align: 'right' });
    }

    // Filename: strip the trailing noun from the title and append "Worksheet".
    const base = String(title).replace(/\s*(Log|Sheet|Pad|Book|Calendar|Worksheet|List)\s*$/i, '').trim() || String(title);
    const tag = base.replace(/[^A-Za-z0-9]+/g, '');
    await this._savePDF(doc, 'BarCop_' + tag + '_Worksheet_' + this._pdfDateStamp() + '.pdf');
  },

  // In-app confirmation modal — replaces window.confirm() so dialogs match
  // Bar Cop's visual language (no jarring native browser prompts). Returns
  // a Promise that resolves to true (confirmed) or false (cancelled).
  // Usage: if (!(await App.confirm({title, message, confirmText, danger}))) return;
  // Put the bold question in `title` and the body in `message` so they render on
  // two lines (question, then the warning below). NEVER cram body text into the
  // title (e.g. titleHtml with an inline span) — that is the one-line look we
  // standardized away from; every confirm/discard/delete box uses title+message.
  confirm(opts) {
    opts = opts || {};
    const title       = opts.title       || 'Are you sure?';
    const message     = opts.message     || '';
    const confirmText = opts.confirmText || 'Confirm';
    const cancelText  = opts.cancelText  || 'Cancel';
    const danger      = opts.danger !== false; // default to danger (red) confirm button
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9500;display:flex;align-items:center;justify-content:center;padding:20px;';
      overlay.innerHTML = '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:24px 28px;max-width:420px;width:100%;">'
        + '<div style="font-size:14px;font-weight:700;color:var(--t1);margin-bottom:' + (message ? '10' : '18') + 'px;">' + (opts.titleHtml || esc(title)) + '</div>'
        + (message ? '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:18px;">' + esc(message) + '</div>' : '')
        + '<div style="display:flex;gap:10px;justify-content:flex-end;">'
          + '<button class="btn btn-ghost" data-act="cancel">' + esc(cancelText) + '</button>'
          + '<button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" data-act="confirm">' + esc(confirmText) + '</button>'
        + '</div></div>';
      document.body.appendChild(overlay);
      const cleanup = (val) => { document.body.removeChild(overlay); resolve(val); };
      overlay.addEventListener('click', e => {
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (act === 'confirm') cleanup(true);
        else if (act === 'cancel' || e.target === overlay) cleanup(false);
      });
      // Esc cancels
      const onKey = (e) => { if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); cleanup(false); } };
      document.addEventListener('keydown', onKey);
    });
  },

  // ── Standard EXPORT-acknowledgment gate — the ONE popup shown before any
  //    high-stakes financial/payroll download (Payroll, Books, Year-End, Weekly
  //    P&L). Form-card look, primary "I Understand, Continue" first, ghost
  //    "Cancel"; no click-off or X so the notice is acted on. message may carry
  //    inline HTML. Resolves true/false. Route every export gate through this so
  //    they never drift apart. See [[legal-protection]].
  confirmExport(opts) {
    opts = opts || {};
    const id = 'export-ack-modal';
    return new Promise(resolve => {
      const html = '<div class="card form-card" style="margin:0;">'
        + '<div class="card-title">' + esc(opts.title || 'Before You Export') + '</div>'
        + '<div style="font-size:12px;color:var(--t2);line-height:1.7;">' + (opts.message || '') + '</div>'
        + '<div class="card-actions">'
        +   '<button class="btn btn-primary" id="export-ack-go">' + esc(opts.confirmText || 'I Understand, Continue') + '</button>'
        +   '<button class="btn btn-ghost" id="export-ack-cancel">' + esc(opts.cancelText || 'Cancel') + '</button>'
        + '</div></div>';
      this.openModal(html, { id, maxWidth: 540, noClose: true });
      let done = false;
      const finish = (val) => { if (done) return; done = true; this.closeModal(id); resolve(val); };
      document.getElementById('export-ack-go')?.addEventListener('click', () => finish(true));
      document.getElementById('export-ack-cancel')?.addEventListener('click', () => finish(false));
    });
  },

  // ── Standard delete confirmation — ONE wording, identical on every delete box
  //    across Bar Cop. Pass a subject for multi-select deletes (e.g. 'these 5
  //    checks'); defaults to 'this' for a single record. Resolves true/false.
  //    Always route a delete through this, never a bespoke confirm() or popup.
  confirmDelete(subject) {
    return this.confirm({
      title: 'Delete ' + (subject || 'this') + '?',
      message: 'Deleting this data is a permanent action and cannot be undone. Delete with caution.',
      confirmText: 'Delete',
      cancelText: 'Cancel'
    });
  },

  // ── Deliverable footer + disclaimer (legal protection helper) ───────────
  // Single source for the disclaimer text + workbook Subject metadata + PDF
  // footer HTML used across every Bar Cop deliverable: Books, Year-End,
  // Weekly P&L Brief, Bar Cop Audit PDF, and any
  // future operator-facing export. Centralizing means the legal language
  // stays in lockstep when it gets edited.
  //
  // Usage:
  //   For XLSX consumers (Books, Year-End, Weekly P&L):
  //     const f = App.deliverableFooter();
  //     f.disclaimerLines  // array of 3 short strings, one per sheet footer row
  //     f.workbookSubject  // single-line string for wb.Props.Subject
  //
  //   For PDF/HTML consumers (Bar Cop Audit PDF):
  //     html += App.deliverableFooter({ kind: 'pdf-html', tagline: 'Bar Cop Audit' });
  //     returns a styled <div class="footer">...</div> block.
  //
  // opts.barName        — defaults to App.data.settings.bar_name or 'Bar Cop'
  // opts.tagline        — short tagline shown above the disclaimer in PDFs
  // opts.sourceText     — optional source note rendered above the disclaimer
  // opts.generatedDate  — Date object, defaults to now
  deliverableFooter(opts) {
    opts = opts || {};
    const dateStr = (opts.generatedDate || new Date()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const tagline = opts.tagline || 'Bar Cop';

    const disclaimerLines = [
      'Generated from data you entered in Bar Cop on ' + dateStr + '.',
      'Bar Cop is a software tool, not a CPA, accountant, marketing consultant, or other professional advisor.',
      'Review and verify before filing, presenting, or making material decisions.'
    ];
    const workbookSubject = disclaimerLines.join(' ');

    if (opts.kind === 'pdf-html') {
      const sourceLine = opts.sourceText
        ? '<div>' + esc(opts.sourceText) + '</div>'
        : '';
      return '<div class="footer" style="margin-top:24px;font-size:9px;color:#999;line-height:1.5;font-family:Helvetica,Arial,sans-serif;border-top:1px solid #ddd;padding-top:10px;">'
        + '<div>' + esc(tagline) + '</div>'
        + sourceLine
        + '<div style="font-style:italic;margin-top:6px;">' + esc(workbookSubject) + '</div>'
        + '</div>';
    }

    return { disclaimerLines: disclaimerLines, workbookSubject: workbookSubject };
  },

  fmtPct(n, d=1) {
    if (isNaN(n) || n == null) return ' ';
    return Number(n).toFixed(d) + '%';
  },

  /* ── Dollarize a percentage gap (Section 10.2) ───────────────────────────
     The shared helper that puts a dollar figure on a percentage. Pass the
     metric, its target, and the annual revenue base it applies to. Returns
     the signed gap in points and dollars (annual and weekly), where a
     positive figure means the metric sits above target. Returns null when
     any input is missing, so callers never print a fabricated number. */
  dollarize(metric, target, annualBase) {
    if (metric == null || target == null || !annualBase || isNaN(annualBase)) return null;
    const gapPts = metric - target;
    const annual = (gapPts / 100) * annualBase;
    return { gapPts: gapPts, annual: annual, weekly: annual / 52 };
  },

  /* ── Unified audit score system (0-100) ──────────────────────────────────
     One scale for every audit score in all three sections:
       70-100  Strong        gold
       50-69   Below Target  white
       0-49    Critical      red                                          */
  // Strong scores use green (success), below-target stays white, critical red.
  // Gold is reserved for brand accents and CTAs, not "doing well" state.
  scoreColor(s) { s = Number(s) || 0; return s >= 70 ? 'var(--green)' : s >= 50 ? 'var(--amber)' : 'var(--red)'; },
  scoreHex(s)   { s = Number(s) || 0; return s >= 70 ? '#518A79'      : s >= 50 ? '#9A5D34'      : '#C03828'; },
  scoreLabel(s) { s = Number(s) || 0; return s >= 70 ? 'Strong'       : s >= 50 ? 'Below Target' : 'Critical'; },

  // Slim 0-100 scale bar with red / amber / green zones and a marker at the score.
  scoreBar(score) {
    const s = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
    return '<div style="margin-top:10px;max-width:300px;">'
      + '<div style="display:flex;height:7px;border-radius:4px;overflow:hidden;">'
      +   '<div style="width:50%;background:var(--red);"></div>'
      +   '<div style="width:20%;background:var(--amber);"></div>'
      +   '<div style="width:30%;background:var(--green);"></div>'
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
    const dots = pts.map((p,i) => p.value != null ? '<circle cx="' + xs(i).toFixed(1) + '" cy="' + ys(p.value).toFixed(1) + '" r="4" fill="#0A1520" stroke="#DBAB46" stroke-width="2"/>' : '').join('');
    const xl = pts.map((p,i) => '<text x="' + xs(i).toFixed(1) + '" y="' + (H-8) + '" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-family="Barlow,sans-serif" font-size="10" font-weight="600">' + esc(String(p.label||'')) + '</text>').join('');
    const yt = [minY, (minY+maxY)/2, maxY].map(v => '<line x1="' + PAD.l + '" y1="' + ys(v).toFixed(1) + '" x2="' + (W-PAD.r) + '" y2="' + ys(v).toFixed(1) + '" stroke="rgba(255,255,255,0.06)" stroke-width="1"/><text x="' + (PAD.l-8) + '" y="' + (ys(v)+4).toFixed(1) + '" text-anchor="end" fill="rgba(255,255,255,0.25)" font-family="Barlow,sans-serif" font-size="10" font-weight="600">' + (Math.round(v*10)/10) + '</text>').join('');
    const tl = opts.target != null
      ? '<line x1="' + PAD.l + '" y1="' + ys(opts.target).toFixed(1) + '" x2="' + (W-PAD.r) + '" y2="' + ys(opts.target).toFixed(1) + '" stroke="#DBAB46" stroke-width="1" stroke-dasharray="5,5" opacity="0.35"/><text x="' + (W-PAD.r+4) + '" y="' + (ys(opts.target)+4).toFixed(1) + '" fill="rgba(219,171,70,0.55)" font-family="Barlow,sans-serif" font-size="9" font-weight="700">TGT</text>'
      : '';
    return '<div class="chart-card" style="padding:20px 24px 14px;">' + head
      + '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block;overflow:visible;">'
      + '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#DBAB46" stop-opacity="0.18"/><stop offset="100%" stop-color="#DBAB46" stop-opacity="0.01"/></linearGradient></defs>'
      + yt + tl
      + '<path d="' + area + '" fill="url(#' + gid + ')" stroke="none"/>'
      + '<path d="' + d + '" fill="none" stroke="#DBAB46" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>'
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
    return this.ymdLocal(d);
  },

  // Newest event record by date. Event logs load date-desc from the events
  // tables, so the last array element is no longer the latest — pick by date
  // (date / period_end / generated_at) instead. Used wherever the Hub and the
  // recovery dashboards show "the latest audit / week".
  latestEvent(arr) {
    if (!Array.isArray(arr) || !arr.length) return null;
    const dk = r => ((r && (r.date || r.period_end || r.generated_at || r.saved_at || r.created_at)) || '') + '';
    return arr.slice().sort((x, y) => dk(y).localeCompare(dk(x)))[0];
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
    + (stale ? ', update it' : '') + '</div>';
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
  // Settings is one unified platform-wide screen (Hub-owned)
  document.getElementById('nav-settings')?.addEventListener('click', () => {
    App.navigate('settings');
  });
  wireAuth();
  App.init();

  // Quality-of-life: focusing any number input selects its current value, so a
  // prepopulated "0" is overwritten the moment the operator types instead of
  // having to delete it first (matches the bottle/keg slider's level field).
  // Delegated on document so it also covers inputs rendered later (count cards,
  // popups, spot check). setTimeout lets the browser's own focus handling run
  // first, otherwise the selection gets cleared on some browsers.
  document.addEventListener('focusin', e => {
    const el = e.target;
    if (el && el.tagName === 'INPUT' && el.type === 'number') {
      setTimeout(() => { try { el.select(); } catch (_) {} }, 0);
    }
  });

  // Kill the browser's native autofill / saved-value dropdowns app-wide. The
  // operator types other people's data (staff phones, vendor contacts), so the
  // browser's "previously entered value" suggestions are noise that pops over
  // the form. Set autocomplete="off" on every text field as it enters the DOM.
  // Screens re-render via innerHTML and modals are injected, so one observer
  // covers them all with no per-form work. Login email/password and any field
  // that already declares an autocomplete value are left alone (so password
  // managers and saved logins keep working).
  const killAutofill = el => {
    if (!el || el.getAttribute('autocomplete')) return;
    const t = (el.getAttribute('type') || 'text').toLowerCase();
    if (t === 'password' || t === 'email' || t === 'number' || t === 'date') return;
    el.setAttribute('autocomplete', 'off');
  };
  const sweepAutofill = root => {
    if (!root || root.nodeType !== 1) return;
    if (root.tagName === 'INPUT' || root.tagName === 'TEXTAREA') killAutofill(root);
    if (root.querySelectorAll) root.querySelectorAll('input, textarea').forEach(killAutofill);
  };
  sweepAutofill(document.body);

  // Mobile/tablet: stamp every data-table + batch-builder cell with its column
  // header (data-label) so the CSS at <=900px can stack each row into a
  // label/value card. One sweep + the observer below cover every screen render,
  // internal re-render, modal, and dynamically added "Add Line" row, with no
  // per-table work. Idempotent: cells that already carry a label are skipped.
  const stampRow = (tr, ths) => {
    let i = 0;
    for (const td of tr.children) { if (td.tagName === 'TD') { if (!td.hasAttribute('data-label')) td.setAttribute('data-label', ths[i] || ''); i++; } }
  };
  const stampTable = tbl => {
    const ths = [...tbl.querySelectorAll('thead th')].map(th => th.textContent.trim());
    if (!ths.length) return;
    tbl.querySelectorAll('tbody tr').forEach(tr => stampRow(tr, ths));
  };
  const sweepTables = root => {
    if (!root || root.nodeType !== 1) return;
    if (root.matches && root.matches('.data-card .tbl, .ing-tbl, .row-list')) stampTable(root);
    if (root.querySelectorAll) root.querySelectorAll('.data-card .tbl, .ing-tbl, .row-list').forEach(stampTable);
    if (root.matches && root.matches('tr')) {            // a single "Add Line" row
      const tbl = root.closest('.data-card .tbl, .ing-tbl, .row-list');
      if (tbl) stampRow(root, [...tbl.querySelectorAll('thead th')].map(th => th.textContent.trim()));
    }
  };
  sweepTables(document.body);

  new MutationObserver(muts => {
    for (const m of muts) for (const n of m.addedNodes) { sweepAutofill(n); sweepTables(n); }
  }).observe(document.body, { childList: true, subtree: true });

  // Section switcher (the dropdown at the top of every section sidebar). One
  // delegated handler so it works in both the module shell (#sidebar-nav) and
  // the Hub's own sidebar, and survives every nav re-render.
  const closeSwitchers = () => document.querySelectorAll('.sec-switch.open').forEach(sw => {
    sw.classList.remove('open');
    const m = sw.querySelector('.sec-switch-menu'); if (m) m.hidden = true;
  });
  document.addEventListener('click', e => {
    // The dashboard icon jumps straight to the current section's dashboard.
    const dash = e.target.closest('.sec-switch-dash');
    if (dash) {
      const sw = dash.closest('.sec-switch');
      closeSwitchers();
      if (sw) App.jumpToSection(sw.dataset.cur);
      return;
    }
    // The rest of the selector opens the section switcher.
    const btn = e.target.closest('.sec-switch-btn');
    if (btn) {
      const sw = btn.closest('.sec-switch');
      const wasOpen = sw && sw.classList.contains('open');
      closeSwitchers();
      if (sw && !wasOpen) { sw.classList.add('open'); const m = sw.querySelector('.sec-switch-menu'); if (m) m.hidden = false; }
      return;
    }
    const item = e.target.closest('.sec-switch-item');
    if (item) { closeSwitchers(); App.jumpToSection(item.dataset.sec); return; }
    closeSwitchers();
  });
});
