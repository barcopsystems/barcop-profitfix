'use strict';

/* ── Tooltip engine ── */
const TT = {
  _cur: null,
  _box: document.getElementById('tt-box'),
  defs: {
    'container-size': {t:'Container Size',b:'The total size of the bottle, can, or keg you purchase. Pick from the list — the app converts to ounces automatically.',e:'750ml bottle of vodka = 25.4 oz'},
    'std-pour':       {t:'Standard Pour',b:'How many ounces you pour per drink. Used to calculate Cost Per Pour and track inventory variance.',e:'Spirits: 1.5 oz · Wine: 5 oz · Draft: 16 oz'},
    'unit-cost':      {t:'Unit Cost',b:'What you pay per bottle, can, or keg. Use your invoice price.',e:'Case of Tito\'s 750ml costs $180 = $15/bottle'},
    'menu-price':     {t:'Menu Price',b:'What you charge the guest per drink or serving.',e:'$10 for a cocktail · $6 for a draft beer'},
    'pour-cost-pct':  {t:'Pour Cost %',b:'Cost Per Pour divided by Menu Price. Lower is better. Industry benchmark 18–22%.',e:'$0.35 cost ÷ $8 menu price = 4.4%'},
    'pours-bottle':   {t:'Pours Made',b:'Actual pours calculated from your inventory count. Bottles used × pours per bottle. This is what actually left the bar this week.',e:'3.4 bottles used × 16.9 pours per bottle = 57.5 pours made'},
    'cost-pour':      {t:'Cost Per Pour',b:'Unit Cost ÷ Pours Per Bottle. What one drink costs you. Calculated automatically.',e:'$15 bottle ÷ 16.9 pours = $0.89/pour'},
    'kitchen-unit':   {t:'Unit of Measure',b:'The unit you order and count this product in.',e:'Chicken: lb · Lime juice: each · Margarita mix: bag'},
    'kitchen-cost':   {t:'Unit Cost',b:'What you pay per unit of this product.',e:'Chicken: $3.20/lb · Lime carton: $4.50/each'},
    'recipe-pours':   {t:'Pours',b:'How many standard pours of this spirit go in this drink. 1 = one standard pour.',e:'1 pour rum + 0.5 pour triple sec'},
    'recipe-bottles': {t:'Bottles',b:'How many full bottles go into the batch. Use decimals for partial bottles.',e:'2 bottles tequila + 0.5 bottle triple sec'},
    'batch-yield':    {t:'Batch Yield',b:'Total amount this batch makes. Pick the unit — app converts to oz to calculate servings.',e:'1 gallon frozen margarita mix = 128 oz'},
    'serving-size':   {t:'Serving Size',b:'How much goes in one drink. App divides yield by serving size to get servings per batch.',e:'5 oz per drink from 128 oz batch = 25.6 drinks'},
    'servings-batch': {t:'Servings Per Batch',b:'Batch Yield ÷ Serving Size. Calculated automatically. Verify this makes sense.',e:'128 oz ÷ 5 oz = 25.6 drinks'},
    'recipe-cost-pct':{t:'Recipe Cost %',b:'Total ingredient cost ÷ Menu Price.',e:'$1.20 cost ÷ $8 menu price = 15%'},
    'plate-yield':    {t:'Plates Per Batch',b:'How many plates this recipe produces. Most single-plate recipes are 1.',e:'A pot of chili serving 10 = plate yield of 10'},
    'bar-revenue':    {t:'Bar Revenue',b:'Total bar sales for the week from your POS. Include all drink sales.',e:'Your POS end-of-week bar department total'},
    'bar-cogs':       {t:'COGS',b:'Cost of Goods Sold — what you spent on bar product. Invoices + transfers in − transfers out.',e:'Weekly liquor invoice total: $2,340'},
    'bar-labor':      {t:'Labor',b:'Bar staff payroll — bartenders, barbacks, bar manager. Not kitchen or floor staff.',e:'Bartender hours × hourly rate'},
    'prime-cost':     {t:'Prime Cost %',b:'(Total Bar COGS + Total Food COGS + Total Labor) ÷ Total Revenue. The most important single number in your operation. Target: 60% or below. Above 65% is a warning sign.',e:'($4,200 bar COGS + $3,800 food COGS + $6,200 labor) ÷ $24,000 revenue = 60.0%'},
    'theoretical':    {t:'Pours Sold (POS)',b:'Number of pours/shots of this product rung in on your POS this week. Pull from your POS sales mix report. Enter as individual shots, not bottles.',e:'POS shows 85 shots of Tito\'s vodka sold this week = enter 85'},
    'variance-units': {t:'Variance (Pours)',b:'Pours Made minus Pours Sold. Near zero = controlled. Positive = more poured than sold (over-pouring or theft). Negative = more rung in than used (check POS entries).',e:'87 pours made, 85 sold = +2 variance (within normal range)'},
    'prev-cost':      {t:'Previous Cost',b:'The Unit Cost currently on file — pulled automatically from product setup.',e:'Tito\'s was $14.50/bottle'},
    'new-cost':       {t:'New Invoice Cost',b:'The price on your most recent invoice for this product.',e:'New invoice shows $15.75/bottle'},
    'weekly-usage':   {t:'Weekly Usage',b:'How many units you typically use per week. Used to calculate Annual Impact $.',e:'4 bottles of Tito\'s per week'},
    'annual-impact':  {t:'Annual Impact $',b:'Cost Change $ × Weekly Usage × 52 weeks.',e:'+$1.25/bottle × 4/week × 52 = +$260/year'},
    'inv-beg':        {t:'Beginning Inventory',b:'Count of bottles/units on hand at the start of this period. Carried forward from last week\'s ending count.',e:'You had 4.5 bottles of Tito\'s at start of week'},
    'inv-purchases':  {t:'Purchases',b:'Bottles/units received from deliveries during the week. Count what arrived on invoices, not what was ordered.',e:'Received 6 bottles from your weekly liquor order'},
    'inv-end':        {t:'Ending Inventory',b:'Physical count of bottles/units on hand right now. Count partial bottles as decimals.',e:'3.5 bottles remaining = 3 full + one half-full'},
    'inv-used':       {t:'Units Used',b:'Beginning + Purchases − Ending = actual consumption. Calculated automatically. In bottles for bar products.',e:'4.5 + 6 − 3.5 = 7 bottles used this week'},
    'shift-cogs':     {t:'Shift COGS (Product Only)',b:'Bar product cost for this shift — spirits, beer, wine. Do not include labor. Estimate from your weekly invoices divided by number of shifts, or use your POS cost report if available.',e:'Weekly $2,400 bar COGS ÷ 6 shifts = $400/shift'},
    'opening-bank':   {t:'Opening Bank',b:'Cash in the drawer at shift start. Your starting float — not counted as revenue.',e:'Standard opening bank: $200'},
    'expected-cash':  {t:'Expected Cash from POS',b:'Cash sales total from your POS for this shift.',e:'POS shows $840 in cash sales for the PM shift'},
    'cash-tolerance': {t:'Over/Short Tolerance',b:'Max dollar amount you consider acceptable for a drawer to be off.',e:'$10 tolerance: $9 over or short = OK. $11 = flagged'},
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
    const session = await DB.getSession();
    if (session) {
      this.data = await DB.readData();
      this.subscription = await DB.getSubscription();
      this.boot();
    } else {
      this.showAuth();
    }
    DB.onAuthChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
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
      this.showApp();
      this.navigate('hub');
    }
  },

  showApp() {
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('ob-overlay').classList.add('hidden');
    document.getElementById('auth-screen').style.display = 'none';
  },

  showAuth() {
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('app').classList.add('hidden');
    document.getElementById('ob-overlay').classList.add('hidden');
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

    const titles = {
      'hub':           ['Recovery Hub', ''],
      'dashboard':     ['Dashboard', ''],
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
      'help':          ['Help & FAQ', ''],
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
  },

  updatePeriod() {
    const el = document.getElementById('sidebar-period');
    if (!el) return;
    const weeks = this.data?.weeks || [];
    if (weeks.length > 0) {
      const w = weeks[weeks.length - 1];
      el.textContent = 'Week ' + w.week_num + ' — ' + (w.period_end || '');
    } else {
      el.textContent = 'No data yet';
    }
  },

  fmtCurrency(n, decimals) {
    if (isNaN(n) || n == null) return '—';
    const d = decimals !== undefined ? decimals : (Math.abs(n) < 10 ? 2 : 0);
    return '$' + Number(n).toLocaleString('en-US', {minimumFractionDigits:d, maximumFractionDigits:d});
  },

  fmtPct(n, d=1) {
    if (isNaN(n) || n == null) return '—';
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
    ['auth-login','auth-signup','auth-reset'].forEach(x => document.getElementById(x).style.display = x===id?'':'none');
  };
  document.getElementById('show-signup')?.addEventListener('click', () => show('auth-signup'));
  document.getElementById('show-login')?.addEventListener('click',  () => show('auth-login'));
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

  document.getElementById('signup-btn')?.addEventListener('click', async () => {
    const email = document.getElementById('signup-email').value.trim();
    const pass  = document.getElementById('signup-password').value;
    const conf  = document.getElementById('signup-confirm').value;
    const err   = document.getElementById('signup-error');
    const ok    = document.getElementById('signup-ok');
    const btn   = document.getElementById('signup-btn');
    if (!email || !pass) { err.textContent='Enter email and password.'; err.style.display='block'; return; }
    if (pass.length < 8) { err.textContent='Password must be at least 8 characters.'; err.style.display='block'; return; }
    if (pass !== conf)   { err.textContent='Passwords do not match.'; err.style.display='block'; return; }
    btn.textContent='Creating...'; btn.disabled=true;
    const {error} = await DB.signUp(email, pass);
    btn.textContent='Create Account'; btn.disabled=false;
    if (error) { err.textContent=error.message; err.style.display='block'; ok.style.display='none'; }
    else { err.style.display='none'; ok.textContent='Account created. Check your email to confirm, then sign in.'; ok.style.display='block'; }
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

  document.getElementById('signout-btn')?.addEventListener('click', async () => {
    await DB.signOut();
    App.showAuth();
  });
}

/* ── Boot ── */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-item[data-screen]').forEach(el => {
    el.addEventListener('click', () => App.navigate(el.dataset.screen));
  });
  document.getElementById('nav-settings')?.addEventListener('click', () => App.navigate('settings'));
  wireAuth();
  App.init();
});
