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
  subscription: { status: 'inactive', plan: null, active_modules: [], period_end: null },

  async init() {
    await DB.init();
    window.onerror = (msg, src, line, col, err) => {
      const el = document.getElementById('content-area');
      if (el) el.innerHTML = '<div class="screen" style="color:var(--red);font-family:monospace;font-size:12px;white-space:pre-wrap;">ERROR: ' + msg + '\nLine: ' + line + '\n' + (err ? err.stack : '') + '</div>';
    };
    if (!window.SUPABASE_URL) {
      this.data = await DB.readData();
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
          this.data = await DB.readData();
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
      this.data = await DB.readData();
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
        this.data = await DB.readData();
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
    // Sidebar toggle
    document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
      document.getElementById('app').classList.toggle('sidebar-collapsed');
    });
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
      'settings':      ['Settings', ''],
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
      App.data = await DB.readData();
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
