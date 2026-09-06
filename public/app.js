'use strict';



// Delegated "+ Note" toggle (App.noteField). Reveals/hides the collapsed note
// box and focuses it on open. One handler covers every form, current and future.
document.addEventListener('click', ev => {
  const tg = ev.target.closest('.note-toggle');
  if (!tg) return;
  const box = document.getElementById(tg.dataset.target + '-box');
  if (!box) return;
  const showing = box.style.display !== 'none';
  box.style.display = showing ? 'none' : 'block';
  if (!showing) { const ta = box.querySelector('textarea'); if (ta) ta.focus(); }
});

/* ── App ── */
const App = {
  data: null,
  inventoryData: null,   // ic_ keys — ic_data table (see Rule 21)
  laborData: null,       // lc_ keys — lc_data table
  shiftData: null,       // sc_ keys — sc_data table
  subscription: { status: 'inactive', plan: null, active_modules: [], period_end: null },

  // Clickwrap: the current Terms/Privacy version stamped on acceptance at signup.
  // Bump this string when the hosted Terms change to force a re-accept.
  TOS_VERSION:     '2026-04-08',
  TOS_TERMS_URL:   'https://www.barcop.com/pages/terms-of-use',
  TOS_PRIVACY_URL: 'https://www.barcop.com/pages/privacy-policy',
  _signupInProgress: false,  // guards the SIGNED_IN handler from booting mid-signup
  _newBarFlow: null,         // { originAccountId, accountId?, draft? } during Add Another Bar

  // The builder's own operating accounts. Gates dev/testing tools (Load Sample
  // Data / Clear All Data / Reset Onboarding) so real paying customers never see
  // them. NOT the throwaway test-customer accounts — those should see exactly
  // what a real customer sees.
  DEV_EMAILS: ['kyleodom@yahoo.com', 'barcopsystems@gmail.com'],
  isDevAccount() {
    const email = ((window.DB && DB._user && DB._user.email) || '').toLowerCase();
    return this.DEV_EMAILS.indexOf(email) !== -1;
  },


  // ── Account-synced small state ────────────────────────────────────────────────
  // Survives on the ACCOUNT across every device the operator logs into (localStorage is
  // per-browser). Lives in the config blob (App.data.account_state) and persists through
  // saveKey. Holds what an operator SETS that must read the same on any machine: cockpit
  // step-done marks, cash forecast config, event agreement terms, saved import mappings.
  // (UI prefs, the offline queue, and the active-bar pointer stay in localStorage on
  // purpose — those are genuinely per-device.)
  _acctState() { if (!this.data) this.data = {}; if (!this.data.account_state) this.data.account_state = {}; return this.data.account_state; },
  acctGet(key, def) { const v = this._acctState()[key]; return (v === undefined || v === null) ? def : v; },
  acctSet(key, val) {
    const s = this._acctState();
    if (val === undefined || val === null || val === '') { if (!(key in s)) return Promise.resolve(true); delete s[key]; }
    else s[key] = val;
    return this.saveKey('account_state');   // return the save promise so a migrate-on-read can defer its localStorage cleanup until the write is CONFIRMED
  },

  /* ⭐ THE SCROLLBAR'S REAL WIDTH, MEASURED ONCE AT BOOT (T26). `scrollbar-gutter: stable` reserves
     this much on the right forever so the page cannot move when a scrollbar appears, and the padded
     containers give the same width back off padding-right so the visual gap stays the 28px it
     already was. Both halves need the number and CSS has no way to tell you it.
     ⚠ MEASURED, NEVER ASSUMED, and the probe deliberately inherits the app's own scrollbar styling:
     `style.css` asks for a 6px `::-webkit-scrollbar`, but `*{scrollbar-width:thin}` overrides that
     in Chrome and the real reservation is 10px. Reading it live means the compensation follows the
     styling instead of drifting from it the moment either changes.
     ⛔ 0 ON ANY FAILURE, NEVER A NEGATIVE, and `--sbw` also defaults to 0 in the stylesheet. The
     containers SUBTRACT this, so a wrong or missing value must land on "exactly as it is today"
     rather than on a right gap narrower than the left. */
  measureScrollbarWidth() {
    let w = 0;
    try {
      const p = document.createElement('div');
      p.style.cssText = 'position:absolute;top:-9999px;left:-9999px;width:100px;height:100px;overflow-y:scroll;';
      document.documentElement.appendChild(p);
      w = Math.max(0, p.offsetWidth - p.clientWidth);
      p.remove();
    } catch (e) { w = 0; }
    try { document.documentElement.style.setProperty('--sbw', w + 'px'); } catch (e) {}
    return w;
  },

  async init() {
    // Before the first await, so the value is in place before anything renders. `init` is the one
    // entry BOTH a real login and `?demo=1` take, so there is no second start-up path that could
    // quietly miss it ([[the-loop]] #101).
    this.measureScrollbarWidth();
    await DB.init();
    // A crash used to paint a raw stack trace over the operator's screen and report it NOWHERE,
    // so Kyle only ever learned about a failure if a customer stopped work and filled in the bug
    // form. Now: the operator gets a calm message they can act on, and the real detail is shipped.
    window.onerror = (msg, src, line, col, err) => {
      try {
        DB.logClientError('js_error', msg,
          (err && err.stack ? err.stack : '') + '\nat ' + (src || '?') + ':' + (line || '?') + ':' + (col || '?'),
          this._currentScreenId || '');
      } catch (e) {}
      // ⚠⚠ BUMP BEFORE TAKING THE CONTENT OVER (S70) — this is the sharpest of the three. Without
      // it a background write still holding a token that looks current repaints the CRASHED screen
      // straight over this card, deleting the operator's only route back. Dismiss the write toast
      // for the same reason every other takeover does (S3): it names a row on a screen that is gone.
      ++this._mountSeq;
      this._dismissWriteFail();
      const el = document.getElementById('content-area');
      if (el) el.innerHTML = '<div class="screen"><div class="card" style="max-width:520px;margin:40px auto;text-align:center;">'
        + '<div style="font-size:15px;font-weight:700;color:var(--t1);margin-bottom:10px;">This screen ran into a problem</div>'
        + '<div style="font-size:13px;color:var(--t2);line-height:1.6;margin-bottom:18px;">'
        + 'Your saved data is safe. The details were sent to Bar Cop automatically, so no report is needed. '
        + 'Reload to get going again.</div>'
        + '<button class="btn btn-primary" onclick="window.location.reload()">Reload Bar Cop</button>'
        + '</div></div>';
    };
    // Rejected promises do NOT reach window.onerror. This app is async end to end, so a failed
    // save deep in an await chain — the exact shape of the data-loss bugs found on 2026-07-19 —
    // was previously invisible to the operator AND to Kyle. Report it, but do NOT take over the
    // screen: most rejections are non-fatal and a false alarm trains people to ignore real ones.
    window.addEventListener('unhandledrejection', (e) => {
      try {
        const r = e && e.reason;
        DB.logClientError('unhandled_rejection',
          (r && (r.message || r.error_description)) || String(r || 'unknown'),
          (r && r.stack) ? r.stack : JSON.stringify(r || null),
          this._currentScreenId || '');
      } catch (e2) {}
    });

    // Browser back/forward walks the in-app history stack instead of leaving
    // the site. _navigationLock suppresses re-pushing while popstate handles
    // the navigation so we don't grow the history stack on every back-step.
    window.addEventListener('popstate', (e) => {
      if (!e.state) return;
      // Block a back/forward step only while the auth / set-password screen is actually
      // up (App.data is also null there) — otherwise every data-driven screen throws and
      // paints a broken shell over the sign-in page. Do NOT gate on "#app is hidden": the
      // Hub hides #app too, so that test can't tell the auth screen from the Hub and would
      // kill browser Back/Forward on the home view. auth-screen is display:flex on the auth
      // panel and display:none everywhere inside the app, so it distinguishes them cleanly.
      const authEl = document.getElementById('auth-screen');
      const authShowing = !!(authEl && authEl.style.display !== 'none');
      if (authShowing || !this.data) return;
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
    /* ⛔ FIRST, BEFORE ANY BRANCH CAN LEAVE OR ANY SCREEN CAN REWRITE THE URL. `showAuth` strips
       the whole query string on `?signup=1`, and the demo branch below returns out of init
       entirely — so a plan named in the URL has to be taken here or not at all. Pure read, no
       network, cannot throw out of its own try, and harmless on every path that ignores it. */
    this._captureUrlPlan();
    // Demo entry: ?demo=1, or the clean /demo path (also tolerate a mistyped
    // /demo=1 with no question mark). The Vercel catch-all serves index.html for
    // /demo, so the app loads here and just needs to switch into demo mode.
    const _demoPath = window.location.pathname.replace(/\/+$/, '').toLowerCase();
    if (new URLSearchParams(window.location.search).get('demo') === '1'
        || _demoPath === '/demo' || _demoPath === '/demo=1') {
      await this.startDemo();
      return;
    }
    // No SUPABASE_URL means DB.init found no Supabase client, i.e. the library never
    // loaded. There is no local-only mode worth booting into: putEvent returns ok
    // without writing, _configBlob strips every event array back out of the blob it
    // does write, and loadEvents reads a cache nothing ever filled. A GM could work a
    // whole shift (drawer, voids, counts, hours, close the week), see every save
    // succeed, reload, and find all of it gone, with no error and nothing to recover.
    // Stop and say so instead of serving a convincing fake.
    if (!window.SUPABASE_URL) {
      this._bootUnavailable();
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
    /* ⭐ CHECKOUT-FIRST ENTRY, and the `!session` half is the guard that matters. A visitor with no
       account goes straight to a hosted Stripe page. A SIGNED-IN visitor falls through to the
       ordinary boot instead: they already have an account, so a public checkout would take their
       money and then be refused at the claim. Refusing before the charge beats refusing after it,
       and the app is where Add Another Bar lives. */
    if (!session && new URLSearchParams(window.location.search).get('start') === '1') {
      await this._startPublicCheckout();
      return;
    }
    /* ⭐ THE CHECKOUT-FIRST RETURN. `!session` is what tells it apart from the EXISTING return
       (an in-app upgrade, or Add Another Bar), which is already signed in and handled below. */
    if (!session) {
      const _rq = new URLSearchParams(window.location.search);
      if (_rq.get('checkout') === 'success' && _rq.get('session_id')) {
        await this._claimCheckout(_rq.get('session_id'));
        return;
      }
    }
    if (session) {
      this._bootedUserId = session.user?.id || null;
      // Returning from a Stripe checkout, the return_url carries ?bar=<id> so we
      // load the bar that was just paid for (the just-added one, for Add Another
      // Bar). Membership is still verified downstream, so this can't grant access.
      const barParam = new URLSearchParams(window.location.search).get('bar');
      if (barParam && DB._setStoredActiveAccountId) DB._setStoredActiveAccountId(barParam);
      await this.loadAllData();
      this.subscription = await DB.getSubscription();
      // Returning from Stripe checkout: the webhook that flips the subscription
      // to active is async, so poll a few seconds before the paywall gate runs,
      // otherwise a just-paid owner briefly bounces back to Finish-your-subscription.
      const checkoutReturn = new URLSearchParams(window.location.search).get('checkout') === 'success';
      if (checkoutReturn) {
        if (this.subscription?.status !== 'active') {
          this.subscription = await this._pollSubscriptionActive();
        }
        window.history.replaceState({}, '', '/');
      }
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
        // Signup owns its own flow (record ToS, then redirect to Stripe). Don't
        // let the signUp-fired SIGNED_IN boot into the paywall mid-flow.
        if (this._signupInProgress) return;
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
     ?demo=1 boots a sandboxed, fully populated demo: no auth, no persistence
     (DB._demo makes every write a no-op), resets on every load. The demo is
     fully functional — audits, PDF exports, everything works — EXCEPT App
     Settings and the two email forms (Report a Bug / Contact Support), which are
     gated via demoBlock() so a visitor can't rename the bar or reach our inbox. */
  demoMode: false,

  // ── SIGNUPS CLOSED ────────────────────────────────────────────────────────────────────────
  // Flip to true to reopen public signup. Set false 2026-07-20, with ZERO live accounts, while
  // the pre-live hardening is taken to completion. The 07-19 hardening got one deep adversarial
  // pass that found real data-destroying regressions (a restore that could wipe an account, a
  // server job that could cancel every subscription), but it was never taken to the point where
  // a round came back clean. Hardening a live system while a stranger could walk in mid-change
  // is the one way this ends badly, and at zero users closing the door costs nothing.
  // ⚠ There is a MATCHING constant in server/index.js (SIGNUPS_OPEN) that blocks checkout.
  // CHANGE BOTH. verify-signups-closed.js FAILS if they disagree, so reopening is one decision.
  /* ⭐ REOPENED 2026-08-02, deliberately, by Kyle. The paragraph above is now HISTORY, kept because
     it records why the door was shut and what had to be true before it opened again.
     WHAT CHANGED: the hardening converged. Every one of the thirteen operator-facing sections has
     been trial-used end to end, the calculation coverage audit is closed, and the suite reached 369
     harnesses / 12,593 assertions green, including the row-per-record migration and the `_dataReady`
     hydration gate that the 07-19 data-loss bug produced.
     ⚠ The one path that had NOT been exercised since 07-13 is a brand-new account's first load —
     every boot since the fix has been an EXISTING account with a populated row, which is the other
     side of that branch. It is now pinned by verify-new-account-first-load.js, including the
     false-empty case that IS the 07-19 wipe. */
  SIGNUPS_OPEN: true,

  // Last-resort boot guard (L14). init() IS the whole boot chain, and at page load BOTH containers
  // are hidden (#auth-screen display:none, #app .hidden) — so a rejection anywhere in that chain
  // used to leave the operator on a PERMANENTLY BLANK PAGE with no message and no way forward. Worse,
  // window.onerror paints its card into #content-area, which lives INSIDE the still-hidden #app, so
  // even that fallback was invisible. Every individual read is already defensive (readData falls back
  // to local, loadEvents to the cache); this catches the one unguarded throw that gets added later.
  // ⚠ ONLY takes over when boot put NOTHING on screen. A LATE rejection (after boot() rendered, or
  // while the sign-in card is up) must never hide a working app behind an error screen.
  _bootFailed(e) {
    try {
      DB.logClientError('boot_failed', (e && e.message) || String(e || 'boot failed'),
        (e && e.stack) ? e.stack : '');
    } catch (e2) {}
    const appEl  = document.getElementById('app');
    const authEl = document.getElementById('auth-screen');
    const appShown  = !!appEl  && !appEl.classList.contains('hidden');
    const authShown = !!authEl && authEl.style.display !== 'none';
    if (!appShown && !authShown) this._bootUnavailable();
  },

  // Hard stop when Bar Cop cannot reach its backend at boot (see the SUPABASE_URL gate
  // in init()). Reuses the auth card so it reads as Bar Cop, not a browser error.
  _bootUnavailable() {
    const scr = document.getElementById('auth-screen');
    document.getElementById('app')?.classList.add('hidden');
    if (!scr) { document.body.textContent = 'Bar Cop could not load. Check your connection and reload.'; return; }
    scr.style.display = 'flex';
    scr.innerHTML = '<div class="auth-view" style="display:block;"><div class="auth-card">'
      + '<div class="auth-logo"><img src="assets/logo.png" alt="Bar Cop" style="height:30px;"/></div>'
      + '<div class="auth-heading">Bar Cop could not load</div>'
      + '<div class="auth-sub">Your connection, or something on your network blocking scripts, stopped part of Bar Cop from loading. Nothing you entered right now would reach your account, so Bar Cop stopped here rather than let you work a shift into a hole.</div>'
      + '<div class="auth-inputs"><button class="btn btn-primary" id="boot-retry" style="width:100%;">Try Again</button></div>'
      + '<div class="auth-sub" style="margin-top:14px;">Your data is safe on your account. If this keeps happening, try another network or email support@barcop.com.</div>'
      + '</div></div>';
    document.getElementById('boot-retry')?.addEventListener('click', () => location.reload());
  },

  /* ⭐⭐ CHECKOUT-FIRST: the pricing page lands here as `/?start=1&plan=annual`.
     No account exists yet and that is the entire point — this hop asks the server for a HOSTED
     Stripe session and hands the browser over. If the customer walks away at Stripe, nothing was
     created: no auth user, no account, nothing to clean up, nothing to lock out of its own data.
     ⛔ IT GOES THROUGH THE APP RATHER THAN STRAIGHT FROM SHOPIFY ON PURPOSE. It reuses the plan
     validation that already exists here, it gives the operator a branded "one moment" instead of a
     dead pause on a marketing page, and it keeps the public endpoint's caller in one place.
     ⚠ A SIGNED-IN VISITOR IS NEVER SENT TO A PUBLIC CHECKOUT. They already have an account, so a
     public session would be REFUSED at the claim after their card was charged. Kyle's rule is
     "refuse and point at Add Another Bar" — doing that BEFORE the money moves is strictly better
     than after, so this bails to the ordinary boot and they land in the app where that button is. */
  async _startPublicCheckout() {
    const scr = document.getElementById('auth-screen');
    document.getElementById('app')?.classList.add('hidden');
    /* ⚠ `bare` EXISTS BECAUSE OF HOW LONG THIS SCREEN LIVES. The hand-off to Stripe is on screen
       for a second or two, and Kyle read it as "something went wrong" precisely because there was
       too much to read: logo, heading and a sentence naming the plan. Nobody finishes that in the
       time it exists, so the eye registers unread text and assumes a problem. One short line is
       the whole design. The FAILURE covers keep the full treatment — those are read at leisure. */
    const PRICING_BTN = '<div class="auth-inputs"><a class="btn btn-primary" href="https://www.barcop.com/pages/pricing" style="width:100%;display:block;text-align:center;">Back to Pricing</a></div>';
    const cover = (heading, sub, retry, bare) => this._flowCover(heading, sub, retry ? PRICING_BTN : '', bare);
    // No plan, or one that names nothing: the pricing page is the only place that can answer it.
    if (!this._urlPlan) {
      cover('Choose a plan first', 'That link did not carry a subscription plan, so there is nothing to set up yet. Pick a plan and Bar Cop will take you straight to payment.', true);
      return;
    }
    cover('Taking you to checkout...', '', false, true);
    try {
      const r = await fetch('/api/start-checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: this._urlPlan })
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data && data.url) { window.location.href = data.url; return; }
      // Say what the server said when it is worth saying, and never claim it worked.
      cover('Could not open checkout', (data && data.error)
        ? String(data.error)
        : 'Something stopped the payment page from opening. Nothing has been charged. Please try again in a moment.', true);
    } catch (e) {
      cover('Could not reach Bar Cop', 'Check your connection and try again. Nothing has been charged.', true);
    }
  },

  /* ⭐⭐ THE RETURN FROM STRIPE. Lands as `/?checkout=success&session_id=…` with NO session, because
     on checkout-first the customer has never signed in — the account is created by this call.
     ⛔ THE SERVER IS THE ONE THAT DECIDES ANYTHING. All this sends is the session id; the server
     re-reads it from Stripe, so a forged or edited id resolves to nothing.
     ⚠ THE URL IS CLEANED BEFORE THE SIGN-IN, not after: a reload mid-way must not re-run a claim
     with a token that has already been spent.
     ⚠ NO ONE-TIME TOKEN IS NOT A FAILURE. The account exists and is paid; they get in with
     Forgot Password. Reporting an error over a working, paid account is the worse answer. */
  async _claimCheckout(sessionId) {
    const scr = document.getElementById('auth-screen');
    document.getElementById('app')?.classList.add('hidden');
    const cover = (heading, sub, action) => this._flowCover(heading, sub, action, false);
    const RELOAD = '<div class="auth-inputs"><button class="btn btn-primary" id="claim-retry" style="width:100%;">Try Again</button></div>';
    const LOGIN  = '<div class="auth-inputs"><button class="btn btn-primary" id="claim-login" style="width:100%;">Go To Log In</button></div>';
    const PRICING = '<div class="auth-inputs"><a class="btn btn-primary" href="https://www.barcop.com/pages/pricing" style="width:100%;display:block;text-align:center;">Back to Pricing</a></div>';
    const wire = () => {
      document.getElementById('claim-retry')?.addEventListener('click', () => location.reload());
      document.getElementById('claim-login')?.addEventListener('click', () => { window.location.href = '/'; });
    };
    cover('Payment Received', 'Setting up your bar. This takes a few seconds.', '');
    try {
      const r = await fetch('/api/claim-checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId })
      });
      const d = await r.json().catch(() => ({}));
      if (r.status === 409 && d && d.existing) {
        cover('You Already Have An Account', (d.email ? esc(d.email) + ' already has a Bar Cop account. ' : '')
          + 'Log in, then use Add Another Bar to set this one up. Your payment is on file, so contact support@barcop.com if you need a hand.', LOGIN);
        wire(); return;
      }
      /* ⛔⛔ THREE DIFFERENT "NOT OK"s, AND ONLY ONE OF THEM MAY MENTION A PAYMENT.
         Found by walking the shipped build: a forged or EXPIRED session id took the catch-all
         below and told the visitor "Your payment went through", which is a claim about their money
         made on the one path where nothing is known to have been paid. Stripe sessions expire, and
         a bookmarked or re-opened success URL lands here for real — so this was a dead end
         asserting a charge, under a Try Again that could never work.
         · 404  the session does not exist at Stripe. Nothing is known. Claim NOTHING.
         · 409  Stripe has it but it never completed. Not paid.
         · else the server RETRIEVED the session, saw it complete, and only provisioning lagged —
                so the payment genuinely did go through and saying so is a kindness, not a guess. */
      if (r.status === 404) {
        cover('We Could Not Find That Checkout', 'This link does not match a checkout at our payment provider, or it has expired. '
          + 'If you have paid, log in with the email you used, or contact support@barcop.com and we will sort it out.', LOGIN);
        wire(); return;
      }
      if (r.status === 409 && d && d.pending) {
        cover('That Checkout Was Not Finished', 'No payment was taken. Pick your plan and Bar Cop will take you straight back to the payment page.', PRICING);
        wire(); return;
      }
      if (!r.ok || !d || !d.ok) {
        // Retryable, not terminal: the webhook provisions independently and may simply be a
        // moment behind. Never say "done" and never say "failed".
        cover('Still Setting Up Your Bar', 'Your payment went through. Bar Cop is finishing your account, which can take a few seconds.', RELOAD);
        wire(); return;
      }
      window.history.replaceState({}, '', '/');
      if (d.tokenHash && DB._sb) {
        const { error } = await DB._sb.auth.verifyOtp({ token_hash: d.tokenHash, type: 'magiclink' });
        // Down BEFORE the handover: the finish screen needs the auth markup this used to destroy.
        if (!error) { this._flowCoverClear(); this._showFinishSetup(d.email); return; }
      }
      cover('Your Bar Is Ready', 'Use Forgot Password with ' + esc(d.email || 'your email')
        + ' to set a password, then log in. Your subscription is active.', LOGIN);
      wire();
    } catch (e) {
      cover('Still Setting Up Your Bar', 'Your payment went through. Check your connection and try again.', RELOAD);
      wire();
    }
  },

  /* THE FINISH SCREEN. Kyle\'s design: one screen, not two. It REUSES the signup form rather than
     growing a second one — same fields, same validation, same service-period control — with the
     email filled in and LOCKED, because it is the address that paid and changing it here would
     desync the account from the Stripe customer. Changing it later belongs in Settings (E1).
     ⚠ The Terms row is hidden: acceptance was collected and RECORDED by Stripe on the session,
     which is stronger evidence than a checkbox here. */
  _showFinishSetup(email) {
    this._finishMode = true;
    // Belt and braces: whichever door reached here, no cover may be left on top of the form.
    this._flowCoverClear();
    this.showAuth();
    ['auth-login', 'auth-signup', 'auth-reset', 'auth-set-password', 'auth-paywall'].forEach(x => {
      const el = document.getElementById(x); if (el) el.style.display = (x === 'auth-signup') ? '' : 'none';
    });
    /* ⛔ UNCOVER THE REAL CARD. With signups shut, `wireAuth` covers this panel with the "not
       taking new accounts" notice. That message is for a stranger; this person has PAID, and the
       fact that brings them here (`needs_password`) lives on the account, so the shut door does
       not stop them arriving. Without these two lines they land on the refusal with no password
       box and no way in. Harmless when the door is open — the notice is not on screen. */
    const closedCard = document.getElementById('signup-closed-card');
    if (closedCard) closedCard.style.display = 'none';
    const realCard = document.querySelector('#auth-signup .auth-card');
    if (realCard) realCard.style.display = '';
    const em = document.getElementById('signup-email');
    if (em && email) { em.value = email; em.readOnly = true; em.style.opacity = '0.7'; }
    const head = document.querySelector('#auth-signup .auth-heading');
    if (head) head.textContent = 'Finish Setting Up Your Bar Cop Account';
    const sub = document.querySelector('#auth-signup .auth-sub');
    // Two separate things, so two separate lines: what just happened to their money, then what
    // they have to do next. Run together, the instruction reads like the tail of the receipt.
    if (sub) sub.innerHTML = 'Payment received. You paid with <b style="color:var(--t1);">' + esc(email || '') + '</b>.<br>Set a password and tell Bar Cop about your bar.';
    const tosRow = document.getElementById('signup-tos')?.closest('label');
    if (tosRow) tosRow.style.display = 'none';
    /* ⛔ THE PANEL FOOT GOES. "Already have an account? Log in" and "Cancel" belong to SIGNUP,
       where nothing has been created yet. Here the customer has paid and the account exists, so
       "Cancel" implies an undo that does not exist, and "log in" invites them away from the one
       screen that sets the password they would need to log in WITH. Hidden rather than deleted,
       because the ordinary signup panel still needs both. */
    const foot = document.querySelector('#auth-signup .auth-foot');
    if (foot) foot.style.display = 'none';
    const btn = document.getElementById('signup-btn');
    if (btn) { btn.textContent = 'Finish Setup'; btn.disabled = false; }
  },

  /* ⛔⛔ THE COVERS PAINT INTO THEIR OWN NODE, NEVER INTO #auth-screen.
     Kyle paid $1 and sat on "PAYMENT RECEIVED" forever. The cause: the claim cover did
     `authScreen.innerHTML = …`, and **#auth-signup lives inside #auth-screen** — so painting the
     cover DELETED the signup form out of the DOM. `_showFinishSetup` then looked for
     `#auth-signup`, `#signup-email`, `#signup-btn`, found null every time, set nothing, showed
     nothing, and the last thing painted stayed up permanently.
     ⚠ IT WORKED WHEN TESTED FROM `boot()` because that path reaches the finish screen with the
     markup intact — no cover had run. The ONE path that breaks it is the one a paying customer
     takes. A screen is not "reachable" until it is reached the way the customer reaches it.
     ⭐ A separate overlay also means the cover cannot be destroyed BY the thing it hands to, and
     `_flowCoverClear()` is the single way it comes down, so it can never be orphaned on screen. */
  _flowCover(heading, sub, action, bare) {
    let m = document.getElementById('flow-cover');
    if (!m) {
      m = document.createElement('div');
      m.id = 'flow-cover';
      // Above the auth screen and the app, below nothing else this flow uses.
      m.style.cssText = 'position:fixed;inset:0;z-index:9600;background:var(--bg);'
        + 'display:flex;align-items:center;justify-content:center;padding:20px;';
      document.body.appendChild(m);
    }
    m.style.display = 'flex';
    m.innerHTML = '<div class="auth-view" style="display:block;"><div class="auth-card">'
      + (bare ? '' : '<div class="auth-logo"><img src="assets/logo.png" alt="Bar Cop" style="height:30px;"/></div>')
      + '<div class="auth-heading"' + (bare ? ' style="margin:0;"' : '') + '>' + heading + '</div>'
      + (sub ? '<div class="auth-sub">' + sub + '</div>' : '')
      + (action || '') + '</div></div>';
    return m;
  },

  _flowCoverClear() {
    const m = document.getElementById('flow-cover');
    if (m) m.remove();
  },

  async startDemo() {
    this.demoMode = true;
    DB._demo = true;
    // ⚠ MARK THE SESSION LOADED. The readiness gates exist to stop a save from overwriting a
    // real server row before the initial load confirmed what that row holds — and the demo has
    // no server row. startDemo builds App.data from the seed and never calls readData, so
    // _dataReady stayed false for the WHOLE demo session and every gate that reads it misfired:
    //   App.save / App.saveKey    -> _configGateRefused painted a red "Settings were not saved —
    //                                Bar Cop has not loaded this account on this device yet"
    //                                banner over the demo, on every screen that saves anything
    //   hub-operating-expenses    -> the recurring catch-up refused, so this month's rent,
    //                                utilities, insurance and subscriptions never materialised
    //                                and the card read "No recurring bills this month" with the
    //                                bills sitting right there in the seed
    //   ic-prep-batches, lc-pay-periods, profit-fix, r-fix -> silently declined to write
    // Opening the gates changes nothing about persistence: writeData, _writeControl, putEvent,
    // removeEvent and putEventsBulk all return a no-op success for _demo before touching the
    // server, so demo edits still stay in memory for the session and reset on reload. Set BEFORE
    // loadSample so the seed itself is not gated. Fixed at the source rather than at the eight
    // call sites, because the ninth one added later would have the bug again.
    DB._dataReady    = true;
    DB._controlReady = { ic_data: true, lc_data: true, sc_data: true };
    DB._loadDegraded = false;
    this.data          = DB._defaultData();
    this.inventoryData = {};
    this.laborData     = {};
    this.shiftData     = {};
    this.subscription  = { status:'demo', plan:'demo', active_modules:['profit','revenue','cash'], period_end:null };
    await S.HubSettings.loadSample();
    /* ⛔ THE DEMO NEEDS THE SAME CATCH-UP A LOGIN GETS. boot() runs this so "Books reflects them
       even if the operator never opens the Operating Expenses page" — and startDemo skips boot()
       (see the note two lines below). So the Books landing opened on a month missing every
       recurring bill: YTD operating income read $58,742.37 against a true $25,866.37, the month
       $26,420.19 against $9,982.19, and it silently corrected itself the moment the visitor
       wandered into Operating Expenses, which renders and calls this.
       ⚠ It goes AFTER loadSample: App.data does not exist until the seed lands, so a call above
       this would generate nothing and leave the bug looking fixed. The gate half was already
       handled — the _dataReady note above was written for exactly this catch-up refusing — but
       nothing ever called it. Pinned by verify-books-other-and-demo-catchup.js. */
    // ⛔ The recurring catch-up ran here at boot and MINTED expense rows. Deleted with
    // the generator (Phase 3 item 16) — a schedule is a forecast input, never a written record.
    /* ⛔ AND THE SAME GOES FOR THE FIX BASELINES — I MADE THE EXACT MISTAKE THE NOTE ABOVE
       DESCRIBES, ONE SESSION AFTER READING IT. `_startFixBaselines` was added to the account
       load routine so "recovered so far" stops depending on visiting the Fix screen. startDemo
       skips boot(), so on the DEMO the cockpit went straight back to reading $5,026 until the
       visitor wandered into Profit Fix, then jumped to $9,869 — the original defect, live, on
       the build every prospective customer sees. MEASURED after the fix shipped: baselines 0,
       profit $5,026; calling it by hand -> baselines 11, profit $9,869.
       Same placement rule as the catch-up directly above: AFTER loadSample, because App.data
       does not exist until the seed lands. Pinned by verify-profit-walk-fixes P1h/P1i. */
    try { this._startFixBaselines(); }
    catch (e) { console.error('demo fix-baseline start', e); }
    this._mountDemoBanner();
    this.showHub();
    this._wireChrome();   // demo skips boot(), so wire the top-nav (i-help, logo, mobile menu) here
    this._showDemoWelcome();
    this._pingDemoVisit();
  },

  // Fire-and-forget demo counter. A random id in localStorage marks the browser,
  // so DISTINCT ids = individual visitors and rows = demo views. Demo only: no
  // account, no personal data, no IP. Never blocks or breaks the demo.
  _pingDemoVisit() {
    try {
      let vid = localStorage.getItem('bc_demo_vid');
      if (!vid) {
        vid = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
            : String(Date.now()) + Math.random().toString(16).slice(2);
        localStorage.setItem('bc_demo_vid', vid);
      }
      fetch('/api/demo-visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vid: vid, ref: document.referrer || '' })
      }).catch(() => {});
    } catch (e) { /* a counter must never break the demo */ }
  },

  // One-time welcome overlay on demo landing. Dimmed background like onboarding,
  // orients the visitor (nothing saves, nothing breaks), points at Run It On My Bar,
  // and closes on Dig In (or clicking the backdrop).
  _showDemoWelcome() {
    const m = document.createElement('div');
    m.id = 'demo-welcome';
    m.style.cssText = 'position:fixed;inset:0;background:var(--overlay);z-index:9600;display:flex;align-items:center;justify-content:center;padding:24px;';
    m.innerHTML = '<div style="background:var(--surface);border:1px solid var(--b-edge);border-radius:10px;padding:32px 30px;max-width:460px;text-align:center;box-shadow:0 8px 24px var(--panel-shadow);">'
      + '<div style="margin-bottom:14px;"><img src="assets/logo.png" alt="Bar Cop" style="height:30px;"/></div>'
      + '<div style="font-size:18px;font-weight:800;color:var(--w);margin-bottom:12px;">Welcome to the Bar Cop Live Demo</div>'
      + '<div style="font-size:13.5px;color:var(--t2);line-height:1.7;margin-bottom:24px;">This is a real bar loaded with real numbers, so you can see exactly how Bar Cop runs the place. Open any section, run an audit, change a price, count some stock, change whatever you want. Nothing here saves and nothing breaks. When you are ready to run your own place, hit <b style="color:var(--gold);">Run It On My Bar</b> down in the corner. Now go dig around.</div>'
      + '<button class="btn btn-primary" id="demo-welcome-go" style="width:100%;padding:14px 20px;font-size:12px;">Dig In</button>'
      + '</div>';
    document.body.appendChild(m);
    const close = () => m.remove();
    m.querySelector('#demo-welcome-go').addEventListener('click', close);
    m.addEventListener('click', e => { if (e.target === m) close(); });
  },

  // ── DEMO READ-ONLY LOCK (SET-2) ────────────────────────────────────────────────────────
  // App Settings is visible in the demo so a prospect can see what they would be buying, and
  // none of it can be changed. This is LAYER 1 OF TWO, and it exists so a visitor never fills
  // in a form and gets refused afterwards ([[the-loop]] #78: a check that CAN run before the
  // work MUST run before the work). LAYER 2 is App.demoBlock() inside each write handler, and
  // it is not optional — a re-render rebuilds a disabled button ENABLED ([[the-loop]] #85), so
  // the disabled attribute can only ever be the courtesy, never the guard.
  //
  // ⚠ NAVIGATION IS DELIBERATELY NOT LOCKED. The Settings overview moves the visitor around
  // the section with data-act buttons ("Edit", "Manage", "Export or Restore"); disabling those
  // would turn the tour into a dead end, which is the opposite of the point.
  //
  // ⚠ `disabled` and not `pointer-events:none` — that property is pointer hit-testing only and
  // leaves the field fully writable by keyboard ([[the-loop]] #92).
  demoLockScreen(container) {
    if (!this.demoMode || !container) return;
    const NAV = ['data-act', 'data-hub-action', 'data-go'];
    const nodes = container.querySelectorAll('input, select, textarea, button') || [];
    Array.prototype.forEach.call(nodes, (el) => {
      if (el.hasAttribute && NAV.some(a => el.hasAttribute(a))) return;
      el.disabled = true;
      if (el.setAttribute) el.setAttribute('aria-disabled', 'true');
      if (el.style) { el.style.cursor = 'not-allowed'; el.style.opacity = '0.55'; }
    });
    // ⚠ NO BANNER HERE. A read-only note used to be inserted at the top of every locked screen;
    // Kyle cut it as noise (2026-08-01). The disabled controls plus the global demo bar carry
    // it, and a visitor who presses something anyway still gets App.demoBlock()'s notice.
  },

  _mountDemoBanner() {
    if (document.getElementById('demo-banner')) return;
    document.body.classList.add('demo');
    const style = document.createElement('style');
    style.id = 'demo-css';
    style.textContent =
      // Slim, always-visible bar pinned to the BOTTOM. The app shrinks by its height
      // so the last content never hides behind it and the sticky top nav is untouched.
      'body.demo #app{height:calc(100vh - 40px);}'
      + 'body.demo #hub-wrapper{bottom:40px !important;}'
      // SET-2: App Settings is VISIBLE in the demo (read-only), so nothing here hides its door. A
      // prospect who cannot find Business Profile, Team Members or Data and Backup has no way
      // to know Bar Cop has them. App.demoLockScreen disables the controls; each write handler
      // still refuses on its own (see there — a disabled button is not a guard).
      // ⚠ THE DOOR IS THE RAIL ROW. This line used to read "so the gear stays"; the gear existed
      // for one push (2026-08-24) and the sentence outlived it by minutes, which is the whole
      // reason a comment naming a specific CONTROL is worth less than one naming the property.
      + 'body.demo #signout-btn,body.demo #hub-signout{display:none;}'   // no account to sign out of in the demo; visitor just closes the tab
      + '#demo-banner{position:fixed;bottom:0;left:0;right:0;height:40px;z-index:200;'
      + 'display:flex;align-items:center;gap:14px;padding:0 16px;background:#1E2B34;'
      + 'color:var(--w);box-shadow:0 -2px 8px rgba(0,0,0,0.45);}';
    document.head.appendChild(style);
    const bar = document.createElement('div');
    bar.id = 'demo-banner';
    bar.innerHTML = '<span style="font-size:12px;font-weight:700;letter-spacing:0.03em;">Bar Cop Live Demo</span>'
      // The demo seeds the CURRENT week whole (all 7 days of sales, hours and shifts)
      // so the close reads like a finished week. Part of that week is still ahead of
      // today, so say so plainly rather than let a visitor find a Saturday already
      // closed and wonder what else is invented. See the note by `dateStr` in the seed.
      + '<span style="flex:1;min-width:0;font-size:11px;color:rgba(255,255,255,0.45);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'
      +   'For demo purposes this week\'s data runs through the full week, ahead of today. Everything else is real math on real records.'
      + '</span>'
      /* ⛔ "RUN IT ON MY BAR", NOT "GET STARTED", AND THE DIFFERENCE IS WHERE THE VISITOR IS
         STANDING (Kyle, 2026-09-05). This button is pressed from INSIDE somebody else's bar, and
         the move it names is the whole point of the demo: take what you are looking at and put it
         on yours. "Get started" from inside a working demo is limp — started with what?
         ⚠ AND IT MUST NOT MATCH THE PRICING PAGE'S BUTTON. This lands on /pages/pricing, whose own
         CTA is "Get Started". Same words twice in one funnel reads as the first press not working,
         which is the collision that ruled out "Get Bar Cop" (the header nav already owns it). */
      + '<button id="demo-signup-btn" class="btn btn-primary btn-sm" style="flex-shrink:0;">Run It On My Bar</button>';
    document.body.appendChild(bar);
    document.getElementById('demo-signup-btn').addEventListener('click', () => { window.location.href = 'https://www.barcop.com/pages/pricing'; });
  },

  // The public demo is fully functional EXCEPT App Settings (a visitor can't
  // rename the sample bar and brand exported PDFs) and the two forms that email
  // us (Report a Bug / Contact Support). Called from those entry points. Pass
  // {title, body} to override the copy; defaults to the Settings message.
  // Returns true (and shows a sign-up notice) when blocked in demo, false else.
  demoBlock(opts) {
    if (!this.demoMode) return false;
    opts = opts || {};
    // ⚠ THE DEFAULT CHANGED WITH SET-2 AND HAD TO. It read "Settings Is Off in the Demo" from
    // the days when the whole section was blocked at the door — so once Settings became visible,
    // that box told a visitor the page was off while they were looking straight at it
    // ([[copy-matches-app]]). The default now only ever fires from a Settings WRITE handler;
    // Report a Bug and Contact Support pass their own title/body and are genuinely off.
    const title = opts.title || 'Settings Is Read-Only in the Demo';
    const body  = opts.body  || 'Look around every Settings page you like. Changing them takes your own bar, with your own numbers in it.';
    const m = document.createElement('div');
    m.style.cssText = 'position:fixed;inset:0;background:var(--overlay);z-index:9500;display:flex;align-items:center;justify-content:center;padding:24px;';
    m.innerHTML = '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:8px;padding:30px;max-width:430px;text-align:center;">'
      + '<div style="font-size:15px;font-weight:800;color:var(--w);margin-bottom:10px;">' + esc(title) + '</div>'
      + '<div style="font-size:13px;color:var(--t2);line-height:1.65;margin-bottom:22px;">' + esc(body) + '</div>'
      + '<button class="btn btn-primary" id="demo-go" style="width:100%;">Run It On My Bar</button>'
      + '<button class="btn btn-ghost btn-sm" id="demo-stay" style="margin-top:10px;">Keep Exploring</button>'
      + '</div>';
    document.body.appendChild(m);
    m.querySelector('#demo-go').addEventListener('click', () => { window.location.href = 'https://www.barcop.com/pages/pricing'; });
    m.querySelector('#demo-stay').addEventListener('click', () => m.remove());
    m.addEventListener('click', e => { if (e.target === m) m.remove(); });
    return true;
  },

  // Wire the shared shell chrome (sidebar collapse, top-nav help/logo/date, and
  // the mobile off-canvas nav). Called by boot() AND startDemo() — the demo
  // renders through showHub() and skips boot(), so without this the demo's top
  // nav (the "i" help button especially) has no click handlers. Uses .onclick
  // assignment so repeated calls never stack handlers.
  _wireChrome() {
    const toggleBtn = document.getElementById('sidebar-toggle');
    if (toggleBtn) toggleBtn.onclick = () => {
      document.getElementById('app').classList.toggle('sidebar-collapsed');
    };
    /* ⛔ The `#tn-collapse` handler is gone with the class. There is no such element in the markup
       (measured: 0 in index.html), the lookup was guarded, so it silently wired nothing — and what
       it toggled was `sidebar-collapsed` on #app, the OLD sidebar collapse that the rail's own
       toggle replaced in stage 5. Dead wiring for a dead button for a dead mode. */
    const tnBurger = document.getElementById('tn-mobile-burger');
    if (tnBurger) tnBurger.onclick = () => App.openMobileNav();
    /* ⛔ THE TOP BAR'S SETTINGS GEAR IS GONE AGAIN (Kyle, 2026-08-24, one push after asking for it:
       *"the gear icon in the top bar between the i help and the rail button needs removed.. it only
       stays on rail menu"*). The LOOKUP GOES WITH THE MARKUP THIS TIME. Leaving it was defensible
       once — a guarded `getElementById` for a node that does not exist is silent — and it is exactly
       what made the gear "need no new code" when it came back, which reads like a feature and is
       really a leftover sitting there looking load-bearing ([[the-loop]] #149: a cleanup is judged
       by what it leaves behind looking like). Settings has two doors now, the rail row and the
       phone's burger drawer, and both still call `_openSettingsForRole()`. */
    const tnHelp = document.getElementById('tn-help');
    if (tnHelp) tnHelp.onclick = () => this.openPageHelp();
    /* ⛔ THE TOP-BAR DATE IS GONE. Kyle, 2026-08-10: *"still need to remove the date from the main
       header."* It lives on the Hub now, beside the greeting, where it anchors "as of when" for every
       comparison on that page. On every OTHER page it was chrome nobody reads.
       ⚠ The setter goes WITH the markup. A live `getElementById` against a span that no longer
       exists is silent, so this would have sat here forever looking load-bearing ([[the-loop]] #149
       — a cleanup is judged by what it leaves behind looking like). The style.css rule went too;
       nothing else used that class.
       ⚠⚠ AND THIS COMMENT DELIBERATELY DOES NOT SPELL THE OLD ID. A sweep in
       `verify-rail-menu-overlay` asserts the id is absent from app.js, and my first version of this
       note QUOTED it — so the sweep counted its own explanation and reported the id as still live.
       Third time this session that a census read prose as code ([[harness-review-like-code]] #139). */
    // Two logo slots now, and BOTH must go to the Hub: the rail's (desktop) and the top bar's
    // (mobile, where the rail is hidden). A querySelector for the first `.tn-logo` would have wired
    // only one of them and the other would have looked identical and done nothing.
    document.querySelectorAll('.tn-logo, #rail-logo-img').forEach(el => {
      el.style.cursor = 'pointer'; el.title = 'Go to The Hub'; el.onclick = () => this.showHub();
    });
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
  },

  /* ⛔⛔⛔ WHO OWES A PASSWORD. Kyle found this by logging into his own main account on 2026-08-14
     and landing on "Finish Setting Up", with no Sign Out on the screen and its only button set to
     overwrite his bar's profile.
     THE CAUSE WAS A REUSED FIELD. The gate read `created_via === 'stripe_checkout' && !password_set`.
     `password_set` was invented the day before; `created_via` was not. The webhook has stamped it
     on every account it provisions since at least 2026-05-18 — measured on his own user, created
     that day and carrying it — so the gate read "the webhook made this account" as "this account
     has never had a password" and captured EVERY customer provisioned before the finish screen
     existed. A field's meaning belongs to the code that already writes it, not to the feature that
     borrows it later.
     ⭐ `needs_password` means one thing and is written in exactly one place: `provisionFromSession`,
     on create, for an account that is being made without a password. A historical account cannot
     carry it, so it cannot be captured. `DB.setPassword` clears it wherever a password is set.
     ⚠ `password_set` is still honoured so the accounts that DID go through yesterday's finish
     screen stay released — releasing is the safe direction, trapping is not. */
  _needsPasswordSetup(meta) {
    const m = meta || {};
    return m.needs_password === true && !m.password_set;
  },

  boot() {
    // A no-subscription account still boots (create account + onboarding are the
    // free tier). The Hub then shows the locked "Choose your plan" popup via
    // enforcePaywall(), and the database blocks all operational data until the
    // subscription is active, so an unpaid account is a hollow shell either way.
    document.getElementById('auth-screen').style.display = 'none';
    // A just-paid new bar carries its onboarding entries in localStorage across
    // the Stripe return; apply them to this bar before the onboarding gate below.
    this._applyPendingNewBarDraft();
    this.updatePeriod();
    // Recurring operating expenses: fill in any elapsed months on load so Books
    // reflects them even if the operator never opens the Operating Expenses page.
    // ⛔ Second boot-time catch-up call, deleted with the generator (Phase 3 item 16).
    this._wireChrome();
    // Every member (Staff/Viewer included) lands on the real Hub. Sections a
    // member can't access are shown in place but blanked + gated with a friendly
    // no-access notice (see S.Hub.render + App.showNoAccess), so there is no
    // separate simplified landing anymore.
    /* ⭐⭐ THREE CASES NOW, NOT TWO (Kyle's merged signup form, 2026-08-12).
       The signup form collects the bar's basics and service periods on the SAME screen as the
       account, so a brand-new signup arrives here already answered. `_signupDraft` is the hand-off:
       the form could not write these itself because `App.data.settings` does not exist until
       `loadAllData()` runs, which is the line above this one.
       ⛔ ONBOARDING IS NOT DEAD AND MUST NOT BE. It still runs for (a) any existing account that
       never finished it, and (b) Add Another Bar, which mounts it with {newBar:true} and saves
       NOTHING — the bar is created only after payment. Deleting it would take that path with it. */
    /* ⛔⛔ AN ACCOUNT PROVISIONED FROM A PAID CHECKOUT HAS NO PASSWORD YET, AND THAT FACT HAS TO
       LIVE ON THE ACCOUNT, NOT IN A VARIABLE. Kyle walked this on 2026-08-13 and landed on ordinary
       onboarding: `_finishMode` is in memory, so a reload, a closed tab or a second visit loses it.
       Plain onboarding never asks for a password — so the customer would finish it, reach the Hub,
       and have NO WAY BACK IN, with nothing having told them. That is the worst end state this
       whole rebuild exists to prevent, reached by pressing F5.
       ⭐ `provisionFromSession` already stamps `created_via: 'stripe_checkout'` on every user it
       creates, so the marker was there before this bug was. Read it here, clear it when a password
       is actually set, and the finish screen becomes unskippable however the operator arrives.
       ⚠ It is checked BEFORE onboarding on purpose: the finish screen already asks everything
       onboarding does, so sending them to onboarding first would ask twice and still leave them
       without a password. */
    const _meta = (window.DB && DB._user && DB._user.user_metadata) || {};
    if (this._needsPasswordSetup(_meta)) {
      this._showFinishSetup(DB._user.email);
      return;
    }
    if (!this.data.settings.onboarding_complete) {
      if (this._signupDraft) this._applySignupDraft();
      else Onboarding.start();
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
    bar.textContent = 'Viewer access, read-only';
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
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9500;background:#1E2B34;'
      + 'color:var(--w);display:flex;align-items:center;gap:14px;padding:9px 18px;'
      + 'font-size:12px;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,0.45);';
    bar.innerHTML = '<span style="flex:1;">Changes you saved on this device while offline have not reached the server yet.</span>'
      + '<button id="sync-now" class="btn btn-primary btn-sm" style="flex-shrink:0;">Sync Now</button>'
      + '<button id="sync-later" class="btn btn-ghost btn-sm" style="flex-shrink:0;">Later</button>';
    document.body.appendChild(bar);
    document.getElementById('sync-later').onclick = () => bar.remove();
    document.getElementById('sync-now').onclick = async () => {
      const btn = document.getElementById('sync-now');
      btn.disabled = true; btn.textContent = 'Syncing...';
      const r = await DB.syncPending();
      // Gated on the queue being EMPTY, not merely on nothing having thrown. syncPending skips a
      // store when the account has not finished loading, and that skip counts no failure — so
      // this branch used to fire, say "All offline changes are synced", and take the banner away
      // while every queued change was still sitting there.
      if (r.ok && !r.remaining) {
        bar.innerHTML = '<span style="flex:1;">All offline changes are synced.</span>';
        setTimeout(() => bar.remove(), 2500);
      } else {
        btn.disabled = false; btn.textContent = 'Retry';
        const span = bar.querySelector('span');
        // THREE outcomes, not two. A run that skipped everything because the account was still
        // loading is not a connection problem, and saying it is sends the operator off checking
        // their wifi for something that will fix itself in seconds.
        // `r.failed || r.error`, not `r.failed` alone. syncPending's two EARLY returns — not
        // connected, and no account membership — both carry failed: 0, so branching on failures
        // alone told a genuinely offline tablet "your account is still loading" and to wait for
        // something that will never resolve. An offline boot never resolves an account id, so
        // that is the COMMON path here, not an edge case. Only a run that skipped because the
        // load had not finished gets the loading message.
        if (span) span.textContent = this._syncMsgFor(r);
      }
    };
  },

  // What to tell the operator after a Sync Now that did not fully drain. THREE outcomes, and
  // getting any of them wrong sends them after the wrong thing.
  // ⚠ Extracted from inside the Sync Now click handler ON PURPOSE (S10). Buried in that closure
  // the only way to test it was a regex over the source, and that regex passed a mutation that
  // gutted the branch — because the strings it matched still appeared in the message text. A pure
  // function can be lifted and RUN, so the assertion is on the sentence the operator actually
  // reads. Message logic that cannot be executed is message logic that is not tested.
  _syncMsgFor(r) {
    r = r || {};
    // A REFUSED change is not a connection problem. Saying "check your connection" about an RLS
    // denial sends the operator chasing something that will never resolve — that message is what
    // made S10 a permanent trap. A refused change is quarantined after DB._MAX_SYNC_ATTEMPTS: it
    // stops blocking a restore, it is never deleted, and it is waiting in Settings.
    if (r.stuck) {
      return r.stuck + ' change' + (r.stuck === 1 ? '' : 's') + ' could not be saved to the server '
        + 'and ' + (r.stuck === 1 ? 'is' : 'are') + ' waiting for you in Settings > Backup & Restore. '
        + 'Nothing has been lost. Everything else is synced.';
    }
    // ⚠ ON THE SYNC PATH, 'No account membership' is DELIBERATELY treated as a connection problem,
    // and this must NOT be "fixed" to a reload message the way _writeFailMsg was (S171 tried that
    // and it was wrong). The two paths differ for a real reason: a WRITE queues first when offline
    // (db.js:1557), so its membership error means genuinely-no-membership → reload. But syncPending
    // only catches offline via `!_sb || !_user` (db.js:813); a CACHED SESSION while offline has
    // both truthy and falls through to the membership branch (db.js:819) because _ensureAccountId
    // can't reach the server. On the sync path — which only runs when there are queued OFFLINE
    // changes — that is the COMMON case, and "check your connection" is the right remedy (reloading
    // offline would not help). So the membership error falls into the connection branch below on
    // purpose. Pinned by verify-sync-reports-truth.js.
    if (r.failed || r.error) {
      return 'Still cannot reach the server. Your changes are safe on this device. '
        + 'Try again once you have a connection.';
    }
    return 'Your account is still loading. Your changes are safe on this device — '
      + 'tap Sync Now again in a moment.';
  },

  // Device storage is full and a write could NOT be stored. This is the one failure the app
  // must never swallow: the operator's entry is gone the moment they reload, so say so loudly
  // and keep saying it until the tab is reloaded. DB._lsSafeSet fires this via DB._onStorageFull
  // after it has already tried evicting the disposable pfev_* caches.
  _showStorageFullBanner() {
    if (document.getElementById('storage-full-banner')) return;
    const bar = document.createElement('div');
    bar.id = 'storage-full-banner';
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9600;background:#7F1D1D;'
      + 'color:#fff;display:flex;align-items:center;gap:14px;padding:9px 18px;'
      + 'font-size:12px;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,0.45);';
    bar.innerHTML = '<span style="flex:1;">This device is out of storage, so your last entry could NOT be saved. '
      + 'Write it down before you leave this page. Close other tabs or clear your browser data, then re-enter it.</span>'
      + '<button id="storage-full-dismiss" class="btn btn-ghost btn-sm" style="flex-shrink:0;color:#fff;border-color:#fff;">Dismiss</button>';
    document.body.appendChild(bar);
    const btn = document.getElementById('storage-full-dismiss');
    if (btn) btn.onclick = () => bar.remove();
  },

  // The session died and writes are no longer reaching the server. Deliberately NOT the same
  // banner as the offline one: offline says "this will sync on its own", which is true for a
  // dropped connection and a lie for a dead session — the replay needs the very session that
  // expired, so it can never drain until the operator signs in. Their work is queued and safe,
  // so this asks rather than alarms, and stays up until auth is genuinely restored.
  _showSessionExpiredBanner() {
    if (document.getElementById('session-expired-banner')) return;
    const bar = document.createElement('div');
    bar.id = 'session-expired-banner';
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9650;background:#7A5B16;'
      + 'color:#fff;display:flex;align-items:center;gap:14px;padding:9px 18px;'
      + 'font-size:12px;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,0.45);';
    bar.innerHTML = '<span style="flex:1;">You have been signed out. '
      + 'What you entered is held on this device and will save when you sign back in.</span>'
      + '<button id="session-expired-signin" class="btn btn-primary btn-sm" style="flex-shrink:0;">Sign In</button>';
    document.body.appendChild(bar);
    const btn = document.getElementById('session-expired-signin');
    if (btn) btn.onclick = () => window.location.reload();   // reload lands on the auth screen; the queue survives in localStorage
  },
  _hideSessionExpiredBanner() {
    const el = document.getElementById('session-expired-banner');
    if (el) el.remove();
  },

  // ── Offline sync lifecycle ──────────────────────────────────────────────────
  // Three pieces wired once at init time:
  //   Fix A — offline indicator pill while navigator.onLine is false
  //   Fix B — auto-fire syncPending() on the online event
  //   Fix C — surface the sync banner the moment a write lands in the pending
  //           queue (rather than waiting for next page reload)
  _wireSyncLifecycle() {
    // DB has no UI of its own; give it the one callback it needs so a refused localStorage
    // write reaches the operator instead of only console.warn.
    DB._onStorageFull = () => this._showStorageFullBanner();
    if (DB._storageFull) this._showStorageFullBanner();   // fired before this wired up
    DB._onAuthExpired  = () => this._showSessionExpiredBanner();
    DB._onAuthRestored = () => { this._hideSessionExpiredBanner(); this._autoSync(); };
    if (DB._authExpired) this._showSessionExpiredBanner();
    // A bar tablet sits on one screen all shift and the tab sleeps. Don't wait for the operator
    // to lose a save before telling them: the moment the tab wakes, confirm the session is still
    // real. getSession() also gives supabase-js a chance to refresh, so a recoverable session
    // just quietly recovers and nothing is shown.
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState !== 'visible' || !this.data) return;
      try {
        const live = await DB.hasLiveSession();
        if (!live) DB._flagAuthExpired('tab-wake'); else DB._clearAuthExpired();
      } catch (e) {}
    });
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
        + 'background:#1E2B34;color:var(--w);border-radius:3px;padding:7px 16px;'
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
    // ⚠ A NEW VIEW IS GOING UP, SO BUMP THE MOUNT TOKEN (S70). Only navigate() and
    // openHubFullPage() used to bump, but this replaces the whole view — so a background write
    // that captured its token before the operator came back to the Hub still looked CURRENT and
    // could repaint the screen they had just left. Deliberately AFTER the overlay-close early
    // return above, which closes a modal over an already-rendered dashboard and is not a takeover.
    ++this._mountSeq;
    this._dismissWriteFail();       // the old screen's failure message must not follow it here (S3)
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
    // The Hub is the one page with no topbar-title to mirror, so it names itself. Without this the
    // bar kept the last section's page name after coming home.
    this._syncPageTitle('The Hub');
    this.renderAccountSwitcher();
    this._recordLocation({ mode: 'hub', module: null, screen: 'hub', label: 'Hub' });
    this.enforcePaywall();   // no active subscription → locked "Choose your plan" popup over the Hub
    this.maybeShowWelcome(); // first Hub load after payment → one-time "You're All Set" popup
  },

  // ── Subscription gate (in-app "Choose your plan" popup over the Hub) ──────────
  // A no-subscription account boots into the free tier (create account +
  // onboarding) and lands on the Hub with this popup. It can't be dismissed via
  // the UI, and the database blocks all operational data until the subscription
  // is active, so an unpaid account is a hollow shell until they pay. On payment
  // the popup clears and the data unlocks. Demo bypasses.
  enforcePaywall() {
    if (this.demoMode) return;
    const s = this.subscription && this.subscription.status;
    // 'trialing' is a live, usable bar (db.listMyAccounts treats it as active too) — do
    // not throw the "Subscription Inactive" gate over a customer mid-trial.
    if (s === 'active' || s === 'unknown' || s === 'trialing') { this._removePlanGate(); return; }
    // Pass the status through so the gate can tell a brand-new signup apart from
    // a returning customer whose subscription lapsed (past due / cancelled).
    /* ⛔ THE GATE IS BUILT IN ITS FINAL MODE ONCE. An earlier version rendered the picker here and
       let _maybeAutoCheckout replace it with the connecting cover a moment later — which paints,
       for a frame or two, the very "choose your plan" screen this whole piece exists to stop
       showing. ONE decision, ONE render: `_autoCheckoutPlan` answers "is this going straight to
       payment", and both this line and the call below ask it, so they can never disagree. */
    const auto = this._autoCheckoutPlan(s);
    this.showPlanGate({ status: s, plan: this._urlPlan, connecting: !!auto });
    this._maybeAutoCheckout(s);
  },

  /* The one predicate that decides whether a carried plan goes straight to payment. Read by
     enforcePaywall (to pick the gate's mode) and by _maybeAutoCheckout (to act), so there is no
     second copy of the rule to drift.
     ⛔ TWO INDEPENDENT REFUSALS FOR A FAILED CARD, ON PURPOSE. past_due/unpaid is excluded by its
     own line AND by the positive inactive/incomplete test, so deleting either one still refuses
     them. That defence in depth used to come for free — the old design pressed the gate's own
     button, and for past_due that button opens the billing portal rather than a checkout — and the
     redesign took it away. Selling a second subscription to someone whose card just bounced, beside
     the one already billing, is the worst outcome this function has. */
  _autoCheckoutPlan(status) {
    if (!this._urlPlan) return null;
    if (status === 'past_due' || status === 'unpaid') return null;
    if (status !== 'inactive' && status !== 'incomplete') return null;
    if (document.getElementById('checkout-modal')) return null;   // already on the payment sheet
    return this._urlPlan;
  },

  /* ⭐ PIECE A PART 3 — A CARRIED PLAN GOES STRAIGHT TO PAYMENT.
     ⛔⛔ THE GATE IS RAISED FIRST AND THIS RUNS SECOND. Opening checkout INSTEAD of the gate was
     the obvious shape and it is wrong three ways, all of them written in `openEmbeddedCheckout`'s
     own comment: its Cancel "closes the modal and leaves the plan gate underneath ready to retry",
     which is only true if something put a gate there. Without it, cancelling at Stripe lands on an
     unlocked Hub with no way to pay at all; a failed `startCheckout` has no `#gate-err` to write
     into; and the async gap between here and the payment sheet leaves the Hub exposed and
     clickable. The gate costs nothing underneath — checkout sits at z-index 9800 over its 9700 —
     and it turns every failure path back onto the recovery surface that already works.
     ⛔ WHO IS NEVER HANDED A PAYMENT SHEET, identified POSITIVELY and never by exclusion (the same
     rule showPlanGate states for its account-deleting Start Over):
       · past_due / unpaid — they HAVE a plan and a bounced card. The billing portal is the answer;
         a fresh subscription sheet here is how a SECOND subscription gets minted beside the one
         that is already billing.
       · canceled / paused — a real account with real data, told "your data is safe and waiting".
         An automatic payment form over that is a sales pitch, not a recovery surface.
       · anything Stripe adds later — falls through to the gate, which is the safe branch.
     ⛔ CONSUME-ONCE, CLEARED BEFORE THE CALL. `enforcePaywall` runs at the end of EVERY `showHub`,
     so without this, cancelling at Stripe and going Home would re-open the payment sheet and the
     operator could never reach their own Hub to sign out. Same discipline as `_applySignupDraft`.
     ⭐⭐ IT PRESSES THE GATE'S OWN BUTTON RATHER THAN RE-IMPLEMENTING IT, and that is the whole
     design. The first version of this called `startCheckout` itself and hand-copied everything
     around it: the 'Going to checkout...' label, the disable-and-restore, the `#gate-err` routing.
     Three copies of one behaviour — the exact drift class this codebase keeps paying for, written
     directly underneath a comment of mine warning about it. Driving the real control means the
     plan, the label, the busy state, the error surface and the past-due branch all stay in ONE
     place, and anything added to that handler later is inherited here for free.
     ⚠ WHICH MAKES THE PRESELECTION LOAD-BEARING, not cosmetic: the handler bills whatever option
     carries `.plan-selected`, so the carried plan reaches Stripe ONLY because showPlanGate opened
     on it. Those two halves are pinned together, end to end, by verify-paywall-auto-checkout.js
     block B — a press that bills the wrong plan is the failure this is most exposed to. */
  _maybeAutoCheckout(status) {
    const plan = this._autoCheckoutPlan(status);
    if (!plan) return;
    this._urlPlan = null;                                    // consume BEFORE anything can re-enter

    /* The gate is ALREADY on screen in connecting mode — enforcePaywall built it that way off the
       same predicate. Nothing is re-rendered here, so the picker never paints even for a frame. */

    const restore = (msg) => {
      this._removePlanGate();
      this.showPlanGate({ status: status, plan: plan });
      if (msg) {
        const e = document.getElementById('gate-err');
        if (e) { e.textContent = msg; e.style.display = 'block'; }
      }
    };
    /* Two different moments, and conflating them was the trap: FAILING TO OPEN must put the picker
       back once, and CANCELLING at Stripe must also put it back — but the second happens after the
       first has already succeeded. One shared "settled" flag would have let a successful open
       silence the cancel handler, leaving the operator on a cover reading "one moment" forever. */
    let phase = 'opening';
    let guard = null;
    const failOpen = (msg) => {
      if (phase !== 'opening') return;
      phase = 'done';
      if (guard) clearTimeout(guard);
      restore(msg);
    };
    /* ⛔ A HUNG FETCH NEVER SETTLES. `create-checkout-session` has no timeout, so without this a
       dropped connection strands the operator on a contentless cover with only Sign Out — strictly
       worse than the picker they used to get. The ceiling puts the real gate back. */
    guard = setTimeout(() => failOpen('That took longer than expected. Pick your plan to try again.'), 20000);
    Promise.resolve(this.startCheckout(plan, failOpen, { onCancel: () => restore() }))
      .then(ok => {
        if (ok) { phase = 'open'; if (guard) clearTimeout(guard); }
        else failOpen();
      })
      .catch(() => failOpen('Could not open checkout. Try again, or contact support.'));
  },

  _removePlanGate() { const g = document.getElementById('plan-gate'); if (g) g.remove(); },

  /* ⭐ PIECE A PART 2 — CARRY A PLAN NAMED IN THE URL ACROSS THE SIGNUP.
     ⛔⛔ THIS RUNS AT BOOT RATHER THAN WHERE THE PLAN IS USED, AND THAT IS THE WHOLE POINT.
     `showAuth` runs `history.replaceState({}, '', window.location.pathname)` the moment
     `?signup=1` is present — the marketing site's own deep link — so the query string is GONE
     before the Create Account panel has been filled in, let alone before the plan gate exists.
     `?checkout=success` wipes it a second time at another line. A lazy read at the gate would
     therefore find nothing on every real signup, while reading perfectly correct in review.
     ⚠ HELD IN MEMORY ONLY, matching `_signupDraft` — which is the standing proof that nothing
     reloads between the signup form and `boot()`. A reload in between (an email-confirmation round
     trip) drops the plan and lands the operator on the picker, and that is the RIGHT degradation:
     the picker is the recovery surface and it already works. Persisting it would let a plan from
     one visit attach itself to a different checkout later in the same tab.
     ⛔ AN UNRECOGNISED PLAN IS DISCARDED, NEVER DEFAULTED — defaulting would put someone who
     mistyped a URL into a monthly checkout without ever being shown a price.
     ⚠ THE TWO WORDS ARE INLINE, NOT A SIBLING CONSTANT: a data property beside a member is
     invisible to every slicer in the harness suite, and that class has cost this project three
     times. They are pinned AGAINST the server's own PLAN_PRICES map by verify-url-plan-carry.js
     block D, because two files answering "is this a plan" is precisely where a disagreement hides:
     accept a word the server refuses and the operator gets a 400 at the moment they press pay.
     ⚠ NOTHING ON THE WEBSITE SENDS `?plan=` YET. This is the half that RECEIVES it; it is inert
     until a link carries one, and a plan id is not personal data, so a URL is a fine place for it. */
  _urlPlan: null,
  _captureUrlPlan() {
    try {
      const raw = new URLSearchParams(window.location.search).get('plan');
      const key = (typeof raw === 'string' ? raw : '').trim().toLowerCase();
      this._urlPlan = (key === 'monthly' || key === 'annual') ? key : null;
    } catch (e) { this._urlPlan = null; }
    return this._urlPlan;
  },

  // ── Add Another Bar (unified flow) ───────────────────────────────────────────
  // Kicked off from the User Account page: onboarding (new-bar mode) → plan gate
  // → Stripe → the new bar's Hub. The bar's account is created only at Continue
  // to Payment (a subscription must attach to an existing account), so cancelling
  // anywhere before that leaves nothing behind, and cancelling Stripe discards
  // the just-created bar. Any cancel drops the operator back on User Accounts.
  startAddBar() {
    this._newBarFlow = {
      originAccountId: (window.DB && (DB._accountId || (DB._getStoredActiveAccountId && DB._getStoredActiveAccountId()))) || null
    };
    if (typeof Onboarding !== 'undefined') Onboarding.start({ newBar: true });
  },

  // Create the new bar, stash the onboarding draft for the post-payment return,
  // then open the embedded checkout for it.
  async startNewBarCheckout(plan, draft, onErr) {
    let newId = null;
    // Roll the just-created bar back so ANY failure after creation (a network
    // throw, no client secret, or a checkout that won't mount) leaves nothing
    // behind — otherwise retries stack up orphan unpaid bars.
    const rollback = async () => {
      if (!newId) return;
      try { await fetch('/api/abandon-account', { method: 'POST', headers: await DB._authHeaders(), body: JSON.stringify({ accountId: newId }) }); } catch (e) {}
      try { localStorage.removeItem('newbar_draft_' + newId); } catch (e) {}
      if (this._newBarFlow) this._newBarFlow.accountId = null;
      newId = null;
    };
    try {
      const headers = await DB._authHeaders();
      const r = await fetch('/api/add-account', { method: 'POST', headers, body: JSON.stringify({ name: draft.bar_name }) });
      const data = await r.json();
      if (!r.ok || !data.ok || !data.accountId) { onErr(data.error || 'Could not create the bar. Try again.'); return false; }
      newId = data.accountId;
      try { localStorage.setItem('newbar_draft_' + newId, JSON.stringify(draft)); } catch (e) {}
      if (this._newBarFlow) { this._newBarFlow.accountId = newId; this._newBarFlow.draft = draft; }
      const cr = await fetch('/api/create-checkout-session', { method: 'POST', headers, body: JSON.stringify({ accountId: newId, plan }) });
      const cd = await cr.json();
      if (!cd.clientSecret) { await rollback(); onErr(cd.error || 'Could not start checkout. Try again, or contact support.'); return false; }
      // Don't switch the active bar yet — the Stripe return_url carries the new
      // bar id, so we only land on it after actual payment. A tab-close mid-
      // checkout leaves the operator on their existing bar, not this unpaid one.
      const opened = await this.openEmbeddedCheckout(cd, onErr, { newBar: true });
      if (!opened) { await rollback(); return false; }   // openEmbeddedCheckout already surfaced the error
      return true;
    } catch (e) { await rollback(); onErr('Connection error. Try again.'); return false; }
  },

  // Cancel a new bar after its account was created (Stripe backed out): delete
  // the bar, restore the bar they came from, and return to User Accounts.
  async discardNewBar() {
    const flow = this._newBarFlow || {};
    const newId = flow.accountId || null;
    const origin = flow.originAccountId || null;
    if (newId) {
      try { const headers = await DB._authHeaders(); await fetch('/api/abandon-account', { method: 'POST', headers, body: JSON.stringify({ accountId: newId }) }); } catch (e) {}
      try { localStorage.removeItem('newbar_draft_' + newId); } catch (e) {}
    }
    if (origin && DB._setStoredActiveAccountId) DB._setStoredActiveAccountId(origin);
    await this._returnToUserAccounts();
  },

  // Tear down the new-bar overlays and drop back on the User Account page.
  async _returnToUserAccounts() {
    this._newBarFlow = null;
    const ov = document.getElementById('ob-overlay'); if (ov) ov.classList.add('hidden');
    this._removePlanGate();
    const cm = document.getElementById('checkout-modal'); if (cm) cm.remove();
    document.getElementById('app').classList.remove('hidden');
    this.showHub();
    try { if (window.S && S.HubUserAccounts) await S.HubUserAccounts.open('account'); } catch (e) {}
  },

  // A just-paid new bar carried its onboarding entries in localStorage across the
  // Stripe redirect. Apply them to the now-active bar so it skips onboarding and
  // shows the right name. Persist first, then sync the name + clear the draft
  // (so an early reload re-applies rather than losing the entries).
  _applyPendingNewBarDraft() {
    try {
      const acctId = (window.DB && (DB._accountId || (DB._getStoredActiveAccountId && DB._getStoredActiveAccountId()))) || null;
      if (!acctId) return;
      const raw = localStorage.getItem('newbar_draft_' + acctId);
      if (!raw) return;
      const draft = JSON.parse(raw);
      const s = this.data && this.data.settings;
      if (!draft || !s) { try { localStorage.removeItem('newbar_draft_' + acctId); } catch (e) {} return; }
      if (draft.bar_name) s.bar_name = draft.bar_name;
      if (draft.city_state != null) s.city_state = draft.city_state;
      if (Array.isArray(draft.service_periods) && draft.service_periods.length) s.service_periods = draft.service_periods;
      s.onboarding_complete = true;
      this.saveKey('settings').then(async () => {
        try {
          if (window.DB && DB.setAccountName && s.bar_name) { await DB.setAccountName(s.bar_name); if (this.renderAccountSwitcher) await this.renderAccountSwitcher(); }
        } catch (e) {}
        try { localStorage.removeItem('newbar_draft_' + acctId); } catch (e) {}
      }).catch(() => {});
    } catch (e) { console.error('new bar draft', e); }
  },

  // One-time "You're All Set" celebration, shown on the first Hub load after the
  // subscription goes active (right after payment). Flagged in settings so it
  // never shows again. Demo and unpaid accounts never see it.
  maybeShowWelcome() {
    if (this.demoMode) return;
    if (!this.subscription || this.subscription.status !== 'active') return;
    const s = this.data && this.data.settings;
    if (!s || !s.onboarding_complete || s.welcome_shown) return;
    s.welcome_shown = true;
    this.saveKey('settings');
    this.showWelcome();
  },

  showWelcome() {
    if (document.getElementById('welcome-gate')) return;
    const m = document.createElement('div');
    m.id = 'welcome-gate';
    m.style.cssText = 'position:fixed;inset:0;background:var(--overlay);z-index:9700;display:flex;align-items:center;justify-content:center;padding:20px;';
    m.innerHTML = '<div style="background:var(--surface);border:1px solid var(--b-edge);border-radius:8px;padding:30px;max-width:420px;width:100%;">'
      + '<div style="text-align:center;margin-bottom:14px;"><img src="assets/logo.png" alt="Bar Cop" style="height:30px;"/></div>'
      + '<div style="font-size:15px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--w);text-align:center;margin-bottom:6px;">You\'re All Set</div>'
      + '<div style="font-size:13px;color:var(--t2);text-align:center;line-height:1.5;margin-bottom:18px;">You\'re a Bar Cop member now. This is your Hub. Your setup steps are waiting below. Start with Inventory, then run your first audit to find your biggest money leaks.</div>'
      + '<button class="btn btn-primary" id="welcome-go" style="width:100%;padding:14px 20px;font-size:12px;">Let\'s Go</button>'
      + '</div>';
    document.body.appendChild(m);
    document.getElementById('welcome-go').addEventListener('click', () => m.remove());
  },

  // ctx = { newBar:true, draft } → Add Another Bar (single Cancel, and Continue
  // creates the bar). No ctx → the signed-in account must pay (Start Over / Sign
  // Out exits, Continue bills the current account).
  showPlanGate(ctx) {
    if (document.getElementById('plan-gate')) return;
    const isNewBar = !!(ctx && ctx.newBar);
    const status = (ctx && ctx.status) || '';
    // A returning customer whose subscription lapsed must NOT be greeted like a
    // brand-new signup. past_due/unpaid still HAVE a plan (fix the card via the
    // billing portal). CRITICAL: "Start Over" deletes the account, so it is shown
    // ONLY for a POSITIVELY-identified never-paid new signup — never by exclusion.
    // Any other status (canceled, paused, trialing, or anything Stripe adds later)
    // is a real account with data and falls to the safe, non-destructive branch.
    const isPastDue   = status === 'past_due' || status === 'unpaid';
    // POSITIVELY identify a never-paid signup — a genuinely new account reads 'inactive'
    // (no subscription row). Do NOT include `!status`: an empty/unexpected status must
    // fall to the safe "Subscription Inactive" branch (Sign Out only), never light up the
    // account-DELETING "Start Over" by exclusion. ('unknown' is short-circuited earlier.)
    // A NEW BAR is inherently a never-paid new signup (created only at payment, carries no
    // status), so it always takes the new-signup branch — never the "reactivate" copy. The
    // account-DELETING "Start Over" stays off for it: the button block checks isNewBar first
    // and shows only Cancel.
    const isNewSignup = isNewBar || status === 'inactive' || status === 'incomplete';
    const barName = isNewBar
      ? (ctx.draft.bar_name || '').trim()
      : ((this.data && this.data.settings && this.data.settings.bar_name) || '').trim();
    const nameB = barName ? '<b style="color:var(--t1);">' + esc(barName) + '</b>' : '';
    let heading, bodyHtml;
    if (isPastDue) {
      heading = 'Payment Past Due';
      bodyHtml = (barName ? 'We could not process the last payment for ' + nameB + '. ' : 'We could not process your last payment. ')
        + 'Update your card to keep running Bar Cop. Your data is safe and waiting.';
    } else if (isNewSignup) {
      heading = "You're Almost Ready";
      const acctLine = isNewBar
        ? (barName ? 'Your new bar ' + nameB + ' is set up.' : 'Your new bar is set up.')
        : (barName ? 'Your account for ' + nameB + ' is now set up.' : 'Your account is now set up.');
      bodyHtml = acctLine + '<br>Start your subscription plan for instant access.';
    } else {
      // canceled / paused / trialing / any other non-active status on a real account
      heading = 'Subscription Inactive';
      bodyHtml = (barName ? 'Your subscription for ' + nameB + ' is not active. ' : 'Your subscription is not active. ')
        + 'Start it back up whenever you are ready. Your data is safe and waiting.';
    }
    // past_due keeps its existing plan — send them to the billing portal to fix
    // the card, not back through a fresh plan picker.
    /* ⛔⛔ CONNECTING MODE — Kyle walked the signup and found this: with a plan carried from the
       website, the gate went up showing a full "choose your plan" picker and SAT THERE for several
       seconds while `create-checkout-session` made its round trip, then Stripe's sheet dropped over
       it. So the one screen an operator is shown after answering the price question on the website
       is a screen asking the price question again. His words: "it looks really dumb and confusing".
       In this mode the gate is still the full-screen cover (that is what makes cancel and every
       error land somewhere safe), but it says what is happening instead of asking anything. The
       picker, the pay button and the billing clause are all withheld until there is a reason to
       show them — a refusal, or a cancel — at which point `_maybeAutoCheckout` re-renders the real
       gate over the top. Sign Out stays, so a hung network can never trap anyone here. */
    const connecting = !!(ctx && ctx.connecting);
    const showPicker = !isPastDue && !connecting;
    const primaryLabel = isPastDue ? 'Update Payment Method' : 'Continue to Payment';
    if (connecting) {
      heading = 'Setting Up Your Subscription';
      bodyHtml = 'Opening secure checkout for the <b style="color:var(--t1);">'
        + ((ctx.plan === 'annual') ? 'Yearly' : 'Monthly') + '</b> plan. One moment.';
    }
    const planOpt = (plan, label, note) =>
      '<div class="plan-opt" data-plan="' + plan + '" style="border:1px solid var(--b-edge);background:var(--gold-tint);border-radius:6px;padding:12px 14px;cursor:pointer;font-size:13px;color:var(--t1);display:flex;justify-content:space-between;align-items:center;">'
      + '<span>' + label + '</span>' + (note ? '<span style="font-size:11px;color:var(--gold);">' + note + '</span>' : '') + '</div>';
    const m = document.createElement('div');
    m.id = 'plan-gate';
    m.style.cssText = 'position:fixed;inset:0;background:var(--overlay);z-index:9700;display:flex;align-items:center;justify-content:center;padding:20px;';
    m.innerHTML = '<div style="background:var(--surface);border:1px solid var(--b-edge);border-radius:8px;padding:30px;max-width:420px;width:100%;">'
      + '<div style="text-align:center;margin-bottom:14px;"><img src="assets/logo.png" alt="Bar Cop" style="height:30px;"/></div>'
      + '<div style="font-size:15px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--w);text-align:center;margin-bottom:6px;">' + heading + '</div>'
      + '<div style="font-size:13px;color:var(--t2);text-align:center;line-height:1.5;margin-bottom:18px;">' + bodyHtml + '</div>'
      + (showPicker
          ? '<div id="gate-plan-picker" style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;">'
            /* ⛔ BOTH PLANS ARE PRICED PER MONTH. Setting $87/mo against an $804 annual TOTAL
               makes the cheaper plan read as the expensive one, which is why that comparison came
               off the pricing page — and this gate, the screen a LAPSED customer is recovered on,
               was still running it. $67 is the figure the website toggle and Stripe's own
               checkout page both print, so the three surfaces now say one thing.
               ⚠ REPRICED 2026-09-05: $87/$804 -> $149/$1,488. 149 x 12 = 1,788, so the annual
               saves 300, and 1,488 / 12 = 124.00 exactly. Every figure here is derived from those
               two and moves with them. (It was $189/$1,890 until 2026-08-31 and $87/$804 until
               today; the earlier numbers are history, not a second price.)
               ⛔ THE SAVING IS IN DOLLARS, NEVER "two months free" OR A PERCENTAGE. A ratio claim
               goes false on the next reprice with no number in it for any sweep to catch, which
               is exactly how "two months free" survived the last one ([[pricing-decision]]).
               ⛔ `data-plan` IS THE SERVER'S PLAN ID: only the LABEL is "Yearly". Renaming the
               value sends a plan `planPrice()` does not know and the checkout is refused. */
            +   planOpt('monthly', '<b>Monthly</b> &middot; $149 / month', '')
            +   planOpt('annual',  '<b>Yearly</b> &middot; $124 / month', 'billed annually &middot; save $300')
            + '</div>'
            // In-app billing clause: the terms the operator agrees to by paying. Kept
            // in step with the website Refund Policy (recurring, per bar, auto-renews,
            // cancel stops future charges, current term is non-refundable).
            + '<div style="font-size:10px;color:var(--t3);line-height:1.5;margin-bottom:16px;">'
            +   'Continuing starts a recurring subscription for this bar at the price shown, charged to your card and renewing automatically each billing period until you cancel. You can cancel anytime under Manage Billing; cancellation stops future charges, and the current period is not refunded. See our <a href="' + App.TOS_TERMS_URL + '" target="_blank" rel="noopener" style="color:var(--gold);">Terms of Use</a>.'
            + '</div>'
          : '')
      // No pay button while connecting: there is nothing to press, and a disabled-looking primary
      // button is the "wall of dead controls" this project already learned not to render.
      + (connecting ? '' : '<button class="btn btn-primary" id="gate-pay" style="width:100%;padding:14px 20px;font-size:12px;">' + primaryLabel + '</button>')
      + '<div id="gate-err" style="color:var(--red);font-size:12px;margin-top:10px;display:none;text-align:center;"></div>'
      // ⛔ START OVER IS WITHHELD WHILE CONNECTING. It DELETES the account, and offering a
      // destructive escape beside "one moment" during a payment hand-off is the worst possible
      // pairing. Sign Out is the safe exit and it stays on every branch.
      + (connecting
          ? '<div style="text-align:center;margin-top:18px;"><button class="auth-link" id="gate-signout" style="font-size:11px;">Sign Out</button></div>'
          : isNewBar
          ? '<div style="text-align:center;margin-top:18px;"><button class="auth-link" id="gate-cancel" style="font-size:11px;">Cancel</button></div>'
          : isNewSignup
            ? '<div style="text-align:center;margin-top:18px;font-size:11px;color:var(--t2);">Used wrong email? <button class="auth-link" id="gate-cancel" style="font-size:11px;">Start Over</button>'
              + '<span style="color:var(--b-edge);margin:0 10px;">|</span>'
              + '<button class="auth-link" id="gate-signout" style="font-size:11px;">Sign Out</button></div>'
            : '<div style="text-align:center;margin-top:18px;"><button class="auth-link" id="gate-signout" style="font-size:11px;">Sign Out</button></div>')
      + '</div>';
    document.body.appendChild(m);
    const opts = showPicker ? Array.from(m.querySelectorAll('#gate-plan-picker .plan-opt')) : [];
    const selectOpt = (el) => opts.forEach(o => {
      const on = o === el;
      o.classList.toggle('plan-selected', on);
      o.style.borderColor = 'var(--b-edge)';
      /* ⛔ `--sel-plan-bg`, NOT A LITERAL. This was #1E2B34 written out here AND again in
         `wirePlanPicker` — one value, two copies, kept in step by hand. Kyle moved it to #2E3D4A
         on 2026-09-05 and it is a token now, so the gate and the paywall picker cannot drift.
         ⚠ The other three #1E2B34 uses in this file are a top bar, a fixed banner and a badge.
         They are NOT this colour and must not follow it ([[color-system-locked]]). */
      o.style.background = on ? 'var(--sel-plan-bg)' : 'var(--gold-tint)';
    });
    opts.forEach(o => o.addEventListener('click', () => selectOpt(o)));
    /* ⭐ OPEN ON THE PLAN THEY CHOSE. This is correctness, not polish: with a carried plan the
       payment sheet opens straight over this gate, and cancelling reveals it — so a gate that
       always defaulted to its FIRST option would sit there with Monthly highlighted after an
       ANNUAL checkout was abandoned, one press away from billing the wrong plan. That mis-billing
       path would have been created by the auto-checkout itself.
       ⛔ WITH NOTHING CARRIED IT NOW OPENS ON YEARLY, not on whichever option renders first. Both
       callers pass a plan, so the no-carry case is the signed-in customer whose subscription has
       lapsed — the one audience that reaches this picker cold — and the website's toggle opens on
       Yearly. Opening on Monthly here made the two surfaces disagree about the default. A carried
       plan still beats it, which is the line above and what J5 controls. */
    const wantedOpt = (ctx && ctx.plan) ? opts.filter(o => o.dataset.plan === ctx.plan)[0] : null;
    const defaultOpt = opts.filter(o => o.dataset.plan === 'annual')[0] || opts[0];
    if (wantedOpt || defaultOpt) selectOpt(wantedOpt || defaultOpt);
    const gateErr = (t) => { const e = document.getElementById('gate-err'); if (e) { e.textContent = t; e.style.display = 'block'; } };
    document.getElementById('gate-pay')?.addEventListener('click', async () => {
      const btn = document.getElementById('gate-pay');
      // Past due: the subscription still exists, so open the Stripe billing portal
      // to update the card rather than starting a second subscription.
      if (isPastDue) {
        btn.disabled = true; btn.textContent = 'Opening billing...';
        try {
          const headers = await DB._authHeaders();
          const accountId = await DB._ensureAccountId();
          const r = await fetch('/api/billing-portal', { method: 'POST', headers, body: JSON.stringify({ accountId }) });
          const data = await r.json();
          if (data && data.url) { window.location.href = data.url; return; }
          gateErr('Could not open billing right now. Try again, or contact support.');
        } catch (e) { gateErr('Connection error. Try again.'); }
        btn.disabled = false; btn.textContent = primaryLabel;
        return;
      }
      const sel = m.querySelector('#gate-plan-picker .plan-opt.plan-selected');
      const plan = (sel && sel.dataset.plan) || 'monthly';
      btn.disabled = true; btn.textContent = 'Going to checkout...';
      if (isNewBar) await this.startNewBarCheckout(plan, ctx.draft, gateErr);
      else await this.startCheckout(plan, gateErr);
      // The embedded checkout modal (if it opened) now covers this button, so
      // resetting it is invisible; on cancel the gate is revealed ready to retry.
      btn.disabled = false; btn.textContent = primaryLabel;
    });
    // New bar: Cancel drops back to User Accounts (no account exists yet).
    // Signup: Start Over discards the account and returns to signup. A lapsed
    // account shows neither (only Sign Out) so real data is never abandoned.
    document.getElementById('gate-cancel')?.addEventListener('click', () =>
      isNewBar ? this._returnToUserAccounts() : this.abandonAndRestart());
    // Non-destructive exit (signup only): sign out (account + email kept) and land
    // on the login page. Signing back in re-shows this gate, so they can finish
    // payment later without losing anything.
    document.getElementById('gate-signout')?.addEventListener('click', async () => {
      // Keep the gate up as the cover through the async signOut, then swap to the
      // login screen and only then drop it — so the Hub never flashes uncovered.
      try { await DB.signOut(); } catch (e) {}
      this.showAuth();
      ['auth-login','auth-signup','auth-reset','auth-set-password','auth-paywall'].forEach(x => {
        const el = document.getElementById(x); if (el) el.style.display = (x === 'auth-login') ? '' : 'none';
      });
      this._removePlanGate();
    });
  },

  // Create a Stripe checkout session for the signed-in owner and open the
  // embedded checkout on top of the Hub (no redirect out to Stripe).
  // `ctx` is forwarded straight to openEmbeddedCheckout so a caller can learn about a CANCEL, which
  // is not an error and so never reaches onErr. The auto-checkout needs it: cancelling at Stripe
  // has to put the plan picker back, and nothing else would tell it that happened.
  async startCheckout(plan, onErr, ctx) {
    try {
      const accountId = await DB._ensureAccountId();
      const headers = await DB._authHeaders();
      const r = await fetch('/api/create-checkout-session', {
        method: 'POST', headers, body: JSON.stringify({ accountId, plan })
      });
      const data = await r.json();
      if (data.clientSecret) return await this.openEmbeddedCheckout(data, onErr, ctx);
      onErr(data.error || 'Could not start checkout. Try again, or contact support.');
      return false;
    } catch (e) { onErr('Connection error. Try again.'); return false; }
  },

  // Mount Stripe's embedded checkout inside a Bar Cop modal so payment happens on
  // app.barcop.com instead of a redirect to a Stripe-hosted page. resp carries
  // { clientSecret, publishableKey } from create-checkout-session. On completion
  // Stripe redirects the page to return_url (?checkout=success); Cancel closes
  // the modal and leaves the plan gate underneath ready to retry.
  async openEmbeddedCheckout(resp, onErr, ctx) {
    ctx = ctx || {};
    if (document.getElementById('checkout-modal')) return true;
    if (!resp || !resp.clientSecret || !resp.publishableKey || typeof Stripe === 'undefined') {
      if (onErr) onErr('Could not open checkout. Try again, or contact support.');
      return false;
    }
    const modal = document.createElement('div');
    modal.id = 'checkout-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:var(--overlay);z-index:9800;display:flex;justify-content:center;overflow-y:auto;padding:24px 16px;';
    // margin:auto on a flex child centers it when it fits and falls back to
    // top-aligned + scrollable when the form is taller than the viewport.
    modal.innerHTML = '<div style="background:var(--surface);border:1px solid var(--b-edge);border-radius:8px;padding:20px;max-width:520px;width:100%;margin:auto;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">'
      +   '<img src="assets/logo.png" alt="Bar Cop" style="height:26px;"/>'
      +   '<button class="auth-link" id="checkout-close" style="font-size:12px;">Cancel</button>'
      + '</div>'
      + '<div id="checkout-embed"></div>'
      + '</div>';
    document.body.appendChild(modal);
    try {
      const stripe = Stripe(resp.publishableKey);
      const checkout = await stripe.initEmbeddedCheckout({ clientSecret: resp.clientSecret });
      checkout.mount('#checkout-embed');
      document.getElementById('checkout-close').addEventListener('click', async () => {
        try { checkout.destroy(); } catch (e) {}
        modal.remove();
        // Cancelling a new bar's checkout discards the just-created bar and
        // returns to User Accounts; a normal checkout just reveals the gate.
        // ⛔ ...except when the gate underneath is the CONNECTING cover, which says "one moment"
        // and has no way forward. `onCancel` is how the auto-checkout puts the real picker back.
        if (ctx.newBar) await this.discardNewBar();
        else if (typeof ctx.onCancel === 'function') ctx.onCancel();
      });
      return true;
    } catch (e) {
      modal.remove();
      if (onErr) onErr('Could not open checkout. Try again, or contact support.');
      return false;
    }
  },

  // Discard the just-created unpaid account (frees the email) → fresh signup.
  // Pull the server's refusal message off a non-OK /api/abandon-account response, so the operator
  // sees WHY (a live subscription, or billing could not be confirmed) instead of a silent no-op.
  async _abandonError(resp) {
    try { const d = await resp.json(); return (d && d.error) || 'This account could not be discarded right now.'; }
    catch (e) { return 'This account could not be discarded right now.'; }
  },

  async abandonAndRestart() {
    // Keep the plan gate up as a full-screen cover the whole time. The confirm
    // renders ABOVE it (z 9800) and the gate stays put through the async delete
    // + signout, so the Hub is never exposed or clickable during the hand-off
    // back to signup. The gate only drops once the auth screen is showing.
    const ok = await this.confirm({
      title: 'Discard this account?',
      message: 'This deletes the account you just created and takes you back to the create-account page, in case you want to use a different email before choosing your subscription.',
      confirmText: 'Discard & Start Over', cancelText: 'Keep It', z: 9800
    });
    if (!ok) return;  // gate is still up; nothing to restore
    // The server can REFUSE this delete (a live subscription, or it could not confirm billing). If
    // it does, we must NOT sign out into a fresh signup — the account still exists and may be
    // billing, and signing out here is the "paid twelve seconds ago, clicked Start Over, now signed
    // out with a live subscription and no way back to it" trap. Only proceed on a confirmed delete.
    let refused = null;
    try {
      const headers = await DB._authHeaders();
      const accountId = await DB._ensureAccountId();
      if (accountId) {
        const resp = await fetch('/api/abandon-account', { method: 'POST', headers, body: JSON.stringify({ accountId }) });
        if (!resp.ok) refused = await this._abandonError(resp);
      }
    } catch (e) { refused = 'Could not reach the server. Nothing was changed. Please try again.'; }
    if (refused) {
      const reload = await this.confirm({
        title: 'This account is still active',
        message: refused + ' You have not been signed out. If you just paid, reload to open your account.',
        confirmText: 'Reload', cancelText: 'Stay on this page', danger: false, z: 9900
      });
      if (reload) window.location.reload();
      return;   // gate stays up; the operator is NOT signed out and the account is untouched
    }
    try { await DB.signOut(); } catch (e) {}
    this.showAuth();
    this._removePlanGate();
    ['auth-login','auth-signup','auth-reset','auth-set-password','auth-paywall'].forEach(x => {
      const el = document.getElementById(x); if (el) el.style.display = (x === 'auth-signup') ? '' : 'none';
    });
    ['signup-email','signup-pw1','signup-pw2'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const tos = document.getElementById('signup-tos'); if (tos) tos.checked = false;
    // Reset the signup button — the prior signUp left it "Creating account..."
    // and disabled, and we're navigating back to the form without a reload.
    const sbtn = document.getElementById('signup-btn'); if (sbtn) { sbtn.textContent = 'Create Account'; sbtn.disabled = false; }
    const serr = document.getElementById('signup-error'); if (serr) serr.style.display = 'none';
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
      /* ⛔⛔ THIS ONE STAYS OFF `--overlay`, AND IT IS THE ONE CASE WHERE THE TOKEN IS WRONG.
         I moved it with the other seven and then read what it is for: the comment above says the
         dashboard *"stays visible underneath with a blur filter so the operator never loses their
         context"* — this is a SHOW-THROUGH overlay, not a hide-the-page scrim.
         ⭐ THE ARITHMETIC DECIDES IT, not taste. `--overlay` is rgba(17,23,27,0.88) and the page
         behind is `--bg` #11171B = rgb(17,23,27) — the same three numbers — so the scrim composites
         to EXACTLY `--bg`. The panel it frames is also `--bg`. Panel and backdrop would be the
         identical colour with only a 1px border between them, which is the precise state Kyle
         rejected for the drop-down a day earlier (*"it only read as a menu because of its border"*).
         The blur would be invisible too, so the sentence above would stop being true.
         At 0.55 black the page composites to ~rgb(8,10,12) and the `--bg` panel reads against it.
         ⚠ NAMED, NOT SKIPPED: `verify-design-code` COLOUR-1 exempts it explicitly and COLOUR-1y
         asserts the exemption still names something real, so it cannot rot into a free pass
         ([[lessons-paid-for]] #115). Kyle rules on whether a show-through scrim earns its own token;
         inventing a second one is a design call and design is walked one change at a time. */
      modal.style.cssText = 'position:fixed;inset:0;z-index:200;display:none;align-items:flex-start;justify-content:center;padding:40px 20px;overflow-y:auto;background:rgba(0,0,0,0.55);';
      document.body.appendChild(modal);
      modal.addEventListener('click', (ev) => {
        if (ev.target === modal) this.closeHubOverlay();
      });
    }
    // Build a fresh panel each open so prior content is cleared
    modal.innerHTML = '<div class="hub-modal-panel" style="background:var(--bg);border:1px solid var(--b-edge);border-radius:8px;max-width:920px;width:100%;max-height:calc(100vh - 80px);overflow-y:auto;position:relative;box-shadow:0 8px 24px var(--panel-shadow);"></div>';
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
  //   App.openHubFullPage('Operations Audit', mount => renderFn(mount), 'bar-cop-audit');
  //
  // The third arg is the sidebar action key (data-hub-action) so we can
  // light up the matching nav item. Back to Dashboard re-renders the Hub
  // via App.showHub(), restoring the default topbar (bar name + date) and
  // putting the active state back on "The Hub".
  // ⚠ Bumped on EVERY screen mount, module page or Hub full page. This is the only honest answer to
  // "am I still the screen on the page?", because both mount hosts (#content-area and
  // .hub-app .content) are PERMANENT and merely have their innerHTML replaced — so
  // `container.isConnected` is always true and can never tell a screen it has been navigated away
  // from. Any screen that writes in the background and then re-renders MUST capture this at render
  // time and compare before repainting, or a late write paints it over whatever the operator went
  // to next (a half-entered count sheet, in the worst case found).
  _mountSeq: 0,

  /* `helpOwner` is OPTIONAL and only matters for a page with no `_HUB_HELP` topic: hand in the object
     that owns the page's directions and the "i" reaches them instead of the global FAQ. Every
     existing three-argument caller behaves exactly as it did. */
  openHubFullPage(title, renderFn, activeAction, helpOwner) {
    // Backward-compat: caller can pass just renderFn if title is unused.
    if (typeof title === 'function') { renderFn = title; title = ''; }
    ++this._mountSeq;
    this._dismissWriteFail();       // the old screen's failure message must not follow it here (S3)
    const wrap = document.getElementById('hub-wrapper');
    const wrapVisible = wrap && wrap.style.display !== 'none';
    if (!wrapVisible) this.showHub();
    // Sidebar context: Blueprint (and any 'none' page) keeps the full-width
    // dashboard mode (no sidebar); Operations Audit mounts its own context
    // sidebar; everything else falls back to the default Hub sidebar.
    const _sideCtx = this._HUB_SIDEBAR_OF_ACTION[activeAction] || 'grabbag';
    this._curHubSection = (_sideCtx === 'audit' || _sideCtx === 'books' || _sideCtx === 'settings') ? _sideCtx : null;
    if (_sideCtx === 'none') {
      document.body.classList.add('hub-dashboard');     // full-width, no sidebar
    } else {
      document.body.classList.remove('hub-dashboard');  // a sub-page is open → show the sidebar
      if (window.S && S.Hub && S.Hub.renderSidebar) S.Hub.renderSidebar(_sideCtx);
    }
    /* ⚠ `activeAction` IS ALSO THE BAR'S MARK KEY. A hub page never sets `_currentScreenId`, so
       without it the section links light whatever module screen was open last (see the note on
       `_renderProtoTopnav`). It is the same key the hub sidebar's own row is marked with. */
    this._renderProtoTopnav(this._globalOfAction(activeAction), activeAction);  // highlight this page's rail row
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
    /* ⛔⛔ THE TITLE SYNC BELONGS **AFTER** THAT LINE, AND SITTING ABOVE IT WAS A REAL DEFECT.
       `_syncPageTitle` reads `.nav-item.active .nav-label`, and `setActiveHubNav` is what MOVES that
       class. Called first, it read the PREVIOUS page's row — so Settings pages showed the last
       page's name: Team Members titled "Recovery Targets", the landing titled "Team Members".
       ⚠ The module half never showed it because that side is a MutationObserver, and a microtask
       runs after the whole synchronous block regardless of where the write sits. Two mechanisms for
       one job, and only the ordered one could be got wrong. */
    this._syncPageTitle();
    // Point the nav "i" page-help at this Hub-shell page's directions (null =
    // fall back to the full Help and FAQ); clears any stale module screen.
    /* ⛔⛔⛔ A HUB PAGE WITH NO TOPIC MUST NOT BLANK THE "i" OVER A SCREEN THAT HAS ITS OWN
       DIRECTIONS (2026-08-25). This assigned the shim unconditionally, so an action with no
       `_HUB_HELP` entry set `_activeScreenObj` to NULL and `openPageHelp` fell through to the global
       FAQ — even when the screen being mounted had a perfectly good `showHowTo` of its own.
       ⭐ MEASURED, POPULATION OF ONE: every `openHubFullPage` action tree-wide against the 18 topics
       that exist. `help`, `report-bug` and `contact-support` have no directions of their own, so the
       FAQ is the right answer for them. WEEK HISTORY is the only page where real help went dark —
       `S.WeekHistory.showHowTo` is four sections long and its own header says it exists precisely so
       this button is not dead, yet nothing could reach it once the page moved onto the hub shell
       ([[lessons-paid-for]] #134: a retired page leaves live code quiet, and quiet reads as never
       built; #107: existence is not reachability).
       ⚠ THE ORDER MATTERS AND SO DOES THE EXPLICIT NULL. The shim wins where a topic exists, so
       nothing that works today changes; and where neither resolves this must still CLEAR the field,
       or a page with no help would answer the "i" with the PREVIOUS page's directions, which is worse
       than the fallback it replaced. */
    this._activeScreenObj = this._hubHelpShim(activeAction)
      || ((helpOwner && typeof helpOwner.showHowTo === 'function') ? helpOwner : null);
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
    // Demo has no real account records, but the sample bar still has a name. Show it
    // in the single-location style (name, no picker) so the demo reads like a live bar.
    if (this.demoMode) {
      const barName = (this.data && this.data.settings && this.data.settings.bar_name) || 'Bar Cop Demo';
      this._acctList = [{ id: 'demo', name: barName }];
      this._acctActiveId = 'demo';
      ['topbar-account-switcher', 'hub-topbar-account-switcher'].forEach(slotId => {
        const slot = document.getElementById(slotId);
        // ⛔ NOTHING IN THE TOP HEADER FOR A SINGLE BAR (Kyle, 2026-08-14). The demo has one bar,
        //    so it takes the same empty treatment as a real single-location account — this is the
        //    build every prospect looks at, and it must not be the one place the name survives.
        if (slot) { slot.style.display = 'none'; slot.innerHTML = ''; }
      });
      /* ⚠ THE TWO GROUP-DASHBOARD IDS CAME OFF THIS LIST WITH THE SCREEN (T123, 2026-09-03) AND THE
         MULTI-LOC PAIR DID NOT. They shared one loop and they are two different retirements: the
         group dashboard's slots are DELETED from the markup, so clearing them is clearing nothing,
         while `sidebar-multi-loc` is a slot that still exists and is deliberately kept empty. A
         blanket cut of the line would have taken a live behaviour with it ([[lessons-paid-for]]
         #42/#137 — a name sharing a heading is not evidence about who owns it). */
      ['sidebar-multi-loc', 'hub-sidebar-multi-loc'].forEach(slotId => {
        const slot = document.getElementById(slotId);
        if (slot) { slot.style.display = 'none'; slot.innerHTML = ''; }
      });
      return;
    }
    if (!window.DB || !DB.listMyAccounts) return;
    const allAccounts = await DB.listMyAccounts();
    const activeId = (DB._accountId) || (DB._getStoredActiveAccountId && DB._getStoredActiveAccountId());
    // Only list PAID bars (plus whichever one they're currently in), so a bar
    // that is mid-signup (created but not yet paid) never pops the switcher.
    const accounts = (allAccounts || []).filter(a => a.active || a.id === activeId);
    /* ⚠⚠ AN EMPTY LIST AFTER A FAILED LOOKUP IS NOT AN ANSWER, SO DO NOT REPAINT ON IT (S313, and
       this is the half my first fix got wrong). Not caching the failure made a retry possible, and
       `navigate` fires one on the next click — but if the very first attempt at boot failed there is
       no last-known list to fall back on, so `accounts` is empty and the block below would hide the
       slot again on EVERY click. That takes the bar name off a SINGLE-location operator too, who has
       no switcher to lose. Leaving the slots untouched keeps whatever is already correct on screen
       and lets a later attempt fill them in. The retry itself stays user-paced: one click, one query,
       no timer, so there is nothing here that can spin. */
    if (!accounts.length && window.DB && DB._acctListErr) return;
    const isMulti  = !!(accounts && accounts.length > 1);
    // Cache for the mobile drawer's location chip (built synchronously).
    this._acctList = accounts || [];
    this._acctActiveId = activeId;
    /* ⛔⛔ THE TOP BAR CARRIES NOTHING NOW, AT EVERY UNIT COUNT (Kyle, 2026-08-23): *"currently when
       there is a multi unit bar the bar selector is in the top bar.. that needs moved out of the top
       bar and replace the bar name on the hub.. and it only goes there."*
       The 2026-08-14 rule ("one bar puts nothing up there, several bars put the picker up there")
       is superseded on its second half only: one bar still puts nothing up there, and several bars
       now put nothing up there either. Both slots are HIDDEN rather than emptied, because an empty
       flex box still claims its gap. */
    ['topbar-account-switcher', 'hub-topbar-account-switcher'].forEach(slotId => {
      const slot = document.getElementById(slotId);
      if (slot) { slot.style.display = 'none'; slot.innerHTML = ''; }
    });

    /* ⭐ THE HUB GREETING IS THE PICKER'S ONE HOME. *"single unit the hub stays as is.. multi unit
       the good afternoon, 'bar name' becomes.. good afternoon, Bar drop down selector."*
       ⛔⛔ THIS ONLY EVER *UPGRADES* THE SLOT, IT NEVER CLEARS IT. `S.Hub.render` writes the bar
       NAME into this slot itself and runs BEFORE this member (see `showHub`), so for a single bar
       the correct behaviour is to leave it completely alone. Writing an empty string here on the
       not-multi path would blank the greeting on every single-location account — and it would do
       the same on a FAILED account lookup, which is the exact hazard the `_acctListErr` guard above
       exists for. Doing nothing is the safe default in both cases.
       ⚠ NO INLINE `style=` ON THE SELECT. An inline declaration beats every stylesheet rule and is
       invisible to a CSS review; the greeting's type is owned by `.hub-greet .at-qsel` so Kyle can
       retune it in DevTools like everything else. */
    const active = accounts.find(a => a.id === activeId) || accounts[0];
    const greet = document.getElementById('hub-greet-account-switcher');
    if (greet && active && isMulti) {
      const options = accounts.map(a => {
        const sel = a.id === active.id ? ' selected' : '';
        return '<option value="' + esc(a.id) + '"' + sel + '>' + esc(a.name) + '</option>';
      }).join('');
      greet.innerHTML = '<select class="acct-switcher at-qsel" aria-label="Switch bar">' + options + '</select>';
      greet.querySelector('.acct-switcher').addEventListener('change', (ev) => {
        const newId = ev.target.value;
        if (newId && newId !== active.id) DB.setActiveAccount(newId);
      });
    }
    /* ⚠ THE GROUP-DASHBOARD SLOT LOOP IS GONE WITH THE SCREEN (T123, Kyle 2026-09-03: *"there is no
       more group dashboard on the app and it is not coming back so delete"*). It read *"keep the
       slots empty so nothing renders"* — honest while the screen was merely unreachable, and
       clearing nothing once the two divs left the markup. A hide for a node nobody renders is the
       same leftover as a class that outlives its node ([[lessons-paid-for]] #105), and this file
       says exactly that about a sibling rule elsewhere. */
    // Sidebar location slot is no longer used: the topbar handles desktop/tablet
    // and the mobile drawer's main screen handles phones. Keep it empty.
    ['sidebar-multi-loc', 'hub-sidebar-multi-loc'].forEach(slotId => {
      const slot = document.getElementById(slotId);
      if (slot) slot.innerHTML = '';
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

  // Hub-level pages (Books, Operations Audit, Settings, Workflow) open directly via
  // openHubFullPage, bypassing the screen router's access check — so they gate
  // here. Returns true (and bounces a Staff member back to their hub) when the
  // page isn't allowed. `screen` = a representative screen to area-check via
  // canAccess (e.g. Books); omit for management-only pages that block all Staff.
  // Owner / Admin / Viewer always pass.
  _hubBlocked(screen) {
    // Owner sees everything.
    if (window.DB && DB.isOwner && DB.isOwner()) return false;
    const role = (window.DB && DB.role && DB.role()) || null;
    // Demo (and any session before the membership role resolves) is full access,
    // the same way canAccessLevel opens up when no role is set. Without this the
    // demo user is blocked from every management page (Workflow, Settings, Team,
    // Operations Audit), since they are neither owner nor admin.
    if (!role) return false;
    if (screen) {
      // Area-scoped hub page (e.g. Books): the member's permission grid is the
      // gate for BOTH admin and staff, so a restricted admin is held out too.
      if (this.canAccess(screen)) return false;
    } else {
      // Management-only page (Settings, Team, Operations Audit, Workflow): an admin
      // configures the bar, so they pass; staff are blocked.
      if (role === 'admin') return false;
    }
    this.showNoAccess();
    return true;
  },

  // Friendly notice shown when a member taps a section, card, step, or nav link
  // they don't have access to. Informational only — there is no in-app request
  // mechanism, they ask the owner directly. A light modal so it never navigates
  // the member away from where they are.
  showNoAccess() {
    if (document.getElementById('no-access-modal')) return;
    const overlay = document.createElement('div');
    overlay.id = 'no-access-modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:var(--overlay);z-index:9600;display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.innerHTML = '<div style="background:var(--surface);border:1px solid var(--b-edge);border-radius:6px;padding:24px 28px;max-width:400px;width:100%;text-align:center;">'
      + '<div style="font-size:14px;font-weight:700;color:var(--t1);margin-bottom:10px;">You don\'t have access to this section</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:20px;">Request access from the owner.</div>'
      + '<button class="btn btn-primary" data-act="ok">Got It</button>'
      + '</div>';
    document.body.appendChild(overlay);
    const cleanup = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') cleanup(); };
    overlay.addEventListener('click', e => { if (e.target === overlay || e.target.closest('[data-act]')) cleanup(); });
    document.addEventListener('keydown', onKey);
  },

  // Access is No Access / Full Access per area: a member who can open a screen
  // has full control of it, and one who can't never reaches it (navigation is
  // gated). So there is no in-screen read-only mode to enforce.

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


  // Staff Hub tiles: one per permission group, in display order.
  // Used by showStaffHub() to render the staff landing page.
  STAFF_TILES: [
    // Inventory Control
    { group:'inventory-dashboard', label:'Inventory Overview',       module:'inventory', screen:'ic-take-inventory' },
    { group:'take-inventory',      label:'Take Inventory',           module:'inventory', screen:'ic-take-inventory' },
    { group:'receive-delivery',    label:'Receive Delivery',         module:'inventory', screen:'ic-receive-delivery' },
    { group:'place-orders',        label:'Place Orders',             module:'inventory', screen:'ic-order-sheet' },
    { group:'spot-check',          label:'Spot Check',               module:'inventory', screen:'ic-spot-check' },
    { group:'manage-products',     label:'Manage Products & Vendors',module:'inventory', screen:'ic-product-setup' },
    { group:'inventory-reports',   label:'Inventory Reports',        module:'inventory', screen:'ic-report-stock' },
    // Labor Control
    { group:'labor-dashboard',     label:'Labor Overview',           module:'labor',     screen:'lc-build-schedule' },
    { group:'log-hours',           label:'Log Hours',                module:'labor',     screen:'lc-log-hours' },
    { group:'log-tips',            label:'Tip Tracking',             module:'labor',     screen:'lc-tip-log' },
    { group:'view-schedule',       label:'View Schedule',            module:'labor',     screen:'lc-schedule-history' },
    { group:'manage-schedule',     label:'Manage Schedule',          module:'labor',     screen:'lc-build-schedule' },
    { group:'manage-staff',        label:'Manage Staff & Positions', module:'labor',     screen:'lc-staff-roster' },
    { group:'time-off',            label:'Time Off Log',             module:'labor',     screen:'lc-time-off' },
    { group:'call-out-log',        label:'Call-Out Log',             module:'labor',     screen:'lc-callout-log' },
    { group:'labor-reports',       label:'Labor History',            module:'labor',     screen:'lc-reports' },
    // Shift Control
    { group:'shift-dashboard',     label:'Shift Overview',           module:'shift',     screen:'sc-cash-control' },
    { group:'cash-mgmt',           label:'Cash Management',          module:'shift',     screen:'sc-cash-control' },
    { group:'checklists',          label:'Run Checklists',               module:'shift', screen:'sc-checklists' },
    { group:'preshift',            label:'Pre-Shift Briefing',       module:'shift',     screen:'sc-preshift' },
    /* ⛔⛔⛔ THESE TWO SAY `inventory` NOW, AND IT IS THE HALF OF THE MOVE NOBODY CAN WALK.
       `staffLanding()` returns `{ module, screen }` for a NON-ADMIN member and the shell is opened
       from THIS field. Leave it saying 'shift' after the screens move and a staff user whose first
       accessible page is one of these lands in the Shift shell on a screen only the Inventory branch
       can draw, which renders "Coming soon." Neither the owner nor the demo can meet it, because
       both short-circuit every gate ([[the-loop]] #149; #124 — moving an id between module blocks
       leaves every piece of per-id logic behind in the old block's path). */
    { group:'void-comp',           label:'Void / Comp Log',          module:'inventory', screen:'sc-void-comp' },
    { group:'waste',               label:'Waste / Spill Log',        module:'inventory', screen:'sc-waste' },
    { group:'maintenance',         label:'Maintenance Log',          module:'shift',     screen:'sc-maintenance' },
    { group:'maintenance',         label:'Licensing',                module:'shift',     screen:'sc-licensing' },
    { group:'incident',            label:'Incident Log',             module:'shift',     screen:'sc-incidents' },
    // Recovery
    { group:'profit-recovery',     label:'Profit Audit',          module:'profit',    screen:'audit-tracker' },
    { group:'revenue-recovery',    label:'Revenue Audit',         module:'revenue',   screen:'r-audit' },
    { group:'cash-recovery',       label:'Cash Audit',            module:'cash',      screen:'c-audit' },
    /* ⛔ `ev-bookings`, NOT `ev-dashboard`, since the Events dashboard was deleted 2026-08-12.
       `staffLanding()` walks this table IN ORDER and returns the FIRST accessible screen, so a
       scoped Events user lands here and nowhere else. **No walk can catch a mistake in this line**:
       the demo carries no role and an owner short-circuits before it is read, which is exactly how
       six of seven areas nearly shipped pointing at deleted screens at 1c. Bookings is the section's
       pipeline and `bookings` is its unified store, so it is the honest landing. */
    { group:'events',              label:'Events',                   module:'events',    screen:'ev-bookings' }
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


  /* Apply the answers the merged signup form collected, then open the Hub.
     ⛔ ITS OWN MEMBER BECAUSE THE CALLER IS NOT ASYNC. Written inline in boot it was
     `await` inside a synchronous function — caught by `node --check`, which is the one thing a
     syntax check CAN see. A named member also means a harness can lift and run it, which an inline
     branch in a 200-line boot cannot.
     ⛔ CONSUME-ONCE. The draft is cleared BEFORE the first await, so a second boot (Supabase
     re-emits SIGNED_IN when the tab regains visibility) cannot re-apply a stale one over settings
     the operator has since edited.
     ⚠ The write order matters: settings first, then the account-name sync. If the sync fails the
     bar is still named correctly IN the app — only the switcher label lags, which is recoverable
     from Business Profile. The reverse order would leave a named account with no settings. */
  async _applySignupDraft() {
    const d = this._signupDraft;
    if (!d) return false;
    this._signupDraft = null;
    const s = this.data.settings;
    s.bar_name        = d.bar_name;
    s.city_state      = d.city_state;
    s.service_periods = d.service_periods;
    s.onboarding_complete = true;
    try {
      await this.saveKey('settings');
    } catch (e) {
      /* The account exists and the operator is signed in, so the recoverable state is the Hub with
         onboarding still owed — never a dead screen. Business Profile writes the same four fields. */
      console.error('signup draft save failed', e);
    }
    /* Keep the bar switcher (accounts.name) in step with the name just set — the same sync
       Onboarding.finish does, and for the same reason: the signup trigger names a fresh account
       after the user's EMAIL, so without this the switcher shows an email address. */
    try {
      if (window.DB && DB.setAccountName) {
        await DB.setAccountName(s.bar_name);
        if (this.renderAccountSwitcher) await this.renderAccountSwitcher();
      }
    } catch (e) { console.error('account name sync', e); }
    this.showHub();
    this._promptSync();
    return true;
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

  /* THE SECTION REGISTRY: the Hub plus the SEVEN module sections, in Hub-sidebar order. Bar Cop
     Audit / Accounting / Operations / Setup / Support are not here on purpose — they live inside the
     Hub, reached via "The Hub".
     ⛔⛔ THIS COMMENT USED TO SAY "the 6 main sections" AND "drives the section switcher (the dark
     dropdown at the top of every section sidebar)". BOTH WERE FALSE, and Kyle caught the second one
     by asking a one-line question: there is no section switcher in this app — the only switcher left
     is the ACCOUNT `<select>` in the topbar. The dropdown this described was replaced by the nav rail
     in the 2026-08-08 redesign and the comment outlived it, so the table read as UI plumbing when it
     is really the registry. **I then repeated the claim in my own comment below, having taken it
     from here rather than from the code** ([[code-is-truth]]).
     ⚠ AND IT HAD NO READER AT ALL until `_isSection` below — a table kept alive for a control that
     no longer existed. Naming what it IS is what stops it being deleted as dead code. */
  /* ⚠ THE LABELS ARE NOT DISPLAYED ANYWHERE. `_isSection` is the only reader and it takes s[0].
     They are corrected rather than deleted because the PAIR SHAPE is what that reader walks, and a
     list of section names that nobody renders is exactly what rotted the retired AREAS table.
     profit / revenue / cash are module RENDERER keys, not rail sections: the rail rows went on
     2026-08-24 and the shells stayed ([[app-nav-section-links]]). */
  SECTIONS: [
    ['hub',       'Hub'],
    ['profit',    'Profit'],
    ['revenue',   'Revenue'],
    ['cash',      'Cash'],
    ['events',    'Events'],
    ['inventory', 'Inventory'],
    ['labor',     'The Floor'],
    ['shift',     'The Floor'],
  ],

  /* ⛔⛔⛔ THIS IS A LANDING MAP AND NOTHING ELSE. It answers "which screen does this module open
     on", and every entry is a screen that can be retired.
     It used to answer a SECOND, unrelated question by accident — "is this rail row a module
     section?" — because having a landing screen happened to be true of exactly the sections.
     `_railHasMenu` and the rail overlay's cross-section click capture both leaned on that proxy, and
     it is about to become false: the six close-the-week cockpits are being deleted and every one of
     them IS a section's landing screen. Six of the ten menu-owning rail rows would have gone dead at
     once, from a table nobody would think to open while deleting a screen.
     ⭐ MEMBERSHIP NOW COMES FROM `_isSection`, off the `SECTIONS` registry above. Pinned by
     `verify-rail-menu-overlay` C4: with this map EMPTIED, all ten rows still own their menu. */
  /* ⛔⛔ EVERY ENTRY IS A SCREEN THAT SURVIVES THE COCKPIT RETIREMENT. These were the six
     close-the-week cockpits until 2026-08-10; each is now the FIRST ROW OF ITS OWN SECTION'S NAV,
     which is the row already sitting at the top of that sidebar — so the highlighted row matches the
     page and no second hand-typed map exists to drift. Events is unchanged: its dashboard survives.
     ⭐ REMAINING READERS, and they are all fallbacks now that the twelve "Close The Week" entry
     points go to the real page: `jumpToSection` (the rail overlay's no-dead-end fallback, and
     Events) and `sectionNode`'s highlight id. Pointing them at survivors BEFORE the files are
     deleted is what makes the deletion itself a pure file removal.
     ⚠ `verify-nav-rail-reachability` C2b/C2d holds this: no landing may name one of the six, and
     every landing must be a screen `_CONVERTED` can actually route to. */
  _SECTION_DASH: { profit: 'audit-tracker', revenue: 'r-audit', cash: 'c-audit', events: 'ev-bookings', inventory: 'ic-take-inventory', labor: 'lc-build-schedule', shift: 'sc-cash-control' },

  /* Is this key one of the module sections? Read off the `SECTIONS` registry above, so there is ONE
     list and a section cannot exist in one place and not the other. `hub` is IN that registry and is
     deliberately NOT a section: it owns no menu and its rail row navigates, exactly like Review and
     Map. */
  _isSection(k) { return !!k && k !== 'hub' && this.SECTIONS.some(s => s[0] === k); },


  // Jump to a section's dashboard (or the Hub) from the switcher. showApp hides
  // the Hub wrapper and shows the module shell, so this works from anywhere.
  jumpToSection(key) {
    // Any real navigation closes the overlay behind it — including the mobile drawer's own calls,
    // which is harmless there because the overlay is never open on mobile.
    this.closeRailMenu();
    if (key === 'hub') { this.showHub(); return; }
    const screen = this._SECTION_DASH[key];
    if (!screen) return;
    // Gate before swapping the shell so a locked section shows the notice and
    // leaves the member where they were (no half-loaded module shell flash).
    if (!this.canAccess(screen)) { this.showNoAccess(); return; }
    this.showApp(key);
    this.navigate(screen);
  },

  /* `target` is optional and defaults to the shell's own sidebar, which is every caller that
     existed before 2026-08-08. The rail's overlay passes its own container so a section's menu can
     be rendered WITHOUT navigating to it — clicking Labor while reading Inventory has to show
     Labor's pages and leave the operator where they are.
     ⭐ ONE RENDERER, TWO CONTAINERS, which is the same shape as `_planMenuImport(rows, target)` on
     the menu door: the screen and the write point the identical walk at different targets so they
     cannot describe different outcomes. A second menu builder for the overlay is exactly how the
     overlay ends up offering a page the sidebar dropped. */
  /* ⭐⭐⭐ THE ONE NAV-SOURCE RESOLVER. Section id -> that section's sidebar markup, for every
     surface that needs the markup rather than the render: the mobile drawer, the section-links bar
     in the top nav, and anything added next. Ten keys, and a key it does not know returns '' so a
     caller can tell "no source" from "empty source".
     ⛔ IT EXISTS BECAUSE THERE WERE TWO. `SectionTabs._srcFor` hardcoded `module === 'inventory'`,
     so flipping `SectionTabs.ENABLED` for a second section made the bar hide itself in silence —
     the switch looked like the whole switch and was half of it (T33).
     ⚠ NOT THE SAME FUNCTION AS `_renderNav` BELOW, and they must not be merged. That one takes a
     TARGET and writes into it, covers the seven MODULE keys only, and DEFAULTS to Profit; the rail
     overlay sends audit/books/settings to `S.Hub.renderSidebar` instead, so it never sees them.
     Merging would change what an unknown module renders ([[lessons-paid-for]] #51/#57).
     ⚠ `window.S`, not a bare `S`: this member is lifted by harnesses that do not declare it. */
  navHTMLFor(key) {
    const H = (typeof window !== 'undefined' && window.S) ? window.S.Hub : null;
    try {
      if (key === 'inventory' && typeof Inventory !== 'undefined') return Inventory.navHTML();
      if (key === 'labor'     && typeof Labor     !== 'undefined') return Labor.navHTML();
      if (key === 'shift'     && typeof Shift     !== 'undefined') return Shift.navHTML();
      if (key === 'events'    && typeof Events    !== 'undefined') return Events.navHTML();
      if (key === 'profit'    && typeof ProfitNav !== 'undefined') return ProfitNav.html();
      if (key === 'revenue'   && typeof Revenue   !== 'undefined') return Revenue.navHTML();
      if (key === 'cash'      && typeof Cash      !== 'undefined') return Cash.navHTML();
      /* ⭐ THE FLOOR joined 2026-08-23 and it is the first section whose pages come from THREE
         other modules. Its rows carry their own door (`data-hub-action="enter"` + `data-mod`), so
         nothing here has to know that — this resolver answers "what is this section's markup" and
         nothing else, which is why the bar, the sidebar and the phone drawer can all read it. */
      if (key === 'floor'     && typeof Floor     !== 'undefined') return Floor.navHTML();
      if (key === 'menus'     && typeof Menus     !== 'undefined') return Menus.navHTML();
      /* ⭐ THE WEEK JOINED 2026-08-23. Its three links come from the section's own object, the same
         way every module section supplies its own — there is no hub SIDEBAR for The Week (all three
         pages are `'none'` in `_HUB_SIDEBAR_OF_ACTION`, full width), so a `_weekSidebarHTML` in
         hub.js would have been a name for something that never renders. */
      if (key === 'week'  && typeof window !== 'undefined' && window.S && window.S.Week) return window.S.Week.navHTML();
      if (key === 'audit'     && H) return H._auditSidebarHTML();
      if (key === 'books'     && H) return H._booksSidebarHTML();
      if (key === 'settings'  && H) return H._settingsSidebarHTML();
    } catch (e) {
      /* ⚠ REPORTED, NOT SWALLOWED. The version this replaces had a bare `catch (e) {}`, so a
         throwing section rendered an empty menu with nothing in the console to say why. */
      console.error('navHTMLFor(' + key + ') failed', e);
    }
    return '';
  },

  /* ⚠ THE MODULE-SCOPED TWIN, and the difference is deliberate — see `navHTMLFor` above. */
  _renderNav(module, target) {
    const nav = target || document.getElementById('sidebar-nav');
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
      /* ⛔⛔⛔ NO "CLOSE THE WEEK" LEAF HERE ANY MORE. Kyle, 2026-08-10, reading the shipped menus:
         *"why are the 'close the week' page links still in the 6 overlay menus and pointing back to
         the close the week page?"* A per-section close-the-week row made sense while every section
         HAD its own cockpit; there is ONE page now, reached from the rail's own Week group, so six
         copies of it inside the section menus were six duplicate routes to one destination. The same
         call the History row got when it was pulled off the Profit and Revenue menus.
         ⚠ EVENTS KEEPS ITS LEAF, and since 2026-08-12 that leaf is `ev-bookings`. The Events
         dashboard it used to point at is DELETED — Kyle: *"it is not needed and serves no purpose to
         a user other than an extra link on the events overlay menu."* Events is still the only
         module that lands anywhere of its own; the destination is now the pipeline rather than a
         dashboard over it. */
      const dashScreen = this._SECTION_DASH[module];
      const firstSec = nav.querySelector('.nav-section');
      if (module === 'events' && dashScreen && firstSec && !nav.querySelector('#nav-' + dashScreen)) {
        const dleaf = document.createElement('div');
        dleaf.className = 'nav-item nav-leaf';
        dleaf.id = 'nav-' + dashScreen;
        dleaf.dataset.screen = dashScreen;
        const dleafLabel = 'Book The Events';
        dleaf.innerHTML = '<svg class="nav-icon" viewBox="0 0 17 17" fill="none"><path d="M2.5 4.2l1.2 1.2 2-2.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 4h6.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M2.5 8.7l1.2 1.2 2-2.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 8.5h6.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M2.5 13.2l1.2 1.2 2-2.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 13h6.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg><span class="nav-label">' + dleafLabel + '</span>';
        firstSec.parentNode.insertBefore(dleaf, firstSec);
      }
    }
    // Rewire nav click handlers. Links a member can't access stay VISIBLE (no
    // reflow); navigate() shows the no-access notice and leaves them put.
    nav.querySelectorAll('.nav-item[data-screen]').forEach(el => {
      el.addEventListener('click', () => {
        // Close the mobile sidebar after the click so the navigated screen
        // gets full width on phones. No-op on desktop where the class is
        // never set.
        document.getElementById('app')?.classList.remove('sidebar-open');
        App.navigate(el.dataset.screen);
      });
    });
    nav.querySelectorAll('.nav-item[data-nav="hub"]').forEach(el => {
      el.addEventListener('click', () => App.showHub());
    });
    // ⚠ The `data-nav="week-close"` listener went with the leaf it served. A hook installed for
    // markup nothing renders is dead code that reads as coverage.
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
    // Support-group links (Report a Bug, Contact Support) stay when the caller
    // asks to keep them, e.g. the App Settings sidebar's Support group.
    if (!opts.keepSupport) {
      nav.querySelectorAll('.nav-item[data-nav="report-bug"], .nav-item[data-hub-action="report-bug"]').forEach(el => el.remove());
    }
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
  /* ⛔ THESE FOUR TABLES ARE THE RAIL, IN RENDER ORDER, and the grouping is the design.
     `flowmap` (Workflow) left the rail in the 2026-08-08 redesign and the PAGE was deleted on
     2026-08-11, so `_PROTO_BOTTOM` is Settings and Sign Out.
     Every key here MUST be answered by `_protoGlobalClick` or by `_SECTION_DASH`, and
     `verify-nav-rail-reachability` asserts exactly that against the tables rather than trusting
     that the two lists were kept in step (integrity #11: a control wired under one spelling and
     rendered under another is a dead row that looks alive). */
  /* ⭐⭐⭐ THE RAIL IS BECOMING ONE FLAT LIST, AND THIS TABLE IS WHERE IT ASSEMBLES (Kyle,
     2026-08-23): *"when it is done there will be no groups on the rail menu.. only the main links
     in one list.. but we are doing one section at a time.. so as a section gets done.. we will move
     the link up to where it goes."* So the groups below are not the design any more — they are what
     is LEFT of the old design, shrinking as each section lands. Expect this list to grow and the
     others to empty; do not "tidy" the remaining groups into a structure, they are a queue. */
  /* ⭐ THE FLOOR SITS UNDER AUDITS (Kyle, 2026-08-23). It arrived in `_PROTO_CONTROL` because it
     replaced Labor and Shift in their own slot; one look at it and he moved it up here, which
     emptied the Control group and retired it. */
  /* ⚠ `audit` READS "Run Audit", NOT "Audits" (Kyle, 2026-08-24). One word in one table, and it
     moves THREE surfaces because they all ask `_railLabelOf`: the rail row, that row's `title` (the
     only thing a collapsed row has), and the top bar's section icon tooltip and aria-label. That is
     the design working — the menu and the bar cannot disagree about what a section is called — and
     it is worth knowing before renaming any other row here. Measured on the live bar first: the
     Audits section shows its ICON ONLY up there, so nothing visible in the top bar changed. */
  _PROTO_GLOBAL:   [['hub','Hub'],['inventory','Inventory'],['week','The Week'],['audit','Run Audit'],['floor','The Floor'],['menus','Menus'],['events','Events'],['books','Books']],
  /* ⛔ `_PROTO_WEEK` IS GONE (2026-08-23). Close, Review and History were three rows for one job in
     three tenses; they are now three TABS on one page (`S.Week`) behind the single "The Week" row
     above. The three ids still resolve — they are tab targets now — so nothing that linked to them
     had to be re-pointed. Deleting the table rather than emptying it is deliberate: an empty table
     still gets rendered as a group and draws its divider. */
  /* ⛔⛔⛔ `_PROTO_CONTROL` IS DELETED, NOT EMPTIED (Kyle, 2026-08-23: *"the floor link goes under
     audits in rail menu and control goes away"*). It held Labor and Shift; The Floor replaced both,
     then moved up into `_PROTO_GLOBAL`, and the group had nothing left in it.
     ⚠ EMPTYING IT WOULD HAVE SHIPPED A CHROME DEFECT: the rail renders each table as a `.rail-group`
     with its own `.rail-grp-label`, so an empty array still draws the word "Control" over nothing.
     `_PROTO_WEEK` was deleted for exactly this reason. Every reader went with it — `_railLabelOf`'s
     table list, the rail render, and the mobile drawer's `railGroup('Control', …)`.
     ⭐ THE MODULES SURVIVE. `navigate` still branches on `labor` and `shift` and renders every one
     of those screens; what died is the rail ROW and the menu, not the shell. `_moduleOf` and
     `App.STAFF_TILES` still say the old words on purpose, exactly as they do for the six pages the
     Books bar took — the filing system moved, the renderer did not. */
  /* ⛔⛔⛔ `_PROTO_RECOVERY` IS DELETED TOO (Kyle, 2026-08-24: *"yes delete all recovery.. experiments
     .. loss prevention"*), and for the same reason as the two above: once Loss Prevention and
     Experiments went, Profit held one row, Revenue held one row and Cash held one row, and every one
     of them was that module's Help page. DELETED, NOT EMPTIED, or the rail draws "Recovery" over
     nothing. The same five readers went with it: the table, `_railLabelOf`'s list, the rail render
     (with one of its two dividers), the drawer's `railGroup('Recovery', ...)` and a comment.
     ⭐ THE ENGINE IS NOT THE RAIL BLOCK, AND THIS IS THE ONE PLACE THE INSTRUCTION COULD BE READ TWO
     WAYS. `recovery.js` computes "Recovered to date" from CONFIRMED WEEKS and feeds the Hub money
     tiles, the briefing and the audits, so deleting it would silently send that headline to $0 on
     the page a prospect looks at ([[lessons-paid-for]] #110, the exact trap the sequencing warned
     about). What was named is the rail SECTION. `Recovery.total()` stays, and `_enterRecovery` stays
     and opens the AUDITS, which is where the recovery numbers live now.
     ⭐ THE NAV OBJECTS STAY, EXACTLY AS `T67` LEFT LABOR AND SHIFT. `ProfitNav`, `Revenue` and `Cash`
     keep their Help row and stay in `SECTIONS`; nothing asks `navHTMLFor` for those keys any more
     because no rail row emits them. Measured before the cut: ZERO screens registered under profit /
     revenue / cash are left unclaimed by some section's nav. */
  /* ⛔⛔ SIGN OUT IS BACK IN THE RAIL, UNDER SETTINGS, BEHIND A DIVIDER, WITH AN ICON (Kyle,
     2026-08-24: *"under the settings link put another divider and move the sign out link under that
     divider with an icon"*). That is the THIRD home this one control has had — the rail's foot, then
     the top nav, now a group of its own — so nothing anywhere should be built on where it sits.
     ⛔ THE TOP-NAV BUTTON WENT WITH IT, all four pieces: the markup, the wiring, its own stylesheet
     rule and its phone `display:none`. A move that leaves any of those behind is how a desktop ends
     up with two ways out and a rule dressing a node nobody renders.
     ⚠⚠ AND THIS NOTE DELIBERATELY DOES NOT SPELL THE RETIRED ID, the same way the top-bar date's
     note does not spell its own. `verify-signout-reachable` block D sweeps for it, and a comment
     that names the thing a sweep is looking for is counted as a survivor (integrity #2). D reads
     de-commented source, so this is belt and braces rather than the only guard.
     ⭐ THE ONE THING THAT HAS NEVER MOVED IS THIS TABLE, AND THAT IS THE POINT: the phone's burger
     drawer is generated from these same tables, and `_PROTO_SIGNOUT` not being read is exactly how
     Sign Out went missing from mobile entirely once before.
     ⭐ THE ICON NEEDED NO NEW ART — `_RAIL_IC.signout` and `_NAV_SECTION_IC.signout` both survived
     every move and still resolve. Measured before the edit rather than assumed: the shipped
     `_railRow('signout', …)` renders 272 characters of real icon markup.
     ⚠ THE ORIGINAL REASON THE ROW IS SPECIAL STILL STANDS and is what the divider buys: this is the
     only row that ENDS THE SESSION rather than going somewhere, so it must never sit flush under
     Settings. 🔧 `verify-signout-reachable` holds one way out per screen size and pins the
     SEPARATION rather than which of the three spellings provides it. */
  // ⚠ WORKFLOW IS GONE FROM BOTH MENUS (Kyle, 2026-08-10: that page is being deleted). Removed here
  // rather than in each menu, so the rail and the mobile drawer — which now reads these same tables
  // — drop it together instead of one at a time.
  /* ⭐⭐⭐ HELP JOINS SETTINGS IN THE BOTTOM GROUP (Kyle, 2026-08-24: *"that global help page will go
     on the rail menu under settings .. Help with an icon"*). It is the app's ONE global FAQ, and
     giving it a rail row is what finally gives it a door: MEASURED on the deployed build before this
     edit, ALL ELEVEN help FAQs were unreachable — every section nav still names a help row, and the
     eight sections with a top BAR drop the whole Support group through `ASIDE_GROUP`, while labor,
     shift, profit, revenue and cash stopped being rail rows entirely.
     ⭐ THE ICON NEEDED NO NEW ART — `_NAV_SECTION_IC.help` has been in the shared map all along.
     ⛔ AND THE ROW WOULD HAVE BEEN DEAD WITHOUT A ROUTER BRANCH. `_protoGlobalClick` did not answer
     `help`; a rail row whose key nothing answers renders perfectly and does nothing on click, which
     is the class that shipped four times in four days. The branch is in `_protoGlobalClick` below,
     and `_HUB_SIDEBAR_OF_ACTION` gained a `help` entry so the row can LIGHT on its own page. */
  /* ⚠ THE ROW READS "GUIDE", NOT "HELP" (Kyle, 2026-08-24: *"in rail menu change 'help' to 'Guide'
     with a different icon"*). One word in one table, and it moves BOTH surfaces at once, because the
     rail row, that row's `title` and the phone drawer's row are all generated from here — the same
     agreement `audit` → "Run Audit" demonstrated above.
     ⛔ THE KEY STAYS `help`, AND THAT IS DELIBERATE. The key is what `_protoGlobalClick`,
     `_GLOBAL_OF_ACTION` and the phone drawer's `routePage` map all resolve; renaming it would be
     four more edits, and a rail row whose key nothing answers renders perfectly and does nothing on
     click — the class that reached Kyle four times in four days. The LABEL is the operator's word,
     the KEY is the wiring, and only one of the two was asked to change.
     ⭐ WHY THE WORD MATTERED: "Help" already named two other things — the top-bar "i", which gives
     the directions for the screen in front of you, and the ten per-section FAQs. Three different
     things under one word is what this fixes. `verify-global-help` A2b pins that the row is NOT
     called "Help" without pinning what it IS called, so renaming it again costs nothing. */
  /* ⚠ "Guide" — reverted from "The Guide" the same day (Kyle, 2026-08-25). Third label this row has
     worn in two days; the KEY has never moved, which is the whole reason each rename is one word in
     one table and reaches the rail row, its title and the phone drawer together.
     ⭐ AND NOTHING IN THE SUITE FIRED ON ANY OF THE THREE. `verify-global-help` A2b pins that the row
     is not called "Help" without pinning what it IS called, and the mutation anchors that used to
     quote this line now DERIVE it. That is the shape working: a rename should cost nothing. */
  _PROTO_BOTTOM:   [['settings','Settings'],['help','Guide']],
  /* ⚠ "LOG OUT", NOT "SIGN OUT" (Kyle, same message). One word in one table, and it moves the rail
     row AND the phone drawer's row, because both are generated from here. That is the agreement
     working: the auth screen this control lands on already reads "LOG IN TO BAR COP", so the rail
     now uses the same word the destination does. */
  _PROTO_SIGNOUT:  [['signout','Log Out']],
  // Maps an openHubFullPage activeAction to the global top-nav link to highlight.
  /* ⭐ ALL THREE WEEK ACTIONS LIGHT THE SAME ROW NOW. They used to map to themselves, one rail row
     each; there is one row, so `week` is the answer for every one of them — otherwise opening a page
     through an old id would light nothing and the operator would be on a page the rail says they
     are not on. */
  /* ⚠ `'help': 'help'` ADDED 2026-08-24 WITH THE RAIL ROW, and it is not optional chrome. This map
     is what lets a HUB page light its own rail row: `_currentScreenId` is written only by
     `navigate`, so a page opened through `openHubFullPage` cannot name itself and its row can never
     be marked ([[lessons-paid-for]] #121). Without the entry the operator would sit on the Help page
     with the rail insisting they are somewhere else. */
  _GLOBAL_OF_ACTION: { 'bar-cop-audit': 'audit', 'breakeven': 'books', 'week': 'week', 'week-review': 'week', 'week-close': 'week', 'week-history': 'week', 'books': 'books', 'weekly-pnl': 'books', 'year-end': 'books', 'operating-expenses': 'books', 'help': 'help' },
  /* ⛔⛔ AND EVERY SETTINGS PAGE WAS MISSING FROM THAT MAP — nine of them. Found while checking the
     new title: Settings read no section prefix, and the same lookup drives the rail highlight, so
     **the Settings row never lit up either** on any of its own pages.
     ⭐ FIXED BY DERIVING, NOT BY TYPING NINE MORE ENTRIES. `_HUB_SIDEBAR_OF_ACTION` already knows
     which section every hub page belongs to, because that is what decides its sidebar, and for
     these three the sidebar key and the rail key are the same word. A second hand-kept list of the
     same fact is what let the first one fall behind ([[harness-review-like-code]] #141). */
  _globalOfAction(action) {
    if (this._GLOBAL_OF_ACTION[action]) return this._GLOBAL_OF_ACTION[action];
    const side = this._HUB_SIDEBAR_OF_ACTION[action];
    return (side === 'audit' || side === 'books' || side === 'settings') ? side : '';
  },
  // Which Hub-shell sidebar a full-page action mounts. 'none' = keep the
  // full-width dashboard mode (Blueprint); 'audit'/'books' = those context
  // sidebars; missing = the default Hub sidebar. Settings gets its own in the
  // next phase of the nav sweep.
  /* ⚠ `week` IS 'none' LIKE THE TWO PAGES IT REPLACES — full width, no hub sidebar. Anything else
     and the tabbed page would open with a sidebar its three panels were never laid out for. */
  _HUB_SIDEBAR_OF_ACTION: { 'bar-cop-audit': 'audit', 'breakeven': 'books', 'week': 'none', 'week-review': 'none', 'week-close': 'none', 'week-history': 'none', 'books': 'books', 'weekly-pnl': 'books', 'year-end': 'books', 'operating-expenses': 'books', 'settings': 'settings', 'settings-profile': 'settings', 'settings-targets': 'settings', 'user-accounts': 'settings', 'user-account': 'settings', 'user-data': 'settings', 'user-team': 'settings', 'audit-help': 'audit', 'books-help': 'books', 'settings-help': 'settings' },

  // Page directions for the nav "i" button on Hub-shell pages. Those pages open
  // via openHubFullPage (not navigate), so they never register an
  // _activeScreenObj on their own and the "i" had nothing to show. Keyed by the
  // page's activeAction; openHubFullPage/showHub install the matching shim.
  // Pages not listed fall back to the full Help and FAQ. Sections: {h, p:[...]}.
  _HUB_HELP: {
    /* ⛔⛔⛔ REWRITTEN 2026-09-04 WITH THE PAGE, AND ALL NINE SECTIONS WERE FALSE (Kyle: *"then i help
       files need to be updated for the pages we have changed"*). The old topic described the six
       bands `T138` deleted: a money line of four figures, an Operations Audit panel, a fixed
       two-week comparison, Do this first, a gain-and-drag card and a six-reading bottom row. Not one
       of them is on the Hub. Copy that describes a deleted mechanism is FALSE, not a wording
       preference, and it is the third of [[the-loop]] #61's three greps — the one nobody does
       ([[lessons-paid-for]] #116).
       ⚠ AND NO VOCABULARY RATCHET COULD HAVE CAUGHT IT. `verify-help-not-stale` bans words that no
       longer name anything the operator can see, and every word here is still live: the Hub exists,
       audits exist, cost of goods exists. What died was the LAYOUT, and only reading the render
       against the words finds that ([[lessons-paid-for]] #150).
       ⭐ EVERY CLAIM BELOW IS READ OFF THE SHIPPED RENDER: seven cards in rail order, a cell that is
       either a figure or its job, one card open at a time seeded from the account, the three body
       blocks `_cardBodyHTML` emits, and the audit scores block on Run Audit. */
    'hub': { title: 'How the Hub Works', sections: [
      { h: 'What this is', p: ['Your home screen, laid out the way the rest of the app is: one card for each part of the rail, top down, Inventory through Books. Each card is where that part of the business stands right now, and every number on it opens the page behind it.'] },
      { h: 'A number, or the job that gets you one', p: ['Every slot on a card is one or the other. You will not see a dash, and you will not see a zero standing in for a figure Bar Cop does not have. Before your first count the Inventory card shows the count as the thing to do; once it is in, that same slot shows what is on your shelf. So a card fills itself in as you use that part of the app, and each job says what it will turn into.'] },
      { h: 'Opening a card', p: ['Click anywhere on a card\'s header to open it and click again to shut it. One is open at a time. Inventory is open the first time you land here; after that Bar Cop reopens the one you left open. That choice is kept on your account, so it follows you to the phone.'] },
      { h: 'What is inside an open card', p: ['Needs attention is what that part of the business is waiting on, worst first, each row a tap into the item it names. What moved is the operating number that went furthest your way over the last two weeks and the one that went furthest against you. Done this week is work already on file, read from your records rather than ticked by hand. A block with nothing to say does not draw a heading at all.'] },
      { h: 'The audit scores', p: ['Open Run Audit and it carries your Profit, Revenue and Cash scores as well, each with the date it last ran and the points it has moved since the run before. An audit that has never run reads as a dash, not a zero.'] },
      { h: 'Hiding a card', p: ['Hide takes a card off the page, which is what to do with a part of the app you do not use. Nothing is deleted: hidden sections are named at the foot of the page and one press brings any of them back. The choice is stored on your account, so a card you hide on the laptop stays hidden on the phone.'] },
      { h: 'Multiple bars', p: ['Your bar name shows in the top bar. If you run more than one bar, that name becomes a switcher: pick another bar and Bar Cop reloads into it.'] }
    ] },
    /* `'flowmap'` (Workflow) was removed on 2026-08-11 with the page. [[the-loop]] #61: retiring a
       feature is three greps — the render call, the helpers whose only caller it was, and the HELP
       TEXT that describes it. The help is the one nobody does, and a topic left behind here would
       still be reachable by any caller passing that action to `openHubFullPage`. */
    'week-close': { title: 'How Closing The Week Works', sections: [
      { h: 'What this is', p: ['The one place a week gets closed. It reads what you have already logged, tells you what the week still needs, and then you confirm it. Every line is read from your real records, so it cannot say the sales are in when they are not.'] },
      { h: 'What the week needs', p: ['Two things: your sales, and a count. Those are the pair that produce your bar pour cost and food cost, which is why they sit at the top. Hours, tips, drawer counts and catering fill in when you have them, and a week closes fine without any of them. Anything marked optional is not a gap, it is a piece you may not keep.'] },
      /* ⛔⛔⛔ ADDED 2026-09-04, AND EVERY FIGURE NAMED IN IT WAS MEASURED (Kyle: *"we need to connect
         the hub and the week together on what closing the week actually does/gives the user.. a user
         goes oh i get it.. i just need to type in my bar and food revenue and i get this"*). The
         page and the Hub were two halves of one thing and nothing said so.
         ⚠ MEASURED BY DIFFERENCING WORLDS ON THE LIVE DEMO, never written from memory: empty the
         store a row fills, rebuild the seven Hub cards, read which cells stopped being figures. That
         is what a claim about what the app will do costs ([[lessons-paid-for]] #64).
         ⛔ TIPS ARE DELIBERATELY ABSENT FROM THE LIST. They light no Hub cell at all, so naming one
         would be the exact defect this rule exists for; the row itself says where they do go.
         Pinned by `verify-week-close` block P, which proves every named cell is real and that the
         rows lighting nothing promise nothing. */
      /* ⛔⛔ CORRECTED TWICE, AND KYLE FOUND IT BOTH TIMES. The first version gave Sales prime cost
         and labor, which need the HOURS. The second gave it bar pour cost and food cost, which need
         the COUNT: a cost percentage is cogs divided by revenue, so revenue alone produces neither.
         MEASURED by closing a week with sales and nothing else: The Week card shows Net sales and
         nothing more ([[lessons-paid-for]] #64). */
      { h: 'What each row gives you', p: ['Every row turns into something, and each one says what before you fill it in. Sales gives you net sales, and it is the base every cost percentage is worked out against. A count gives you cost of goods, bar pour cost and food cost, because a cost percentage is what you used divided by what you sold. Hours turn those into prime cost and labor.', 'Skip a row and only the figures that need it stay blank. Nothing is barred: a bar with no timeclock export closes its week the same as anyone else, it just reads no prime cost until the hours are in.'] },
      /* ⛔⛔⛔ THIS SECTION EXISTS BECAUSE KYLE ASKED THE QUESTION AND WAS RIGHT TO: *"if they are
         dropping a tip file from their pos they already have their tip totals.. so what is the point
         of dropping a file?"* and *"if they have a pos drawer count, wouldn't that already have
         their over/short.. curious really don't know?"* Three rows on this page take a report the
         operator already has, and the first version of the copy handed it straight back to them.
         ⭐ BOTH ANSWERS WERE MEASURED, NOT REMEMBERED. `App.tipMakeupForRows` on the seeded week
         returns $45.90 owed to one person; the Operations audit's `_recurringPatterns` names people
         by name across ninety days (*"Recurring cash variance: Jake T., 14 variance events"*), and
         `_scoreCashIntegrity` scores the variance trend as a share of the cash handled
         ([[the-loop]] #122 — answer a "why does this exist" question by enumerating what READS it). */
      { h: 'Why drop a file you already have', p: ['Three of these rows take a report your POS already prints, and the point is never the total. It is what Bar Cop does with it after.', 'Tips decide whether each tipped employee cleared minimum wage once their tips are counted with their wage. Anyone who did not is owed makeup pay before payroll runs, and Pay Periods names them and the amount. Your POS tip report cannot tell you that.', 'Drawer counts are the same shape. Your POS gives you tonight\'s over and short; what it cannot do is look across ninety days, and that is where the Operations audit catches the same person coming up short again and again. One night is a number. The pattern is the finding.'] },
      /* ⛔ THIS SECTION DID NOT EXIST, AND SALES IS THE FIRST ROW ON THE PAGE. The help explained how
         to get HOURS in and said nothing about how to get SALES in beyond one clause in "What the
         week needs" — so the row an operator meets first was the one with no directions. Added with
         the week-total door (T135), and every claim below was walked on the live build: three
         numbers write ONE row for the week, the file drop still reads each day, and typing days
         over a week total replaces it. */
      { h: 'Getting the sales in', p: ['Enter the Week is the quickest way and it is two numbers: your bar sales and your food sales for the whole week, plus covers if you count them. Save Sales stores them; the week itself is closed by the confirm at the foot of the page. That is enough to close a week. Or drop your POS sales export in the box underneath and Bar Cop reads each day off it and shows you every row before anything saves. Enter by Day is there if you would rather key each day in yourself.', 'A week total is stored as the week, not split across seven days, because Bar Cop does not know what your Tuesday was. If the week already has days in it and you save a week total, it asks you first and says how many days it would replace. Filling the days in afterwards replaces the week total the same way.'] },
      { h: 'Getting the hours in', p: ['Import file on the Hours row opens a drop zone for your weekly timeclock export. Bar Cop reads the file, matches each row to your roster and rates, and shows you every row with what it worked out before anything is saved. Take out anything you do not want, then press the button to add them. Re-dropping the same file will not double-count, and a week that arrives in two files is fine. Open takes you to Log Hours if you would rather type them in.'] },
      { h: 'Cost of goods', p: ['If your counts happen to span this week, Bar Cop prices the cost of goods from them and says so. If they do not, you type it on the confirm. Counting weekly is not required, and Bar Cop will never book a month of usage onto one week.'] },
      { h: 'Confirming', p: ['Confirm the Week saves the week\'s figures. Anything missing reads as blank, so you can confirm now and fill the rest in later. Once it is confirmed the button reopens the same form so you can correct it.'] }
    ] },
    /* ⛔⛔⛔ REWRITTEN 2026-08-25 WITH THE PAGE (Kyle: *"make sure the i help is correct now"*). Two of
       its six sections described an app that no longer exists: "Read a section" listed *"the Recovery
       work: audits run, sales reviews, discrepancies filed, investigations opened, and experiments
       running"*, and "Why some numbers read a dash" opened *"The Recovery sections (Profit, Revenue,
       Cash)"*. MEASURED against the rebuilt page: it emits ZERO occurrences of investigation,
       experiment, sales review or Recovery, and Profit / Revenue / Cash are not sections — the two
       lines that produced investigations and experiments were cut at T69 when their stores turned
       out to be unregistered.
       ⚠ AND `verify-help-not-stale` COULD NOT HAVE CAUGHT IT, WHICH IS THE PART WORTH KNOWING. That
       ratchet derives its banned vocabulary from what the nav renders and proves each word is absent
       before banning it — and Profit, Revenue and Cash are all still live words, as the names of
       three of the four AUDITS. This is the same word in a different ROLE ("the Recovery sections"
       against "the Revenue audit"), which no vocabulary sweep can see. Pinned by
       `verify-week-review-accordion` block I against the page's OWN section table instead.
       ⭐ EVERY CLAIM BELOW IS READ OFF THE RENDERED PAGE, not from the plan: seven rows, the three
       band names, the three band labels inside a row, and the four cards that suffix a band because
       its figures are about today rather than about the finished week. */
    'week-review': { title: 'How Week in Review Works', sections: [
      { h: 'What this is', p: ['The recap of a week that has finished. One row for each part of the business, reading what your team logged and what those records turned up, so you can read one page and see how the week actually went.'] },
      { h: 'It only shows finished weeks', p: ['The most recent week you can open is the one that just ended, and the arrows step back from there. A week still being lived has only half its records in it, so a recap of it would report a bar that looks like it did nothing about a week nobody has finished. It opens on the last week you confirmed.'] },
      { h: 'Open a row to read it', p: ['Every row opens and closes. Inventory is open when you land; click any other heading to open it and click it again to shut it. Each heading says how much that part of the business logged, so you can scan the closed page and see which rows have anything in them.'] },
      { h: 'The three groups', p: ['What fed the week is the work that produced the week\'s records: Inventory, The Floor and Events. The week itself is the close, where sales, hours and your count came together. What the week fed is what reads finished weeks back: Run Audit, Menus and Books. That is the same order the Guide builds them in.'] },
      { h: 'Read a row', p: ['Done This Week is the activity that got logged, written out: counts and spot checks, deliveries and orders, hours and tips, the week\'s sales, drawer counts, bookings, bills. What It Turned Up is the result those records produced. Anything still open sits on the Hub instead, on that section\'s own card, so this page stays a record of the week that finished.'] },
      { h: 'Everything here is a record', p: ['Every figure on this page comes from something Bar Cop actually has on file for that week, never from a box anyone ticked. If a row logged nothing all week it says so once, instead of listing what did not happen.'] },
      { h: 'Some figures are about today, not the week', p: ['A few numbers cannot be pinned to a finished week because they only exist as they stand right now: what is below par, what is trapped on the shelf, your event pipeline, your menu, your runway. Those bands say so in their own heading, with Current Stock, Current Pipeline, Current Menu or Today after the label. Everything without that suffix belongs to the week you are reading.'] },
      { h: 'Why some numbers read a dash', p: ['The Week card carries the cost percentages, and they only exist once that week is confirmed, which rolls up its revenue, cost of goods and labor. If a week was never confirmed those cells read a dash and the card says so. You can still confirm a past week from Close The Week and the numbers fill in. A dash is an honest blank, never a made-up number.'] },
      { h: 'Export', p: ['Export PDF saves the week as a one-page report, named for the week it covers so two weeks never overwrite each other. It sits on the first group heading.'] }
    ] },
    'bar-cop-audit': { title: 'How the Operations Audit Works', sections: [
      { h: 'What this is', p: [
        'Your read on how well the whole operation is being run, separate from the Profit, Revenue, and Cash audits that hunt for dollars to recover. This one answers a different question: is the place being run with discipline. It scores entirely from the data you already log across Inventory, Shift, and The Floor, so there is nothing to upload. Run it whenever you want a fresh read.',
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
      { h: 'Landing and history', p: ['The landing holds the Generate button (run it whenever you want a fresh read; it scores your trailing 30 days), a live data badge showing what level the audit would come out at right now, the latest audit with its six section scores, and the Audit History list of past runs to reopen. Bar Cop keeps one audit a day so you can watch the trend. The top bar carries all four audits, Operations, Profit, Revenue and Cash, so you can move straight between them.'] }
    ] },
    /* ⛔⛔⛔ REWRITTEN 2026-08-08 FROM THE PAGE, NOT FROM THE PLAN (Kyle: *"the close the books and
       the money out page i help text is both wrong"*). Every one of the three sections below
       described a page that no longer exists: tiles up top, a Current Month card, Recent Months, a
       Coming Due side panel, Quick Actions, and "everything here is read-only". Measured on the
       shipped build: this page is Where You Stand, a progress banner, FOUR STEPS and an As Needed
       row, and the first step renders the money out form and its importer in place. "Read-only" was
       the exact opposite of true for the one step an operator does the most work in.
       ⛔ AND THE FORM AND IMPORTER SECTIONS BELONG HERE, not on Money Out. The one-ledger rebuild
       moved the add card onto this page and left the help behind on the ledger it came from. */
    
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
    'breakeven': { title: 'How Break-Even Works', sections: [
      { h: 'What this is', p: ['Break-Even is the one number that runs the business: the sales you need each week to cover your costs. Below it you are losing money, above it you are making it. Bar Cop already holds every input, so it just draws the line.'] },
      { h: 'How it is built', p: ['Your fixed costs, the nut, are your recurring operating-expense bills like rent, insurance, and utilities, plus your salaried (exempt) pay, which is the same every week no matter how sales move. Your variable rate is the share of every sales dollar that goes to product and hourly labor, read from your real logged weeks. Break-even is the nut divided by the dollars left after those variable costs. Keep your operating expenses, salaries, and weekly closes current and the number stays honest.'] },
      { h: 'Tracking against it', p: ['The strip up top shows last week against the line: cleared it and the amount is your profit, short and that is your gap, plus the day of the week you cross break-even at last week\'s pace. The eight-week table at the bottom shows the streak.'] },
      { h: 'What If', p: ['The what-if is a sandbox. Move your weekly sales, cut the nut, or trim the variable rate and watch break-even and your profit move, so you can see what a price change or a rent cut actually buys you before you commit. Hit Reset to snap back to your real numbers.'] }
    ] },
    'permits': { title: 'How Licensing Works', sections: [
      { h: 'What this page is', p: ['Tracks your permits and licenses by renewal date so none of them lapse. Add each one with its type, next renewal date and recurrence, and Bar Cop watches the calendar for you. Find it under The Floor, in Records.'] },
      { h: 'How the statuses work', p: ['A renewal more than 30 days out is On Track. Within 30 days is due soon and within 14 is more urgent, both flagged amber; once the date passes it is Expired, in red. Anything due soon or expired shows under Needs Attention here and on your Hub. Use the chips to filter the list by status.'] },
      /* ⚠ THIS PROMISED THE RENEWAL WOULD LOG THE COST "so your bookkeeper does not enter it twice",
         and it was doing the opposite: the row it wrote carried the permit's TYPE as its vendor, so
         the same fee off a bank statement imported as a second row. Build piece 5 closed that door. */
      { h: 'Marking one renewed', p: ['When you renew a permit, click Mark Renewed and set the next renewal date (Bar Cop suggests it from the recurrence). That is all this page does. What the renewal cost is a bill like any other: it comes in with your statement on Money Out, or you type it there once, and it lands on the Licenses and Permits line of your P&L.'] },
      { h: 'Worksheet', p: ['Worksheet prints a blank sheet to walk your office wall with. Write down every permit and licence you actually hold, its issuing agency and when it renews, then enter them here so Bar Cop watches the dates.'] },
      { h: 'Good to know', p: ['Bar Cop tracks the dates you enter. It does not verify that a permit or license is valid, current, or accepted by any agency, and it is not legal advice. Confirm requirements and deadlines with your issuing agency.'] }
    ] },
    /* ⛔⛔ RENAMED AND NARROWED 2026-08-08. The sidebar has said Money Out since the one-ledger
       rebuild and this still said Operating Expenses, which is the OLD name for half of what the
       page holds — cash outflows are the other half and are not operating expenses at all.
       ⛔ AND IT DESCRIBED CONTROLS THAT ARE NOT ON THIS PAGE. The rebuild moved the add form and the
       importer onto Close The Books (`hub-books-home` mounts `renderMoneyOut`), so "Two dates on the
       form" and "Importing" were instructions for a screen the reader was not on. Both moved to
       `books-home`, where the controls actually are. What is left is the LEDGER, which is what this
       page now is: three tabs, the stat strip, By Category and the log. */
    'operating-expenses': { title: 'How All Money Out Works', sections: [
      { h: 'What this page is', p: ['The record of everything that left the bank: the bills that are not COGS or labor (wages and salaries both live in The Floor, not here) plus the cash outflows that are not a cost of running the bar. You log it on the card at the top of this page; the tabs below are where it all lives afterwards, and it is what feeds the Month-End income statement so it shows a real operating income instead of stopping at prime cost.'] },
      /* ⚠ THIS SECTION DESCRIBED A PAGE THAT NO LONGER EXISTS, in four separate claims. It promised
         month cards for "this month and next", a Recurring/Variable split inside each, next month's
         recurring bills listed as Expected before they post, and Expense History as its own sidebar
         row. Build pieces 3+4 replaced all of it with three tabs over one ledger, T5 deleted the
         month cards, and the Expense History route went with them.
         ⚠ MEASURED ON THE DEPLOYED BUILD BEFORE REWRITING, not written from the plan: the sidebar
         is Close The Books / Money Out / Break-Even / Weekly P&L Brief / Month-End Books / Annual
         Review / Help, and the words "expected", "next month" and "upcoming" appear NOWHERE on the
         page. Nothing on it is forward-looking, so "Expected" had no referent at all.
         ⭐ The two facts worth having that no plan mentioned, both measured: the stat strip, the By
         Category table AND the log all follow the tab (Bills $5,455.83 + Cash Outflows $6,800.00 =
         All Money Out $12,255.83 to the cent), while the range chips move the LOG ONLY (7 -> 46 ->
         14 rows with the figures above unmoved). An operator reading a chip as a page-wide filter
         would misread every number on the screen. */
      { h: 'The three tabs', p: [
        'All Money Out opens on Bills: the money that comes in on a statement or an invoice, which is what rolls into your income statement. Cash Outflows is money that genuinely left the bank but is not a cost of running the bar, so Books keeps it off that statement: owner draws, loan payments, capital and equipment, tax remittances. All Money Out is the two added together. Everything follows the tab you are on, so the numbers up top, the By Category table and the log all describe that one kind of money.',
        'Up top you get this month, last month, year to date, and what it comes to as a share of revenue. By Category breaks those same periods out line by line so you can see which one moved. The log underneath is the whole back-record, newest first, with Edit and Delete on every row, so there is no separate history page to go to. The range chips sit above the log and filter the log only: the figures higher up keep their own periods whatever chip you pick.'
      ] },
      /* ⚠ THIS SECTION USED TO DESCRIBE A CHECKBOX, a How Often picker, an "Ends after" field and a
         Stop button. Build order C removed every one of them from the bill form — a bill recurs
         because it keeps happening, derived off the ledger — so the whole paragraph was instructions
         for controls that are not on the screen. Rewritten to what the app does, in the same words
         `hub-help.js` already uses ([[the-loop]] #61: retiring a feature is three greps, and the
         help text is the one nobody does).
         ⚠⚠ AND IT HAPPENED AGAIN IN THE SAME PARAGRAPH: it ended by telling the operator to "use
         Repeat to copy last month forward". `Repeat` was one of the three row actions deleted on
         2026-08-06 — measured, the word does not appear in this screen's live code at all, only in
         the comment recording its removal. The help outlived the control by two days. */
      { h: 'Recurring bills', p: ['Bar Cop works out which bills recur by watching what you actually log: drop two months of statements on Money Out and it picks up rent, insurance and your subscriptions on its own, and projects them onto your Cash Forecast. A bill that stops showing up stops being projected, so cancelling a service needs no extra step.'] },
      /* ⚠ AND THIS ONE WAS FALSE ON BOTH HALVES. Repairs stopped living in Shift Control at Phase 2
         item 12 and platform fees stopped living in the weekly numbers at build piece 2. It told the
         operator to keep two real deductions OFF the log that Books reads. */
      { h: 'Good to know', p: ['Every dollar that leaves the business is logged here, including repairs and 3rd-party platform fees. One log, one place to look, nothing counted twice.'] },
      /* ⭐⭐ THESE TWO CAME BACK FROM `books-home` WITH THE CARD (2026-08-23), VERBATIM. The topic they
         lived in described a page that no longer exists, but these two sections describe the FORM and
         the IMPORTER — and the form is at the top of this page now. The old topic's own comment said
         *"the form and importer sections belong here, not on Money Out"* because the card had moved
         the other way at the one-ledger rebuild; that reason expired the moment the card came back, so
         it is re-derived rather than inherited ([[the-loop]] #137/#138).
         ⚠ MOVED, NOT REWRITTEN. A replacement sentence is a new claim and gets the measurement the old
         one failed ([[lessons-paid-for]] #117); these are true as they stand. The one word that had to
         change is "On the money out step", which named a step that is gone. */
      { h: 'Two dates on the form', p: ['Date Submitted is just when you logged the bill and always stays on today, so you never touch it. Due Date is the one that matters: it is when the bill is actually due, and it is what the P&L timing runs from. When you bulk-enter your bills at setup, set each Due Date to the real due date, not today.'] },
      { h: 'Dropping a statement', p: ['On the card at the top of this page, switch the Add form to Import File and drop a CSV or Excel export from your bank or card. Map the columns once (date and amount are required) and Bar Cop remembers it. The file then stops on a check screen that takes the page: every row is listed with where it is going, grouped by category, with anything already logged held back and anything that is not an operating expense held back in its own card so it cannot be double counted. Nothing is saved until you press Add on that screen.'] }
    ] },
    /* !! THE 'cash-outflows' HELP TOPIC WAS DELETED HERE (2026-08-06). It was the info-button
       topic for the retired standalone Cash Outflows page and it died with the page. Cash
       Outflows is a TAB on Money Out now, and 'operating-expenses' above is the topic that
       describes it: its 'The three tabs' section covers Bills, Cash Outflows and All Money Out.
       Nothing routes to a 'cash-outflows' screen any more, so a topic keyed to one could only
       ever be opened by code that no longer exists. */
    'settings-profile': { title: 'How the Business Profile Works', sections: [
      { h: 'What this page is', p: ['Your operation\'s identity: bar name and location, your taxes and wage settings, and the service periods you run. One-time setup you revisit when something changes. Save it all with the one Save Data button below the card.'] },
      { h: 'Taxes and payroll', p: ['Set your sales tax rate, how often you file (monthly or quarterly), and your payroll tax percentage once here. Books, The Floor, and Events all read them, so you enter them in one place: the Month-End Sales Tax worksheet uses your rate, Cash Position uses it to size the money you have collected but already owe, and the Pay pages use your state minimum wage.'] },
      { h: 'Service periods', p: ['Turn on the dayparts you run, like Brunch, Lunch, Dinner, and Late Night. These set every shift-type field across Bar Cop, across the schedule and the daypart breakdowns. Add a custom one if your venue runs something different.'] }
    ] },
    'settings-targets': { title: 'How Targets Work', sections: [
      { h: 'What this page is', p: [
        'Every target here sets the line your real numbers get measured against across the Profit and Revenue audits, the Hub, and your confirmed week. Hit the target and the number reads green. Miss it and Bar Cop flags the gap and prices what it is worth to close.',
        'Industry defaults are pre-filled so you have a working line on day one. Set each one to your own goal as you learn your numbers. Each section saves on its own with its Save Data button.'
      ] },
      { h: 'Profit targets', p: [
        'Bar Pour Cost %: your liquor, beer, and wine cost as a share of bar sales. The lower the number, the more you keep on every pour. Most bars run 18 to 24 percent; the default is 22. Bar Cop grades your real pour cost against this on the Profit Audit and flags the categories running over.',
        'Food Cost %: your food cost as a share of food sales. Full-service kitchens usually run 28 to 35 percent; the default is 32. Set it to the margin your menu is priced for.',
        'Labor Cost %: total labor, hourly and salary, as a share of total sales. Most full-service operations target 28 to 32 percent; the default is 30. This is the line the schedule builds toward.',
        'Prime Cost %: pour cost plus food cost plus labor, the one number that decides whether the doors stay open. Keep it under 60 to 65 percent of sales; the default is 60. Get prime cost right and the rest of the P&L usually follows.'
      ] },
      { h: 'Revenue targets', p: [
        'Check Average: the average guest check you are aiming for. Bar Cop measures your real check average against it and sizes the upsell opportunity in dollars. Raise it as your menu and service push add-ons.',
        'Lunch, Dinner, and Bar RPLH: revenue per labor hour, the sales each worked labor hour brings in, set separately for each daypart since a slow lunch and a packed bar are not the same job. Build Schedule uses these to set target hours, so a higher RPLH target tightens the schedule.',
        'Event Close Rate: the share of event inquiries you turn into booked events. Events grades your booking pipeline against it. Set it to the close rate your sales process should hold.'
      ] }
    ] },
    'user-account': { title: 'How Your Account Works', sections: [
      { h: 'What this page is', p: ['Your password lives here, and every member can change their own. If you own the account, this is also where your subscription and your other bars live, and backing up or restoring your data has its own page, Data and Backup, one row down the sidebar.'] },
      { h: 'Password', p: ['Set a new password any time. This is the one thing everyone on the team can do here.'] },
      { h: 'Subscription and bars (owner only)', p: ['The owner sees the plan and status, with Manage Billing to update the card, pull past invoices, or change the plan, and Add Another Bar to start a second location on its own subscription. Admins and staff never see billing.'] },
      { h: 'Testing tools', p: ['Owner testing accounts only, and never in the demo. Load Sample Data fills every system with realistic records, Clear All Data wipes it, and Reset Onboarding replays first-run setup. For setting up and testing, not daily use.'] }
    ] },
    'user-data': { title: 'How Data and Backup Works', sections: [
      { h: 'What this page is', p: ['Everything that gets your data out of Bar Cop and back in. Because a backup is the whole account, this page is the account owner only. Admins and staff never see it.'] },
      { h: 'Your own copy', p: ['Export Backup writes the entire account to one file: settings, targets, weekly numbers, your Profit, Revenue and Cash audits, your Operations Audits, recipes, the fix log, your money out log, Permits, and every Inventory, Labor and Shift record. Keep it offsite. Restore from Backup reads that same file back to recover your data or move it to another account.'] },
      { h: 'Automatic backups', p: ['Bar Cop saves a full backup of this bar on its own, about once a day, so there is always a recent point to fall back to without you remembering anything. Pick a date in the list and Restore rolls the whole account back to how it stood then.'] },
      { h: 'Restore points you take yourself', p: ['Create Restore Point saves the account as it is right now. Take one before anything big: a price change across the menu, a bulk import, a first inventory count. Those are the only ones you can delete by hand, because the automatic dailies are the safety net and must not be crowded out.'] },
      { h: 'How far back it goes', p: ['Bar Cop keeps the last 30 automatic daily backups and the last 10 restore points you took yourself, each in its own pool so a busy day of manual saves can never push the dailies off the end.'] },
      { h: 'Changes the server would not take', p: ['This panel only appears when there is something in it. A change saved on this device that the server refused ends up here rather than disappearing quietly. Try Again re-sends it, Discard drops it for good. Nothing in that list blocks a restore.'] }
    ] },
    'user-team': { title: 'How Team Members Work', sections: [
      { h: 'What this page is', p: ['Where you invite the rest of your management, choose which areas each person can use, and manage who has access. Owners and admins only. Bar Cop is a manager tool: your floor staff work off printed worksheets, so the people you invite here are other managers and your bookkeeper, not every employee.'] },
      { h: 'The three roles', p: ['Owner is you, or whoever holds the card. Full access to everything, holds billing, and controls the whole team. Admin runs the bar day to day: they get the areas you grant plus your bar settings (Business Profile and Recovery Targets), but never billing. Staff gets only the areas you grant, plus their own password.'] },
      /* ⛔⛔⛔ REWRITTEN 2026-08-25 (Kyle: *"settings team i help was never updated after the
         permissions changes and still talks about sections no longer in the app"*). It was wrong
         twice, and the second one matters more than the names.
         · THE LIST WAS THE OLD MODULE SET: *"Inventory, Labor, Shift, Profit, Revenue, Cash, Events,
           Books, and the Operations Audit"*. MEASURED off `_permSections()` on the live build, the
           grid offers SEVEN: Inventory, The Week, Run Audit, The Floor, Menus, Events, Books. Labor
           and Shift are one section now, Profit / Revenue / Cash are GROUPS inside Run Audit rather
           than areas of their own, and The Week and Menus were missing from the help entirely.
         · AND IT SAID ACCESS WAS BINARY: *"Every area is either No Access or Full Access."* It is
           not. The grid grants a whole section OR the individual menu links inside it — the page's
           own explainer says so on screen: *"Tick Full Access to give a whole section, or tick only
           the menu links this member should have."* Telling an owner their only choice is all-or-
           nothing is telling them to over-grant.
         ⚠ WHAT DID NOT CHANGE, CHECKED RATHER THAN ASSUMED: there is still no read-only level
         (`sectionAllowed` is a boolean and `canAccessLevel` returns 'edit'), and "Business Profile"
         and "Recovery Targets" are still the real nav labels, so the roles paragraph stands.
         ⚠ THE COPY IS STATIC AND THE PIN IS DERIVED: `verify-week-review-accordion` block T reads
         `_permSections()` and refuses a list that has drifted from it, so the next section Kyle adds
         fails here instead of going stale for weeks. */
      { h: 'Access by section', p: ['Access is granted section by section, and you can go finer than a whole one. Tick Full Access to hand over everything in a section, or tick only the menu links that person should have; anything left unticked is hidden from them, on the Hub and in the menus. The sections are Inventory, The Week, Run Audit, The Floor, Menus, Events and Books. There is no read-only setting: a link they can open is a link they can use.'] },
      { h: 'Inviting', p: ['Enter an email, pick Admin or Staff, then tick Full Access on the sections they run and just the menu links they need on the rest. Send Invite emails a link to set a password; if they already have a Bar Cop login they join your team with no email. Bar Cop never asks for SSNs, bank details, or anything you would not keep in a binder.'] },
      { h: 'What an admin can hand out', p: ['An admin can build their own team, but only within their own reach: they can invite Staff (not other admins), can only offer areas they hold themselves, and can only manage the people they personally invited. Anyone you invited, the admins included, stays under your control alone. So you set an admin\'s ceiling once and everything they can grant flows from it.'] },
      { h: 'Managing members', p: ['Everyone on the account lists below, with a Pending tag until they accept. Only the owner changes roles from the dropdown, or hands off the account with Make Owner. Edit Access re-opens the area grid for a member; Remove takes them off and cuts access on the spot. You cannot change your own access or remove yourself.'] }
    ] },
    'audit-help': { title: 'Operations Audit Help', sections: [
      { p: ['The full Help and FAQ for the Operations Audit: what it measures, when to run it, and how it relates to your Profit, Revenue, and Cash audits.'] },
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
  _CONVERTED: new Set(['profit-forecast', 'audit-tracker', 't-playbook', 'r-audit', 't-audit', 't-presence', 't-this-week', 't-forecast', 't-fix', 't-dashboard', 't-help', 'r-forecast', 'r-server-check', 'r-menu-items', 'r-menu-planning', 'r-menu-engineering', 'r-price-calc', 'r-dog-test', 'r-help', 'recipe-cost-analysis', 'vendor-tracker', 'vendor-watch', 'vendor-scorecard', 'vendor-discrepancy', 'sales-integrity', 'cash-recon', 'help', 'ev-bookings', 'ev-calendar', 'ev-regulars', 'ev-pricing', 'ev-help', 'sc-drawers', 'sc-cash-control', 'sc-cash-history', 'sc-walked-tabs', 'sc-void-comp', 'sc-waste', 'sc-maintenance', 'sc-incidents', 'sc-licensing', 'sc-checklists', 'sc-checklist-templates', 'sc-preshift', 'sc-help', 'lc-build-schedule', 'lc-schedule-history', 'lc-log-hours', 'lc-pay-periods', 'lc-payroll-export', 'lc-tip-log', 'lc-tip-pool', 'lc-tip-history', 'lc-reports', 'lc-overtime-watch', 'lc-callout-log', 'lc-time-off', 'lc-positions', 'lc-staff-roster', 'lc-training', 'lc-help', 'ic-take-inventory', 'ic-count-history', 'ic-spot-check', 'ic-receive-delivery', 'ic-delivery-history', 'ic-order-sheet', 'ic-order-history', 'ic-par-suggestions', 'ic-transfers', 'ic-adjustments', 'ic-empties', 'ic-report-usage', 'ic-report-variance', 'ic-report-stock', 'ic-product-setup', 'ic-locations', 'ic-vendors', 'ic-prep-batches', 'ic-help', 'c-trapped', 'c-purchasing', 'c-forecast', 'c-audit', 'c-position', 'c-bridge', 'c-capital', 'c-help']),
  _protoGlobalClick(g) {
    if (g === 'hub')     return this.showHub();
    /* ⭐⭐ THE WEEK — ONE ROW, THREE TABS (Kyle, 2026-08-23). Close, Review and History became one
       tabbed page (`S.Week`), so the rail carries a single "The Week" row that lands on Close.
       ⛔⛔ THE THREE OLD IDS ARE KEPT ALIVE AS TAB TARGETS, AND THAT IS THE WHOLE SAFETY OF THIS
       CHANGE. Measured before any edit: `week-close` has 34 inbound references across 15 files,
       `week-review` 12 across 5, `week-history` 26 across 7, plus 64 harness files. Re-pointing 72
       call sites is how a change like this ships dead links by the dozen ([[the-loop]] #24 — a blind
       find-and-replace would have shipped nineteen at once last time). Every existing link keeps its
       id and simply lands on the tab it always meant.
       ⚠ HISTORY USED TO BE THE ODD ONE OUT and this is where that ended: it was the only MODULE
       screen in the rail, routed through `openScreen` so the module shell swapped first, and it had
       to have its rail mark repainted afterwards because `showApp` re-rendered the rail as PROFIT.
       None of that applies now — it is a tab on a hub page like its two siblings, so it is out of
       `_CONVERTED` and the repaint is gone with it. */
    /* ⚠ THE ID GOES STRAIGHT THROUGH. `S.Week.open` resolves a tab key OR a legacy screen id
       itself, off its own `LEGACY` map — the one place that pairing is written. An id→tab map here
       as well would be the same fact in two files, which is how the tab a link opens and the tab it
       claims to open drift apart. */
    if (g === 'week' || g === 'week-close' || g === 'week-review' || g === 'week-history') {
      return (window.S && S.Week) ? S.Week.open(g) : null;
    }
    /* ⭐⭐⭐ THE FLOOR LANDS ON BUILD SCHEDULE (Kyle, 2026-08-23: *"so the build schedule is the
       default page the user always lands on when clicking 'the floor' rail link"*). It goes through
       `_enter` rather than `navigate` because this section's pages live in other modules and
       `navigate` is module-internal — the wrong door here is three dead links, twice paid for.
       ⛔⛔ AND IT MUST NOT DEAD-END A SHIFT-ONLY MEMBER. The landing is a LABOR page, so merging
       Shift into this section would otherwise refuse the whole thing to somebody who could use
       Shift Control yesterday: `_enter` gates on the screen, and the rail row is their only way in.
       So it falls through to the first row in BAR ORDER they can open, and refuses only when they
       can open none of them. The order comes from the section's own nav, so there is no second list
       to keep in step, and the common case is still exactly what Kyle asked for.
       ⚠ THE FALLBACK IS NOT A PREFERENCE ENGINE. It does not remember, rank or guess — it takes the
       first door that opens, which is the same rule an operator reading the bar left to right would
       apply themselves. */
    if (g === 'floor') {
      if (!(window.S && S.Hub && S.Hub._enter)) return null;
      if (this.canAccess('lc-build-schedule')) return S.Hub._enter('lc-build-schedule', 'labor');
      let first = null;
      try {
        (SectionTabs.groupsFor('floor') || []).forEach(gr => gr.rows.forEach(r => {
          if (!first && r.screen && this.canAccess(r.screen)) first = r;
        }));
      } catch (e) { first = null; }
      if (first) return S.Hub._enter(first.screen, first.mod);
      return this.showNoAccess();
    }
    /* ⭐ MENUS LANDS ON BUILDER, the first link in its own bar. Same shape as The Floor: `_enter`
       rather than `navigate`, because these pages live in the revenue and profit modules and
       `navigate` is module-internal. The fallback is the same too — Summary is a `profit` page and
       the other four are `revenue`, so a member holding only one of those areas must still get into
       the section rather than meeting a refusal on the rail row. */
    if (g === 'menus') {
      if (!(window.S && S.Hub && S.Hub._enter)) return null;
      if (this.canAccess('r-menu-items')) return S.Hub._enter('r-menu-items', 'revenue');
      let first = null;
      try {
        (SectionTabs.groupsFor('menus') || []).forEach(gr => gr.rows.forEach(r => {
          if (!first && r.screen && this.canAccess(r.screen)) first = r;
        }));
      } catch (e) { first = null; }
      if (first) return S.Hub._enter(first.screen, first.mod);
      return this.showNoAccess();
    }
    if (g === 'audit') return (window.S && S.HubBarCopAudit) ? S.HubBarCopAudit.open() : null;
    if (g === 'books') return (window.S && S.HubOperatingExpenses) ? S.HubOperatingExpenses.open() : null;
    if (g === 'events') return this.jumpToSection('events');
    /* Settings and Sign Out joined the router when they moved off the top bar into the rail's
       bottom group. Settings keeps the gear button's exact rule rather than a second copy of it:
       Staff cannot reach Settings, but they still need Your Account to change their password, so
       they land there. Two spellings of one access rule is how they drift apart. */
    if (g === 'settings') return this._openSettingsForRole();
    /* ⛔⛔ THE HELP ROW'S BRANCH, AND IT IS THE HALF THAT MAKES THE ROW REAL (2026-08-24). A key in
       `_PROTO_BOTTOM` with no answer here renders a perfect row that does nothing on click, silently
       — the defect that reached Kyle four times in four days and the reason both routers now log an
       unhandled action instead of falling off the end.
       ⭐ IT DELEGATES TO THE SCREEN'S OWN OPENER, never a second copy of the mounting. `S.HubHelp.open`
       already calls `openHubFullPage('Help and FAQ', …, 'help')`, so the page, its title and the
       action that lights the rail row all stay in one place. */
    if (g === 'help')     return (window.S && S.HubHelp) ? S.HubHelp.open() : null;
    if (g === 'signout')  return this._signOut();
  },

  /* ── The section menu overlay ─────────────────────────────────────────────────────────────────
     FOUR WAYS OUT, and between them they cover the two things an operator can mean:
       a link inside it  -> navigate AND close   (landing on a page with the menu over it is the
                            whole reason auto-close won: MEASURED on the shipped Order Sheet, the
                            overlay would sit over 141px of a 248px product-name column)
       the same section  -> toggle closed, stay put
       another section   -> SWAP, do not close (browsing across sections must not cost two clicks)
       the screen / Esc  -> close, stay put
     ⭐ OPENING THE MENU IS NOT A COMMITMENT. Every exit that is not a link leaves the operator
     exactly where they were, which is what makes it safe to go looking. */
  /* ── The top bar's page name ───────────────────────────────────────────────────────────────────
     ⛔ A MIRROR, NEVER A THIRD SOURCE. Nine sites in this file already write the page name into
     `#topbar-title`, and `openHubFullPage` writes its own into `.hub-app .topbar .topbar-title`.
     Both of those topbars are display:none under chrome-on, but both are still correctly
     maintained, and one of them is read back for the PDF export title. Adding a tenth writer would
     be a hand-kept list of nine call sites, which is the shape that goes stale silently
     ([[harness-review-like-code]] #141). This copies whichever one the live shell owns.
     ⭐ WHICH SHELL IS LIVE IS ASKED THE ONLY RELIABLE WAY — `#app.hidden`. Guessing from
     visibility is the #1 source of false findings in this app ([[no-preview-server]]). */
  /* `force` is for the one page that has no topbar-title to mirror. Every module screen writes
     #topbar-title and every Hub-shell page goes through openHubFullPage(title, …), but the HUB
     ITSELF is neither: showHub swaps the whole view without a title write, so the bar kept
     whatever the previous page had left in it. It passes its own name in. */
  /* ⭐⭐ THE PAGE NAME IS READ OFF THE NAV LINK THE OPERATOR CLICKED, not from a second table.
     Kyle: *"make sure the page titles match the actual link text on the overlay menu."* Measured
     across eleven screens, two already disagreed — Events' landing was titled "Dashboard" over a
     link saying **Book The Events**, and the void log was "Void and Comp Log" over **Void and
     Comps**. Hand-correcting those two would have fixed today and nothing else; nine branches of
     `navigate` write those titles and any of them can drift again tomorrow.
     Reading `.nav-item.active .nav-label` makes the two agree BY CONSTRUCTION — there is only one
     string, and it is the one the operator just read in the menu.
     ⚠ The old topbar title stays as the FALLBACK, for any page that is not in a menu at all. */
  _pageNameFromNav() {
    const appEl = document.getElementById('app');
    const moduleShellUp = appEl && !appEl.classList.contains('hidden');
    const nav = moduleShellUp
      ? document.getElementById('sidebar-nav')
      : document.querySelector('.hub-app .sidebar-nav');
    const act = nav && nav.querySelector('.nav-item.active .nav-label');
    if (act && act.textContent.trim()) return act.textContent.trim();
    const src = moduleShellUp
      ? document.getElementById('topbar-title')
      : document.querySelector('.hub-app .topbar .topbar-title');
    return ((src && src.textContent) || '').trim();
  },

  // The rail label for a key, from the same four tables the rail itself renders.
  _railLabelOf(key) {
    const tables = [this._PROTO_GLOBAL, this._PROTO_BOTTOM, this._PROTO_SIGNOUT];
    for (const t of tables) for (const [k, l] of (t || [])) if (k === key) return l;
    return null;
  },

  _syncPageTitle(force) {
    const el = document.getElementById('tn-title');
    if (!el) return;
    const page = force || this._pageNameFromNav();
    // Only overwrite with something real, so a shell mid-swap never blanks the bar.
    if (!page) return;
    /* The section prefix goes on exactly the pages that HAVE an overlay menu, which is the same
       ten `_railHasMenu` already answers for. The Hub, Week in Review and Workflow have no menu and
       no parent, so they stand alone rather than being given a section they do not belong to. */
    /* ⭐ THE KEY, NOT JUST THE LABEL. The prefix is now a CONTROL that opens this section's overlay,
       so the click needs the rail key. Deriving both from the SAME `_railCtx` in the same statement
       is what makes it impossible for the bar to name one section and open another — the agreement
       is structural rather than something a second lookup has to keep in step. */
    /* ⭐⭐ A SECTION IS ONE THAT OWNS A MENU **OR** A BAR (widened 2026-08-23, for The Week).
       `_railHasMenu` answers "does this rail row open an overlay", which was the same question as
       "is this a section" right up until a section got a top-bar nav instead of an overlay. The Week
       has three links in the bar and no overlay at all, so the old test called it a plain page and
       the bar's own section ICON never rendered beside its links.
       ⛔ THE RAIL ROW IS UNCHANGED BY THIS, deliberately. `_railRow` still asks `_railHasMenu`, so
       The Week stays a `data-rail-go` row that navigates straight to Close — which is what it does
       today and what keeps it away from the section short-circuit that shipped the dead Audits row
       ([[lessons-paid-for]] #120). This widening is scoped to the TITLE, nothing else. */
    const barred0 = typeof SectionTabs !== 'undefined' && SectionTabs.on(this._railCtx);
    const secKey = (!force && (this._railHasMenu(this._railCtx) || barred0)) ? this._railCtx : null;
    const sec = secKey ? this._railLabelOf(secKey) : null;
    /* ⛔ `tn-title-sec`, NOT `tn-sec`. That name belonged to row 2's clickable section pills, whose
       CSS outlived the markup — so the prefix picked up their padding, hover fill and pointer
       cursor and read as a link that went nowhere. The pill rules are deleted now; the distinct
       name is belt and braces.
       ⭐ A REAL <button>, NOT A SPAN WITH A LISTENER. `verify-role-button-keyboard` exists because
       the one `role="button"` span in this app announced itself as a button and did nothing on
       Enter or Space. A real button gets both keys, the tab stop and the `:focus-visible` ring for
       free, and `#tn-help` two nodes along is the same trick — a button reset to look like bare
       text. Kyle asked for a control here; this is what a control is in this codebase. */
    /* ⭐ A SECTION WITH A TAB BAR SHOWS ONLY ITS NAME UP HERE (Kyle: *"the top bar where it
       currently has the section | section page i help.. just becomes the section i help"*). The
       group is on the tab bar and the screen names itself on the page, so repeating it in the bar
       is the third spelling of the same fact.
       ⛔ SCOPED TO THOSE SECTIONS, NOT GLOBAL. The other eight have no tab bar, so dropping the
       page name there would leave the operator with nothing in the chrome telling them where they
       are — a regression bought for a section that has not changed. */
    const barred = secKey && typeof SectionTabs !== 'undefined' && SectionTabs.on(secKey);
    /* ⛔ AND IT STOPS BEING A BUTTON. The section name opens the overlay menu, which a barred
       section no longer has — so with the short-circuit in place, pressing it would have JUMPED
       the operator to Take Inventory from wherever they were. Clicking the name of the section you
       are already in should never move you. The tabs are the menu now, so this is a label. */
    /* ⭐ A BARRED SECTION SHOWS ITS ICON, NOT ITS NAME (Kyle: *"replace the section name with the
       section icon.. so section icon then vertical divider then menu"*). The icon comes from the
       SAME `_RAIL_IC` → `_NAV_SECTION_IC` pair the rail row uses, so the bar and the rail can never
       show two different marks for one section. The divider is drawn by `.sec-links::before`, which
       keeps it attached to the links rather than floating between two independent nodes. */
    /* ⛔⛔ THE GUIDE SHOWS ITS ICON ALONE (Kyle, 2026-08-25: *"when on the guide page.. put just the
       guide icon up in the top bar just like the other top bar menus have the page icons.. no
       vertical divider since there is no menu.. just the icon"*).
       ⚠ IT IS SCOPED TO THIS ONE KEY ON PURPOSE, AND I LOOKED FOR A PROPERTY FIRST. Measured live:
       the Guide and the HUB are structurally identical here — both have `_railHasMenu` false, both
       are un-barred, and BOTH have a mark in `_NAV_SECTION_IC`. So "a rail row with an icon and no
       menu shows its icon" would put a mark on the Hub too, and Kyle asked for the Hub to be bare
       the day before (*"get rid of ... the hub page title"*). There is no property that separates
       them; this is a decision about one page, so it is written as one and said out loud rather than
       dressed up as a rule ([[lessons-paid-for]] #139 — a hand-kept list is a smell, but inventing a
       property the app does not have is worse).
       ⭐ NO DIVIDER COMES FOR FREE. The rule is drawn by `.sec-links::before`, which hangs off the
       LINKS container — and the Guide is un-barred, so `SectionTabs` renders no links and there is
       nothing for the rule to attach to. Nothing had to be suppressed.
       ⭐ AND IT REUSES `.tn-secicon` AND THE SAME `_RAIL_IC` -> `_NAV_SECTION_IC` PAIR the rail row
       reads, so the bar and the rail can never show two different marks for the Guide — the same
       agreement every barred section already has. */
    /* ⛔⛔ LOG OUT IS NOT IN THIS BAR ANY MORE (Kyle, 2026-08-25: *"move the log out down to where it
       currently is"*). It lived here for one day, between coming off the rail at T98 and going back
       to the rail's FOOT when the collapse was retired and freed that slot. The Hub renders nothing
       on this side again, which is what he asked for at T92 (*"get rid of ... the hub page title"*).
       ⭐ WHAT THE ONE DAY COST IS WORTH KEEPING: the branch shipped as `if (!force && _railCtx ===
       'hub')`, and `showHub` is the ONE of five call sites that passes an argument — so it was
       switched off on the only page it was for, and a desktop had no way out at all under a green
       gate. `!force` was a proxy for the CALLER LIST where the question is WHICH PAGE IS THIS
       ([[lessons-paid-for]] #140). Two such proxies survive below on `secKey` and `guideIcon`,
       measured redundant and ratcheted by `verify-signout-reachable` G6 so a third cannot appear. */
    const GUIDE_KEY = 'help';
    const guideIcon = (!force && this._railCtx === GUIDE_KEY)
      ? (this._NAV_SECTION_IC[this._RAIL_IC[GUIDE_KEY]] || '') : '';
    const secIcon = barred ? (this._NAV_SECTION_IC[this._RAIL_IC[secKey]] || '') : '';
    if (guideIcon) {
      el.innerHTML = '<span class="tn-secicon" title="' + esc(this._railLabelOf(GUIDE_KEY) || 'The Guide') + '"'
        + ' aria-label="' + esc(this._railLabelOf(GUIDE_KEY) || 'The Guide') + '">'
        + '<svg class="nav-icon" viewBox="0 0 17 17" fill="none">' + guideIcon + '</svg></span>';
      return;
    }
    el.innerHTML = (sec
        ? (barred
            /* ⚠ `_NAV_SECTION_IC` holds the svg's INNER content, not a whole element — the rail
               wraps it in `<svg class="rail-icon" viewBox="0 0 17 17">`. Same wrapper here, or the
               markup renders as nothing at all. Falls back to the section's NAME if the map ever
               loses the key, so the bar can never go blank. */
            ? '<span class="tn-secicon" title="' + esc(sec) + '" aria-label="' + esc(sec) + '">'
              + (secIcon ? '<svg class="nav-icon" viewBox="0 0 17 17" fill="none">' + secIcon + '</svg>'
                         : esc(sec)) + '</span>'
            : '<button type="button" class="tn-title-sec" data-rail-sec="' + esc(secKey) + '"'
              + ' title="Open the ' + esc(sec) + ' menu">' + esc(sec) + '</button>'
              + '<span class="tn-sep"></span>')
        : '')
    /* ⛔⛔ A PAGE WITH NO SECTION SHOWS NOTHING UP HERE (Kyle, 2026-08-24: *"get rid of the help and
       faq page title and also the hub page title"*). Those were the only two pages rendering a bare
       page name, and they rendered it because they belong to no section — so the honest rule is the
       property, not their two ids.
       ⭐ MEASURED BEFORE IT WAS WRITTEN, on the deployed build: all 11 rail rows plus 24 inner
       section pages walked, and EXACTLY TWO showed a bare `tn-pg` — the Hub and Help. Every other
       page is a barred section rendering its icon alone. So "no section" and "the two he named" are
       the same set today, and naming the two ids instead would have been a hand-kept list of what to
       suppress ([[lessons-paid-for]] #139).
       ⚠ THE `!page` GUARD ABOVE IS UNTOUCHED AND MUST STAY. The Hub still passes its own name in, so
       `page` is still truthy and a shell mid-swap still cannot blank the bar; the name is computed
       exactly as it was and simply is not painted. Removing the `force` argument as "now unused"
       would reintroduce the stale-title defect it was added for.
       ⚠ AND ONLY THE MIRROR CHANGES. `#topbar-title` and `.hub-app .topbar .topbar-title` are still
       written by their own nine call sites — both measure 0x0 under chrome-on, and one of them is
       read back for the PDF export title, so neither may be quietened.
       ⛔⛔⛔ IT KEYS ON `secKey`, NOT ON `sec`, AND THAT DISTINCTION IS THE WHOLE SAFETY OF IT. `sec`
       is the LABEL, and `_railLabelOf` returns null for a section that no longer has a rail row —
       measured: `profit`, `revenue`, `cash`, `labor` and `shift` are all still sections by
       `_isSection` while their rail rows were deleted at T67/T69, so all five have a menu and NO
       label. Written as `!sec` this would have blanked the bar for every one of them instead of
       showing the page name, which is a regression on five module keys bought for a change about
       two pages. `!secKey` asks the question actually being asked — IS THERE A SECTION — so a
       section whose label goes missing degrades to exactly what it renders today.
       ⭐ AND IT WAS CAUGHT BY MEASURING, NOT BY READING. 54 real landings were walked (11 rail rows,
       24 inner section pages, 9 hub and week pages, 10 Hub alert rows) and not one of them lands on
       those five, because `_railSectionForScreen` re-points every reachable screen to a barred
       section. So `!sec` would have shipped green and unreachable — and "unreachable today" is the
       thing that stops being true quietly ([[lessons-paid-for]] #61). Make it impossible, not
       unreached. */
      + ((barred || !secKey) ? '' : '<span class="tn-pg">' + esc(page) + '</span>');
  },

  /* The module title is written by nine different branches of `navigate`, several of which return
     early, so there is no single line to append to. An observer on the node they ALL write catches
     every one of them, including any added later — the same "derive it, do not list it" move the
     import census uses. The Hub-shell side gets one explicit call from `openHubFullPage`, because
     that node is created by hub.js after boot and there is exactly one writer. */
  _wirePageTitle() {
    const t1 = document.getElementById('topbar-title');
    if (t1 && window.MutationObserver) {
      new MutationObserver(() => App._syncPageTitle())
        .observe(t1, { childList: true, characterData: true, subtree: true });
    }
    /* ⛔ DELEGATED, AND IT HAS TO BE. `_syncPageTitle` rewrites `#tn-title`'s innerHTML on EVERY
       navigation, so a listener bound to the button itself is destroyed on the next page and the
       control silently stops working one screen in — the shape that looks fine in a single test and
       dead in real use. `#tn-title` is static markup in index.html, so one listener on it survives
       every re-render and there is nothing to re-bind. Same reasoning as the rail's own wire-once.
       ⚠ `_wirePageTitle` is called from exactly one place (the boot wiring), so this cannot stack.
       Pinned, because a second caller would give every click two handlers. */
    const title = document.getElementById('tn-title');
    if (title && !title._secWired) {
      title._secWired = true;
      title.addEventListener('click', (e) => {
        const btn = e.target.closest('.tn-title-sec[data-rail-sec]');
        /* Read the key off the BUTTON, not off `App._railCtx`. They agree today because the same
           render writes both, and reading the element keeps it that way if navigation ever becomes
           async: the click opens the section whose NAME the operator actually pressed. */
        if (btn) App.toggleRailMenu(btn.dataset.railSec);
        /* ⚠ THE `.tn-logout` BRANCH THAT SAT HERE WENT WITH THE CONTROL (2026-08-25). Log Out is a
           rail row again, wired by the rail's own `data-rail-go` loop, so a second handler here
           would be a door to a button nothing renders ([[the-loop]] #61 — retiring a feature means
           the render call AND the helpers whose only caller it was). */
      });
    }
    this._syncPageTitle();
  },

  /* ⛔⛔ THE RAIL COLLAPSE IS RETIRED (Kyle, 2026-08-25: *"retire the collapse"*), and it was
     MEASURED rather than argued. `--sidebar-w-coll` (52px) is inherited from the OLD 220px sidebar,
     where collapsing saved 168px. The rail redesign took the expanded width to 120px, so the same
     feature saved 68px — and the content area is capped at `max-width:1320px`, so on the deployed
     build it bought 68px at a 1280 viewport, **10px at 1440, and ZERO at 1450 and above**. The rail
     redesign had already delivered most of what collapsing was for, and nobody re-asked whether the
     leftover still earned its keep ([[lessons-paid-for]] #82 — when the thing a workaround was
     shaped around changes, re-read the workaround).
     ⭐ WHAT WENT WITH IT: `railCollapsed`, `applyRailCollapsed`, `toggleRailCollapsed`,
     `_RAIL_COLLAPSE_KEY`, the boot apply in `_wireRailMenu`, the `#rail-collapse` button, and ten
     `body.rail-collapsed` rules. `--sidebar-w-coll` STAYS — it still has readers on the old sidebar
     ([[the-loop]] #149: when you delete N of M registrations, read what each survivor is for).
     ⚠ THE `bc_rail_collapsed` LOCALSTORAGE KEY IS LEFT BEHIND ON DEVICES THAT SET IT. Nothing reads
     it now, so it is inert; a migration to delete it would be a write to every device to tidy a
     string nobody looks at. Said out loud rather than left implicit. */
  _railOpen: null,

  toggleRailMenu(key) {
    if (this._railOpen === key) { this.closeRailMenu(); return; }
    this.openRailMenu(key);
  },

  openRailMenu(key) {
    /* ⛔⛔⛔ THE ACCESS GATE, AND IT HAS TO BE THE FIRST THING. Every other refusal in this app is a
       page refusing itself, which meant a member with Books = No Access could still open the Books
       menu and read the whole list of what they cannot do — and reach anything in it that had been
       shipped without a gate of its own. Refusing the SECTION states the rule once, at the door the
       operator actually presses, instead of relying on N pages each remembering to ask.
       ⚠ BEFORE the fallback below, deliberately: that fallback navigates INTO the section, so
       checking after it would hand a blocked member the very screen this is refusing. */
    if (!this._railSectionAllowed(key)) { this.showNoAccess(); return; }
    /* ⭐ A SECTION WITH A TAB BAR HAS NO OVERLAY MENU. The rail row navigates straight in and the
       section's groups are on screen from then on, which is the whole point: the overlay showed the
       shape of the section and then took it away again the moment you chose a row.
       ⚠ AFTER the access gate, deliberately, for the same reason the gate is first — this
       navigates INTO the section, so checking after it would hand a blocked member the screen. */
    if (typeof SectionTabs !== 'undefined' && SectionTabs.on(key)) {
      /* ⛔⛔⛔ TWO KINDS OF SECTION, TWO DOORS — AND THIS LINE SHIPPED WITH ONE (fixed 2026-08-22,
         Kyle found it in one click: *"audit rail link doesn't work"*). A MODULE section lands
         through `jumpToSection`, which resolves `_SECTION_DASH`; a HUB section has no entry there
         and `jumpToSection` returns silently, which is a rail row that does nothing at all.
         ⚠ THE FALLBACK TEN LINES DOWN ALREADY MAKES THIS EXACT BRANCH and its comment already
         warns about this exact failure. I read that comment while adding the Audits section and
         still handed a hub key to the module door — naming a hazard is not checking for it
         ([[lessons-paid-for]] #18). MEASURED live: `_SECTION_DASH` has no 'audit' key, so the row
         was dead from the moment the section was switched on.
         ⚠ STILL AFTER THE ACCESS GATE, deliberately: both doors navigate INTO the section, so a
         blocked member must be refused before either one runs. */
      if (this._RAIL_HUB_CTX[key]) this._protoGlobalClick(key); else this.jumpToSection(key);
      return;
    }
    const nav = document.getElementById('rail-menu-nav');
    const hubCtx = this._RAIL_HUB_CTX[key];
    /* ⛔ NO DEAD END. If the overlay is not on the page for any reason, fall back to navigating
       into the section rather than swallowing the click. A rail row that silently does nothing is
       the dead-tab defect, and it is worse than a navigation the operator did not ask for.
       ⚠ The two kinds of section fall back through DIFFERENT doors: jumpToSection only knows
       module keys, so a hub section handed to it would return silently on the missing
       _SECTION_DASH lookup and produce the exact dead row this guard exists to prevent. */
    if (!nav || (hubCtx && !(window.S && S.Hub))) {
      if (hubCtx) this._protoGlobalClick(key); else this.jumpToSection(key);
      return;
    }
    /* ⛔⛔ CLEAR THE HUB RENDERER'S CACHE FIRST, AND THIS IS THE "Audits goes to the last section"
       BUG. `renderSidebar` early-returns on `nav._builtCtx === context` so an in-section navigation
       keeps the open drop-down. That cache lives on the NODE — and this one node is written by TWO
       renderers. Open Audits (sets _builtCtx='audit'), open Inventory (_renderNav overwrites the
       markup and never touches _builtCtx), open Audits again: the guard matches, it returns early,
       and the overlay is still showing Inventory.
       ⚠ MY OWN COMMENT ON THAT CACHE MISSED IT — it reasoned about two CONTAINERS keeping separate
       caches, which is true, and never asked what happens when one container has two writers. The
       overlay rebuilds on every open by design, so the cache has no job here at all. */
    nav._builtCtx = null;
    if (hubCtx) S.Hub.renderSidebar(hubCtx, nav);
    else this._renderNav(key, nav);
    /* ⛔⛔⛔ STRIP THE IDS FROM THE COPY. The overlay renders the section's OWN sidebar markup, which
       carries `id="nav-<screen>"` on every row — so opening a menu put a SECOND element with that id
       into the document, and `#rail-menu` sits before `#app`, so `getElementById` started answering
       with the overlay's row instead of the shell's.
       MEASURED: after clicking a link in the overlay, `#sidebar-nav .nav-item.active` was **(none)**
       — `updateNav` had marked the overlay's copy — and the page title fell back to the old
       `#topbar-title`, which is why Events read "Dashboard" over a link saying Book The Events.
       ⭐ THE CLASS OF BUG IS BIGGER THAN THE TITLE. Duplicate ids are invalid, and every
       `getElementById` in the app resolves by document order, so any of them could have started
       answering with the overlay's copy. The overlay routes by `data-screen` / `data-hub-action`
       and class, never by id, so it does not need them. */
    nav.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
    /* ⭐ THE SECTION'S NAME, AT THE TOP OF ITS OWN MENU. Kyle, walking it: open Labor's menu from an
       Inventory page and the top bar still reads "Inventory | Delivery History" directly above the
       list, 20px away and in the same column — so the bar reads as the menu's heading, for the
       WRONG section, and the eye skips the real first row.
       ⛔ It also closes a gap nobody had named: the overlay carried NOTHING saying which section it
       belonged to. The lit rail row is 120px away, and the whole point of his report is that the eye
       does not travel there.
       ⚠ Quiet on purpose — styled like the rail's own CONTROL / RECOVERY labels. A bold header would
       just move the eye-skip down one row; the first thing with weight in that column must stay
       Close The Week. And the text comes from the SAME `_railLabelOf` the title prefix uses, so the
       menu and the bar cannot disagree about what the section is called. */
    const secLabel = this._railLabelOf(key);
    if (secLabel) {
      const head = document.createElement('div');
      head.className = 'rail-menu-head';
      head.textContent = secLabel;          // textContent, never innerHTML
      nav.insertBefore(head, nav.firstChild);
    }
    this._railOpen = key;
    document.body.classList.add('rail-menu-on');
    this._markRailOpen();
  },

  closeRailMenu() {
    if (!this._railOpen) return;
    this._railOpen = null;
    document.body.classList.remove('rail-menu-on');
    this._markRailOpen();
  },

  /* ⛔⛔ ONE ROW IS MARKED AT A TIME, AND WHILE A MENU IS OPEN IT IS THE OPEN ONE.
     Kyle, walking it: *"it just is a little confusing visually to have the active section and the
     open menu section both colored at the same time."* He is right, and the reason is that the two
     marks were competing for the same meaning — the eye reads "highlighted" as "where I am", so two
     highlights ask the operator to hold two answers to one question.
     So the mark FOLLOWS THE MENU: open Shift from an Inventory page and Shift wears it while
     Inventory stands down. Close without navigating and Inventory takes it straight back. Navigate
     into Shift and it simply keeps it, because by then it really is the active section.
     ⭐ DONE BY MOVING THE `active` CLASS, not by a second set of colours. A CSS "stand down" rule
     needs `:not(.rail-open)` plus a matching hover override to out-specify itself, which is three
     rules that can disagree; moving one class means the DOM says exactly what the screen shows and
     there is only ever one styled state to maintain.
     `_railCtx` is the context the rail was last rendered with, which is what the mark reverts TO. */
  _markRailOpen() {
    const open = this._railOpen;
    const ctx = this._railCtx;
    document.querySelectorAll('#rail-nav .rail-item').forEach(el => {
      const isOpen = !!open && el.dataset.railSec === open;
      el.classList.toggle('rail-open', isOpen);
      const key = el.dataset.railSec || el.dataset.railGo;
      el.classList.toggle('active', open ? isOpen : key === ctx);
    });
  },

  _wireRailMenu() {
    const bd = document.getElementById('rail-menu-backdrop');
    if (bd) bd.addEventListener('click', () => App.closeRailMenu());
    /* Close AFTER the nav's own handler has run, so the navigation is never racing the teardown.
       Scoped to `.nav-item` on purpose: in mobile-style sidebars a `.nav-section` is an accordion
       HEADER that expands a group in place, and closing the menu on those would shut it every time
       the operator opened a drop-down to look inside. */
    const host = document.getElementById('rail-menu');
    /* ⛔⛔ CAPTURE PHASE, AND THAT IS THE WHOLE FIX FOR "none of the links work".
       `_renderNav` wires each row to a bare `App.navigate(screen)`, which renders into
       `#content-area` — inside `#app`, which is HIDDEN whenever the operator is on the Hub or in a
       different section. Browsing Inventory's menu from the Hub and pressing Order Sheet therefore
       painted the page into a hidden shell and looked like a dead link.
       `jumpToSection` has always known this (`showApp(key)` THEN `navigate(screen)`); the overlay
       is the first thing that could navigate ACROSS sections without going through it. Capture runs
       before the row's own listener, so the shell is up by the time navigate() fires. */
    if (host) host.addEventListener('click', (e) => {
      const item = e.target.closest && e.target.closest('.nav-item');
      if (!item) return;
      const sec = App._railOpen;
      // ⛔ MEMBERSHIP AGAIN. This asks "is the open overlay a module section", so that the shell is
      // swapped before navigating; it never wanted that section's landing screen. Reading the landing
      // map meant a retired cockpit would stop the swap and paint every cross-section jump into a
      // hidden shell — the dead-link defect this handler's own comment above records.
      if (sec && item.dataset.screen && App._isSection(sec)) {
        const appEl = document.getElementById('app');
        if (!appEl || appEl.classList.contains('hidden') || App._activeModule !== sec) App.showApp(sec);
      }
    }, true);
    if (host) host.addEventListener('click', (e) => {
      const item = e.target.closest && e.target.closest('.nav-item');
      if (!item) return;
      /* ⛔⛔ A HUB-SECTION ROW CARRIES data-hub-action, AND ITS HANDLER LIVES ON THE HUB SHELL'S
         OWN NODE, NOT ON THIS ONE. Rendering Books' menu into the overlay without this line paints
         every row correctly and does nothing on click — the dead-tab defect, which is why
         S.Hub.routeSidebarAction had to become a named member before these three sections could
         join. Module rows are already wired by _renderNav's own handlers, so they are left alone.
         The `.nav-disabled` and `enter` cases are handled inside the router, not duplicated here. */
      if (item.dataset.hubAction && window.S && S.Hub && S.Hub.routeSidebarAction) {
        S.Hub.routeSidebarAction(item);
      }
      setTimeout(() => App.closeRailMenu(), 0);
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') App.closeRailMenu(); });
  },

  _openSettingsForRole() {
    const role = (window.DB && DB.role && DB.role()) || null;
    if (role === 'staff') { if (window.S && S.HubUserAccounts) S.HubUserAccounts.open('account'); return; }
    /* ⛔ Was S.HubSettingsHome.open(). The landing is retired, so the door that used to pass
       THROUGH it goes straight to the first real settings page instead. */
    if (window.S && S.HubSettings) S.HubSettings.open('business-profile');
  },

  async _signOut() {
    await DB.signOut();
    this.showAuth();
  },
  /* ── The rail (2026-08-08) ────────────────────────────────────────────────────────────────────
     Renders the three rail tables into #rail-nav, marks the one entry that matches `context`, and
     wires each row. Same signature and same three callers it has always had (showHub,
     openHubFullPage, showApp), because `context` was already the right argument: every caller
     already knew which destination it was rendering.

     ⛔ A ROW IS EITHER A PLACE OR A CONTAINER, NEVER BOTH. A row carrying `data-rail-go` navigates
     on click; a row carrying `data-rail-sec` owns a section MENU, so it opens
     the overlay and goes nowhere — clicking Inventory must not drag the operator off the page they
     are reading just because they wanted to look at the menu. `data-rail-sec` marks the second kind
     so stage 2's overlay can find them; until it lands they fall back to jumpToSection, so no
     destination is unreachable mid-build. */
  /* ⛔ WHICH RAIL ROWS OWN A MENU IS A FACT ABOUT THE APP, NOT ABOUT WHICH TABLE A ROW SITS IN.
     Events lives in `_PROTO_GLOBAL` and Settings in `_PROTO_BOTTOM`, yet both have a full section
     menu; Hub, Review and Map sit in those same tables with none. Deciding from the table would
     have made Events navigate and Audits navigate purely because of where they were listed.
     ⭐ AND IT MATCHES THE MOBILE DRAWER EXACTLY, which was the tell that it is the right line:
     openMobileNav gives Hub / Map / Review leaf rows that navigate, and drills these same ten. */
  /* ⭐ `floor` is a HUB-style section for the same reason `audit` is: its pages live in other
     modules, so `_activeModule` cannot answer "where am I" for them and `_railSectionForScreen`
     has to. A MODULE section must never appear here or the resolver starts moving rail rows nobody
     asked about (pinned as the `ic-take-inventory` control). */
  _RAIL_HUB_CTX: { audit: 'audit', books: 'books', settings: 'settings', floor: 'floor', menus: 'menus' },

  /* ── THE PERMISSION MAP: WHICH BAR LINK OWNS THIS SCREEN ─────────────────────────────────────
     Built here and handed to `DB.registerSectionMap` because the source is the NAV, and the nav is
     app-side. `db.js` owns what a grant MEANS; this owns what the units ARE. One source for the
     bar, the drawer, the permission grid and the gate, so a group added to a section becomes a
     checkbox and a gate on the same day ([[the-loop]] #147 — a hand-kept list breaks every time the
     product legitimately changes, and the permission AREAS list is the one that already did: it
     still offers "Labor Control", "Shift Control" and three Recovery sections that do not exist).
     ⛔⛔ THE GATE ID IS NOT ALWAYS THE ROW'S ID, AND THAT IS THE WHOLE DIFFICULTY. A module row
     carries `data-screen` and is asked about directly. A HUB row carries an ACTION, and the page it
     opens gates on its own registered id — measured, every one of them is `hub-` + the action
     (`operating-expenses` -> `hub-operating-expenses`, `weekly-pnl` -> `hub-weekly-pnl`, and so on
     for `books`, `year-end`, `breakeven`). So the rule is derived rather than a five-entry table
     somebody has to maintain: prefer the `hub-` form WHEN IT IS A REGISTERED SCREEN, else the id
     itself. Getting this wrong makes those pages ungrantable, which fails closed and is invisible
     to owner-and-demo testing ([[lessons-paid-for]] #118/#128/#149).
     ⛔ SETTINGS IS EXCLUDED ON PURPOSE. It is ROLE-routed, not section-granted: every member reaches
     Your Account to change their own password, Data and Backup is owner-only and Team Members
     admin-only. Giving it checkboxes would create a way to lock somebody out of their own
     credentials. Kyle drew this line himself. */
  _permissionUnits() {
    const out = {};
    if (typeof SectionTabs === 'undefined' || !SectionTabs.ENABLED) return out;
    Object.keys(SectionTabs.ENABLED).forEach(sec => {
      if (!SectionTabs.ENABLED[sec] || sec === 'settings') return;
      let groups = [];
      try { groups = SectionTabs.groupsFor(sec) || []; } catch (e) { groups = []; }
      groups.forEach(g => {
        (g.rows || []).forEach(r => {
          const id = this._gateIdOf(r);
          if (!id) return;
          const at = sec + '/' + (g.name || '');
          (out[id] = out[id] || []);
          if (out[id].indexOf(at) < 0) out[id].push(at);
        });
      });
    });
    return out;
  },

  /* The id the GATE will be asked for this row. See the note above for why the `hub-` form wins
     when it is registered — and why it must be CHECKED against the registry rather than assumed:
     `_areaOf` has no `hub-` rule, so an unregistered id falls through to its `profit` default. */
  _gateIdOf(row) {
    const raw = (row && (row.screen || row.action)) || '';
    if (!raw) return null;
    const hub = 'hub-' + raw;
    if (window.DB && DB.SCREEN_GROUPS && DB.SCREEN_GROUPS[hub]) return hub;
    return raw;
  },

  /* ⭐⭐⭐ WHICH RAIL SECTION OWNS THIS SCREEN, WHEN THE ANSWER IS NOT THE MODULE IT LIVES IN.
     ⛔⛔ THE DEFECT IT CLOSES (Kyle, 2026-08-23): *"profit, revenue, and cash links when clicked go
     to the audit page.. but the top bar menu is gone and it defaults to their recovery sections...
     these three audits no longer live in recovery they live in audits."* Measured on the deployed
     build: the bar's Profit link landed `audit-tracker` correctly and left `_railCtx` on 'profit',
     the rail marking Profit, `#sec-links` hidden, and the top bar's left side empty. Three of the
     four audits threw the operator out of the section they were browsing, on arrival.
     ⭐ THE CAUSE IS AN ORDER, NOT A TABLE. `_enter` runs `showApp(mod)` first and `showApp` draws
     the top nav from `_activeModule` — at which point the destination is not known yet, so the bar
     is drawn for the module and never redrawn for the page.
     ⛔ SO THE FACT BELONGS TO THE SCREEN, NOT THE DOOR. These three ids are reached from several
     places (`_enter`, `_enterRecovery` from the Hub's money tiles and the weekly readout, audit
     action items, the rail overlay). A fact written by one of N doors is not written, so it is
     resolved from the id at the one point every module navigation passes through.
     ⛔⛔ DERIVED FROM THE NAV, NEVER HAND-TYPED. A screen belongs to a section when that section's
     own nav names it, off the same `navHTMLFor` source the bar, the sidebar and the drawer already
     read. A hand-kept list of "which screens are really audits" is the second copy that drifts.
     ⚠ HUB SECTIONS ONLY, AND THAT BOUND IS THE POINT. A MODULE section's screens live in that
     module, so `_activeModule` already answers correctly for them and this must stay inert — the
     Audits section is the one whose pages come from three OTHER modules. Pinned as `verify-section-
     tabs` I7 with `ic-take-inventory` as the control. */
  _railSectionForScreen(id) {
    if (!id || typeof SectionTabs === 'undefined') return '';
    const en = SectionTabs.ENABLED || {};
    for (const k in en) {
      if (!en[k] || !this._RAIL_HUB_CTX[k]) continue;
      const gs = SectionTabs.groupsFor(k);
      for (let i = 0; i < gs.length; i++) if (gs[i].rows.some(r => r.screen === id)) return k;
    }
    return '';
  },
  _railHasMenu(k) {
    // ⛔ MEMBERSHIP, NOT "HAS A LANDING SCREEN" — see the note on `_SECTION_DASH`. Reading that map
    // here meant a section lost its whole menu the moment its landing screen was retired.
    return !!this._RAIL_HUB_CTX[k] || this._isSection(k);
  },

  /* ⭐⭐⭐ CAN THIS MEMBER USE THIS SECTION AT ALL? (Kyle, 2026-08-12, using the app with a real
     scoped member: "if a member was permissioned to no access on books.. just clicking books in the
     rail menu should give the no access prompt and not the individual pages in the books overlay
     menu.") He is right, and the reason it was wrong is that nothing had ever asked this question:
     the refusals all lived one page deeper, so the menu opened, and any page in it that had been
     given no gate of its own was simply reachable.
     ⭐ THE RAIL KEYS AND THE GRANTABLE AREA KEYS ARE THE SAME NINE WORDS — inventory, labor, shift,
     profit, revenue, cash, events, books, audit. That is not a coincidence to lean on quietly, so
     `verify-area-access-doors` asserts the two sets are equal; if a section is ever added without a
     matching area, this returns false for it and the gate says so rather than opening it.
     ⛔ SETTINGS IS THE ONE SECTION THAT IS NEVER AREA-GATED, and it is not an oversight: a staff
     member reaches Your Account through it to change their own password (`_openSettingsForRole`
     routes them straight there, and `hub-user-accounts` refuses every other group). Blocking this
     menu would lock a member out of their own credentials. */
  /* ⛔⛔⛔ A SECTION IS OPEN IF THE MEMBER CAN REACH ANY PAGE IN IT, and that stopped being the
     same question as `areaAllowed(key)` the day a section's pages came from more than one area.
     THE DEFECT IT CLOSES, before it could ship: this function reads the RAIL KEY as an AREA KEY.
     The Floor merges Labor and Shift, nobody holds a `floor` key, and `_permissions['floor']` is
     undefined — so every scoped member would have been refused the whole section while the owner
     and the demo sailed through, because both short-circuit every gate. That is the class of defect
     that cannot be walked ([[lessons-paid-for]] #136).
     ⭐ DERIVED FROM THE SECTION'S OWN NAV, never a hand-kept map of "which areas is this section
     really made of" — the same source `_railSectionForScreen`, the bar, the sidebar and the phone
     drawer already read, so a row moving between sections carries its area question with it.
     ⭐ AND IT IS PROVABLY INERT FOR EVERY SECTION THAT SHIPPED BEFORE THIS. Measured first: every
     other section's nav resolves to exactly its own area key plus `_always`, so `some()` over that
     set is the same answer `areaAllowed(key)` gave. The ONE deliberate exception is Audits, whose
     nav spans profit, revenue, cash and audit: a Profit-only member can now open that rail row and
     reach the Profit Audit, where before the row refused them. Nobody gains a PAGE — every per-page
     gate is untouched — they gain the menu that offers the page they already owned.
     ⛔ THE FALLBACK IS NOT A CONVENIENCE. A section whose nav this cannot read (no markup, an
     unparsed shape) must answer exactly as it did yesterday rather than quietly opening: an empty
     derived set means "I could not measure", never "no areas required" ([[the-loop]] #23 — a claim
     about every member of an empty set is vacuously true, and that is the dangerous direction). */
  /* ⛔⛔ THE AREA WALK IS A LOCAL, NOT A SIBLING METHOD, AND THAT IS NOT A STYLE CHOICE. Three
     harnesses LIFT `_railSectionAllowed` and run it on their own bare `App` object; the moment it
     called a sibling, all three died with `this._sectionAreas is not a function` — one of them
     threw and printed no summary at all, which `_gate.js` can only see as "the suite got shorter".
     A helper that only its own member reads goes INSIDE that member, every time
     ([[the-loop]] #16/#120, and #13's "a new App.* helper breaks every harness stub at once"). */
  _railSectionAllowed(key) {
    if (key === 'settings') return true;
    /* ⭐⭐ A v2 MEMBER IS ASKED THE SECTION DIRECTLY, because under per-section permissions the
       section IS the unit — there is nothing to derive. The whole area-derivation below exists only
       because a grant used to be per AREA while a section's pages come from several of them; that
       question stops being asked the moment the grant is per section.
       ⛔ AND IT MUST COME FROM `DB`, NOT FROM READING `_permissions` HERE. The rail asking one way
       and the screens another is precisely the divergence `areaAllowed`'s own comment warns about,
       and it would show up as a menu that opens onto pages that all refuse — which is the shape
       Kyle reported on Books in August. One owner of the permission shape, two callers. */
    if (window.DB && DB.sectionAllowed && DB._isV2 && DB._isV2(DB.permissions && DB.permissions())) {
      return DB.sectionAllowed(key);
    }
    if (!window.DB || !DB.areaAllowed) return true;
    // Which permission areas the pages in this section's own menu actually resolve to.
    const areas = [];
    if (typeof SectionTabs !== 'undefined' && SectionTabs.groupsFor && DB._areaOf) {
      try {
        SectionTabs.groupsFor(key).forEach(g => g.rows.forEach(r => {
          if (!r.screen) return;
          const a = DB._areaOf(r.screen);
          // '_always' is the help marker, readable by anyone, so it can never be the reason a
          // section opens — counting it would open every menu that carries a Help row.
          if (a && a !== '_always' && areas.indexOf(a) < 0) areas.push(a);
        }));
      } catch (e) { areas.length = 0; }
    }
    return areas.length ? areas.some(a => DB.areaAllowed(a)) : DB.areaAllowed(key);
  },

  /* Every rail row carries an icon, from the SHARED section map, because the collapsed rail is
     icons alone — a row with no icon would simply vanish there. `_RAIL_IC` maps the rail's own keys
     onto that map. Every key here is now a straight pass-through except the three Week rows; the
     one entry that needed translating (`flowmap` → `blueprint`) went with the Workflow page. */
  /* ⚠ `week` KEEPS CLOSE'S MARK (`dash`) because that is the tab the row lands on — the least
     surprising thing for an operator who has been clicking "Close" there. The icon vocabulary is
     fixed (`_NAV_SECTION_IC` has 17 entries and none of them is a calendar), so this is a pick from
     what exists rather than a design decision; it is one word to change if Kyle wants another.
     ⚠ The three OLD keys stay: they are still the ids every existing link uses, and `_railLabelOf`
     and the mobile drawer both read this map by id. */
  _RAIL_IC: { hub: 'hub', week: 'dash', 'week-review': 'review', 'week-close': 'dash', 'week-history': 'history',
              audit: 'audit', events: 'events', books: 'books',
              /* ⚠ The Floor reuses the CREW mark that Labor Control carried, rather than new art:
                 it is the section of the schedule, the pay and the checklists, and the people mark
                 says that where the clock (Shift's) said only "now". The `labor` and `shift` keys
                 stay in `_NAV_SECTION_IC` because the phone drawer and the module shells still read
                 them. Design is Kyle's, one change at a time, so this is a reuse and not a choice. */
              inventory: 'inventory', floor: 'labor', menus: 'menus', labor: 'labor', shift: 'shift',
              profit: 'profit', revenue: 'revenue', cash: 'cash',
              /* ⚠ `help` ADDED 2026-08-24 with the rail row. The mark already existed in
                 `_NAV_SECTION_IC` (a question mark in a circle) and had no reader until now, which
                 is why this is a pass-through like every other entry rather than a new drawing. */
              settings: 'settings', help: 'help', signout: 'signout' },

  _railRow(k, label, context) {
    const isSection = this._railHasMenu(k);
    const ic = this._NAV_SECTION_IC[this._RAIL_IC[k]] || '';
    /* The `title` is not decoration: collapsed, the label is gone and the icon is all there is, so
       without it a row the operator does not recognise has no way to identify itself. Rendered
       always rather than only when collapsed, because the rail is not re-rendered on collapse. */
    return '<div class="rail-item' + (k === context ? ' active' : '') + '"'
      + ' title="' + esc(label) + '"'
      + (isSection ? ' data-rail-sec="' : ' data-rail-go="') + k + '">'
      + '<svg class="rail-icon" viewBox="0 0 17 17" fill="none">' + ic + '</svg>'
      + '<span class="rail-label">' + esc(label) + '</span></div>';
  },

  /* ⛔⛔ `markKey` IS WHICH BAR LINK TO LIGHT, AND A HUB PAGE HAS TO BE ABLE TO NAME ITSELF
     (2026-08-23). This passed `_currentScreenId` and nothing else. That field is set by `navigate`,
     so ONLY a module screen ever writes it — on the Operations audit it holds whichever module
     audit was open last. MEASURED live: land on Operations first and no link is marked at all;
     open Profit, come back to Operations, and **Profit stays marked while Operations is on
     screen.** `groupsFor` already keys a screen-less row on its hub ACTION, so one argument
     addresses both kinds of destination and the caller passes whichever it owns. */
  _renderProtoTopnav(context, markKey) {
    /* Remembered because `_markRailOpen` has to know what the mark reverts TO when a menu closes
       without navigating. Every caller already passes the right value; this just keeps it. */
    this._railCtx = context;
    /* ⛔⛔⛔ THE SECTION LINKS ARE DRIVEN FROM HERE, NOT FROM `navigate`, AND THAT IS THE FIX FOR
       "the menu is showing up on a lot of other pages". `_afterNavigate` only fires for MODULE
       screens; Books, Close The Week and every other hub-shell page is opened by `openHubFullPage`
       and never reaches it — so the Inventory links stayed on the bar over Books. This runs on
       EVERY shell render, hub pages included, and `context` is the rail's own idea of where the
       operator is, which is the only thing that knows about both kinds of page. */
    try { if (typeof SectionTabs !== 'undefined') SectionTabs.render(context, markKey || this._currentScreenId); }
    catch (e) { console.error('section links render failed', e); }
    const rail = document.getElementById('rail-nav');
    if (rail) {
      const r = ([k, l]) => this._railRow(k, l, context);
      rail.innerHTML =
          /* ⛔ SETTINGS IS BACK TO ONE DESKTOP DOOR (Kyle, 2026-08-24: *"the gear icon in the top
             bar between the i help and the rail button needs removed.. it only stays on rail
             menu"*). The gear lived here for one push; the rail row is the desktop door again, and
             the phone still reaches Settings through the burger drawer.
             ⭐ THE STAFF RULE IS UNAFFECTED because it never lived in either door: both called
             `_openSettingsForRole()`, and that is still the ONE implementation deciding where a
             member lands. Removing a door removes a caller, not the rule.
             ⛔⛔ AND SIGN OUT IS THE THIRD GROUP, BEHIND ITS OWN DIVIDER (same message: *"under the
             settings link put another divider and move the sign out link under that divider with an
             icon"*). It is the only row that ENDS THE SESSION rather than going somewhere, so the
             divider is not decoration — it is what keeps it from sitting flush under Settings, one
             mis-click from taking an operator out mid-shift. Pinned as the SEPARATION in
             `verify-signout-reachable`, never as the line, because this is the third spelling that
             property has had and each of the previous two fired on the change it existed to permit. */
          /* ⛔⛔ SIGN OUT LEFT THE RAIL ON 2026-08-25 (Kyle: *"get rid of the divider under guide and
             move logout to the top bar on the hub only... this is desktop only.. on mobile.. log out
             stays where it is under divider under guide link"*). The divider under Guide went with
             it — it existed to hold Sign Out off Settings, and with the row gone it separated
             nothing.
             ⭐ THIS IS DESKTOP-ONLY BY CONSTRUCTION, NOT BY A FLAG. `#proto-rail` is
             `display:none !important` under `@media (max-width:768px)`, and the phone builds a
             SEPARATE drawer from these same tables — `railGroup('Session', App._PROTO_SIGNOUT)`.
             Two renderers, one table: editing this one cannot reach the phone, which is exactly
             what he asked for. `_PROTO_SIGNOUT` therefore STAYS (verify-signout-reachable E1/E3).
             ⚠ AND THE WAY OUT MOVED RATHER THAN VANISHING: `_syncPageTitle` renders it in the top
             bar on the Hub. A desktop operator on any other page now reaches Log Out via the Hub —
             two clicks instead of one, which is Kyle's call and is flagged, not assumed. */
          '<div class="rail-group">' + this._PROTO_GLOBAL.map(r).join('') + '</div>'
        + '<div class="rail-divider"></div>'
        + '<div class="rail-group">' + this._PROTO_BOTTOM.map(r).join('') + '</div>';
      /* ⛔⛔ LOG OUT IS THE RAIL'S FOOT, PINNED BELOW THE SCROLLING NAV (Kyle, 2026-08-25:
         *"retire the collapse.. and move the log out down to where it currently is.. same divider
         line above log out"*). It took the slot the Collapse button held, which is why it is a
         separate host rather than a third group in the nav: MEASURED on the deployed build, the
         Guide row ended at y=445 and the Collapse button sat at y=722 — **277px apart**. A third
         `.rail-group` inside `#rail-nav` would have put it directly under Guide, which is where it
         was before T98 and is not what he asked for.
         ⭐ THE DIVIDER HE ASKED FOR IS THE FOOT'S OWN `border-top`, the same 1px `--b-edge` line
         the Collapse button carried — not a `.rail-divider` element. So the nav still contains
         EXACTLY ONE `.rail-divider` (the Settings/Guide split) and `verify-settings-section`'s
         assertion about that sequence is untouched.
         ⭐⭐ IT RENDERS FROM `_PROTO_SIGNOUT`, THE TABLE THE PHONE DRAWER ALSO READS. Hardcoding a
         button in index.html would have been a SECOND spelling of one control, which is the drift
         this pair has already had once ([[lessons-paid-for]] #63 — a fact written by one of N doors
         is not written). Two renderers, one table, exactly as before.
         ⚠ `_markRailOpen` STAYS SCOPED TO `#rail-nav`, DELIBERATELY. It marks the active section,
         and `signout` is never a section or a `_railCtx` — so the foot row can never be marked, and
         widening the query would only create a state that must never occur. */
      const foot = document.getElementById('rail-foot');
      if (foot) foot.innerHTML = '<div class="rail-group">' + this._PROTO_SIGNOUT.map(r).join('') + '</div>';
      /* ⛔ BOTH HOSTS GET WIRED. The rows are rebuilt on every render, so the listeners die with the
         nodes they were bound to and cannot stack — the same reason the nav's own wiring is safe. */
      const wireRows = (host) => {
        if (!host) return;
        host.querySelectorAll('.rail-item[data-rail-go]').forEach(el =>
          el.addEventListener('click', () => { App.closeRailMenu(); App._protoGlobalClick(el.dataset.railGo); }));
        host.querySelectorAll('.rail-item[data-rail-sec]').forEach(el =>
          el.addEventListener('click', () => App.toggleRailMenu(el.dataset.railSec)));
      };
      wireRows(rail);
      wireRows(foot);
      this._markRailOpen();
    }
    /* ⛔ THE SWITCHER RELOCATION IS GONE (Kyle, 2026-08-23). This used to lift
       `topbar-account-switcher` (and, until T123 deleted it, a second slot beside it) out of the
       old hidden `.topbar` and into `#tn-acct` in the visible bar, because a multi-bar picker had
       to live up here. It does
       not any more: *"that needs moved out of the top bar and replace the bar name on the hub.. and
       it only goes there."* `renderAccountSwitcher` now hides that slot at every unit count and
       fills `hub-greet-account-switcher` instead, so there is nothing to relocate and `#tn-acct`
       itself is deleted from index.html.
       ⚠ THE OLD SLOT IS HIDDEN BY THE MEMBER, NOT LEFT TO ITS PARENT. `.topbar` is only
       display:none under 768px and for `_CONVERTED` screens, so on a desktop non-converted page it
       still paints — leaving that slot to "whatever its parent does" would put the picker back
       on screen in the one place nobody would look for it. */
    /* THE RAIL — the one whole-bar read, reachable from every page.
       ⚠ WIRED ONCE, GUARDED BY A FLAG, because this function runs on every navigation and a second
       listener would open two stacked modals. The node is static markup in index.html, so it
       survives every render and there is nothing to re-bind. */
    const railBtn = document.getElementById('tn-rail');
    if (railBtn && !railBtn._wired) {
      railBtn._wired = true;
      railBtn.addEventListener('click', () => BarCopBriefing.open());
    }
    /* ⛔ SIGN OUT'S TOP-NAV WIRING IS GONE WITH ITS BUTTON (Kyle, 2026-08-24 — it is a rail row
       again). It needed the `_wired` flag because this function runs on every navigation and a
       second listener would have fired two sign-outs; the rail row needs no such guard, because the
       rail's rows are rebuilt by this same render and their listeners go with the old markup. */
  },

  // Section sub-group (drop-down) icons, keyed by the ORIGINAL sub-group name.
  // Shared by the mobile drawer (accordion headers) and the desktop mobile-style
  // sidebar. Only drop-down HEADERS use these; nested links stay icon-less.
  /* ⭐ THE SECTION ICONS, SHARED BY THE LEFT RAIL AND THE MOBILE DRAWER (hoisted 2026-08-08).
     It was a local const inside openMobileNav, so the rail would have needed a second copy of
     fifteen SVGs — and two icon sets for the same ten sections drift the moment one is edited.
     Same reasoning as _NAV_GROUP_IC directly below, one level up.
     ⚠ Each surface still PICKS from it: mobile keeps IC.audit for Review, the rail uses its own
     'review' key, because Review and Audits sit adjacent in the rail and reading as the same icon
     is worse there than the inconsistency. Shared map, explicit choices, no drift. */
  _NAV_SECTION_IC: {
    /* ⚠ `menus` is Menu Builder's OWN row mark, lifted rather than drawn (2026-08-23). This table
       had nothing that reads as a menu, and reusing `revenue` would have put two rail rows on one
       mark for as long as the Revenue row survives. Design is Kyle's, one change at a time, so this
       is a reuse of something the app already ships and not a choice made on his behalf. */
    menus:'<path d="M3.5 2.5h7l3.5 3.5v8.5h-10.5v-12z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M10.5 2.5v3.5h3.5M5.5 8h6M5.5 11h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
    hub:'<rect x="2" y="2" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="9" y="2" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="2" y="9" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.3"/>',
    /* `blueprint` was Workflow's icon and had exactly one reader, `_RAIL_IC`'s flowmap entry. Both
       went with the page on 2026-08-11 — an icon nothing can name is dead weight in a map every
       rail row reads. */
    audit:'<circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 8.5l2 2L12 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
    events:'<rect x="2" y="3.5" width="13" height="11" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 2v3M11.5 2v3M2 8h13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
    books:'<rect x="3" y="2.5" width="11" height="12" rx="0.5" stroke="currentColor" stroke-width="1.3"/><path d="M3 5.5h11M6 8.5h5M6 10.5h5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
    /* ⛔ A REAL TOOTHED COG, not the spoked star this used to be. Kyle: "the settings link gets the
       actual standard settings gear icon not the one the button currently has." The old one drew a
       circle with eight straight spokes radiating out, which reads as a sun or an asterisk at 17px;
       nobody recognises it as settings. This is the outline everyone does recognise.
       ⚠ It is the SHARED map, so the mobile drawer's Settings row gets the same icon. That is the
       point of sharing it, and one settings icon app-wide is the right answer anyway. */
    settings:'<circle cx="8.5" cy="8.5" r="2.4" stroke="currentColor" stroke-width="1.3"/><path d="M13.6 10.4a1.1 1.1 0 0 0 .22 1.21l.04.04a1.35 1.35 0 1 1-1.91 1.91l-.04-.04a1.1 1.1 0 0 0-1.21-.22 1.1 1.1 0 0 0-.67 1v.11a1.35 1.35 0 1 1-2.7 0v-.06a1.1 1.1 0 0 0-.72-1 1.1 1.1 0 0 0-1.21.22l-.04.04a1.35 1.35 0 1 1-1.91-1.91l.04-.04a1.1 1.1 0 0 0 .22-1.21 1.1 1.1 0 0 0-1-.67h-.11a1.35 1.35 0 1 1 0-2.7h.06a1.1 1.1 0 0 0 1-.72 1.1 1.1 0 0 0-.22-1.21l-.04-.04a1.35 1.35 0 1 1 1.91-1.91l.04.04a1.1 1.1 0 0 0 1.21.22h.05a1.1 1.1 0 0 0 .67-1v-.11a1.35 1.35 0 1 1 2.7 0v.06a1.1 1.1 0 0 0 .67 1 1.1 1.1 0 0 0 1.21-.22l.04-.04a1.35 1.35 0 1 1 1.91 1.91l-.04.04a1.1 1.1 0 0 0-.22 1.21v.05a1.1 1.1 0 0 0 1 .67h.11a1.35 1.35 0 1 1 0 2.7h-.06a1.1 1.1 0 0 0-1 .67z" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>',
    // Week in Review: a page with a tick. Distinct from `audit` on purpose — the two sit adjacent
    // in the rail, where reading as the same mark is worse than differing from the mobile drawer.
    review:'<rect x="3.5" y="2" width="10" height="13" rx="1" stroke="currentColor" stroke-width="1.3"/><path d="M6 5.5h5M6 8h5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M6 11.4l1.4 1.4 3-3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
    /* ⛔ WEEK HISTORY'S OWN GLYPH, carried over from the `nav-week-history` row it is replacing, so
       the icon an operator already associates with that screen does not change meaning when the row
       moves into the rail. ⚠ A key missing from this map renders an EMPTY icon and the row simply
       VANISHES in the collapsed rail, which is icons alone — the row is not broken, it is invisible. */
    history:'<path d="M5 4.5h9M5 8.5h9M5 12.5h9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="2.6" cy="4.5" r="0.7" fill="currentColor"/><circle cx="2.6" cy="8.5" r="0.7" fill="currentColor"/><circle cx="2.6" cy="12.5" r="0.7" fill="currentColor"/>',
    signout:'<path d="M6.5 2.5H3.8c-.7 0-1.3.6-1.3 1.3v9.4c0 .7.6 1.3 1.3 1.3h2.7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M10.8 11.3L14 8.5l-3.2-2.8M6.8 8.5H14" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
    inventory:'<path d="M2.5 5L8.5 2l6 3v7l-6 3-6-3V5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M2.5 5l6 3 6-3M8.5 8v7" stroke="currentColor" stroke-width="1.2"/>',
    labor:'<circle cx="6" cy="6" r="2.6" stroke="currentColor" stroke-width="1.3"/><path d="M1.8 14c0-2.6 1.9-4.2 4.2-4.2s4.2 1.6 4.2 4.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M11.5 4.2a2.4 2.4 0 0 1 0 4.6M12 14c0-2.4-1.3-3.9-3-4.1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
    shift:'<circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M8.5 5v4l2.5 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
    profit:'<path d="M2 13h11M4 13V8M7.5 13V4M11 13V9.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
    revenue:'<path d="M2 13l4-5 3 3 4.5-7M10 4h4v4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
    cash:'<circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M8.5 4.7v7.6M10.6 6.3c-.4-.6-1.2-1-2.1-1-1.2 0-2.1.6-2.1 1.6 0 2.1 4.3 1.1 4.3 3.2 0 1-.9 1.6-2.2 1.6-1 0-1.8-.4-2.2-1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>',
    /* ⚠ AN OPEN BOOK, NOT THE QUESTION MARK (Kyle, 2026-08-24: *"change 'help' to 'Guide' with a
       different icon"*). The old mark was a `?` in a circle, which is the universal sign for
       "support", and the row is not support any more — it is the manual.
       ⛔ THE KEY IS STILL `help` BECAUSE `_RAIL_IC` MAPS THE RAIL KEY, NOT THE LABEL. Renaming it to
       `guide` would mean re-pointing `_RAIL_IC` and two assertions for no behaviour change; the mark
       a key resolves is allowed to change without the key moving.
       ⚠ MEASURED AGAINST THE OTHER TEN RAIL MARKS BEFORE DRAWING IT, because two rail rows on one
       mark is two rows nobody can tell apart once the rail is collapsed to icons: the closest
       neighbour is `books`, a PORTRAIT rectangle with a top band and two short rules, which reads as
       a ledger. This is wide and low with a centre spine and two page blocks — a different
       silhouette at 17px, which is the size that decides it. `verify-global-help` B5 is the census
       that keeps every rail mark distinct from now on.
       ⚠ AND IT WAS DRAWN TWICE, BECAUSE THE FIRST ONE WAS MEASURABLY TOO SMALL. Rendered against
       the other ten rail marks it came back **10 x 10** where the set runs 11-13 wide and 10.6-13
       tall, so it would have read light beside `books` and `settings` on either side of it. This one
       measures **12.6 x 10.8, inset 2.2/2.8**, which sits between `books` (11x12) and `hub` (13x13).
       A mark is only right at the size it ships at, and that is a measurement, not an opinion.
       ⏳ DESIGN IS KYLE'S AND HE ASKED FOR "a different icon" WITHOUT NAMING ONE, so this is a pick
       from what the mark has to say, not a decision made on his behalf. Flagged for veto: one line. */
    help:'<path d="M8.5 4.4C7 3.3 5 2.8 2.2 2.8v9.2c2.8 0 4.8.5 6.3 1.6 1.5-1.1 3.5-1.6 6.3-1.6V2.8c-2.8 0-4.8.5-6.3 1.6z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" fill="none"/><path d="M8.5 4.4v9.2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
    bug:'<ellipse cx="8.5" cy="9" rx="3.5" ry="4.5" stroke="currentColor" stroke-width="1.3"/><path d="M5 9H2.5M14.5 9H12M5.5 5L4 3.5M11.5 5L13 3.5M5.5 13L4 14.5M11.5 13L13 14.5M8.5 4.5V3M7 4a2 2 0 0 1 3 0" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
    dash:'<path d="M2.5 4.2l1.2 1.2 2-2.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 4h6.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M2.5 8.7l1.2 1.2 2-2.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 8.5h6.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M2.5 13.2l1.2 1.2 2-2.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 13h6.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>'
  },

  _NAV_GROUP_IC: {
    /* ⛔ 'Analysis' WENT WITH THE GROUPS IT NAMED (T48, 2026-08-23). Profit, Revenue and Cash each
       opened with an "Analysis" group holding that section's forecast; all three forecasts moved
       into the Books bar and all three groups went with them, so this key stopped naming anything
       the tree can emit. Removed in the edit that orphaned it ([[the-loop]] #105 — retiring a
       feature orphans its helpers in the SAME edit, and the ratchet is what remembers otherwise).
       ⚠ MEASURED, NOT ASSUMED: 12 of the 29 keys in this table name nothing today. Ten of those
       pre-date T48 and are left alone deliberately — deleting one of twelve is tidiness, not a fix,
       and the population is on THE LIST as its own item. This one is here because this change made
       it a ghost. */
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
    /* ⭐⭐ ADDED WITH THE GROUP IT NAMES (Kyle, 2026-08-23: Inventory's "Operations" became "Logs").
       ⛔ RENAMING A GROUP DROPS ITS PHONE ICON, SILENTLY — the drawer keys an accordion header off
       this table BY NAME and `GIC[g.group] || ''` fails soft, so the header just loses its mark and
       nothing says so. `N1` caught this rename within a minute of it being made, which is the second
       time that pin has paid for itself ([[lessons-paid-for]] #132).
       ⚠ ADDED, NOT RENAMED: Shift still has an "Operations" group of its own, so the gear above is
       still live and moving it would have taken Shift's mark instead.
       ⭐ THE MARK IS THE APP'S OWN LOG-LINES ICON, lifted from the `History` key rather than drawn —
       three ruled lines with bullets is what this codebase already uses for a list of past records,
       and `History` names no group today, so nothing is taken from anything. */
    'Logs':'<path d="M5 4.5h9M5 8.5h9M5 12.5h9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="2.6" cy="4.5" r="0.7" fill="currentColor"/><circle cx="2.6" cy="8.5" r="0.7" fill="currentColor"/><circle cx="2.6" cy="12.5" r="0.7" fill="currentColor"/>',
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
    /* ⚠ RENAMED WITH ITS GROUP, NOT LEFT BEHIND (T48, 2026-08-23). Books' "Accounting" heading
       became "Statements" when the section's groups became its bar links, and the phone drawer takes
       an accordion header's mark from THIS table by the group's NAME (`GIC[g.group] || ''`) — so
       renaming the group and not the key drops the icon off that header silently. Same three rows,
       same icon, new name. Found by the reader sweep, not by looking at the phone
       ([[lessons-paid-for]] #111 — the plan names what you change, only a sweep of who READS it
       names what breaks). Pinned by `verify-section-tabs` N1. */
    'Statements':'<rect x="3" y="2.5" width="11" height="12" rx="0.5" stroke="currentColor" stroke-width="1.3"/><path d="M3 5.5h11M6 8.5h5M6 10.5h5M6 12.5h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
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
    /* Every section FAQ row, in both spellings the nav uses: `ic-help` / `ev-help` arrive as a
       `data-screen`, `books-help` / `audit-help` / `settings-help` as a `data-hub-action`. Named
       once so there is a single definition to check, and used at exactly one place (row admission
       in `groupsOf`) so it can never reach the rail rows the drawer's root is built from. */
    const FAQ_ROW = /(^|-)help$/;
    const groupsOf = (htmlFn, keepSupport) => {
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
            /* ⛔ THE SUPPORT ROWS ARE DROPPED EVERYWHERE EXCEPT SETTINGS (Kyle, 2026-08-12: "on the
               settings menu the contact support and report a bug links are both missing").
               ⭐ WHY NOT SIMPLY UNFILTER: `Report a Bug` is rendered by all SEVEN module sidebars
               (nav.js) plus Books and Audits, so letting it through everywhere would repeat one row
               in nine drawer panels — which is what this filter was written for and it is right
               about those. It was WRONG about Settings, where the Support group actually lives, and
               filtering it there left a phone with no route to support at all. One place, and this
               is the one. */
            /* ⛔⛔⛔ NO SECTION FAQ REACHES THE PHONE, IN ANY SECTION (Kyle, 2026-08-24: *"the mobile
               menu should not have any help links/pages.. in any section... just the guide page on
               the main menu... if the help pages were removed from the desktop menus.. why wouldn't
               they be removed from the mobile menu too? it is the exact same app"*).
               ⭐ THE DESKTOP ALREADY DROPPED THEM and this is the phone catching up, not a new rule:
               a section with a tab bar loses its whole Support group through
               `SectionTabs.ASIDE_GROUP`, and Settings' FLAT table maps seven of its eight actions
               with Help deliberately left out. The drawer reads the SAME `navHTML` and kept them, so
               five sections carried a FAQ row nothing on a desktop can reach — measured on the
               pushed build: inventory, audit, events, books, settings.
               ⛔ BOTH SPELLINGS, AND THAT IS THE WHOLE DIFFICULTY. A hub section writes its FAQ as
               `data-hub-action="books-help"`; a module section writes `data-screen="ic-help"`. A
               filter that knew one would have left Events and Inventory carrying theirs and reported
               a clean bill ([[lessons-paid-for]] #118 — a corpus is what it reads, a pattern is what
               it can SEE). Measured against the shipped nav before it was written: exactly five rows
               match, all of them labelled "Help and FAQ", and NOTHING else in the tree ends in
               `-help`, so it cannot over-reach.
               ⚠ NOT INSIDE `!keepSupport`. Settings loses its FAQ too — "in any section" — and it is
               the one section that keeps Contact Support and Report a Bug, which this must not touch.
               ⭐ AND IT SITS HERE, AT ROW ADMISSION, SO THE EMPTY GROUP GOES WITH IT FOR FREE:
               `groupsOf` already ends `return out.filter(g => g.pages.length)`. On four of the five
               the FAQ was the ONLY row left in Support once Report a Bug is dropped below, so
               filtering the row anywhere further downstream would leave a divider over nothing —
               the exact chrome defect `_PROTO_WEEK` and `_PROTO_CONTROL` were DELETED, not emptied,
               to avoid. Measured live: the Inventory drill ended `divider · Help`.
               ⛔ THIS IS THE FAQ PAGES ONLY, NEVER THE "i" (Kyle, same message). The top-bar help
               icon is the directions for the screen in front of you and is a different mechanism
               entirely; it is untouched by this and by everything in this member. */
            const k0 = el.dataset.hubAction || el.dataset.screen || '';
            if (FAQ_ROW.test(k0)) return;
            if (!keepSupport) {
              if (el.dataset.nav === 'report-bug') return;
              const a0 = el.dataset.hubAction || '';
              if (a0 === 'report-bug' || a0 === 'contact-support') return;
            }
            const action = el.dataset.hubAction || '';
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
        'breakeven':          () => S2.HubBreakEven && S2.HubBreakEven.open(),
        'books':              () => S2.HubBooks && S2.HubBooks.open(),
        'year-end':           () => S2.HubYearEnd && S2.HubYearEnd.open(),
        'permits':            () => S2.HubPermits && S2.HubPermits.open(),
        'operating-expenses': () => S2.HubOperatingExpenses && S2.HubOperatingExpenses.open(),
        'books-help':         () => S2.HubBooksHelp && S2.HubBooksHelp.open(),
        'settings-profile':   () => S2.HubSettings && S2.HubSettings.open('business-profile'),
        'settings-targets':   () => S2.HubSettings && S2.HubSettings.open('recovery-targets'),
        'user-account':       () => S2.HubUserAccounts && S2.HubUserAccounts.open('account'),
        'user-data':          () => S2.HubUserAccounts && S2.HubUserAccounts.open('data'),
        'user-team':          () => S2.HubUserAccounts && S2.HubUserAccounts.open('team'),
        'settings-help':      () => S2.HubSettingsHelp && S2.HubSettingsHelp.open(),
        /* ⛔⛔ THESE TWO WERE MISSING AND IT SHIPPED (Kyle, 2026-08-12: "both the support and bug
           report links close the menu and that is it.. the popup forms do not show").
           ⭐ THE CAUSE IS THE SHAPE, NOT THE TYPO: this map only ever needed the actions the drawer
           could REACH, and these two were filtered out of every panel — so the day the filter was
           lifted for Settings, two rows arrived at a router that had never heard of them.
           `if (r[p.action])` then does nothing, `fire()` has already closed the sheet, and the row
           reads as dead. Unfiltering a row and routing it are ONE change, not two.
           ⚠ Same `openModal || open` shape as `Hub.routeSidebarAction`, because these two open a
           MODAL rather than a page and the desktop door already decides that. */
        'report-bug':         () => S2.HubReportBug && (S2.HubReportBug.openModal || S2.HubReportBug.open).call(S2.HubReportBug),
        'contact-support':    () => S2.HubSupport && (S2.HubSupport.openModal || S2.HubSupport.open).call(S2.HubSupport),
        'help':               () => S2.HubHelp && S2.HubHelp.open(),
        /* ⛔⛔⛔ THE WEEK'S THREE PAGES. Added 2026-08-23 with the drawer drill, and this map's own
           comment above predicted it word for word: a row that could not be REACHED does not need a
           route, right up until it can. The moment The Week stopped being a leaf, three rows arrived
           at a router that had never heard of them — the third time in three days that a bar or
           drawer row met a router with no branch for it.
           ⭐ DELEGATED to the same door the rail presses, never a fourth copy of the resolution. */
        'week':               () => App._protoGlobalClick('week'),
        'week-close':         () => App._protoGlobalClick('week-close'),
        'week-review':        () => App._protoGlobalClick('week-review'),
        'week-history':       () => App._protoGlobalClick('week-history')
      };
      if (r[p.action]) r[p.action]();
      /* ⛔ AND AN UNROUTED ROW IS LOUD NOW, for the same reason `routeSidebarAction` reports one:
         `if (r[p.action])` failing is completely silent, the sheet has already closed, and the row
         just reads as dead. Every one of these has reached Kyle rather than the error digest. */
      else if (p.action) console.error('routePage: no route for action "' + p.action + '"');
    };
    /* ⭐ ONE DOOR. This was the ten-key resolver and it is now the caller of it — `App.navHTMLFor`
       is the same table, moved up so the section-links bar reads the SAME source instead of keeping
       a one-key copy of it (T33). Behaviour is unchanged for this caller; the errors are logged now
       rather than swallowed. */
    const navHtml = (k) => App.navHTMLFor(k);

    // Build the nav tree as nodes for a drill-in (push) menu. A node has groups
    // of rows; a leaf row navigates, a parent row pushes its child node. Only one
    // flat, uniform list shows at a time, so it stays clean however deep the nav
    // goes. The section/sub-group holding the current page are marked so the menu
    // opens drilled-in there with that page highlighted.
    const IC = App._NAV_SECTION_IC;
    // Group (drop-down) icons live on App._NAV_GROUP_IC (shared with the desktop
    // mobile-style sidebar). Only accordion HEADERS use them; nested links don't.
    const GIC = App._NAV_GROUP_IC;
    const pageItem = (p) => ({ label: p.label, id: p.screen || p.action, icon: p.icon || '', go: () => routePage(p) });
    // Mobile-only label remaps (do NOT touch the desktop sidebars).
    /* ⛔ EMPTIED 2026-08-23, AND BOTH ENTRIES WERE GHOSTS I LEFT BEHIND. A remap only applies to a
       MULTI-PAGE group (`sectionNode` reads it in the accordion branch; a one-row group becomes a
       leaf and never consults it), so both keys had stopped naming anything real:
       · `audit: 'By Recovery System'` — that group was replaced by Operations/Profit/Revenue/Cash
         when the Audits section was built, and the exemption outlived it by two days.
       · `events: 'Bookings'` — still a group name, but it holds ONE row now, so the branch that
         would rename it never runs.
       ⭐ An exemption that names nothing real is the shape that made three harnesses fire during the
       Fix retirement ([[lessons-paid-for]] #115). Pinned by `verify-section-tabs` L, which refuses
       any remap key that is not a real multi-page group in that section's own nav — so the next one
       cannot outlive its reason. The table stays (empty) because the mechanism is still correct and
       a future regroup may want it. */
    const GROUP_REMAP = {};
    const PAGE_REMAP  = {};
    // A section node lists its sub-groups as single-open ACCORDIONS (they expand
    // inline) plus any leaf pages. Leaf rows (Dashboard, single-page groups, Help)
    // keep their icons; the accordion sub-group HEADERS now carry a group icon
    // too. The only rows with no icon are the final links nested under a drop-down.
    const sectionNode = (label, key, homeFn, homeLabel, panelTitle) => {
      const sgs = groupsOf(() => navHtml(key), key === 'settings');
      const gr = GROUP_REMAP[key] || {};
      const pr = PAGE_REMAP[key] || {};
      /* ⚠ THE "Help and FAQ" -> "Help" RELABEL WENT WITH THE ROWS IT SERVED (2026-08-24). It existed
         so a long FAQ label did not wrap in a drill panel; `groupsOf` now refuses every FAQ row
         before it can reach here, so that line could only ever be dead code. A retirement orphans
         its helpers in the SAME edit ([[lessons-paid-for]] #105) — leaving it would be one more
         thing reading as live to the next person who greps for how the drawer names its help. */
      const mkPage = (p) => { const it = pageItem(p); if (pr[it.label]) it.label = pr[it.label]; return it; };
      const items = [];
      /* ⚠ THE ID IS FOR THE HIGHLIGHT, so it names where the row goes. The `Close The Week` branch
         that used to live here went with the six duplicate rows it served. */
      const homeId = App._SECTION_DASH[key] || ({ books: 'operating-expenses' })[key] || '';
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

    /* ── THE MOBILE DRAWER IS THE RAIL, IN THE RAIL'S OWN ORDER ─────────────────────────────────
       Kyle, 2026-08-10: *"mobile menu should match the desktop... hub, audits, events, books..
       divider close, review, history, divider.. inventory, labor, shift, divider.. profit, revenue,
       cash, divider.. settings."*
       ⛔⛔ SO IT IS GENERATED FROM THE FOUR RAIL TABLES, NOT HAND-LISTED BESIDE THEM. Two menus
       written out separately are two things to keep in step, and they had ALREADY drifted: this
       drawer was missing Close and History entirely while carrying Settings up beside Books, and the
       six section rows each carried a duplicate "Close The Week" home. Reading the tables makes
       "they match" structural instead of a promise someone has to remember.
       ⛔ AND THERE IS EXACTLY ONE LINK TO CLOSE THE WEEK NOW — the Week group's own `Close` row. The
       six per-section copies are gone: they made sense when every section HAD a close-the-week page,
       and that stopped being true.
       ⚠ WORKFLOW IS IN NEITHER MENU: Kyle is deleting that page. Removed from `_PROTO_BOTTOM` too,
       so the rail and the drawer drop it together rather than one at a time.
       ⚠ THE SECTIONS KEEP THEIR DRILLS — they have real sub-pages. What they lost is the HOME ROW,
       which `sectionNode` only pushes `if (homeFn)`; the same shape Audits has always had. Events
       and Books keep theirs because their landing pages are real and survive. */
    const railRow = (k, label) => {
      const icon = IC[App._RAIL_IC[k]] || '';
      // Sections drill into their own pages; everything else is a leaf that goes straight there.
      if (App._isSection(k)) return drill(label, k, null, null, icon);
      /* ⛔⛔⛔ A ROW DRILLS IF IT HAS PAGES, AND THIS WAS A HAND-KEPT TRIO UNTIL 2026-08-23 (Kyle, on
         the phone: *"the week goes straight to the close the week page.. with no way to reach the
         other two pages"*). It read `k === 'audit' || k === 'books' || k === 'settings'`, so The Week
         fell to the LEAF branch and opened Close with no route to Review or History anywhere on a
         phone. That was survivable while the three were TABS on one page — the tabs were the phone's
         way through — and it stopped being survivable the moment the tabs were cut.
         ⭐ DERIVED NOW: `navHtml(k)` is the one nav-source resolver, so a key with pages drills and a
         key without stays a leaf. Hub and Sign Out resolve to '' and are unaffected; Books keeps its
         landing row and Settings its panel title. A section switched on tomorrow drills the day it
         ships instead of the day somebody remembers this list ([[the-loop]] #147 — a hand-kept list
         breaks every time the product legitimately changes). */
      if (navHtml(k)) {
        /* ⛔ THE BOOKS LANDING ROW WENT 2026-08-23, SAME REASON AS THE DESKTOP LEAF. It opened Close
           Books, which was not one of the section's own rows. That page is deleted and the landing is
           All Money Out — already the first row this drill lists — so keeping a home would repeat one
           row on the phone. Events lost its landing row for exactly this in August.
           ⚠ The mechanism stays: `sectionNode` still pushes a home `if (homeFn)`, and the next
           section with a landing page that is NOT one of its rows will want it. */
        const home = null;
        return drill(label, k, home, null, icon,
          k === 'settings' ? 'App Settings' : null);
      }
      /* ⭐ ONE DOOR. `_protoGlobalClick` is what the rail presses, so Hub / Close / Review / History
         cannot open one way on desktop and another on mobile — which is exactly how Review came to
         call `S2.WeekReview.open()` directly here while the rail routed through the handler. */
      return { label: label, icon: icon, go: () => App._protoGlobalClick(k) };
    };
    const railGroup = (label, table) => ({ label: label, items: table.map(([k, l]) => railRow(k, l)) });
    const root = { title: 'Bar Cop Menu', groups: [
      /* ⛔ THE EVENTS LANDING ROW IS GONE, AND IT WAS A DUPLICATE (Kyle, 2026-08-12).
         It rendered "Book The Events" → `jumpToSection('events')`, and `_SECTION_DASH.events` is
         **`ev-bookings`** — the exact screen the next row down, "Event Booking", already opens. Two
         rows, one destination, and only on the phone: the desktop Events overlay has five rows and
         no landing leaf. Measured both, tapping the real control.
         ⚠ Books keeps ITS landing row because the desktop overlay genuinely has one ("Close Books"),
         which is the whole point of comparing against the rendered overlay rather than the raw
         sidebar builder — the builder output matches NEITHER menu. */
      { label: 'Go to', items: App._PROTO_GLOBAL.map(([k, l]) => railRow(k, l)) },
      /* ⛔⛔⛔ THE DEMO PHONE GETS THIS GROUP TOO (Kyle, 2026-08-24: *"both links Settings and Guide
         should be on the mobile demo.. settings in the demo is locked so a demo user can't change
         anything.. but we want them to be able to see it just like on the demo desktop"*).
         This line used to read `...(App.demoMode ? [] : [railGroup(...)])` and its comment said
         *"App Settings is off in the live demo, same as the desktop gear."* BOTH halves had gone
         false: the gear was deleted on 2026-08-24, and App Settings has been VISIBLE and read-only
         in the demo since SET-2 — `_mountDemoBanner`'s own note says so, and the rail renders this
         same table in the demo with no guard at all. So the phone was the one surface still
         enforcing a rule the rest of the app had dropped, and MEASURED at 375px on the deployed
         build the demo drawer had NINE rows and neither Settings nor the guide among them.
         ⭐ WHY IT IS SAFE TO OPEN, AND IT IS MEASURED RATHER THAN ASSUMED: the demo lock is not on
         the DOOR, it is on the screen and on every write. `App.demoLockScreen` disables the controls
         at render (`settings.js`, `hub-user-accounts.js`) and `App.demoBlock` refuses inside each
         write handler, with `DB._demo` under both. A new door therefore cannot expose a write, which
         is the question this had to answer before the guard came off ([[lessons-paid-for]] #68 — a
         flag that reconfigures a screen for one audience is a claim only that audience can reach
         it). `verify-demo-settings-readonly` block P is the census that keeps it true: every row
         this group can reach must land somewhere disabled, refused, or classified read-only. */
      railGroup('Settings', App._PROTO_BOTTOM),
      /* ⛔ SIGN OUT WAS MISSING FROM THE PHONE ENTIRELY (Kyle, 2026-08-12). This drawer is generated
         from the rail tables, and `_PROTO_SIGNOUT` — which the rail renders as its own group at the
         foot — was simply never added to the list, so there was NO way to sign out on mobile.
         ⭐ Its own group, so it lands behind a divider exactly as it does in the rail, and rendered
         in the demo too for the same reason the rail does: one table, one answer, both menus. */
      railGroup('Session', App._PROTO_SIGNOUT)
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
    panel.style.cssText = 'position:fixed;left:0;right:0;bottom:0;top:var(--navh);width:100%;background:var(--surface);border-top:1px solid var(--b-edge);box-shadow:0 -8px 24px var(--panel-shadow);z-index:9001;transform:translateY(100%);transition:transform .24s ease;display:flex;flex-direction:column;overflow:hidden;';
    const close = () => { panel.style.transform = 'translateY(100%)'; ov.style.opacity = '0'; setTimeout(() => { ov.remove(); panel.remove(); }, 240); };
    const fire = (fn) => { close(); setTimeout(() => { try { fn(); } catch (e) {} }, 30); };

    const headEl = document.createElement('div');
    headEl.className = 'mnav-head';
    const bodyEl = document.createElement('div');
    bodyEl.className = 'mnav-body';
    panel.appendChild(headEl);
    panel.appendChild(bodyEl);

    /* Open drilled into the section you are in, so reopening the menu on any of its pages returns to
       that section's menu with the current page highlighted.
       ⛔⛔⛔ ASK WHICH RAIL ROW IS LIT, NOT WHICH SHELL IS UP. This read
       `onHub ? _curHubSection : _activeModule`, and Kyle found what that costs: open History from the
       main menu, reopen the menu, and it drilled into PROFIT. Week History goes through
       `openScreen('week-history')` — a MODULE screen, unlike its two rail siblings Close and Review,
       which are hub pages — so `onHub` was false and the expression fell through to `_activeModule`,
       which holds whatever shell was last up and is **seeded `'profit'` at declaration**. It was
       never "no section"; it was always Profit ([[lessons-paid-for]] #14: a default is decided by
       whoever assigns first, not by the reader).
       ⭐ `_railCtx` is the row the rail is currently marking — `_protoGlobalClick('week-history')`
       sets it — and `_railHasMenu` is the app's own answer to "does that row own a menu to drill
       into". The rail was already right; the drawer was answering a different question. One
       accessor, so the two menus cannot disagree about where you are. */
    const curKey = App._railHasMenu(App._railCtx) ? App._railCtx : '';
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
      if (canBack) {
        headEl.innerHTML = '<button class="mnav-back" type="button" aria-label="Back">‹</button>'
          + '<span class="mnav-title">' + esc(node.title) + '</span>'
          + '<button class="mnav-x" type="button" aria-label="Close">×</button>';
      } else {
        // Root landing: the bar name (or the multi-unit switcher) sits left where the
        // title would be, no "Bar Cop Menu" label.
        const accts = App._acctList || [];
        const active = accts.find(a => a.id === App._acctActiveId) || accts[0];
        const locHtml = (active && accts.length > 1)
          ? '<select class="at-qsel mnav-loc-sel">'
              + accts.map(a => '<option value="' + esc(a.id) + '"' + (a.id === active.id ? ' selected' : '') + '>' + esc(a.name) + '</option>').join('')
              + '</select>'
          : '<span class="mnav-barname">' + esc((active && active.name) || 'My Bar') + '</span>';
        /* ⭐ THE RAIL BUTTON LIVES HERE NOW (Kyle, 2026-08-12), not in the mobile top bar. The bar
           name is `flex:1` so it absorbs the slack, then The Rail, then the × — which lands exactly
           where it already was, because it is `flex-shrink:0` and last in the row.
           ⛔ ROOT ONLY. It is on the main menu screen, not on the drilled-in section panels, whose
           head is Back / title / × and has no room for a fourth control. */
        headEl.innerHTML = '<span class="mnav-head-loc">' + locHtml + '</span>'
          + '<button class="btn btn-primary mnav-rail" type="button" title="A read on how the bar is doing">The Rail</button>'
          + '<button class="mnav-x" type="button" aria-label="Close">×</button>';
        const sel = headEl.querySelector('.mnav-loc-sel');
        if (sel) sel.addEventListener('change', (ev) => {
          const id = ev.target.value;
          if (id && active && id !== active.id) fire(() => { if (window.DB && DB.setActiveAccount) DB.setActiveAccount(id); });
        });
      }
      headEl.querySelector('.mnav-x').addEventListener('click', close);
      /* ⛔ THROUGH `fire()`, like every other row in this sheet. The briefing is a MODAL, so opening
         it while the drawer is still up would stack two overlays and leave the operator closing two
         things to get back. `fire` slides the sheet down first, then opens it. */
      const railB = headEl.querySelector('.mnav-rail');
      if (railB) railB.addEventListener('click', () => fire(() => {
        if (typeof BarCopBriefing !== 'undefined' && BarCopBriefing.open) BarCopBriefing.open();
      }));
      const backBtn = headEl.querySelector('.mnav-back');
      if (backBtn) backBtn.addEventListener('click', () => { stack.pop(); render(); });

      bodyEl.innerHTML = '';
      // Flat list with a divider between groups (matches the desktop sidebar).
      // No accordions on either level; the two-level drill stays.
      let started = false;
      const divider = () => { if (started) { const d = document.createElement('div'); d.className = 'mnav-divider'; bodyEl.appendChild(d); } started = true; };
      if (node.groups) {
        // Level 1 (root): each category is a divider-separated block. Section rows
        // drill in (with a chevron); Hub/Blueprint/Support navigate. The bar name /
        // unit switcher lives in the header now (see above), not here.
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
        /* Level 2 (section): the Dashboard leaf, then every page as a flat row (with its icon), a
           divider between the source sub-groups. No accordions.
           ⛔⛔ THESE DIVIDERS WERE REMOVED ON 2026-08-12 AND PUT STRAIGHT BACK, AND THE REASON IS A
           PROBE ERROR WORTH LEAVING WRITTEN DOWN. I checked whether the desktop overlay groups its
           rows by counting `.nav-section` elements in `#rail-menu-nav` and got **0 for all five
           sections** — inventory, labor, books, events, audit — and read that as "every desktop
           overlay is a flat list". It is not. The overlay emits **`.nav-divider`**, a different
           class: Books really is `Close Books, All Money Out, Break-Even ── Weekly P&L Brief,
           Month-End Books, Annual Review ── Help`.
           ⭐ FIVE IDENTICAL ZEROES WAS THE TELL AND I NAMED IT AND WENT ANYWAY: a sweep that finds
           nothing everywhere is reporting that it is blind, not that the thing is absent
           ([[harness-review-like-code]] #67b). Count the SHAPE (a 1px child that is not a nav-item),
           never one class name you assumed. */
        node.items.forEach(it => {
          /* ⛔ NO RULE UNDER THE LANDING LEAF (Kyle, 2026-08-12: "remove the divider after close
             books.. it should be close books, all money out, break-even.. divider"), and it is the
             DESKTOP behaviour being matched rather than a preference: the overlay's converter drops
             any group header with no nav-item above it, and `renderSidebar` PREPENDS the leaf into
             the first block — so desktop reads `Close Books, All Money Out, Break-Even ── …`.
             Mobile pushed the leaf as its own item, so it consumed the `started` slot and the first
             real group drew a rule instead. Skipping it here hands that slot to the first sub-group,
             which is what makes the two menus agree.
             ⚠ Books is the only section with a leaf today (Events' was removed as a duplicate), but
             the rule is written for the shape, not for Books. */
          if (!it.home) divider();
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
  /* ⭐⭐⭐ THE PREFIX CONVENTION HAS EXCEPTIONS, AND THEY GO HERE, NAMED. A screen whose id carries no
     section prefix falls to the `profit` DEFAULT at the bottom — which is exactly why the four
     vendor ids counted as Profit screens for as long as they did, without anybody deciding it.
     ⛔⛔ Kyle moved Vendor Tracker into Inventory on 2026-08-23 (*"so it no longer is in profit at
     all"*), and the nav row alone would NOT have moved it: `openScreen` resolves the shell through
     here, so the Operations Audit's two discrepancy action items would still have swapped the
     operator into the Profit shell to show an Inventory page.
     ⚠ RENAMING THE IDS TO `ic-*` WAS THE OTHER OPTION AND IT IS WORSE. It would drag `DB._areaOf`,
     `_CONVERTED`, `screens`, `titles`, two audit action items and one Hub row along by side effect,
     and ids are not user-visible, so it is a large blast radius for no operator gain
     ([[lessons-paid-for]] #23 — a rename is a text edit, bound it and read every hit).
     ⛔⛔⛔ THIS MAP MUST AGREE WITH `DB.SCREEN_GROUPS`, which is the twin decision (the PERMISSION
     area, not the shell). Move one and not the other and you ship either a page that opens and then
     refuses, or one a member may use and cannot reach — and neither is visible to owner-and-demo
     testing, because `canAccessLevel` returns 'edit' for demo and `isOwner()` short-circuits.
     `verify-vendors-in-inventory` C3 asserts the two answer the same word for every id here. */
  _MODULE_EXCEPTIONS: {
    'vendor-tracker': 'inventory', 'vendor-scorecard': 'inventory',
    'vendor-watch': 'inventory', 'vendor-discrepancy': 'inventory',
    /* ⭐⭐ FOUR MORE MOVED INTO INVENTORY (Kyle, 2026-08-23): Purchasing under Ordering, Trapped Cash
       leading Reports, and the Void/Comp and Waste/Spill logs leading the renamed "Logs" group.
       ⛔ THESE IDS CARRY A `c-` AND `sc-` PREFIX, so WITHOUT AN ENTRY HERE `_moduleOf` sends them to
       Cash and Shift and `_enter` swaps to a shell whose branch cannot draw them: "Coming soon."
       ⛔⛔ AND FIVE THINGS MOVE, NOT TWO. The shell (here), the permission area
       (`DB.SCREEN_GROUPS`), the title and the RENDER registration (`icTitles`/`icScreens`, and out
       of the cash/shift maps so one page has one home), and `App.STAFF_TILES`, whose `module` field
       decides where a NON-ADMIN member lands — leave that saying 'shift' and a staff user opens the
       Shift shell on a screen only Inventory can render. That last one is invisible to owner and
       demo testing, so it is pinned rather than walked ([[the-loop]] #149).
       🔧 `verify-inventory-absorbs` asks all five of EVERY id in this table, derived, so the vendor
       pages are covered by the same block and the next move is covered the day it ships. */
    'c-purchasing': 'inventory', 'c-trapped': 'inventory',
    'sc-void-comp': 'inventory', 'sc-waste': 'inventory'
  },

  _moduleOf(id) {
    const ex = this._MODULE_EXCEPTIONS[id];
    if (ex) return ex;
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
    /* ⛔⛔⛔ CLOSE THE WEEK IS A HUB PAGE, AND WITHOUT THIS LINE EVERY DOOR TO IT SAYS "Coming soon."
       Measured on the shipped build: `App.openScreen('week-close')` rendered exactly that, because
       the id reaches the module router, which has never heard of it. That is the same failure as the
       `hub-permits` dead link, and it is why the ~19 remaining cockpit links could NOT simply be
       swapped to `'week-close'` — a blind find-and-replace would have shipped nineteen dead links in
       one edit instead of one.
       ⭐ SO THE ID BECOMES ROUTABLE FROM ANYWHERE, ONCE, HERE. `openScreen` is the app's cross-module
       door (it is what `AuditUI`'s setup rows, the Fix panels and every `data-go` handler call), so
       teaching it this one id fixes every consumer at the same time rather than each caller learning
       a special case. `_protoGlobalClick` is the SAME door the rail uses, never a second
       `S.WeekClose.open()` — two doors to one page drift apart ([[the-list]] step 1b).
       ⚠ WHY IT SITS WITH `settings` AND NOT LOWER: the comment above already gives the reason. These
       short-circuit BEFORE `showApp`, or the module shell flashes up behind a hub page. */
    /* ⭐ ALL FOUR WEEK IDS THROUGH THE ONE DOOR (2026-08-23). `week-close` was intercepted alone;
       Review reached its page through `navigate` and History through `_CONVERTED` + the module
       router. History has now LEFT `_CONVERTED`, so without naming it here `openScreen('week-history')`
       falls through to the module router and renders "Coming soon." — the `hub-permits` defect
       arriving through a DELETION rather than an addition.
       ⚠ THIS LINE EXISTS TWICE ON PURPOSE, in `openScreen` AND in `navigate`. `_enter` uses the
       second one, so teaching only the first fixes the audit rows and leaves every Hub row dead
       ([[the-loop]] #24). Both were measured before this edit rather than assumed. */
    if (id === 'week' || id === 'week-close' || id === 'week-review' || id === 'week-history') {
      this._protoGlobalClick(id); return;
    }
    // Hub Accounting deliverables a fix step can deep-link to.
    if (id === 'weekly-pnl') { if (window.S && S.Reports && S.Reports._openQboModal) S.Reports._openQboModal(); return; }
    if (id === 'books') { if (window.S && S.HubBooks && S.HubBooks.open) S.HubBooks.open(); return; }
    /* ⚠ THE BILLS ARE NOT THE MONTH-END CLOSE. Two "Review Bills" buttons in the Cash Playbook
       routed to 'books', which opens Month-End Books — a closing workbook picker — while the
       prose directly above one of them reads "Your bills live in Books, where you pay on the
       due date". The Cash cockpit's own Review Bills went to the right place through a bespoke
       branch, so the section had one label, two destinations, and only one of them right.
       Routing both by id here means there is ONE door, not two spellings of the job. */
    if (id === 'operating-expenses') { if (window.S && S.HubOperatingExpenses && S.HubOperatingExpenses.open) S.HubOperatingExpenses.open(); return; }
    /* ⛔ `books-home` NEEDED A ROUTE OF ITS OWN (2026-08-12). It was reachable only as a hub ACTION
       (`data-hub-action`), so `openScreen('books-home')` fell through to "Coming soon." — the exact
       trap [[the-loop]] #24 records for `week-close`, which is intercepted six lines up for the same
       reason. Break-Even's day-one card sends an operator here to LOG money out, and a setup card
       dispatches through `data-go` → `openScreen`, so without this the button was a dead end.
       ⚠ Money Out is READ-ONLY HISTORY; the entry card mounts inside Close Books' first step. Any
       control that says "log your money out" belongs here, not there. */
    if (id === 'books-home') { if (window.S && S.HubOperatingExpenses) S.HubOperatingExpenses.open(); return; }
    /* ⛔ NO 'cash-outflows' ROUTE. The standalone Cash Outflows page was the pre-rebuild screen; Cash
       Outflows is a TAB on Money Out now, over the same ledger. Its last door was the "Go There"
       button on the Money Out add form, deleted with that prompt, and the page it opened disagreed
       with the tab it duplicated: its stat card summed `outflowsBetween(start, today)` — a
       projection — under labels identical to the tab's ledger totals, reading $4,000 / $30,000
       against $6,800 / $26,600 on the same data. Kyle, 2026-08-06: *"the old cash outflows page
       should never be seen and deleted too."* `S.HubCashOutflows` itself stays: Money Out delegates
       its real writes to `_writeCashRow` / `_deleteCashRow`. */
    // Gate before swapping the shell so a locked screen shows the notice and
    // leaves the member where they were (mobile drawer routes through here).
    if (!this.canAccess(id)) { this.showNoAccess(); return; }
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
    /* Re-render on EVERY navigate, not just on a section swap, because the lit link has to follow
       the screen however the operator got there — a Fix step, a Hub row or an audit action item all
       land here without touching the bar.
       ⚠ `_railCtx`, not `_activeModule`: the rail's context is the one field that knows about hub
       pages too, and keying on the module is what let the Inventory links survive onto Books. */
    /* ⛔⛔⛔ AND THIS IS THE FIRST POINT THE DESTINATION IS KNOWN, WHICH IS WHY THE FIX LIVES HERE
       (Kyle, 2026-08-23: the three module audits *"no longer live in recovery they live in
       audits"*). `_enter` runs `showApp(mod)` BEFORE `navigate`, so by the time we get here the
       rail has already been drawn for the module — with the Audits bar hidden and the Profit row
       lit. Asking the screen which section owns it, here, fixes every door onto those three ids at
       once instead of the one Kyle happened to press.
       ⚠ SILENT FOR EVERY OTHER SCREEN. `_railSectionForScreen` answers only for hub sections that
       are switched on, so an Inventory or Labor screen returns '' and this stays exactly as it was
       ([[the-loop]] #88 — walk the control, the input that must change nothing). */
    try {
      if (typeof SectionTabs !== 'undefined') {
        const sec = this._railSectionForScreen(id);
        if (sec && sec !== this._railCtx) this._renderProtoTopnav(sec, id);
        else SectionTabs.render(this._railCtx, id);
      }
    } catch (e) { console.error('section links render failed', e); }
  },

  showAuth() {
    // Signing out is a view switch, not a navigate, so this is the third and last door (S3).
    // Without it a failed save leaves a red "Not saved" bar over the login card of the account
    // that was just signed out of, where it is both alarming and impossible to act on.
    this._dismissWriteFail();
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('app').classList.add('hidden');
    document.body.classList.remove('chrome-on');
    document.getElementById('ob-overlay').classList.add('hidden');
    const hw = document.getElementById('hub-wrapper');
    if (hw) hw.style.display = 'none';
    // Restore any auth button left in its loading state. A successful login/
    // signup holds "Logging in..." / "Creating account..." and relies on boot to
    // swap the screen; on sign-out we land back on this static panel, so reset
    // the buttons (and clear errors) or they stay stuck from the prior submit.
    const lb = document.getElementById('login-btn'); if (lb) { lb.textContent = 'Log In'; lb.disabled = false; }
    const sb = document.getElementById('signup-btn'); if (sb) { sb.textContent = 'Create Account'; sb.disabled = false; }
    const le = document.getElementById('login-error'); if (le) le.style.display = 'none';
    const se = document.getElementById('signup-error'); if (se) se.style.display = 'none';
    const params = new URLSearchParams(window.location.search);
    // Pick which auth panel shows. Default is Log In; the marketing site's
    // "Set Up Bar Cop" button deep-links in with ?signup=1 to open Create Account.
    const wantSignup = params.get('signup') === '1';
    ['auth-login','auth-signup','auth-reset','auth-set-password','auth-paywall'].forEach(x => {
      const el = document.getElementById(x);
      if (el) el.style.display = x === (wantSignup ? 'auth-signup' : 'auth-login') ? '' : 'none';
    });
    if (wantSignup) window.history.replaceState({}, '', window.location.pathname);
    const cy = document.getElementById('auth-copy-year'); if (cy) cy.textContent = String(new Date().getFullYear());
    // Show success banner if landing from Stripe checkout
    const banner = document.getElementById('checkout-success-msg');
    if (banner) banner.style.display = params.get('checkout') === 'success' ? 'block' : 'none';
    // Clean up the URL
    if (params.get('checkout')) window.history.replaceState({}, '', '/');
  },


  // After a Stripe checkout return, the webhook that activates the subscription
  // is async. Poll getSubscription a few times (showing a confirming state) so a
  // just-paid owner doesn't bounce to the paywall before the webhook lands.
  async _pollSubscriptionActive(tries = 8, delayMs = 1500) {
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('app').classList.add('hidden');
    const hw = document.getElementById('hub-wrapper');
    if (hw) hw.style.display = 'none';
    ['auth-login','auth-signup','auth-reset','auth-set-password','auth-paywall'].forEach(x => {
      const el = document.getElementById(x);
      if (el) el.style.display = 'none';
    });
    const screen = document.getElementById('auth-screen');
    let note = null;
    if (screen) {
      note = document.createElement('div');
      note.id = 'auth-confirming';
      note.className = 'auth-view';
      note.innerHTML = '<div class="auth-card">'
        + '<div class="auth-logo"><img src="assets/logo.png" alt="Bar Cop" style="height:30px;"/></div>'
        + '<div class="auth-heading">Confirming Your Payment</div>'
        + '<div class="auth-sub">One moment while we activate your subscription.</div>'
        + '</div>';
      screen.appendChild(note);
    }
    let sub = this.subscription;
    for (let i = 0; i < tries; i++) {
      await new Promise(r => setTimeout(r, delayMs));
      sub = await DB.getSubscription();
      if (sub?.status === 'active') break;
    }
    if (note) note.remove();
    return sub;
  },

  // Both save paths persist config only: the 19 unbounded recovery/hub logs
  // live row-per-record in core_events now (see EVENT_STORES.core), so the
  // user_data blob never re-stores them. saveKey's `key` is already mutated on
  // this.data by the caller; we just write the stripped blob. Every event
  // write-site goes through putRecord/removeRecord instead.
  // S195 — the pre-load gate refused a CONFIG-BLOB save. Which of two very different things that is
  // depends on whether the initial load is still running:
  //   • load STILL RUNNING  → a harmless race. The operator did not act (an autosave fired mid-boot)
  //     and their next real edit saves normally, so stay SILENT — this is what `deferred` has always
  //     meant and why the classifier ignores it.
  //   • load FINISHED, still not ready → readData never CONFIRMED the account (a cold OFFLINE boot is
  //     the common way in), so the gate stays shut for the WHOLE session: every settings save is
  //     dropped — not even queued — while the screens flashed "Saved" over it. Say it out loud.
  // Returns false either way: nothing was written, and no caller may report success.
  // ⚠ `!this.data` is the second half of the silence test, and it is not optional: _loadInFlight is
  // undefined (falsy) until loadAllData actually STARTS, so the window between page load and that
  // call would otherwise raise a false alarm. No data loaded = nothing an operator could have edited.
  // A cold offline boot DOES set this.data (readData falls back to the local copy), so the real case
  // still speaks.
  _configGateRefused() {
    if (DB._loadInFlight || !this.data) return false;
    this._reportWriteFail({ ok: false, configGate: true });
    return false;
  },

  async save() {
    if (!DB._dataReady) return this._configGateRefused();   // gated pre-load (see DB.writeData) — nothing loaded yet to persist
    const r = await DB.writeData(this._configBlob('core', this.data));
    // S195: the ROW path (putRecord) has always surfaced its failures; this one only logged to the
    // console, so a failed settings write was invisible. The classifier self-silences for offline /
    // queued / deferred / blocked, so this cannot produce a false alarm.
    if (!r.ok) { console.error('Save failed:', r.error); this._reportWriteFail(r); }
    return r.ok;
  },

  async saveKey(key) {
    if (!DB._dataReady) return this._configGateRefused();   // gated pre-load (see DB.writeData) — a premature save must not clobber the server blob
    const r = await DB.writeData(this._configBlob('core', this.data));
    // An offline save is NOT a failure: the copy is kept on-device and queued, and
    // the global offline banner tells the operator it will sync. Report success so
    // form handlers render the record instead of a misleading "Save failed."
    if (!r.ok) {
      if (!r.offline) console.error('saveKey failed:', r.error);
      this._reportWriteFail(r);   // S195 — self-silencing for offline/queued; speaks for a real failure
    }
    return r.ok || !!r.offline;
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

  // Load Recovery data plus the three Control data stores (Rule 21)
  async loadAllData() {
    DB._dataReady = false;          // gate every config-blob save until THIS load confirms what the server holds (prevents a boot/deploy/switch-race save from wiping the account)
    DB._controlReady = {};          // per-control gate: each control blob's write path stays closed until ITS OWN read confirms the account (a failed control read must not open it)
    DB._controlNonEmpty = {};       // recomputed per control read; drives the control total-wipe backstop
    DB._allowReset = false;         // any leftover reset bypass ends at the next load
    DB._backfillPending = {};       // per-kind "backfill not confirmed" flags are per-LOAD: a flag left set by a queued/failed backfill (or by another account in this tab) makes _configBlob keep re-writing that array into the config blob forever, which is what lets a deleted-to-empty array resurrect on the next login
    DB._loadedNonEmpty = false;     // "the account I have loaded is known-populated" — the ONE flag here that used to survive a reload. It is re-derived below (and by readData), so carrying the PREVIOUS load's value into this one armed the total-wipe backstop against a half-loaded App.data and produced false wipe_blocked reports. Per-load, like every sibling above.
    DB._loadDegraded = false;       // "this login did not see the whole account" — raised by loadEventStores on any cache-served or truncated read. MUST be per-load: a stale true would block the daily backup forever, and a stale false would let a partial account be captured as a restore point.
    DB._loadInFlight = true;        // diagnostic only: lets the backstop say whether it fired mid-load
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
    // How many kinds were already known-migrated before this load, so the write at the end
    // fires only when loadEventStores actually learned something new.
    const _migCountBefore = Object.keys((this.data && this.data.migrated_kinds) || {}).length;
    await this.loadEventStores('ic');
    // ic_locations is row-per-record now (no inherent array order), but its array position IS
    // the count-sheet order — so restore it from each location's sort_order (a reorder sets it;
    // a new location appends). Locations without one (backfilled, never reordered) fall back to
    // id (creation order). Sort in place so every reader sees the operator's order.
    // A backfilled location carries NO sort_order. Sorting those with a 1e9 sentinel put them
    // last on a scale the writer never uses: ic-locations._nextLocSeq numbers a new location
    // from max(sort_order)+1, which on an all-unstamped account is 1 — so the location the
    // operator just appended to the bottom of the count sheet came back ABOVE every existing
    // one on the next login. Put both on ONE scale instead: stamp any missing sort_order from
    // creation order (id ascending — rows load newest-first, so array position is not creation
    // order) before sorting, so _nextLocSeq appends past the end and the order holds.
    const _locsStamped = [];
    const _locs = this.inventoryData && this.inventoryData.ic_locations;
    if (Array.isArray(_locs) && _locs.length) {
      const byCreation = _locs.slice().sort((a, b) => String(a && a.id).localeCompare(String(b && b.id)));
      let _seq = byCreation.reduce((m, l) => Math.max(m, (l && l.sort_order != null) ? l.sort_order : -1), -1) + 1;
      byCreation.forEach(l => { if (l && l.sort_order == null) { l.sort_order = _seq++; _locsStamped.push(l); } });
      _locs.sort((a, b) => ((a.sort_order || 0) - (b.sort_order || 0))
        || String(a && a.id).localeCompare(String(b && b.id)));
    }
    await this.loadEventStores('sc');
    await this.loadEventStores('lc');
    // Core / Recovery event logs (Profit pass): weeks, theft scores, variance
    // investigations, vendor discrepancies, audits -> core_events rows.
    await this.loadEventStores('core');
    // The entered-data arrays now live row-per-record and are STRIPPED from the config
    // blob, so DB._loadedNonEmpty (set from the blob at readData) understates a populated
    // account whose data is entirely in rows. Recompute it from the live, rows-filled
    // App.data so the total-wipe backstop stays accurate in steady state: a real account
    // reads populated (backstop armed), a genuinely-empty one does not (new user saves fine).
    DB._loadedNonEmpty = DB._blobHasArrayData(this.data);
    // Same recompute for the three CONTROL blobs: once their config arrays (staff, positions,
    // schedules, locations, vendors, prep batches, drawers, checklist templates) migrate to
    // rows, the loaded control blob is stripped of them, so _controlNonEmpty (set from the
    // blob at read time) would understate a populated account and disarm the control total-wipe
    // backstop. Recompute from the live, rows-filled control objects so it stays armed.
    DB._controlNonEmpty['ic_data'] = DB._blobHasArrayData(this.inventoryData);
    DB._controlNonEmpty['lc_data'] = DB._blobHasArrayData(this.laborData);
    DB._controlNonEmpty['sc_data'] = DB._blobHasArrayData(this.shiftData);
    DB._loadInFlight = false;       // data is fully loaded; any backstop hit from here is genuine
    // Persist the migration markers loadEventStores just learned, ONCE, now that every store has
    // loaded and the backstop flags above are accurate. Only writes when something actually
    // changed, so this is a no-op on every login after the first. Without it the marker never
    // survives a reload and "deleted to empty" stays indistinguishable from "not yet migrated".
    if (_migCountBefore !== Object.keys(this.data.migrated_kinds || {}).length) {
      await this.saveKey('migrated_kinds');
    }
    /* ⛔ THE CASH-OUTFLOW MIGRATION AND ITS RECONCILE WERE REMOVED FROM THIS BLOCK (build order E).
       Both kept the legacy `cash_outflow` store and the ledger in step; E drops that store, so a
       cash row is written once and there is nothing left to migrate or repair. `repairGeneratedCashRows`
       below is a DIFFERENT job and stays.
       ⚠ The one-time marker (`migrated_kinds.cash_outflow_to_ledger`) is left where it is on live
       accounts: nothing reads it, and clearing it would be a write to every operator's data for no
       benefit. The `_migCountBefore` check above is unaffected — it counts keys, and this one simply
       stops changing. */
    /* ⭐ THIS REPAIR IS NOT PART OF E. It removes the child rows the retired recurring catch-up
       generated off migrated outflows: they carry a cash-only category and a `recurring_parent` but
       no `migrated_from`, so every filtering figure hides them while the engine counts each one as a
       second copy of a payment it already projects. Keyed on a three-clause predicate that can name
       every row it deletes, and a no-op on an account that was never damaged. */
    if (window.S && S.HubOperatingExpenses && S.HubOperatingExpenses.repairGeneratedCashRows) {
      await S.HubOperatingExpenses.repairGeneratedCashRows();
    }
    /* ⭐ PHASE 2: the maintenance log's repair costs become ledger rows the same way. Additive and
       invisible until Books' Repairs line is pointed at the category — the tracker still holds the
       cost, and nothing reads these rows yet. */
    if (window.S && S.HubOperatingExpenses && S.HubOperatingExpenses.reconcileMaintenanceLedger) {
      await S.HubOperatingExpenses.reconcileMaintenanceLedger();
    }
    /* ⭐⭐⭐ BUILD PIECE 2: the weekly roll's delivery commissions come ACROSS, once, and the weekly
       field stops being a source. This was `reconcilePlatformFeesLedger` and it ran here on EVERY
       load, keeping a ledger row in step with `week.platform_fees` — two homes for one dollar, and
       measured on the deployed build it was already being subtracted twice (the Cash Bridge read
       one full period of commission low, the Profit Forecast added it on top of the opex average).
       ⛔ IT IS A MIGRATION RATHER THAN A DELETION because an account that has not logged in since
       the mirror shipped (2026-08-05) has no rows yet, and deleting the reconcile outright would
       drop its whole history's commission off the Income Statement silently. It is additive,
       id-preserving, skips anything already on file, and marks itself done.
       ⚠ IT SAVES ITS OWN MARKER. The `migrated_kinds` persist above runs EARLIER in this routine, so
       a marker set here would never survive the session and this would re-run for ever.
       ⚠ THE DEMO NEEDS NO CALL HERE and that is a claim about the SEED, not an omission: `startDemo`
       skips `boot()` entirely, and the seed writes its commission rows straight into the ledger.
       Both paths are pinned BY NAME in `verify-platform-fees-one-source.js` block F, because a pin
       asserting "it is called somewhere" is exactly what let the fix-baselines miss through. */
    if (window.S && S.HubOperatingExpenses && S.HubOperatingExpenses.migratePlatformFeesOnce) {
      await S.HubOperatingExpenses.migratePlatformFeesOnce();
    }
    // PERSIST the sort_order stamps assigned above. In-memory-only stamping did not fix the
    // count-sheet order, it displaced the bug by one login: _nextLocSeq reads the in-memory max,
    // so a location added this session got a number ABOVE the un-stamped rows, and on the next
    // load those rows were re-stamped HIGHER than it — putting the newly added location back at
    // the top of the count sheet. Writing the stamps makes the order stable for good. Rows only
    // (ic_locations is row-per-record); safe here because the load is complete.
    // ONLY off a server-confirmed read. loadEventStores already refuses to trust a cache-served
    // array for the migrated_kinds marker; this write needs the same gate and did not have it.
    // putEventsBulk upserts `payload: rec` — the WHOLE record — so stamping from the offline
    // cache would push a stale location object back over the server row, reverting a rename,
    // an archive or a service_bar toggle made on another device. And a location present on the
    // server but missing from the cache would be numbered on a different scale, persisting a
    // scrambled count-sheet order instead of fixing it.
    if (_locsStamped.length && !(_locs && _locs._fromCache)) {
      await this.putRecordsBulk('ic', 'location', _locsStamped, { quiet: true });
    }
    // Pre-fetch the accounts list so the Hub sidebar can render the
    // Locations section synchronously (multi-account users only).
    if (DB.listMyAccounts) { await DB.listMyAccounts(); }
    // Automatic daily backup: on owner login, if the last snapshot is >~20h old, capture the
    // whole account so there's always a recent restore point (see Settings → Data and Backup).
    // Fire-and-forget so it never delays boot.
    this._maybeAutoBackup();
    // Fix baselines feed the COCKPITS, so they cannot depend on visiting the Fix screen.
    this._startFixBaselines();
  },

  /* ⛔ A HEADLINE MONEY FIGURE MUST NOT DEPEND ON WHICH SCREEN YOU HAPPENED TO OPEN.
     profit-fix and r-fix each derive a gap's start date from its first tracked action and record
     a durable baseline (Recovery.ensureBaseline); Recovery.moduleSummary scores off those
     baselines, and BOTH cockpits print that total as "$X recovered so far".
     Both screens ran the backfill from their own render() only. MEASURED on the live build: the
     Profit cockpit read "$5,026 recovered so far" on a clean load, and opening Profit Fix once
     wrote 5 baselines (0 -> 5), moved the figure to $9,869 and left it there — a 96% change in a
     money headline caused by looking at a screen, in the understating direction. The per-system
     parts ($6,248 + $3,621) sum to $9,869, so the pre-visit number was the wrong one.
     Revenue carries the identical mechanism; on the current seed it happens not to diverge
     (every revenue gap already has a fix_log row), which is exactly why it went unnoticed there.
     Running it once at load makes every consumer agree from the first paint. The screens still
     call it — harmless, and it keeps a mid-session action recorded promptly. */
  _startFixBaselines() {
    try {
      if (!DB._dataReady) return;                 // same gate the machinery has always used
      /* ⛔⛔ THIS USED TO REACH INTO THE TWO FIX SCREENS — `S.ProfitFix._autoStart()` and
         `S.RevenueFix._autoStart()`. Those screens are being deleted, and the baseline they wrote is
         what `Recovery.compute` measures "Recovered to date" FROM: without it every gap reads
         `untracked` and the figure the audits now display silently goes to $0.
         ⭐ SO THE MACHINERY MOVED TO `recovery.js`, beside `ensureBaseline`, which was always its
         only consumer. An equality proof ran both implementations over one fixture and compared the
         durable baselines and the auto `fix_log` rows: IDENTICAL, 11 and 11 ([[the-loop]] #110 — a
         migration is safe only when the new answer IS the old answer, not when it looks right).
         ⚠ Still idempotent: `ensureBaseline` writes only when it LOWERS a gap's date, and the log
         row is skipped when the gap already has one. */
      if (window.Recovery && typeof Recovery.startBaselines === 'function') Recovery.startBaselines();
    } catch (e) { /* best-effort; a baseline backfill must never block boot */ }
  },

  // Create a fresh account backup at most once a day, on OWNER login. Best-effort — a failed
  // or skipped backup never affects the app. Restores are owner-driven from Your Account.
  async _maybeAutoBackup() {
    try {
      if (this.demoMode || !DB.isOwner || !DB.isOwner()) return;
      if (!(window.S && S.HubSettings && S.HubSettings._buildBackup)) return;
      // Never snapshot an unconfirmed or empty account. loadAllData runs to completion even when
      // readData fell back to defaults (a transient RLS/network error leaves _dataReady false),
      // and a snapshot taken then captures nothing — but it still lands in the owner's backup
      // list as the NEWEST restore point, hides the real ones behind the 30-row retention, and
      // suppresses genuine backups for the next 20h. Same gate the config saves already use.
      if (!DB._dataReady) return;
      if (!DB._blobHasArrayData(this.data)) return;
      // ...and never snapshot a PARTIALLY loaded one. The test above is a some() — one non-empty
      // array anywhere satisfies it — while loadEventStores fires ~28 core kinds concurrently and
      // any of them can fall back to the offline cache or return a truncated page run. So an
      // account that loaded 27 kinds short still passed, and got stored as the newest auto-daily.
      // Restoring it is destructive: seed('core') clears EVERY kind and reseeds only what the
      // snapshot holds, so the kinds that were missing at capture time are deleted for good under
      // a "Backup restored" message. Even unrestored it does damage — it takes the newest slot,
      // suppresses real backups for 20h, and ages a good one out of the 30-row pool.
      if (DB._loadDegraded) return;
      const last = await DB.lastBackupAt();
      const stale = !last || (Date.now() - new Date(last).getTime()) > 20 * 3600 * 1000;
      if (!stale) return;
      await DB.saveBackup(S.HubSettings._buildBackup(), 'auto-daily');
    } catch (e) { /* best-effort; never block the app on a backup */ }
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
  /* ⛔⛔ KEEP FOCUS INSIDE THE OPEN POPUP (S296's last sibling).
     Nothing contained focus in a modal: Tab walked out of the card into the screen behind it, which
     is still fully focusable, so an operator on a keyboard could activate controls on a page they
     cannot see under the scrim. It was invisible until `:focus-visible` shipped; now they watch the
     ring vanish behind the overlay.
     ⚠ `inert`, NOT `pointer-events` and NOT a hand-rolled Tab handler. `pointer-events:none` is
     hit-testing and nothing else — it does not blur the focused element, does not leave the tab
     order and does not block keydown ([[the-loop]] #92). `inert` means off for pointer, keyboard,
     focus and screen reader together, and it gives the trap for FREE: with the background inert,
     Tab has nowhere to go but the modal, so there is no first/last-element bookkeeping to drift.
     ⛔⛔ AND THE FAILURE MODE THIS MUST NOT HAVE. `#app` is a shared, permanent node, and
     [[the-loop]] #93 is exactly what happens when a guard is TOGGLED onto one and a promise never
     settles: the whole app goes dead with the nav still working. So this is DERIVED, never toggled.
     It reads how many modals are actually open and sets everything from that, which means a missed
     call, a thrown handler or a hung write cannot leave the app inert — the next sync recomputes
     from truth. `verify-modal-focus-trap.js` case I6 pins that by setting the flag by hand with no
     modal open and asserting a sync clears it.
     ⚠ STACKED MODALS: only the TOPMOST is live, matching the way ESC already peels a stack one
     layer at a time. Otherwise Tab reaches a form sitting under another form. */
  _syncModalInert() {
    const host = document.getElementById('app-modal-host');
    const kids = host ? [].slice.call(host.children) : [];
    const open = kids.length > 0;
    ['app', 'auth-screen'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.inert = open;
    });
    kids.forEach((el, i) => { el.inert = i !== kids.length - 1; });
  },

  openModal(html, opts) {
    opts = opts || {};
    const id = opts.id || 'app-modal';
    const layer = opts.layer || 9000;
    let host = document.getElementById('app-modal-host');
    if (!host) { host = document.createElement('div'); host.id = 'app-modal-host'; document.body.appendChild(host); }
    const old = document.getElementById(id);
    if (old) old.remove();
    // Captured BEFORE the overlay goes in, because appending it and inerting the background is what
    // takes focus away (S296).
    const prevFocus = document.activeElement;
    const overlay = document.createElement('div');
    overlay.id = id;
    // Near-opaque navy scrim (the --bg family) so the popup reads as nested in the
    // app's darkest canvas — navy-on-navy, like the on-page forms — not a navy card
    // stranded on a translucent black wash.
    overlay.style.cssText = 'position:fixed;inset:0;z-index:' + layer + ';background:var(--overlay);'
      + 'display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:32px 16px;';
    // The corner X (thin icon, inside the card's top-right) is the universal close,
    // shown by default. Pass opts.noX only to force a deliberate choice (e.g. the
    // export-acknowledgment gate). Styled in style.css (.app-modal-x).
    const closeX = opts.noX ? '' : '<button type="button" class="app-modal-x" aria-label="Close">'
      + '<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3.5 3.5l8 8M11.5 3.5l-8 8"/></svg>'
      + '</button>';
    overlay.innerHTML = '<div style="width:100%;max-width:' + (opts.maxWidth || 900) + 'px;margin:auto 0;position:relative;">' + closeX + html + '</div>';
    host.appendChild(overlay);
    const x = overlay.querySelector('.app-modal-x');
    const doClose = () => { if (typeof opts.onClose === 'function') opts.onClose(); else App.closeModal(id); };
    // opts.confirmDirty: guard against an accidental X on a form the operator has
    // started filling. Snapshot the fields once the modal has fully rendered (next
    // tick, after the caller's own post-open wiring/prefill), then on the X confirm
    // ONLY if a field actually changed. A clean open-and-close never prompts.
    let _dirtyBaseline = null;
    if (opts.confirmDirty) setTimeout(() => { _dirtyBaseline = JSON.stringify(App.captureDraft(overlay) || {}); }, 0);

    /* ⛔⛔ THREE ESCAPES, ONE GUARDED PATH (2026-07-31). This helper had exactly one way out — the
       corner X — and no ESC, no backdrop click, and nothing closing it on navigation. MEASURED on
       the live app: open a delivery's FILE DISCREPANCY form, click "Order Sheet" in the sidebar,
       and the Order Sheet renders UNDERNEATH a full-viewport overlay that still eats every click.
       Reproduced on the Bar Cop Briefing too, and modals from different screens STACKED. With 83
       call sites this was one function stranding operators app-wide.
       App.confirm already did all three correctly; openModal is now brought up to its sibling.
       ⚠ Every route goes through attemptClose so opts.confirmDirty keeps its say — an ESC on a
       half-filled form must ask before discarding, exactly as the X does. */
    let _busy = false;
    const attemptClose = async () => {
      if (_busy) return;                       // the discard-confirm is already up; ignore repeats
      if (opts.confirmDirty && _dirtyBaseline != null && JSON.stringify(App.captureDraft(overlay) || {}) !== _dirtyBaseline) {
        _busy = true;
        const ok = await App.confirm({ title: 'Discard unsaved entry?', message: 'You have entered information that has not been saved yet. Close this form and lose it?', confirmText: 'Discard', cancelText: 'Keep Editing', danger: true });
        _busy = false;
        if (!ok) return;
      }
      cleanup();
      doClose();
    };
    /* The listener has to come off with the overlay. App.confirm's own comment records what
       happens otherwise: a button-close left the keydown handler on document forever, and the next
       Escape anywhere in Bar Cop ran a stale handler against a detached node. `cleanup` is called
       on every close path, and onKey self-heals if the overlay was removed some other way
       (closeModal, closeAllModals, a caller's own onClose). */
    const cleanup = () => document.removeEventListener('keydown', onKey);
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (!document.body.contains(overlay)) { cleanup(); return; }
      // Only the TOPMOST modal answers, so ESC peels a stack one layer at a time.
      const stack = host.children;
      if (stack.length && stack[stack.length - 1] !== overlay) return;
      attemptClose();
    };
    document.addEventListener('keydown', onKey);
    /* ⛔⛔⛔ THE BACKDROP CLOSE IS GONE (T137, Kyle 2026-09-03): *"i can click the screen on any popup
       and it closes the popup... some of them give a warning prompt if data in the popup form has
       been entered to keep editing or discard.. but some of them don't.. big issue."*
       MEASURED before removing it: **68 call sites, 7 pass `confirmDirty`, 29 render a FORM and do
       not** — Count Drawer, Safe Count, Log an expense, the day and week hours editors, the wage
       editor, permits, and Confirm the Week among them. `confirmDirty` is opt-in, so on those 29 a
       mis-aimed click discarded typed work with no prompt at all. A close route that is this easy to
       hit by accident cannot be the one route that is not guarded.
       ⭐⭐ AND IT WAS SAFE TO REMOVE ONLY BECAUSE THE DEFECT IT WAS ADDED FOR HAS ANOTHER FIX. It
       landed on 2026-07-31 because this helper had ONLY an X, so an operator who navigated away sat
       under a full-viewport overlay that ate every click. `App.navigate` calls `closeAllModals()` on
       every navigation, independently — that is what actually closes the stranded case, and it is
       asserted and RUN in `verify-modal-closes-on-navigation` block B. Two escapes remain (the X and
       ESC) and both route through `attemptClose`, so the dirty guard keeps its say on each.
       ⚠ SCOPED TO THIS HELPER. Four other backdrop closes in the tree were read and LEFT: the demo
       welcome, the demo upsell, the no-access notice and `App.confirm` — none holds a form, and a
       backdrop click on a confirm resolves to the SAFE answer. "Fix all the popups" is a population
       claim, and the population that loses data is this one ([[lessons-paid-for]] #75). */
    if (x) x.addEventListener('click', attemptClose);
    /* ⚠ THE BACKGROUND GOING INERT DROPS FOCUS TO `<body>` unless something inside the modal takes
       it, and the operator's next Tab would then start from the top of the document. So focus moves
       IN — to the first real control if there is one, else the card itself, which is given
       tabindex="-1" only so it can receive focus programmatically (never a tab stop of its own).
       ⚠ `_bcRestore` remembers what had focus so closing gives it back. Without it a keyboard
       operator who opens and closes a popup is returned to the top of the page every time.
       ⚠ Guarded: a modal opened from a control that has since been re-rendered away must not throw
       on the way out, so the restore checks the node is still in the document. */
    overlay._bcRestore = (prevFocus && typeof prevFocus.focus === 'function') ? prevFocus : null;
    App._syncModalInert();
    const card = overlay.firstElementChild;
    const first = overlay.querySelector('input:not([type=hidden]),select,textarea,button:not(.app-modal-x),[tabindex]:not([tabindex="-1"])');
    /* ⛔⛔ AND THE FALLBACK MUST NOT PAINT A FOCUS RING (Kyle, 2026-09-03, walking the Needs
       attention list: *"modal opens with white highlight outline .. goes away if i right click the
       screen"* — right-clicking clears `:focus-visible`, which is the tell that it IS a ring and not
       a border). MEASURED: every modal in the app until now has been a FORM, so `first` resolves to
       a real input or button and the ring lands on that control, where it belongs and looks
       ordinary. The Needs attention list is the first modal with NO focusable control in it, so it
       took this branch — and Chrome drew its default ring around the whole card.
       ⭐ THE RING IS SUPPRESSED ONLY ON THIS BRANCH, so the blast radius is exactly the modals that
       have nothing to focus. A form modal still shows its indicator on the field that has focus, and
       no real control anywhere loses one: a ring on a container that exists solely to receive
       programmatic focus tells a keyboard operator nothing it does not already know from the
       backdrop going inert ([[the-loop]] #93 — a guard belongs on the narrowest thing that owns the
       problem). Focus still MOVES here, which is the half that matters for the next Tab. */
    try {
      if (first) first.focus();
      else if (card) { card.setAttribute('tabindex', '-1'); card.style.outline = 'none'; card.focus(); }
    } catch (e) { /* a detached or hidden node is not worth throwing over */ }
    return overlay;
  },
  /* Give focus back to whatever opened the modal. Reads `_bcRestore` off the overlays being
     removed, topmost first, and only if that node is still on the page. */
  _restoreModalFocus(els) {
    for (let i = els.length - 1; i >= 0; i--) {
      const t = els[i] && els[i]._bcRestore;
      if (t && typeof t.focus === 'function' && document.body.contains(t)) {
        try { t.focus(); } catch (e) {}
        return;
      }
    }
  },
  closeModal(id) {
    const el = document.getElementById(id || 'app-modal');
    if (el) el.remove();
    // Derived, so this is also what un-inerts the app when the last modal goes (S296).
    this._syncModalInert();
    if (el) this._restoreModalFocus([el]);
  },

  /* Close EVERY open modal at once. Called on navigation, because an openModal overlay is
     position:fixed over the whole viewport and does not belong to the screen underneath it —
     leaving one up meant the next screen rendered behind a form it had nothing to do with, and
     every click landed on the stale overlay. Modals stack (different ids), so one-by-one removal
     is not enough; empty the host. Safe to call when no modal is open and at boot before the host
     exists. Pinned by verify-modal-closes-on-navigation.js. */
  closeAllModals() {
    const host = document.getElementById('app-modal-host');
    const gone = host ? [].slice.call(host.children) : [];
    if (host) host.innerHTML = '';
    // The app must come back out of inert here too, or navigating away from a modal leaves every
    // screen unreachable by keyboard (S296). Derived, so it cannot get out of step.
    this._syncModalInert();
    this._restoreModalFocus(gone);
  },

  // Shared "Get Started" setup box for the Control cockpits (Inventory / Labor /
  // Shift). Sits above the weekly cockpit and disappears once every step's data
  // exists. steps: [{ num, label, screen, done }]; sectionLabel e.g. 'Inventory'.
  // Step chips link to their setup screen via data-go (each cockpit's wire handles it).
  controlGetStarted(sectionLabel, steps, kind) {
    if (!steps || !steps.length || steps.every(s => s.done)) return '';
    const numWord = { 1: 'One', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six' }[steps.length] || steps.length;
    const chip = s =>
      '<div data-go="' + s.screen + '" style="display:flex;align-items:center;gap:10px;cursor:pointer;flex:1;min-width:200px;padding:11px 13px;border:1px solid '
      + (s.done ? 'var(--b-edge)' : 'var(--gold-tint-bord)') + ';border-radius:8px;background:' + (s.done ? 'var(--sel-active-bg)' : 'var(--gold-tint)') + ';">'
      + '<span style="width:20px;height:20px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;'
      + (s.done ? 'background:var(--green);color:var(--bg);' : 'border:1px solid var(--t3);color:var(--t3);') + '">' + (s.done ? '&#10003;' : s.num) + '</span>'
      + '<span style="font-size:12px;font-weight:600;color:var(--t1);">' + esc(s.label) + '</span></div>';
    return '<div class="card form-card" style="margin-bottom:16px;">'
      + '<div class="card-title">Get Started</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:14px;">' + numWord + ' steps to getting started in ' + esc(sectionLabel) + ' ' + (kind || 'Control') + '.</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;">' + steps.map(chip).join('') + '</div>'
      + '</div>';
  },

  // ── Reusable "custom option" select ─────────────────────────────────────────
  // A <select> of built-in options + values already used on the operator's own
  // records + a "+ Add your own..." choice that reveals a text field. A typed
  // value is injected and selected; it persists once the record is saved and
  // then shows up on its own next time (via opts.existing, distinct values off
  // the records). Keeps the built-in list as the shared default so reporting
  // stays consistent. Call App.wireCustomSelects(container) after render.
  // opts: { id, builtin:[], existing:[], selected, style, selectClass, addLabel, newPlaceholder }
  customSelect(opts) {
    opts = opts || {};
    const sel = (opts.selected == null ? '' : String(opts.selected));
    const key = opts.key || '';
    const all = [];
    const push = v => { v = (v == null ? '' : String(v)).trim(); if (v && !all.some(x => x.toLowerCase() === v.toLowerCase())) all.push(v); };
    if (key) {
      // Keyed list: options come from the built-in defaults + the operator's own
      // added options minus the ones they hid, all managed via the Manage editor
      // (App.openListManager). No longer derived from existing records.
      this._listBuiltins[key] = opts.builtin || this._listBuiltins[key] || [];
      this.listOptions(key).forEach(push);
    } else {
      (opts.builtin || []).forEach(push);
      (opts.existing || []).forEach(push);
    }
    push(sel);
    const selLc = sel.toLowerCase();
    /* "Add your own" replaces the legacy "Other" bucket, so Other is not offered — EXCEPT for a
       list that genuinely DECLARES it as one of its own options, and except for a legacy record
       already sitting on it (so editing one cannot silently recategorise it).
       ⛔ THAT EXCEPTION IS listOptions' RULE, AND THIS LAYER WAS STILL ENFORCING THE OLD ONE.
       `listOptions` grew `declaresOther` when Kyle found the hole on 2026-07-28; this filter kept
       its own unconditional copy, so listOptions returned NINE expense categories and this
       rendered EIGHT. The symptom was the exact one that fix was written to close: 'Other' is
       what the CSV importer falls back to, what _opExSums buckets unknowns into, and a rendered
       line on the Income Statement and the By Category card — visible everywhere, choosable
       nowhere. Two doors, one record, two rules, again.
       Read the builtins actually in play: the keyed list registers them on _listBuiltins above,
       an unkeyed one passes them inline. */
    const _builtins = key ? (this._listBuiltins[key] || []) : (opts.builtin || []);
    const declaresOther = _builtins.some(b => String(b == null ? '' : b).trim().toLowerCase() === 'other');
    const allF = all.filter(v => declaresOther || v.toLowerCase() === selLc || v.toLowerCase() !== 'other');
    const blankHtml = opts.blank ? '<option value=""' + (sel === '' ? ' selected' : '') + '>' + esc(opts.blankLabel || '-') + '</option>' : '';
    const optionsHtml = blankHtml + allF.map(v => '<option value="' + esc(v) + '"' + (v.toLowerCase() === selLc ? ' selected' : '') + '>' + esc(v) + '</option>').join('');
    const idAttr = opts.id ? ' id="' + esc(opts.id) + '"' : '';
    const keyAttr = key ? ' data-cs-key="' + esc(key) + '"' : '';
    const styleAttr = opts.style ? ' style="' + opts.style + '"' : '';
    const cls = opts.selectClass || 'form-input';
    /* Keyed lists do all add/remove through the Edit editor — no inline
       "+ Add your own" option or text field. Non-keyed selects keep the old
       inline-add behaviour.
       ⛔ UNLESS THE VOCABULARY IS FIXED. `addCustom: false` is for an unkeyed list whose values are
       not free text but a CLOSED SET the code maps to something else — Money Out's Kind picker maps
       its five names to a stored outflow `type`. Measured on the live app before this existed:
       typing "Equipment Lease" there saved `type: ''` and the row came back as "Other Cash
       Outflow", so the name the operator typed was gone and the record carried an empty type. A
       control must not accept a value it discards. Default stays TRUE, so nothing else moves. */
    const allowAdd = opts.addCustom !== false;
    const addHtml = (key || !allowAdd) ? '' : '<option value="__addcustom__">' + esc(opts.addLabel || '+ Add your own...') + '</option>';
    const inputHtml = (key || !allowAdd) ? '' : '<input type="text" class="cs-newval form-input" placeholder="' + esc(opts.newPlaceholder || 'Type it, then Enter') + '" style="display:none;width:100%;"/>';
    return '<span class="cs-wrap" style="display:block;">'
      + '<select' + idAttr + keyAttr + ' class="cs-select ' + cls + '"' + styleAttr + '>'
      +   optionsHtml
      +   addHtml
      + '</select>'
      + inputHtml
      + '</span>';
  },
  // Wire every custom-select in a container. Picking "+ Add your own..." swaps the
  // select out for the text field IN PLACE (no layout push); typing a value + Enter
  // (or tabbing away) injects it as an option, selects it, and brings the select
  // back. Empty / Escape reverts to the prior value. The select never rests on the
  // "+ Add your own..." sentinel.
  wireCustomSelects(root) {
    root = root || document;
    root.querySelectorAll('.cs-wrap').forEach(wrap => {
      const sel = wrap.querySelector('.cs-select');
      const inp = wrap.querySelector('.cs-newval');
      if (!sel || !inp || sel._csWired) return;
      sel._csWired = true;
      sel._csPrev = (sel.value === '__addcustom__') ? '' : sel.value;
      sel.addEventListener('change', () => {
        if (sel.value === '__addcustom__') { sel.style.display = 'none'; inp.style.display = ''; inp.value = ''; inp.focus(); }
        else { sel._csPrev = sel.value; }
      });
      const finish = () => {
        const val = (inp.value || '').trim();
        inp.style.display = 'none';
        sel.style.display = '';
        if (!val) { sel.value = sel._csPrev || ''; return; }
        const addOpt = sel.querySelector('option[value="__addcustom__"]');
        if (![...sel.options].some(o => o.value.toLowerCase() === val.toLowerCase())) {
          const o = document.createElement('option'); o.value = val; o.textContent = val;
          sel.insertBefore(o, addOpt);
        }
        [...sel.options].forEach(o => { if (o.value.toLowerCase() === val.toLowerCase()) sel.value = o.value; });
        sel._csPrev = sel.value;
        inp.value = '';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      };
      inp.addEventListener('blur', finish);
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }
        else if (e.key === 'Escape') { inp.value = ''; inp.blur(); }
      });
    });
    // Wire the "| Manage" links that sit next to a keyed dropdown's label.
    root.querySelectorAll('.cs-manage').forEach(a => {
      if (a._csWired) return;
      a._csWired = true;
      a.addEventListener('click', e => { e.preventDefault(); App.openListManager(a.getAttribute('data-cs-key')); });
    });
  },

  // ── Customizable dropdown lists (the 7 Bar-Cop-prefilled selects) ───────────
  // Per-account store of which options the operator ADDED and which built-ins
  // they HID, keyed by a stable list key (expense_category, permit_type, etc.).
  // Built-in defaults live on each screen and are registered into _listBuiltins
  // the first time that list's customSelect renders. Saved with saveKey.
  _listBuiltins: {},
  // Per-key list metadata. `valued` = options carry a numeric value (bottle size in
  // oz), shown + chosen in the editor. (unit_type is a plain name list; how a
  // product is tracked is a per-product "Track By" choice, not a unit property.)
  _listMeta: {},
  _listIsMethoded(key) { return !!(this._listMeta[key] && this._listMeta[key].methoded); },
  _listLabels: {
    expense_category: 'Expense Categories', permit_type: 'Permit Types',
    department: 'Departments', cert_type: 'Certification Types',
    payment_term: 'Payment Terms', prep_category: 'Prep Categories',
    incident_type: 'Incident Types', unit_type: 'Unit Types', misc_type: 'Misc Types',
    subcat_liquor: 'Liquor Sub-Categories', subcat_wine: 'Wine Sub-Categories',
    subcat_bottle_beer: 'Bottle Beer Sub-Categories', subcat_draft_beer: 'Draft Beer Sub-Categories',
    subcat_food: 'Food Sub-Categories',
    size_spirits: 'Liquor Sizes', size_wine: 'Wine Sizes', size_beer: 'Beer Sizes',
    size_draft: 'Keg Sizes', size_liquid: 'Bottle Sizes', order_min_unit: 'Order Minimum Units',
    // menu_category is the pre-B2 shared list. It is never deleted — ensureMenuCatLists re-derives
    // the three per-type lists from it, which is what makes a failed migration write harmless.
    menu_category: 'Menu Categories',
    menu_category_plate: 'Dish Categories', menu_category_cocktail: 'Mixed Drink Categories',
    menu_category_inventory: 'No Prep Categories',
  },
  _listIsValued(key) { return !!(this._listMeta[key] && this._listMeta[key].valued); },
  // Category-appropriate example for the "Name" field on a valued (size) list.
  _listNameHints: {
    size_spirits: 'e.g. Gallon', size_wine: 'e.g. Box', size_beer: 'e.g. Tallboy',
    size_draft: 'e.g. Corny Keg', size_liquid: 'e.g. Jug',
  },
  listConfig(key) {
    this.data.list_config = this.data.list_config || {};
    const c = this.data.list_config[key] = this.data.list_config[key] || {};
    c.added = c.added || [];
    c.hidden = c.hidden || [];
    c.methods = c.methods || {};   // unit_type only: name -> 'count' | 'oz'
    return c;
  },
  // Add a unit type with its tracking method (Edit Unit Types popup). The name goes
  // in added like any option; the method is stored alongside so unitMethod() finds it.
  listAddUnit(name, method) {
    name = (name == null ? '' : String(name)).trim();
    if (!name) return;
    const c = this.listConfig('unit_type');
    const lc = name.toLowerCase();
    c.hidden = c.hidden.filter(h => String(h).toLowerCase() !== lc);
    const isBuiltin = this.IC_FOOD_UNITS.some(u => u.name.toLowerCase() === lc);
    if (!isBuiltin && !c.added.some(a => String(a).toLowerCase() === lc)) c.added.push(name);
    if (!isBuiltin) c.methods[lc] = (method === 'oz') ? 'oz' : 'count';
    this.saveKey('list_config');
  },
  // The live option list for a key: built-ins + added, minus hidden, minus Other.
  /* ⚠⚠ 'OTHER' IS DROPPED AS A LEGACY BUCKET — BUT NOT WHEN THE LIST GENUINELY DECLARES IT (found
     by Kyle in the real app, 2026-07-28). This stripped 'other' unconditionally, and the comment on
     listAddOption already recorded the consequence — "the Add button simply appeared broken" — but
     the fix went to the Add path only, so the underlying hole stayed open. THREE lists declare
     'Other' as one of their own options: Expense Categories, Departments and Permit Types. On
     Operating Expenses it is the ninth category, it is what the IMPORTER falls back to for any
     column it cannot match, it is the bucket _sumMonthByCategory puts unknowns in, and it renders
     as a row on the By Category card — so the operator could SEE 'Other' rows they had no way to
     create, correct a row to, or re-add. Two doors, one record, two rules, again.
     The bare bucket is still dropped for every list that never declared it. */
  listOptions(key) {
    const c = this.listConfig(key);
    const hid = c.hidden.map(h => String(h).toLowerCase());
    const declaresOther = (this._listBuiltins[key] || []).some(b => String(b == null ? '' : b).trim().toLowerCase() === 'other');
    const out = [];
    const push = v => {
      v = (v == null ? '' : String(v)).trim();
      const lc = v.toLowerCase();
      if (!v) return;
      if (lc === 'other' && !declaresOther) return;
      /* ⛔ AND AT READ TIME, NOT ONLY AT ADD TIME — the add guard alone was half a fix and I knew it.
         An account that typed "Owner Draw" into the list manager BEFORE that guard shipped kept the
         whole defect: the dropdown still offered the name, the By Category card still listed it, and
         an expense filed under it was excluded from every total and from the log, so it had no Edit
         and no Delete button on any screen. Refusing the name here takes it out of the picker and
         off the card for those accounts too, so no new row can land on it.
         ⚠ Rows ALREADY filed under such a name stay unreachable until the Phase 5 cleanup — that is
         a data repair, not a code fix, and it is listed with the phantom catch-up children. */
      if (this.listReservedWhy(key, v)) return;
      if (hid.includes(lc) || out.some(x => x.toLowerCase() === lc)) return;
      out.push(v);
    };
    (this._listBuiltins[key] || []).forEach(push);
    c.added.forEach(push);
    /* ⛔⛔⛔ OTHER IS THE CATCH-ALL, SO IT IS ALWAYS THE LAST OPTION (Kyle, 2026-08-06, on the live
       app: *"when you add a custom category it is placed under other in the list.. that is weird..
       other should always be last in the list"*). Builtins are pushed first and `added` after, so
       every category an operator adds landed UNDERNEATH Other — which reads like a subtotal line
       that is not one, in every keyed picker in the app.
       ⭐⭐ AND THIS EXACT DEFECT WAS ALREADY FOUND AND FIXED ONCE, IN ONE CALLER.
       `hub-operating-expenses.categoryList()` carries the identical three lines with a comment
       explaining them — written when the By Category card showed it — and the SHARED reader every
       picker pulls through kept the bug. MEASURED on the live demo: `listOptions` returned
       *"… Other, Bar Supplies"* while `categoryList()` returned *"… Bar Supplies, Other"*, so one
       screen disagreed with itself one list away. [[the-loop]]: when you fix a shared thing, grep
       for the second IMPLEMENTATION, not for callers — and pin the rule where the rule lives.
       ⚠ A list that does not DECLARE Other never gains one: `push` has already refused it above, so
       this can only move a value that was legitimately there. */
    const oi = out.findIndex(v => v.toLowerCase() === 'other');
    if (oi >= 0 && oi !== out.length - 1) out.push(out.splice(oi, 1)[0]);
    return out;
  },
  // Add an option to a key (from the inline "+ Add your own" or the Manage editor).
  // A brand-new value goes into added; a hidden built-in just gets un-hidden.
  /* ⛔⛔ A NAME THE APP ALREADY USES FOR A DIFFERENT KIND OF ROW, AND THE COLLISION LOSES MONEY.
     The one-ledger merge put owner draws, loan payments, capital buys and tax remittances into
     `operating_expenses` under five reserved category names, and every reader on the expense side
     excludes rows by CATEGORY NAME. Nothing stopped the operator adding a category called exactly
     "Owner Draw" through the list manager: an expense logged under it was then filtered out of the
     month total, the year total, the history log — so it had no Edit and no Delete button anywhere
     — while the By Category card printed "Owner Draw $0.00", which reads as "no draws" rather than
     "$4,000 missing". Measured on a $8,100 ledger: This Month $4,100, operating income $4,000 high.
     It also let a re-dropped bank file write a real duplicate, because the import dedup compares
     against the same filtered set.
     ⚠ The names come from the screen that OWNS them, never a second copy here — a hardcoded list
     would drift the moment a sixth category is added, which is the whole disease this rebuild
     treats. Returns the REASON, not a boolean: a refusal the operator cannot explain reads as a
     broken Add button, which is exactly what [[the-loop]] #53 was about. */
  listReservedWhy(key, val) {
    if (key !== 'expense_category') return '';
    const v = String(val == null ? '' : val).trim();
    if (!v) return '';
    /* ⛔ "Uncategorized" IS A HEADING, NOT A CATEGORY (Phase 3 item 15). Bar Cop renders it over any
       expense with no category yet, and those are deliberately kept off the Income Statement until
       somebody sorts them. A real category by that name would print in the same bucket while
       COUNTING on the P&L, so the card would show one figure and mean two things.
       ⚠ app.js already carries the scar this prevents: a synthetic "Uncategorized" heading in the
       menu domain was once ADOPTED as a stored value after a degraded load. Refused at both doors,
       same as the cash-only names, and the refusal says why ([[the-loop]] #53 — a silent `return
       false` reads as a broken Add button). */
    if (v.toLowerCase() === 'uncategorized') {
      return '"' + v + '" is how Bar Cop labels an expense that has no category yet, so it cannot '
        + 'also be a category. Give those rows a real category instead, or pick a different name.';
    }
    if (!S.HubOperatingExpenses.isCashOnlyCategory(v)) return '';
    return '"' + v + '" is how Bar Cop labels money that leaves the bank but is not an operating '
      + 'cost. Log those on Money Out with Log Type set to Cash Outflow instead, or pick a different name.';
  },
  listAddOption(key, val) {
    val = (val == null ? '' : String(val)).trim();
    if (!val) return false;
    const lc = val.toLowerCase();
    /* ⚠ REFUSE ONLY WHERE IT CANNOT TAKE EFFECT, AND RETURN THE VERDICT SO THE CALLER CAN SAY SO.
       listOptions drops a bare 'other' for lists that never declared it — storing one there produced
       an entry written to the server, never shown, never offered, and the Add button simply appeared
       broken. It still refuses those. But a list that DOES declare 'Other' (Expense Categories,
       Departments, Permit Types) must accept it: re-adding un-hides the built-in, which is exactly
       what every other built-in does. Silently returning was the part that read as a bug. */
    if (lc === 'other' && !(this._listBuiltins[key] || []).some(b => String(b == null ? '' : b).trim().toLowerCase() === 'other')) return false;
    if (this.listReservedWhy(key, val)) return false;
    const c = this.listConfig(key);
    c.hidden = c.hidden.filter(h => String(h).toLowerCase() !== lc);
    const isBuiltin = (this._listBuiltins[key] || []).some(b => String(b).toLowerCase() === lc);
    if (!isBuiltin && !c.added.some(a => a.toLowerCase() === lc)) c.added.push(val);
    this.saveKey('list_config');
    return true;
  },
  // Remove an option: a built-in gets hidden, a custom-added one gets deleted.
  listRemoveOption(key, val) {
    const c = this.listConfig(key);
    const lc = String(val).toLowerCase();
    // ⚠ A MENU SECTION LIST MAY NOT BE EMPTIED. Every item form requires a section, so taking the
    // last one off a type dead-ends its Add form for good: the picker holds only the blank option
    // and Save refuses "Category required." from a screen the operator cannot fix it on. Refusing
    // here rather than papering over it at read time keeps the manager and the dropdown telling
    // the same story — a read-time fallback made them disagree and resurrected deleted sections.
    const isMenuKey = this.MENU_CAT_LIST_KEYS
      && Object.keys(this.MENU_CAT_LIST_KEYS).some(t => this.MENU_CAT_LIST_KEYS[t] === key);
    if (isMenuKey) {
      const left = this.listOptions(key).filter(o => String(o).toLowerCase() !== lc);
      if (!left.length) return false;
    }
    const before = c.added.length;
    c.added = c.added.filter(a => a.toLowerCase() !== lc);
    const wasCustom = c.added.length !== before;
    if (!wasCustom && (this._listBuiltins[key] || []).some(b => String(b).toLowerCase() === lc)) {
      if (!c.hidden.some(h => String(h).toLowerCase() === lc)) c.hidden.push(val);
    } else if (c.methods) {
      delete c.methods[lc];   // a deleted custom unit drops its stored method
    }
    // ⚠ MENU SECTION LISTS ONLY: a removed CUSTOM section has to be remembered as hidden as well.
    // Deleting it from `added` leaves no record it ever existed, and its items still carry the
    // name — so absorbMenuCats put it straight back on the next import and the operator found a
    // section they deleted kept returning. Re-adding it un-hides it again (listAddOption).
    if (wasCustom && isMenuKey && !c.hidden.some(h => String(h).toLowerCase() === lc)) {
      c.hidden.push(val);
    }
    this.saveKey('list_config');
    return true;
  },
  listResetDefaults(key) {
    this.data.list_config = this.data.list_config || {};
    // A per-type MENU section list is not like the others: its `added` entries were DERIVED from
    // the operator's own items by ensureMenuCatLists, not typed in by hand, while the confirm only
    // promises to remove "the ones you added". A plain reset therefore deleted sections their menu
    // is actively using, leaving items in a section their own picker no longer offers. Keep the
    // _seeded marker (so the migration does not undo the reset by re-merging the pre-B2 list) and
    // re-absorb what the menu actually uses.
    // ⚠ IT DOES NOT RE-ABSORB. A first pass called absorbMenuCats here so a reset could not strip a
    // section the menu was using — but every `added` entry on a migrated list came FROM an in-use
    // item, so absorb put all of them straight back and Reset to Defaults became a visible no-op
    // that still burned two server writes. Reset means reset, the same as it does for the other
    // twenty lists. Items keep their category, customSelect still offers it on the item that has
    // it, and the section still renders on the page; it just stops being offered to new items.
    // The _seeded marker is kept so the migration cannot undo the reset by re-merging the pre-B2
    // list on the next boot.
    const menuType = Object.keys(this.MENU_CAT_LIST_KEYS || {})
      .find(t => this.MENU_CAT_LIST_KEYS[t] === key);
    this.data.list_config[key] = menuType
      ? { added: [], hidden: [], methods: {}, _seeded: true }
      : { added: [], hidden: [] };
    this.saveKey('list_config');
  },
  // ── Valued lists (bottle sizes: each option is {label, v} where v = ounces) ──
  // Live options for a valued key: built-ins + added minus hidden, sorted by v.
  listValuedOptions(key) {
    const c = this.listConfig(key);
    const hid = c.hidden.map(h => String(h));
    const out = [];
    const push = o => {
      if (!o || o.v == null) return;
      const vs = String(o.v);
      if (!hid.includes(vs) && !out.some(x => String(x.v) === vs)) out.push({ label: o.label, v: o.v, name: o.name || '' });
    };
    (this._listBuiltins[key] || []).forEach(push);
    c.added.forEach(push);
    out.sort((a, b) => a.v - b.v);
    return out;
  },
  // A custom size stores its raw name AND a composed "Name (oz oz)" label so the
  // dropdown reads like the built-ins; the name rides to the product via data-name.
  listAddValued(key, label, v) {
    v = parseFloat(v);
    if (isNaN(v) || v <= 0) return;
    const c = this.listConfig(key);
    const vs = String(v);
    c.hidden = c.hidden.filter(h => String(h) !== vs);
    const name = (label || '').trim();
    const lbl = name ? (name + ' (' + v + ' oz)') : (v + ' oz');
    const existing = c.added.find(a => String(a.v) === vs);
    const isBuiltin = (this._listBuiltins[key] || []).some(b => String(b.v) === vs);
    if (existing) { existing.label = lbl; existing.name = name; }
    else if (!isBuiltin) c.added.push({ label: lbl, name, v });
    this.saveKey('list_config');
  },
  listRemoveValued(key, v) {
    const c = this.listConfig(key);
    const vs = String(v);
    const before = c.added.length;
    c.added = c.added.filter(a => String(a.v) !== vs);
    if (c.added.length === before && (this._listBuiltins[key] || []).some(b => String(b.v) === vs)) {
      if (!c.hidden.some(h => String(h) === vs)) c.hidden.push(v);
    }
    this.saveKey('list_config');
  },
  listRestoreValued(key, v) {
    const c = this.listConfig(key);
    const vs = String(v);
    c.hidden = c.hidden.filter(h => String(h) !== vs);
    this.saveKey('list_config');
  },
  // The "| Edit" affordance that sits after a keyed dropdown's <label> text. The
  // pipe inherits the label's colour/size (reads as part of the title); only the
  // word "Edit" is gold. The gold + pointer inline style picks up the global
  // gold-link hover. Lives inside the label (labels here are unassociated, so a
  // click never focuses the select) which keeps the row height aligned.
  manageListLink(key) {
    return '<span aria-hidden="true">|</span>'
      + '<a class="cs-manage" data-cs-key="' + esc(key) + '" style="color:var(--gold);cursor:pointer;">Edit</a>';
  },
  // Rebuild every on-screen keyed select for a list after the Manage editor
  // changes it, preserving each select's current value (and its blank option).
  _refreshListSelects(key) {
    const valued = this._listIsValued(key);
    const opts = valued ? this.listValuedOptions(key) : this.listOptions(key);
    document.querySelectorAll('.cs-select').forEach(sel => {
      if (sel.getAttribute('data-cs-key') !== key) return;
      const cur = sel.value;
      const hadBlank = sel.options.length && sel.options[0].value === '';
      const blankLabel = hadBlank ? sel.options[0].textContent : '';
      // If the operator just removed the option that was selected, DROP it
      // (deselect) — don't pin it at the end of the list. (Initial render keeps a
      // saved product's value selectable; that lives in customSelect, not here.)
      const stillThere = valued
        ? opts.some(o => String(o.v) === String(cur))
        : opts.some(v => v.toLowerCase() === (cur || '').toLowerCase());
      let html = hadBlank ? '<option value="">' + esc(blankLabel) + '</option>' : '';
      if (valued) {
        html += opts.map(o => '<option value="' + o.v + '"' + (o.name ? ' data-name="' + esc(o.name) + '"' : '')
          + (stillThere && String(o.v) === String(cur) ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('');
      } else {
        const curLc = (cur || '').toLowerCase();
        html += opts.map(v => '<option value="' + esc(v) + '"' + (stillThere && v.toLowerCase() === curLc ? ' selected' : '') + '>' + esc(v) + '</option>').join('');
      }
      sel.innerHTML = html;
      sel.value = stillThere ? cur : '';
      sel._csPrev = sel.value;
      // Removing the live selection changes the value → let dependents recompute.
      if (!stillThere) sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
  },
  // Shared list editor (opened by the "| Edit" link). Remove hides a built-in /
  // deletes a custom; Restore un-hides a hidden built-in; Add adds a custom;
  // Reset to Defaults clears both. Corner X closes. Re-renders after each change;
  // on close it refreshes the live selects so the dropdowns reflect the edits.
  openListManager(key) {
    if (!key) return;
    const label = this._listLabels[key] || 'List';
    const id = 'list-mgr';
    const rowStyle = 'display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 12px;background:var(--zone);border-radius:6px;margin-bottom:6px;';
    const linkStyle = 'color:var(--gold);cursor:pointer;font-size:11px;font-weight:600;';
    const valued = this._listIsValued(key);
    const methoded = this._listIsMethoded(key);
    const methodTag = name => '<span style="color:var(--t3);font-weight:400;font-size:11px;margin-left:8px;">'
      + (this.unitMethod(name) === 'oz' ? 'By ounces' : 'By count') + '</span>';
    const render = () => {
      // Rows: string list rows carry the value in data-v; valued (size) rows carry
      // the ounces in data-v and show the size label; methoded (unit) rows show the
      // tracking method next to the name.
      const rows = valued ? this.listValuedOptions(key) : this.listOptions(key).map(v => ({ label: v, v }));
      // ⚠ A MENU SECTION LIST CANNOT GO TO ZERO — every item form requires a section, so an empty
      // list dead-ends the Add form. listRemoveOption refuses it outright, but a Remove link that
      // does nothing when clicked is its own bug, so the last one simply does not offer it.
      const isMenuKey = this.MENU_CAT_LIST_KEYS
        && Object.keys(this.MENU_CAT_LIST_KEYS).some(t => this.MENU_CAT_LIST_KEYS[t] === key);
      const atFloor = isMenuKey && rows.length === 1;
      const rowsHtml = rows.length
        ? rows.map(o =>
            '<div style="' + rowStyle + '">'
            + '<span>' + esc(o.label) + (methoded ? methodTag(o.v) : '') + '</span>'
            + (atFloor
              ? '<span style="color:var(--t3);font-size:11px;">Your last section</span>'
              : '<span class="ll-del" data-v="' + esc(String(o.v)) + '" style="' + linkStyle + '">Remove</span>')
            + '</div>').join('')
        : '<div style="color:var(--t3);font-size:12px;padding:6px 0 10px;">No options yet. Add one below.</div>';
      // Hidden built-ins available to restore (valued ones are looked up for a label).
      const hiddenRaw = this.listConfig(key).hidden.slice();
      const hidden = valued
        ? hiddenRaw.map(hv => { const b = (this._listBuiltins[key] || []).find(x => String(x.v) === String(hv)); return { label: b ? b.label : (hv + ' oz'), v: hv }; })
        : hiddenRaw.map(v => ({ label: v, v }));
      const hiddenHtml = hidden.length
        ? '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin:16px 0 8px;">Hidden</div>'
          + hidden.map(o =>
            '<div style="' + rowStyle + 'color:var(--t3);">'
            + '<span>' + esc(o.label) + '</span>'
            + '<span class="ll-restore" data-v="' + esc(String(o.v)) + '" style="' + linkStyle + '">Restore</span>'
            + '</div>').join('')
        : '';
      const addRow = valued
        ? '<div style="display:flex;align-items:center;gap:8px;margin-top:14px;">'
          +   '<input type="text" id="ll-add" class="form-input" placeholder="Name (' + esc(this._listNameHints[key] || 'e.g. Gallon') + ')" style="flex:1;"/>'
          +   '<input type="number" id="ll-add-oz" class="form-input" placeholder="oz" step="0.1" min="0" style="width:90px;"/>'
          +   '<button class="btn btn-primary" id="ll-add-btn">Add</button>'
          +   '<span id="ll-add-err" style="display:none;font-size:11px;color:var(--red);align-self:center;"></span>'
          + '</div>'
        : methoded
        ? '<div style="display:flex;align-items:center;gap:8px;margin-top:14px;">'
          +   '<input type="text" id="ll-add" class="form-input" placeholder="Add a unit" style="flex:1;"/>'
          +   '<select id="ll-add-method" class="form-input" style="width:130px;"><option value="count">By count</option><option value="oz">By ounces</option></select>'
          +   '<button class="btn btn-primary" id="ll-add-btn">Add</button>'
          +   '<span id="ll-add-err" style="display:none;font-size:11px;color:var(--red);align-self:center;"></span>'
          + '</div>'
        : '<div style="display:flex;align-items:center;gap:8px;margin-top:14px;">'
          +   '<input type="text" id="ll-add" class="form-input" placeholder="Add an option" style="flex:1;"/>'
          +   '<button class="btn btn-primary" id="ll-add-btn">Add</button>'
          +   '<span id="ll-add-err" style="display:none;font-size:11px;color:var(--red);align-self:center;"></span>'
          + '</div>';
      const html = '<div class="card form-card" style="margin:0;">'
        + '<div class="card-title">Edit ' + esc(label) + '</div>'
        + '<div style="max-height:340px;overflow:auto;">' + rowsHtml + hiddenHtml + '</div>'
        + addRow
        + '<div class="card-actions">'
        +   '<button class="btn btn-ghost" id="ll-reset">Reset to Defaults</button>'
        + '</div>'
        + '</div>';
      this.openModal(html, { id, maxWidth: 460, onClose: () => { this.closeModal(id); this._refreshListSelects(key); } });
      const root = document.getElementById(id);
      if (!root) return;
      root.querySelectorAll('.ll-del').forEach(x => x.addEventListener('click', () => {
        if (valued) this.listRemoveValued(key, x.getAttribute('data-v'));
        else this.listRemoveOption(key, x.getAttribute('data-v'));
        render();
      }));
      root.querySelectorAll('.ll-restore').forEach(x => x.addEventListener('click', () => {
        if (valued) this.listRestoreValued(key, x.getAttribute('data-v'));
        else this.listAddOption(key, x.getAttribute('data-v'));
        render();
      }));
      const addInp = root.querySelector('#ll-add');
      const ozInp = root.querySelector('#ll-add-oz');
      const doAdd = () => {
        if (valued) {
          const oz = parseFloat(ozInp.value);
          if (isNaN(oz) || oz <= 0) { ozInp.focus(); return; }
          this.listAddValued(key, addInp.value, oz);
        } else if (methoded) {
          const v = (addInp.value || '').trim(); if (!v) return;
          this.listAddUnit(v, (root.querySelector('#ll-add-method') || {}).value);
        } else {
          const v = (addInp.value || '').trim(); if (!v) return;
          /* ⚠ A FORM THAT TAKES INPUT AND DOES NOTHING IS THE THING BEING REPORTED. listAddOption
             returns false when a value can never take effect; without this the row was accepted,
             the editor re-rendered unchanged, and the operator was left typing it again. */
          if (this.listAddOption(key, v) === false) {
            const err = root.querySelector('#ll-add-err');
            // A reserved name says WHY; everything else keeps the generic line.
            const why = this.listReservedWhy(key, v);
            if (err) { err.textContent = why || ('"' + v + '" cannot be added to this list.'); err.style.display = 'inline'; }
            return;
          }
        }
        render();
      };
      root.querySelector('#ll-add-btn').addEventListener('click', doAdd);
      addInp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); valued ? ozInp.focus() : doAdd(); } });
      if (ozInp) ozInp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } });
      root.querySelector('#ll-reset').addEventListener('click', () => {
        this.confirm({
          title: 'Reset to defaults?',
          message: 'This restores the built-in options and removes the ones you added.',
          confirmText: 'Reset',
        }).then(ok => { if (ok) { this.listResetDefaults(key); render(); } });
      });
    };
    render();
  },

  /* ⛔ HAS A CONFIRMED WEEK ALREADY BOOKED THIS RECORD?  ("locked" is no longer the whole answer --
     read the S331 note below before quoting this function's name as a rule.)

     Kyle, 2026-07-29: "if i inventory a location and submit it.. but then i realize i missed a
     couple of bottles.. how do i add those to the inventory count?" Today: you cannot. There is
     no edit, only Delete, on a record the screen's own help says feeds cost of goods -- and an
     ADJUSTMENT cannot stand in for it, because `computeUsagePair(start, end, deliveries)` never
     reads adjustments, so one would record a note without correcting a penny of COGS.

     So counts become editable. The original rule was blanket: ONCE A WEEK ENDING ON OR AFTER THIS
     COUNT IS CONFIRMED, THE COUNT IS LOCKED -- deliberately conservative, because a count is one
     end of a usage pair and a confirmed week has booked COGS, prime and variance off it.

     ⭐⭐ S331 NARROWED THAT, 2026-07-31, AND WHAT IT NOW GOVERNS DIFFERS BY ACTION AND BY STORE:
       · a booked COUNT is still undeletable, and is now EDITABLE -- `ic-take-inventory.submit()`
         asks `ConfirmWeek.cogsImpact` which confirmed weeks the correction moves, names each one
         with real before/after figures, and writes them only if the operator says so;
       · a booked DELIVERY is unchanged: both Edit and Delete stay off it, because no equivalent
         impact popup exists for the purchases term.
     The argument that made the narrowing safe: a confirmed week's figures were ALREADY editable
     from Week History -> Edit, which reuses the Confirm the Week popup and writes back to the SAME
     `week` / `revenue_week` records. **The blanket rule froze the SOURCE while leaving the RESULT
     freely editable**, which is not the integrity it read like.
     ⚠ Do not treat this function's return value as "the operator cannot touch this". It answers one
     narrow question -- has a confirmed week ended on or after this record's date -- and each caller
     decides what that costs. Callers: the Booked label and Delete on ic-count-history, both actions
     on ic-delivery-history, and ic-receive-delivery's belt-and-braces refusal.
     ⚠ `this.`, not `App.`, so it stays liftable ([[the-loop]] #46). */
  /* ⚠⚠ WHICH CONFIRMED WEEKS DO THESE DATED ROWS FALL INSIDE? (S281.)
     An import writes per-day `sc_shifts` records with no idea whether the operator has already
     confirmed the week those days sit in — `pos-ingest` carries no lock guard at all, while the app
     enforces one on counts and deliveries (`countLockedByWeek`). **This is NOT data loss and must
     not be reported as one**: Confirm the Week STORES its own figures on the `week` /
     `revenue_week` records, so a confirmed week keeps exactly what was signed off. What it is, is a
     SILENT DIVERGENCE — the day-level sales behind a confirmed week now say something different
     from the week itself, and nothing on screen says so. Kyle's call: WARN, do not block.
     ⚠ Bounded by the week's real Monday, not just `<= period_end`. `countLockedByWeek` deliberately
     locks everything on or before the newest confirmed week-end (a count is a running snapshot, so
     anything earlier is behind a sign-off). A sales DAY is not like that — it belongs to exactly
     one week, and warning about a day three months before the only confirmed week would be noise.
     Returns the week-ending dates, sorted, so the caller can name them. */
  confirmedWeeksTouched(dates) {
    const weeks = (this.data && this.data.weeks) || [];
    const ends = weeks.map(w => String((w && w.period_end) || '').slice(0, 10)).filter(Boolean);
    if (!ends.length) return [];
    const hit = new Set();
    (dates || []).forEach(raw => {
      const day = String(raw || '').slice(0, 10);
      if (!day) return;
      ends.forEach(end => {
        const start = this.weekStartFor(end);
        if (start && day >= start && day <= end) hit.add(end);
      });
    });
    return [...hit].sort();
  },

  /* IS THIS DRAWER COUNT ACTUALLY A VARIANCE? (S80)
     ⚠ COUNTING ROWS IS NOT COUNTING VARIANCES, and this app has now got that wrong in two
     documents an accountant reads side by side. The Year-End WORKBOOK already counts Over and Short
     BY STATUS — S27(h), whose own comment measured a bar counting four registers nightly getting
     "Short Count: 680" from raw sign while Cash History said 11 out of tolerance. The Year-End PDF
     and the monthly Books PDF were missed in that same export and printed `variances.length`, the
     raw row count, under the words "Cash variances logged": measured on the seed, the workbook says
     37 and the PDF says 364.
     An `sc_variances` row is a drawer count that was RECONCILED. Most of them are a few dollars off
     and INSIDE the register's tolerance, which is why `status` exists: 'Over' and 'Short' are the
     ones out of tolerance, and everything else is a clean count.
     ⚠ THE SIGN FALLBACK IS CARRIED OVER DELIBERATELY, not invented here — a legacy row with no
     status recorded has only its amount to go on, and that is the rule the workbook already uses.
     One implementation, because two files ask this and two files is exactly how the first pair
     drifted ([[the-loop]] #54: when a number appears on two screens, pin the EQUALITY). */
  /* CAN THIS POOL BE RANKED AT ALL? (S298 / S303)
     A Star/Plowhorse/Puzzle/Dog verdict is a COMPARISON: `hiM = margin >= avgMargin`,
     `hiV = covers >= avgCovers`. `>=` means an item sitting exactly ON the mean counts as high — so
     when every item in a pool holds the SAME value on an axis, every item is on that mean and every
     item is "high" on it:
       · S303  nothing has sold yet, so `avgCovers` is 0 and `0 >= 0` holds for everyone. The whole
               section comes back Stars and Plowhorses. That is the DAY-ONE shape for any menu
               before its first product-mix drop, so it is the first thing a new operator reads.
       · S298  four bottle-beer cases at one case price are all on the margin mean and all Stars,
               under a tile reading "Strong on both counts" about items nothing can tell apart.
     THE RULE: if an axis separates nobody, no verdict can be reached, and the pool is UNRANKED —
     which is precisely the answer a too-small pool already gets, and every consumer already handles
     it. EITHER axis, not both: a flat covers pool with varied margins yields only Stars and
     Plowhorses and never a Puzzle or a Dog, and both of those words assert a volume side that does
     not exist.
     ⚠ COMPARED IN CENTS. `price - cost` carries float noise, and at full precision two genuinely
     equal margins read as distinct — which hands the verdict straight back out. Menu Rundown's tie
     map already compares in cents for exactly this reason.
     ⚠ MIRRORED VERBATIM in server/audit-compute.js, the same arrangement `menuGroupKey` has, and
     held to it by verify-flat-pool-no-verdict.js — the audit must name the same Stars as the screen
     its action item links to. */
  menuPoolSeparable(list) {
    const l = Array.isArray(list) ? list : [];
    if (l.length < 2) return false;
    const cents = v => Math.round((Number(v) || 0) * 100);
    const m = new Set(), c = new Set();
    l.forEach(i => { m.add(cents((i && i.price) - (i && i.cost))); c.add(Number((i && i.weekly_covers) || 0)); });
    return m.size > 1 && c.size > 1;
  },

  varianceIsOut(v) {
    if (!v) return false;
    if (v.status) return v.status === 'Over' || v.status === 'Short';
    return (parseFloat(v.variance) || 0) !== 0;
  },

  countLockedByWeek(c) {
    const d = String((c && (c.date || c.created_at)) || '').slice(0, 10);
    if (!d) return false;
    return ((this.data && this.data.weeks) || [])
      .some(w => w && String(w.period_end || '').slice(0, 10) >= d);
  },

  /* ⭐ AN IN-PROGRESS SPOT CHECK IS NOT A SPOT CHECK YET. Every consumer reads through here.

     A spot check is a TWO-SITTING job: pre-shift counts before service, post-shift counts and the
     POS numbers after. Until the second sitting happens the check has measured nothing, and a
     half-finished one must not reach a score. Two ways it used to land, both wrong and in opposite
     directions: with no POS the variance is null, so it read as a COMPLETED check at $0 -- a clean
     bill of health from a check that measured nothing, which also inflated the spot-check
     discipline count; with POS but no post count it booked the entire pre-shift stock as poured,
     a huge false overpour into the audit's shrink figure.

     ⚠ THIS IS A HELPER BECAUSE SIX FILES ASKED THE SAME QUESTION SEPARATELY -- audit-tracker,
     hub-bar-cop-audit (twice), hub-week-review, ic-dashboard and profit-fix all read
     `ic_spot_checks` raw. Filtering inside the spot-check SCREEN would have fixed none of them
     ([[the-loop]] step 0.6: the second consumer is in another file; where there are six of one
     decision there is one helper).
     ⚠ ABSENT STATUS MEANS COMPLETE, and that is load-bearing: every check already saved and every
     seeded one predates the field. Testing `=== 'complete'` would erase real history on upgrade.
     ⚠ `this.`, not `App.`, so it stays liftable into the harness suite ([[the-loop]] #46). */
  completedSpotChecks() {
    const all = (this.inventoryData && this.inventoryData.ic_spot_checks) || [];
    return all.filter(c => c && c.status !== 'in_progress');
  },

  // Display unit for a product's Par / Order Qty / On-Hand columns. Bottle beer
  // pars/orders in cases, draft in kegs, liquor/wine in bottles; Food/Misc use
  // the product's unit_type (lb, each, case, qt…). Keeps every category's
  // quantity columns labeled the same way instead of baking the unit into the
  // product name.
  /* `n` is OPTIONAL and only changes the answer at exactly 1, so all 18 existing callers
     keep today's behaviour byte for byte. It exists because a par of one keg rendered
     "1 kegs" on the product list and on the vendor's product list — the same cell in two
     files, which is why the fix is here and not at either call site.
     ⚠ Only the three units Bar Cop owns are singularised. `unit_type` is free text the
     operator typed (lb, case, each, gallon, or their own word) and there is no rule that
     turns an arbitrary word singular without getting it wrong ("each" -> "eac"). */
  productUnit(p, n) {
    if (!p) return '';
    const one = Number(n) === 1;
    if (p.category === 'Bottle Beer') return one ? 'case' : 'cases';
    if (p.category === 'Draft Beer')  return one ? 'keg'  : 'kegs';
    if (p.category === 'Liquor' || p.category === 'Wine') return one ? 'btl' : 'btls';
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
    if (p.category === 'Bottle Beer') {
      // unit_cost is a CASE price; with no case size there is no per-bottle cost, so REFUSE (null)
      // rather than hand back the whole case as a per-bottle figure (~24x too high). The poured-
      // beverage branch in menuLinkCost refuses the same way (0/Incomplete until a basis exists). S162.
      return (p.case_size && p.case_size > 0) ? cost / p.case_size : null;
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

  /* ── A QUANTITY AND ITS UNIT, WITH THE UNIT SINGULAR AT EXACTLY ONE ────────
     F19: Dynamic Pars printed "1 kegs", the Order Sheet's minimum dialog printed
     "1 kegs under the 2 kegs minimum", and THREE screens (Stock Report, Usage
     Report, Dynamic Pars) carried byte-identical private copies of the same
     `num + ' ' + unitAbbr(...)` renderer. One wrong word written out seven times,
     so it gets one door.

     Takes the ALREADY-FORMATTED number STRING. Every caller has already decided
     its own precision, and reformatting here would silently move figures on six
     screens — only the word after the number changes.

     Singular ONLY when that string is exactly "1":
        "1 keg"   "2 kegs"   "1.0 kegs"   "0.5 kegs"
     so nothing has to decide what 1.5 of a keg is called and a decimal never
     changes shape. Pinned by verify-qty-unit-singular.js.

     ⛔ unitAbbr is deliberately NOT quantity-aware. Its vocabulary is
     ABBREVIATIONS — cs / ea / oz / qt / gal / L have no singular form — and it
     feeds countCols, i.e. every count string in the app. */
  qtyUnit(numStr, unit) {
    const s = String(numStr == null ? '' : numStr);
    const u = String(unit == null ? '' : unit);
    if (!u) return s;
    return s + ' ' + (s === '1' ? this.unitSingular(u) : u);
  },
  /* The singular of a stock unit.
     ABBR is EVERY value unitAbbr can emit, written out rather than derived, and
     each one maps to what it should read as at a count of one. That list is the
     whole point: an abbreviation is not a plural. A bare `.replace(/s$/,'')`
     turns "cs" — a perfectly good case count — into "1 c", which is how the
     first version of this helper shipped and what the pin caught.
     Anything else is a real word (MIN_UNITS, or the operator's own list) where
     English's rule applies: `-es` after ss/x/z/ch/sh, `-s` otherwise. The trap
     that rule exists for is that "glasses" is glass+es while "cases" is case+s —
     stripping "es" from everything ending "ses" would print "1 cas". */
  unitSingular(unit) {
    const u = String(unit == null ? '' : unit);
    const ABBR = { cs: 'cs', kegs: 'keg', btls: 'btl', ea: 'ea', lbs: 'lb',
                   oz: 'oz', qt: 'qt', gal: 'gal', l: 'L' };
    const hit = ABBR[u.toLowerCase()];
    if (hit) return hit;
    if (!/s$/i.test(u) || /ss$/i.test(u)) return u;   // gal, glass, anything singular
    return /(?:ss|x|z|ch|sh)es$/i.test(u) ? u.slice(0, -2) : u.slice(0, -1);
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
      // Full cases and loose bottles are whole numbers, so "1 btls" is reachable
      // here and nowhere else in this function — the totals carry decimals.
      return { full: this.qtyUnit(cases, 'cs'), open: this.qtyUnit(loose, 'btls'), total: total.toFixed(2) + ' cs' };
    }
    // Food / Misc with a pack size: full units + loose pieces, total in units.
    const packSize = vals.packSize != null ? vals.packSize : ((p && p.pack_size) || 0);
    if (packSize > 0 && (((p && p.category) || vals.category) === 'Food' || ((p && p.category) || vals.category) === 'Misc') && vals.loose != null) {
      const pu = this.unitAbbr(this.productUnit(p || { category: vals.category, unit_type: vals.unit_type }));
      return { full: this.qtyUnit(vals.fulls || 0, pu), open: this.qtyUnit(vals.loose || 0, 'ea'), total: total.toFixed(2) + (pu ? ' ' + pu : '') };
    }
    const u = this.unitAbbr(this.productUnit(p || { category: vals.category, unit_type: vals.unit_type }));
    const us = u ? ' ' + u : '';
    return {
      full:  this.qtyUnit(vals.fulls || 0, u),
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
    // Skip products a partial count left uncounted (counted===false, stored total:0):
    // reading that 0 as the endpoint would bill the whole shelf as used and flag a
    // phantom 100% leak, while _perpetualInventory (the on-hand reader) skips them and
    // keeps the last count. Usage needs a real value at BOTH ends, so filter both maps.
    ((start && start.items) || []).forEach(it => {
      if (it.counted === false) return;
      if (sMap[it.product_id]) sMap[it.product_id].total = (sMap[it.product_id].total || 0) + (it.total || 0);
      else sMap[it.product_id] = { ...it };
    });
    ((end && end.items) || []).forEach(it => {
      if (it.counted === false) return;
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
      // Fall back to the pour math when pours_per_container was never stored, so a
      // seeded/imported pourable still yields theoretical draws (kept consistent
      // with ic-report-variance _compServingsToStock).
      const servingsPerUnit = isCaseBeer ? p.case_size
        : (p.pours_per_container || ((p.container_size_oz && p.pour_size_oz) ? p.container_size_oz / p.pour_size_oz : null));
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
  // How a role's tip-out percent is applied: 'tips' = a percent of the tips they
  // made (common 10-20%), 'sales' = a percent of their sales (common 1-2%).
  // Set per position; defaults to 'sales' so older records read the same as before.
  tipOutBasisFor(s) {
    const p = this.positionFor(s);
    return (p && p.tip_out_basis === 'tips') ? 'tips' : 'sales';
  },
  // The dollar tip-out a payer owes: their percent applied to the right basis
  // (their sales, or their gross tips). One place so every entry path agrees.
  tipOutPaid(s, sales, grossTips) {
    const pct = this.tipOutPctFor(s);
    if (pct <= 0) return 0;
    const base = this.tipOutBasisFor(s) === 'tips' ? (parseFloat(grossTips) || 0) : (parseFloat(sales) || 0);
    return base > 0 ? base * pct / 100 : 0;
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

  /* ⛔⛔⛔ A TIP ROW IS PART OF AN OPEN SHIFT ONLY WHILE IT SAYS SO. ABSENT MEANS CLOSED.
     The Tip Log saves each person as they check out, so a shift is half-entered for most of a
     night, and half-entered tips must not reach anything that treats them as final: the tip-credit
     check decides how much MAKEUP PAY is owed to a $2.13 server, and Form 8027 is a tax worksheet.
     ⭐ THE POLARITY IS THE WHOLE SAFETY OF IT, and it is why the field names the OPEN state rather
     than the closed one. Every tip row written before this existed carries no field at all, and
     those are complete history. With `tip_shift_open` absent reads FALSY, so they are closed and
     cannot be captured by a state invented after them ([[lessons-paid-for]] #63 — a field that
     predates your feature has a meaning your feature does not get to choose; the safety comes from
     the field being NEW). A `tip_shift_closed` spelling would have needed `!== false` at six call
     sites to say the same thing, and the one that got it wrong would silently re-open two years of
     records.
     ⚠ ONE CONSUMER DELIBERATELY DOES NOT FILTER: `PosIngest.buildTips` compares against EVERY
     existing row to spot duplicates, so hiding open rows from it would re-import somebody who is
     already on the screen. That exemption is pinned with its reason. */
  tipShiftOpen(t) { return !!(t && t.tip_shift_open); },
  // The rows any final figure may be built from. One door, so a seventh consumer added next month
  // asks the same question the other six do.
  settledTips(list) { return (list || []).filter(t => !this.tipShiftOpen(t)); },

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
    const every = ((this.shiftData && this.shiftData.sc_drawers) || []);
    const active = every.filter(d => d.active !== false);
    // ⚠ An ARCHIVED register that is CURRENTLY SELECTED stays on the list (S132) — the same rule
    // as S35/S54: whatever a picker excludes, it must still show what is selected. Without it the
    // "(unsaved)" fallback below rendered the raw internal id in front of the operator
    // ("d2 (unsaved)"), which S104 made common by stamping imported rows with an archived
    // register's id. It is still never offered for a NEW count.
    const archivedSel = selectedId
      ? every.find(d => d.active === false && (d.id === selectedId || d.name === selectedId))
      : null;
    const all = archivedSel ? active.concat([archivedSel]) : active;

    let resolvedId = selectedId || '';
    if (resolvedId && !all.some(d => d.id === resolvedId)) {
      const byName = all.find(d => d.name === resolvedId);
      if (byName) resolvedId = byName.id;
    }

    let h = '<option value="">' + esc(opts.placeholder || 'Select drawer...') + '</option>';
    all.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(d => {
      h += '<option value="' + esc(d.id) + '"' + (resolvedId === d.id ? ' selected' : '') + '>'
        + esc(d.name) + (d.active === false ? ' (archived)' : '') + '</option>';
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
    { name: 'Lunch',      start: '11:00', end: '16:00' },
    { name: 'Dinner',     start: '16:00', end: '22:00' },
    { name: 'Late Night', start: '22:00', end: '02:00' }
  ],
  DEFAULT_SERVICE_PERIODS: [
    { id: 'sp_def_breakfast', name: 'Breakfast',  start: '06:00', end: '11:00' },
    { id: 'sp_def_lunch',     name: 'Lunch',      start: '11:00', end: '16:00' },
    { id: 'sp_def_dinner',    name: 'Dinner',     start: '16:00', end: '22:00' },
    { id: 'sp_def_late',      name: 'Late Night', start: '22:00', end: '02:00' }
  ],
  servicePeriods() {
    const sp = this.data && this.data.settings && this.data.settings.service_periods;
    return (Array.isArray(sp) && sp.length) ? sp : this.DEFAULT_SERVICE_PERIODS;
  },
  // Canonical shift-type names, derived from the operator's service periods. Every
  // consumer reads from here so the list never drifts.
  get SHIFT_TYPES() { return this.servicePeriods().map(p => p.name); },

  /* ⛔⛔⛔ DOES A SCHEDULED SHIFT TOUCH A SERVICE PERIOD, AND FOR HOW LONG.
     Kyle, 2026-09-05, on the first build of the tip shift selector: *"all the staff names stay on
     every shift, just their hours change... priya works 5-11, so dinner and 1 hour into late
     night, but she is still listed on lunch and happy hour. Why?"*
     Because the selector filtered the HOURS lookup and never the CREW. MEASURED on the demo: every
     period returned the same eight people, including Brianna K. (09:30-15:00) on Late Night and
     Priya N. (17:00-23:00) on Lunch.
     ⭐ THE HOURS MATTER AS MUCH AS THE NAMES. A tip pool divides by hours, so putting a whole
     eight-hour shift against Lunch pays that person for time they worked at dinner and takes it off
     everyone else. `overlapHours` is the portion that actually falls inside the period.
     ⚠ BOTH WINDOWS CAN WRAP PAST MIDNIGHT — Late Night is 22:00-02:00 in the app's own presets, and
     a 17:00-01:00 bar shift wraps too — so each is measured on a 48-hour line and compared against
     the other's next-day copy as well. Touching end-to-start is NOT an overlap: 11:00-15:00 beside
     15:00-17:00 is two adjacent dayparts, which is the normal case.
     ⚠ ONE IMPLEMENTATION. `ServicePeriods._overlap` asks the same question when it refuses two
     periods that cross, and two copies of a time comparison is exactly the drift this codebase
     keeps paying for. */
  _clockMin(t) { const a = String(t || '').split(':'); return (parseInt(a[0], 10) || 0) * 60 + (parseInt(a[1], 10) || 0); },
  _clockSpan(start, end) {
    const s = this._clockMin(start);
    let e = this._clockMin(end);
    if (e <= s) e += 1440;                     // wraps past midnight
    return [s, e];
  },
  overlapMinutes(aStart, aEnd, bStart, bEnd) {
    if (!aStart || !aEnd || !bStart || !bEnd) return 0;
    const [as, ae] = this._clockSpan(aStart, aEnd);
    const [bs, be] = this._clockSpan(bStart, bEnd);
    const cut = (x1, x2, y1, y2) => Math.max(0, Math.min(x2, y2) - Math.max(x1, y1));
    // Compare against the other window's next-day copy too, or a wrapping shift misses a morning
    // period and vice versa.
    return Math.max(cut(as, ae, bs, be), cut(as, ae, bs + 1440, be + 1440), cut(as + 1440, ae + 1440, bs, be));
  },
  windowsOverlap(aStart, aEnd, bStart, bEnd) { return this.overlapMinutes(aStart, aEnd, bStart, bEnd) > 0; },
  /* ⚠ `overlapHours` AND `servicePeriodByName` WERE RETIRED HERE (2026-09-05). Both existed for
     one caller: the Tip Log's per-daypart crew filter, which scoped a shift's hours to the period
     being closed out. Tips track per day again, so nothing asks either question, and a helper
     with no caller is a member somebody rediscovers and wires to the wrong thing.
     `overlapMinutes` and `windowsOverlap` STAY — `ServicePeriods._overlap` and the seed both
     read them, and the midnight-wrap arithmetic in `overlapMinutes` is the part worth keeping
     in one place. 🔧 verify-no-retired-code.js is what caught these two. */
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
  // KITCHEN_CATS arrays in bar-products.js, kitchen-products.js, and the inline
  // isBar() check below. (this-week.js used to hold delegating getters for these;
  // T1 retired them with the grid, and its one live reader passes App.BAR_CATS in.)
  BAR_CATS: ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer'],
  KITCHEN_CATS: ['Food', 'Misc'],

  // Full Inventory Control product category list (the product form picker) and
  // the Food/Misc stock-unit list. Single source so take-inventory,
  // product-setup and the log forms never drift from each other.
  IC_CATEGORIES: ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer', 'Food', 'Misc'],
  // Food/Misc unit types carry a tracking method: 'count' (servings/pieces, total
  // or full+loose count) or 'oz' (recipe-costed by the ounce, fill-slider count).
  // Volume units are 'oz'; everything countable is 'count'. Operator-added units
  // choose their method in the Edit Unit Types popup.
  IC_FOOD_UNITS: [
    { name: 'lb', method: 'count' }, { name: 'each', method: 'count' }, { name: 'case', method: 'count' },
    { name: 'bag', method: 'count' }, { name: 'box', method: 'count' }, { name: 'gallon', method: 'oz' },
    { name: 'quart', method: 'oz' }, { name: 'pint', method: 'oz' }, { name: 'dozen', method: 'count' },
  ],
  get IC_FOOD_UNIT_TYPES() { return this.IC_FOOD_UNITS.map(u => u.name); },
  // The tracking method for a unit name: a built-in's fixed method, else the
  // operator-set method stored on the unit_type list, else 'count'.
  unitMethod(name) {
    if (!name) return 'count';
    const lc = String(name).trim().toLowerCase();
    const b = this.IC_FOOD_UNITS.find(u => u.name.toLowerCase() === lc);
    if (b) return b.method;
    const c = this.listConfig('unit_type');
    return (c.methods && c.methods[lc]) || 'count';
  },

  /* ── THE ONE NUMERIC COERCION for operator-supplied text ──────────────────────────────────
     Every import and every typed cell that has to become a number comes through here.

     ⚠ WHY IT EXISTS: seven screens each rolled their own, and they disagreed on SIGN — which is
     money. A card export's refund row reads "(125.00)" or "125.00-", and six of the seven returned
     +125, so hub-operating-expenses booked a $125 CREDIT as a $125 EXPENSE. The same file's
     "-125.00" rows parsed to -125 and were silently dropped by that same guard: one file, two
     opposite wrong answers, $250 apart.

     RETURNS A NUMBER, OR null WHEN THERE IS NO NUMBER TO READ. null is not 0 — that is the same
     distinction as an uncosted item versus an item costing zero, and conflating them is what once
     made an unpriced dish read as the best margin on the menu. The CALLER decides what "no number"
     means for its own field (`?? 0`, or skip the row).

     ⚠ WHAT IT DELIBERATELY DOES NOT DO. It does not read European decimal commas ("1 234,50" is
     123450), does not parse scientific notation ("1e3" is 13), and does not unpick a cell holding
     two numbers ("2 for $10" is 210). All eight previous implementations already behaved exactly
     this way, so nothing that was right has moved; each needs a product decision and is tracked
     separately. verify-parse-num.js PINS these so a later fix has to come here on purpose. */
  parseNum(v) {
    if (v == null) return null;
    const s = String(v).trim();
    if (!s) return null;
    // ⚠ A SPREADSHEET ERROR IS NOT A NUMBER. #REF! and #N/A already fell out as null (no digits),
    // but #DIV/0! carries a literal 0 and parsed as a REAL ZERO — and a zero is not "unreadable",
    // it is a value, so the sales import's carry test treated the column as present and wrote $0
    // over a day's real takings, reporting "1 replaced earlier figures" with no conflict raised.
    // Every Excel error starts with '#', which no legitimate money or count cell does.
    if (s.charAt(0) === '#') return null;
    // Sign is read BEFORE stripping, from the three shapes accounting software actually emits:
    // wrapped in parentheses, a leading minus, or a trailing minus.
    const t = s.replace(/[^0-9.,()\-]/g, '');
    // An INTERIOR minus is a range or a code ("4-6", "10-12"), not a value. The old implementations
    // split 3-to-5 on it and fabricated either 46 or 4. Refusing is the honest answer; the caller's
    // own default then applies.
    if (/\d\s*-\s*\d/.test(t)) return null;
    /* I13 — A CELL HOLDING MORE THAN ONE NUMBER IS NOT A QUANTITY.
       The parse below strips every non-digit and reads what is left, so two numbers in one cell
       were CONCATENATED into a third that appears nowhere in the data: "2 for $10" -> 210,
       "9 / 34" -> 934, "16oz $7" -> 167, "1e3" -> 13. Price-per-size cells are ordinary on a real
       menu, and measured downstream one "2 for $10" entree moved avgCM 13.57 -> 45.79 and flipped
       two dishes from Puzzle to Dog.
       ⭐ This is the SAME RULE as the range guard directly above, applied consistently — that line
       already refuses "4-6" for exactly this reason. A ',' or '.' BETWEEN digits belongs to one
       number ("1,234.50"); anything else between two digit runs means the cell holds two.
       ⚠ Counted on `s`, the ORIGINAL string — not on `t`, which has already had the letters
       stripped, so "2 for $10" would look like the single run "210" there.
       ⚠ No lookbehind: the browser floor is ES2020 and Safari shipped lookbehind only in 16.4,
       far above the floor L10 measured. Lookahead is ES3 and safe. */
    const runs = s.replace(/(\d)[.,](?=\d)/g, '$1').match(/\d+/g);
    if (runs && runs.length > 1) return null;
    const neg = /^\(.*\)$/.test(t) || /^-/.test(t) || /-$/.test(t);
    const n = parseFloat(s.replace(/[^0-9.]/g, ''));
    if (isNaN(n)) return null;
    return neg ? -n : n;
  },

  // Canonical vendor discrepancy types. Used by vendor-discrepancy.js and
  // ic-receive-delivery.js flag-per-line flow so the type list stays unified.
  VENDOR_DISCREPANCY_TYPES: ['Price Overcharge', 'Short Count', 'Substitution', 'Damaged Goods', 'Other'],

  // Canonical Profit Audit section names. Used by audit-tracker.js in
  // extractSections, viewAudit sections array, and renderNarrative sections
  // array so the list never drifts across the three call sites.
  AUDIT_PROFIT_SECTION_NAMES: [
    'Pour and Bar Cost',
    'Food Cost',
    'Shrink and Waste',
    'Theft and Cash Loss',
    'Vendor Cost Control'
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
  /* ⚠ `MENU_PLATE_CATEGORIES` WAS DELETED HERE (M6, 2026-07-30). It had ZERO references in the
     whole tree — one occurrence, its own definition — while its comment claimed it was "kept for
     the recipe ingredient/target-cost logic". Nothing read it, and it still listed **Specials**,
     which was removed from the dish list on 2026-07-25, so the next person to trust it would have
     got the pre-rename set. A stale duplicate is worse than no constant: it looks authoritative.
     ⚠ Do not confuse it with `MENU_PLATE_ING_CATS` (below), which IS live — r-menu-items reads it
     through a getter. Near-identical names, opposite verdicts ([[the-loop]] #9). */
  // The shared, operator-customizable menu SECTION list (the | Edit popup key
  // 'menu_category'). Any menu item — dish, cocktail, or no-prep — can sit in any
  // of these. Builtins are the classic sections in menu order; the operator adds
  // their own (Happy Hour, Featured, Brunch...) which then show on every form and
  // as real sections on the menu pages. Item TYPE is stored separately on the item.
  MENU_ALL_CATEGORIES: ['Appetizers', 'Entrees', 'Sides', 'Desserts', 'Specials', 'Cocktails', 'Beer', 'Wine', 'NA Beverages', 'Snacks'],

  /* ── PER-TYPE MENU SECTION LISTS (B2 step 3, Kyle 2026-07-25) ─────────────────────────────
     Each item TYPE now carries its own operator-customizable section list, so the Dish form
     stops offering "Cocktails" and a cocktail can sit in Happy Hour or Frozen. MENU_ALL_CATEGORIES
     above is kept as the union — it is what the ONE old shared list was seeded from, and the
     migration below still reads accounts that were built on it.
     ⚠ THESE ARE MENU LAYOUT. THEY ARE NOT ECONOMICS. menuGroupKey still pools every cocktail
     whatever section it sits in, and still keys dishes / No Prep per category, so adding a
     cocktail section can never move a ranking. Pinned by verify-menu-cat-lists.js case 7, and
     the basis itself by verify-menu-grouping-tieout.js. */
  MENU_CATEGORIES_BY_TYPE: {
    plate:     ['Appetizers', 'Entrees', 'Sides', 'Desserts'],
    /* ⚠ THE TAB IS "MIXED DRINKS"; "COCKTAILS" IS A SECTION INSIDE IT (Kyle, 2026-07-25).
       It was both at once before, and a category cannot contain itself. The tab names the KIND of
       thing the way Dishes does; these name what goes on a printed menu, the way Appetizers /
       Entrees / Desserts do.
       ⚠ "Cocktails" MUST STAY IN THIS LIST. All 14 seeded drinks are filed there, and menuTypeOf's
       legacy fallback for every item saved before the `type` field is literally
       `category === 'Cocktails'`. Dropping it would strand the seed and blind that inference.
       Cocktails / Shots / Frozen are LAYOUT — all three still rank in the one pool. */
    cocktail:  ['Cocktails', 'Shots', 'Frozen'],
    inventory: ['Beer', 'Wine', 'NA Beverages', 'Snacks']
  },
  MENU_CAT_LIST_KEYS: {
    plate:     'menu_category_plate',
    cocktail:  'menu_category_cocktail',
    inventory: 'menu_category_inventory'
  },
  /* Names a section list must never adopt. SHARED BY BOTH SEEDERS — ensureMenuCatLists and
     absorbMenuCats — because they do the same job at two different moments and a rule written into
     only one of them is the twin miss that keeps costing rounds. It went into absorb and not into
     the migration, so a degraded first load followed by a POS import left "Uncategorized" adopted
     as a real, permanently-offered section on the next healthy boot.
       'Other'         — listOptions drops it unconditionally; the "+ Add your own" flow replaced
                         that bucket, so storing one yields an option nothing can ever show.
       'Uncategorized' — the synthetic heading the menu list renders for items with NO section. It
                         is a state, not a section anyone chose, and adopting it made the list
                         builder draw it twice: once in place and once in its pinned slot. */
  _menuCatReserved(v) {
    const l = String(v == null ? '' : v).trim().toLowerCase();
    return !l || l === 'other' || l === 'uncategorized';
  },
  menuCatListKey(type)  { return this.MENU_CAT_LIST_KEYS[type] || this.MENU_CAT_LIST_KEYS.plate; },
  menuCatBuiltins(type) { return this.MENU_CATEGORIES_BY_TYPE[type] || this.MENU_CATEGORIES_BY_TYPE.plate; },
  // The live options for a type.
  // ⚠ IT MUST NOT CREATE THE KEY. listOptions → listConfig CREATES whatever key it is handed, so
  // calling this while the migration is gated shut used to write an EMPTY
  // menu_category_plate — and an empty key reads as "already migrated", which locked the operator
  // out of their own sections permanently. Unmigrated now serves the builtins and touches nothing.
  menuCatOptions(type) {
    this.ensureMenuCatLists();
    const key = this.menuCatListKey(type);
    const lc = (this.data && this.data.list_config) || null;
    if (!lc || !lc[key]) return (this._listBuiltins[key] || this.menuCatBuiltins(type)).slice();
    // ⚠ NO "IF EMPTY, SHOW THE BUILTINS" FALLBACK HERE, DELIBERATELY. A first pass added one, and
    // it was both dead and harmful: the form's picker is customSelect, which reads listOptions
    // DIRECTLY and never comes through this door, so the form still dead-ended — while the preset
    // guard in r-menu-items DID come through here, passed on phantom options, and re-injected a
    // section the operator had deleted as the only selectable choice. The list cannot be emptied
    // in the first place now; listRemoveOption holds the floor, where the manager and every
    // dropdown see the same answer.
    return this.listOptions(key);
  },

  /* Split the single `menu_category` list into three, once per account.

     ⚠ IT IS RE-DERIVABLE ON PURPOSE, AND THAT IS THE WHOLE DESIGN. saveKey does not roll memory
     back when it fails, so a migration that stamped a "done" flag would land the flag in memory,
     lose the write, and never retry — the failure that has bitten this app four times. Instead
     this reads the ORIGINAL menu_category config, never deletes it, and writes no flag. A failed
     save costs nothing: the next boot refetches a server copy that never moved and derives the
     identical three lists.

     ⚠ listConfig() CREATES the key it is handed, so "already migrated?" must be read off
     data.list_config directly. One listConfig call here would make every account look done.

     ⚠ GATED ON BOTH _dataReady AND _loadDegraded, and it needs both.
     `_dataReady` only covers the CONFIG BLOB (DB.readData). `menu_items` is row-per-record and
     does not arrive until loadEventStores('core') runs AFTER that, and loadEvents returns an empty
     or truncated array on any error while leaving the app fully booted — it raises _loadDegraded
     instead. Gating on _dataReady alone therefore let one flaky login derive the split from an
     EMPTY menu list: no in-use sections, so every hand-added section became an unattributable
     "orphan" and landed on all three lists (the Dish form offering drink sections is the exact
     thing this step exists to remove), and a builtin hidden while items sit in it stayed hidden.
     Then it PERSISTED, and reloading restored the items but never the lists. _maybeAutoBackup and
     backupNow already guard on _loadDegraded for this same "this login did not see the whole
     account" reason.

     ⚠ "ALREADY MIGRATED" IS `_seeded`, NOT MERE PRESENCE. listConfig() creates any key it is
     handed, so a single stray read could mint an empty list that read as migrated forever. The
     marker lives INSIDE the derived object, so it cannot desync from it: if the save fails, the
     whole object is lost from the server and re-derived next boot. That is not the "done flag"
     [[test-the-retry]] warns about — that one is written somewhere the retry cannot see. */
  ensureMenuCatLists() {
    const TYPES = ['plate', 'cocktail', 'inventory'];
    // Register builtins whatever happens — listOptions returns [] without them.
    TYPES.forEach(t => { this._listBuiltins[this.menuCatListKey(t)] = this.menuCatBuiltins(t); });
    if (typeof DB !== 'undefined' && (!DB._dataReady || DB._loadDegraded)) return false;
    if (!this.data) return false;
    const lc = this.data.list_config || null;
    const missing = TYPES.filter(t => { const c = lc && lc[this.menuCatListKey(t)]; return !c || !c._seeded; });
    if (!missing.length) return false;

    const old = (lc && lc.menu_category) || {};
    const oldAdded  = (old.added  || []).map(String);
    const oldHidden = (old.hidden || []).map(String);
    // In-use sections, per type. ARCHIVED ITEMS COUNT: making a seasonal cocktail active again
    // must not land it in a section that no longer exists.
    const used = { plate: [], cocktail: [], inventory: [] };
    (this.data.menu_items || []).forEach(i => {
      const t = this.menuTypeOf(i);
      const c = (i && i.category != null) ? String(i.category).trim() : '';
      if (!c || !used[t]) return;
      if (!used[t].some(x => x.toLowerCase() === c.toLowerCase())) used[t].push(c);
    });
    // An added section NO item uses cannot be attributed to a type, and there is no undo on a
    // config blob. It goes on all three lists: an unused option costs nothing and can be hidden
    // per type, whereas a deleted one is gone. Reversible beats clever.
    const orphanAdded = oldAdded.filter(a =>
      !TYPES.some(t => used[t].some(x => x.toLowerCase() === a.toLowerCase())));

    this.data.list_config = this.data.list_config || {};
    missing.forEach(t => {
      const key = this.menuCatListKey(t);
      const builtins = this.menuCatBuiltins(t).map(b => b.toLowerCase());
      // A key can already exist WITHOUT _seeded if something read it before the migration ran.
      // MERGE onto it rather than replacing, so an option the operator added in that window is
      // not thrown away by the migration that follows.
      const prior = this.data.list_config[key] || {};
      const added = [];
      const push = v => {
        v = String(v == null ? '' : v).trim();
        const l = v.toLowerCase();
        if (this._menuCatReserved(v) || builtins.includes(l)) return;
        if (!added.some(x => x.toLowerCase() === l)) added.push(v);
      };
      (prior.added || []).forEach(push);
      used[t].forEach(push);
      orphanAdded.forEach(push);
      // Carry the OLD SHARED list's hides across, but only for this type's builtins, and never
      // hide a section this type's items sit in — that is what the seeding rule promises.
      // ⚠ `prior.hidden` is NOT subject to that in-use rule. Those are hides made on THIS type's
      // own list, so they are current intent, not an inherited guess: filtering them by in-use
      // silently un-hid a section the operator had just removed.
      let hidden = oldHidden
        .filter(h => builtins.includes(String(h).toLowerCase())
          && !used[t].some(x => x.toLowerCase() === String(h).toLowerCase()))
        .concat(prior.hidden || []);
      hidden = hidden.filter((h, n) => hidden.findIndex(o => String(o).toLowerCase() === String(h).toLowerCase()) === n);
      // ⚠ NEVER HAND BACK AN EMPTY LIST. A food-only bar that hid every drink section from the one
      // pre-B2 list would otherwise migrate to a No Prep list with nothing in it, and the first
      // No Prep item they ever add opens an empty dropdown — the exact outcome this step exists to
      // prevent. Test the ACTUAL result rather than counting hides: `hidden` can now hold customs
      // too, so a length comparison against the builtins is no longer the same question.
      const visible = this.menuCatBuiltins(t).concat(added)
        .filter(v => String(v).toLowerCase() !== 'other'
          && !hidden.some(h => String(h).toLowerCase() === String(v).toLowerCase()));
      if (!visible.length) hidden = [];
      this.data.list_config[key] = { added, hidden, methods: {}, _seeded: true };
    });
    this.saveKey('list_config');
    return true;
  },

  // The same seeding rule at a later moment: after an IMPORT brings in sections the list has never
  // seen. Without it, uploading a dish list with eight of the operator's own sections leaves the
  // Dish dropdown offering none of them. Idempotent, and silent when there is nothing new.
  absorbMenuCats(type) {
    this.ensureMenuCatLists();
    if (typeof DB !== 'undefined' && (!DB._dataReady || DB._loadDegraded)) return false;
    if (!this.data || !this.data.list_config || !this.data.list_config[this.menuCatListKey(type)]) return false;
    const key = this.menuCatListKey(type);
    const have = this.listOptions(key).map(o => o.toLowerCase());
    const c = this.listConfig(key);
    let changed = false;
    (this.data.menu_items || []).forEach(i => {
      if (this.menuTypeOf(i) !== type) return;
      const v = (i && i.category != null) ? String(i.category).trim() : '';
      const l = v.toLowerCase();
      if (!v || have.includes(l)) return;
      if (this._menuCatReserved(v)) return;
      // ⚠ Dedup against `added` DIRECTLY, not only against `have`: a reserved name can never
      // appear in `have` (listOptions drops it), so `have` alone re-added it on every single
      // import — one server write each, for an option that was never selectable.
      if (c.added.some(a => String(a).toLowerCase() === l)) return;
      // A section the operator deliberately HID must not come back just because an item uses it.
      if (c.hidden.some(h => String(h).toLowerCase() === l)) return;
      c.added.push(v); have.push(l); changed = true;
    });
    if (changed) this.saveKey('list_config');
    return changed;
  },

  /* ── THE MENU COMPARISON BASIS — mirrored in server/audit-compute.js ──────────────────────
     Menu Engineering ranks Stars/Plowhorses/Puzzles/Dogs against a COMPARISON GROUP, and the
     server audit must name the same Stars and the same Dogs or its "cut the Dogs" action item
     points at different items than the screen it links to. That has already happened once (the
     audit pooled the whole menu and compared a starter to a steak) and a separate client/server
     menu filter drifted before that, so BOTH functions below are duplicated verbatim on the
     server and held together by verify-menu-grouping-tieout.js. Change one, change both.

     THE RULE (Kyle, 2026-07-25): the comparison group is whatever genuinely competes on the same
     economics.
       DISHES     - an appetiser and an entree are not comparable (different price band, covers
                    and absolute margin), so they rank per CATEGORY.
       NO PREP    - a $6 bottled beer and a $60 bottle of wine are not comparable either, so
                    Beer / Wine / NA also rank per CATEGORY.
       COCKTAILS  - a frozen margarita and a house old fashioned ARE comparable. Frozen, Specials
                    and Happy Hour are how the MENU is laid out, not different economics, so every
                    cocktail ranks in ONE pool whatever the operator calls their sections. */
  menuTypeOf(item) {
    if (!item) return 'plate';
    // Explicit type is the source of truth (set on save). Everything below is the legacy
    // inference for items saved before the type field existed — including the whole demo seed,
    // which carries no type at all, so the fallbacks are load-bearing, not decoration.
    if (item.type === 'plate' || item.type === 'cocktail' || item.type === 'inventory') return item.type;
    if (item.linked_product_id) return 'inventory';
    if (item.recipe && item.recipe.mode === 'single') return 'cocktail';
    if (item.category === 'Cocktails') return 'cocktail';
    return 'plate';
  },

  menuGroupKey(item) {
    const t = this.menuTypeOf(item);
    if (t === 'cocktail') return 'cocktail';          // one pool; categories are presentational
    return t + '|' + ((item && item.category) || 'Uncategorized');
  },

  /* What a comparison group is CALLED on screen. Pass the other keys in play so it can qualify a
     name only when it genuinely collides: a dish "Specials" and a No Prep "Specials" are different
     sections on a real menu, and printing two identical headings reads as a bug. Unqualified in the
     ordinary case, so nobody sees "Entrees (Dishes)" for no reason. Display only — the KEY is what
     the math groups by, and it is never shown. */
  menuGroupLabel(key, allKeys) {
    // ⚠ 'Mixed Drinks', not 'Cocktails'. This labels the POOLED group — every drink whatever
    // section it sits in — so it has to be the TAB's name, not one of the sections inside it.
    // Labelling it "Cocktails" while a section was also called Cocktails printed the same word at
    // two levels, and read as though the group held only the drinks filed under that section.
    const NOUN = { plate: 'Dishes', cocktail: 'Mixed Drinks', inventory: 'No Prep' };
    const k = String(key == null ? '' : key);
    const bar = k.indexOf('|');
    if (bar < 0) return NOUN[k] || k;
    const type = k.slice(0, bar), cat = k.slice(bar + 1);
    // ⚠ THE BARE POOL KEY COUNTS AS A CLASH TOO. This used to require `b > -1` on the other key,
    // so the pooled 'cocktail' key was invisible to the test — and a No Prep section literally
    // named "Cocktails" (canned/RTD drinks, which a No Prep CSV import creates readily) rendered
    // a second heading also reading "Cocktails", sorted right next to the first. The pool keeps
    // its plain name and the section gets qualified, which is enough to tell them apart.
    const clash = (allKeys || []).some(o => {
      const s = String(o); if (s === k) return false;
      const b = s.indexOf('|');
      return (b > -1 ? s.slice(b + 1) : (NOUN[s] || s)) === cat;
    });
    return clash ? cat + ' (' + (NOUN[type] || type) + ')' : cat;
  },
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

  // 2nd-level tag on the catch-all Misc category. Misc lumps three kinds of thing
  // (things you sell, things you build drinks from, and pure operating supplies),
  // so this tag keeps each out of the wrong list: NA Beverage is sellable on the
  // menu; Drink Mixer + Garnish are cocktail-recipe ingredients; the three supply
  // types stay out of every menu/recipe picker. Food ingredients live in the Food
  // category, not here. This list is FIXED (not operator-editable) because the app
  // branches on its values — an unknown type would silently fall out of pickers.
  MISC_TYPES: ['NA Beverage', 'Drink Mixer', 'Garnish', 'Bar Supplies', 'Paper & To-Go', 'Cleaning & Supplies', 'Other'],
  MISC_SUPPLY_TYPES: ['Bar Supplies', 'Paper & To-Go', 'Cleaning & Supplies'],
  // Tagged as an NA beverage in Inventory (vs a mixer or a supply).
  miscSellable(p) { return !!p && p.category === 'Misc' && p.misc_type === 'NA Beverage'; },
  // Pure operating supply — not a recipe ingredient, not a menu item.
  miscIsSupply(p) { return !!p && p.category === 'Misc' && this.MISC_SUPPLY_TYPES.includes(p.misc_type); },

  // ── Resale items (bought and sold whole) ──────────────────────────────
  // The per-sale cost of an inventory product when it is linked to a menu item:
  // resale items use cost per serving, bottle beer divides the case, everything
  // else is the straight per-container cost. One source for menuItemCost and the
  // Menu Items linked-product forms so they never disagree.
  menuLinkCost(p, amount) {
    if (!p) return 0;
    // Food / Misc linked as a resale/side item: the menu item is a PORTION of the
    // product (a side of bacon = a few servings, a bag of chips = 1). Cost =
    // portion x the product's per-serving / per-ounce recipe cost; blank = 1.
    if (p.category === 'Food' || p.category === 'Misc') {
      const per = this.recipeBasis ? (this.recipeBasis(p).costPerUnit || 0) : (this.piecePrice(p) || 0);
      const portion = (amount != null && amount > 0) ? amount : 1;
      return per * portion;
    }
    // Bottle beer is sold whole — one bottle is one serving — so the per-bottle
    // cost (cost per case / case size) is the menu cost.
    if (p.category === 'Bottle Beer') {
      const bc = this.bottleCost(p);
      // No case size → no per-bottle cost. Report 0 (Incomplete), the SAME as a poured beverage with
      // no pour basis below — NOT the whole case price, which scored every bottle at ~24x. S162.
      return bc != null ? bc : 0;
    }
    // Poured beverages (Wine, Draft Beer, Liquor) are sold by the glass/pour, so
    // the menu cost is the cost of ONE pour, NEVER the whole bottle or keg. Honor
    // a per-item pour override, else the product's pour size.
    const unit = parseFloat(p.unit_cost) || 0;
    const container = parseFloat(p.container_size_oz) || 0;
    const pour = (amount != null && amount > 0) ? amount : (parseFloat(p.pour_size_oz) || 0);
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
    /* ⭐ `label` IS THE HEADING TO PRINT, and it exists so the three call sites cannot
       drift: ic-product-setup and BOTH ic-locations lists were each building
       `(g.key ? g.key : 'Uncategorized') + ' (n)'` by hand.
       ⛔ THE ONE RULE IN IT (Kyle, 2026-08-03): when the ungrouped set is the ONLY group,
       the heading is the CATEGORY, not "Uncategorized". A bar that deliberately never uses
       sub-categories was reading "Uncategorized" over every product it owns, forever — an
       unfinished-looking word for a finished state. With real groups alongside it the word
       is doing actual work (which ones are unsorted), so it stays.
       ⚠ Only when grouping by SUB-category. Grouped by category (`byCat`) an empty key
       means the product has no category at all, and there is no name to fall back to. */
    return keys.map(k => ({
      key: k,
      label: k || ((keys.length === 1 && !byCat && category) ? String(category) : 'Uncategorized'),
      items: groups[k].slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    }));
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
  // action (optional) = { label, onClick } renders a primary button in a footer
  // bar; clicking it closes the panel then runs onClick. Lets a help panel double
  // as a detail panel with an Open action (used by the Workflow map on mobile).
  showHelpModal(title, sections, action) {
    const sh = t => '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin:18px 0 8px;">' + t + '</div>';
    const pp = t => '<p style="margin:0 0 10px;">' + t + '</p>';
    let body = '';
    (sections || []).forEach(s => { if (s.h) body += sh(s.h); (s.p || []).forEach(t => { body += pp(t); }); });

    const m = document.createElement('div');
    m.className = 'help-overlay';
    m.style.cssText = 'position:fixed;inset:0;background:var(--overlay);z-index:9000;opacity:0;transition:opacity .18s ease;';
    const box = document.createElement('div');
    box.className = 'help-panel';
    box.style.cssText = 'position:fixed;top:0;right:0;height:100%;width:420px;max-width:92vw;background:var(--surface);border-left:1px solid var(--b-edge);box-shadow:-8px 0 24px var(--panel-shadow);z-index:9001;display:flex;flex-direction:column;transform:translateX(100%);transition:transform .22s ease;';
    box.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--b2);flex-shrink:0;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);">' + title + '</div>'
      + '<button class="btn btn-ghost btn-sm" data-help-close>Close</button></div>'
      + '<div style="padding:20px;font-size:13px;color:var(--t2);line-height:1.75;overflow-y:auto;flex:1;">' + body + '</div>'
      + (action ? '<div style="padding:14px 20px;border-top:1px solid var(--b2);flex-shrink:0;"><button class="btn btn-primary" data-help-action style="width:100%;">' + action.label + '</button></div>' : '');
    const close = () => {
      box.style.transform = 'translateX(100%)';
      m.style.opacity = '0';
      setTimeout(() => { m.remove(); box.remove(); }, 230);
    };
    m.addEventListener('click', close);
    box.querySelector('[data-help-close]').addEventListener('click', close);
    if (action) box.querySelector('[data-help-action]').addEventListener('click', () => { close(); action.onClick(); });
    document.body.appendChild(m);
    document.body.appendChild(box);
    requestAnimationFrame(() => { m.style.opacity = '1'; box.style.transform = 'translateX(0)'; });
  },

  // Shared footer for the section Help/FAQ pages: a subtle "still stuck?" line
  // that links to the bug report (opens a popup in place, keeping you on the
  // page) and Contact Support. Appended after the help body on every Help page
  // so support is reachable from wherever an operator is reading help.
  helpFooter() {
    return '<div style="border-top:1px solid var(--b2);margin-top:26px;padding-top:16px;font-size:12px;color:var(--t3);line-height:1.7;">'
      + 'Still stuck? '
      + '<span onclick="S.HubReportBug.openModal();" style="color:var(--gold);cursor:pointer;text-decoration:underline;">Report a bug</span>'
      + ' &middot; '
      + '<span onclick="S.HubSupport.openModal();" style="color:var(--gold);cursor:pointer;text-decoration:underline;">Contact support</span>'
      + '</div>';
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
    /* ⛔⛔⛔ `openScreen`, NOT `navigate`. Kyle on the live build, 2026-08-11: *"and the empty state
       buttons don't work.."* MEASURED from Week in Review before changing anything — `_activeModule`
       was `'profit'` and `#app` was HIDDEN, so `App.navigate('ic-vendors')` painted "Coming soon."
       into a hidden `#content-area` and the visible page did not move at all. Not a wrong landing, a
       SILENT one. `App.openScreen` from the same state opened the real Vendors screen.
       ⭐ `navigate` is MODULE-INTERNAL: it branches on `this._activeModule` and falls through for any
       id outside it. `openScreen` is the cross-module door — resolve the module, swap the shell if it
       differs OR the app is hidden, then call `navigate` — so it is a strict SUPERSET. A same-module
       step with the shell already up takes the byte-identical path it took before; the only steps
       whose behaviour changes are the ones that were dead ([[the-loop]] #146).
       ⚠ 40 files and 78 steps ride on this one line, and a routing change is INVISIBLE — it fails
       silently on a day-one screen the seeded demo cannot even render. So it is pinned before it is
       changed, by `verify-setupcard-cross-module.js`, which also sweeps every step in the tree and
       proves its destination resolves ([[proactive-ux-polish]] THE BOUNDARY). */
    container.onclick = ev => {
      const go = ev.target.closest('.setup-go');
      if (go && go.dataset.go) App.openScreen(go.dataset.go);
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

  // Small neutral cadence tag for an import drop, so an operator can tell at a
  // glance what belongs in the weekly sitting versus what runs on demand. The
  // word carries the meaning; no color coding (stays inside the color system).
  freqTag(text) {
    return '<span style="display:inline-block;font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--t3);border:1px solid var(--b-edge);border-radius:4px;padding:2px 7px;vertical-align:middle;white-space:nowrap;">' + esc(text || '') + '</span>';
  },

  // Collapsed "+ Note" field. Replaces an always-open notes textarea on a form
  // with a small "+ Note" link that reveals a standard 2-row note box on click
  // (so an empty notes box stops eating vertical space on every form). Auto-opens
  // and shows a gold "Note" label when a note already exists, so an edit never
  // hides a saved note. The toggle is handled by one delegated listener (below
  // the TT click handler) so no per-form wiring is needed; collection reads the
  // textarea by its id exactly as before. Matches the Take Inventory pattern.
  noteField(opts) {
    opts = opts || {};
    const id = opts.id;
    const val = opts.value != null ? String(opts.value) : '';
    const has = !!val.trim();
    const ph = opts.placeholder || 'Optional note';
    const mt = opts.mt != null ? opts.mt : 14;
    return '<div class="note-field" style="margin-top:' + mt + 'px;">'
      + '<button type="button" class="note-toggle" data-target="' + esc(id) + '" style="background:none;border:none;padding:0;cursor:pointer;font-size:11px;white-space:nowrap;color:' + (has ? 'var(--t1)' : 'var(--t3)') + ';">' + (has ? 'Note' : '+ Add Note') + '</button>'
      + '<div class="note-box" id="' + esc(id) + '-box" style="margin-top:8px;' + (has ? '' : 'display:none;') + '">'
      + '<textarea id="' + esc(id) + '" class="notes-ta" rows="2" placeholder="' + esc(ph) + '">' + esc(val) + '</textarea>'
      + '</div></div>';
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
      /* ⚠⚠ A RESTORED NOTE WAS PUT BACK INVISIBLY, UNDER A LABEL SAYING THERE WAS NONE. noteField
         bakes `display:none` + "+ Add Note" into its markup when the value is empty AT RENDER TIME,
         which is always true for a fresh add form — and this only ever set el.value, so the text
         came back into a collapsed box with the toggle still reading "+ Add Note". Reached by any
         re-render that restores a draft: a filter chip, a delete, an import, leaving and returning.
         The operator sees their note gone, retypes it or gives up, and it is submitted anyway from
         the hidden textarea. Fixed here rather than at one screen: 14 screens use noteField and
         restoreDraft together. */
      const nf = el.closest && el.closest('.note-field');
      if (nf && String(el.value || '').trim()) {
        const box = nf.querySelector('.note-box'); if (box) box.style.display = 'block';
        const tg = nf.querySelector('.note-toggle');
        if (tg) { tg.textContent = 'Note'; tg.style.color = 'var(--t1)'; }
      }
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
    // The caret TRAILS the title (never leads it) so the title text always starts
    // at the same left edge whether or not the card collapses, keeping titles
    // aligned page to page. Any top-card action (e.g. Worksheet) owns the far-right
    // slot, so the caret and that action are never adjacent.
    return '<div class="card-title card-collapse-head" data-collapse-key="' + esc(key) + '" '
      + 'style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span style="display:inline-flex;align-items:center;gap:8px;">' + esc(titleText)
      +   '<span class="card-chevron" aria-hidden="true">&#9662;</span></span>'
      + (rightHtml ? '<div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">' + rightHtml + '</div>' : '')
      + '</div>';
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
  // chrome) so one helper serves every Export button.
  // ⚠ jsPDF + autoTable are the app's ONLY runtime-loaded library. The XLSX lib is NOT loaded this
  // way — it is a single blocking tag in index.html, and the lazy-load that used to sit in
  // csv-mapper was removed (M8) precisely because it fetched a different version. This comment used
  // to cite that importer as the precedent for loading a library at runtime; M8 made that false, and
  // left as-is it would have read to the next person as house permission to reintroduce it.
  /* ⚠⚠ AND THE CACHE IS CLEARED ON FAILURE, OR THE ADVICE IS UNACHIEVABLE. `_pdfLibPromise` is the
     memo, and a REJECTED promise memoises just as well as a resolved one — so one dropped connection
     poisoned it for the rest of the session. Every one of the ~20 export doors then said "Could not
     load the PDF engine. Check your connection and try again", and trying again failed instantly with
     no network request even after the wifi came back, until a full page reload. Same class M8 was
     closed for: advice that cannot work. The rejection is re-thrown so the caller's own message still
     fires; only the memo is dropped. */
  /* ⚠⚠ THE READINESS PROBE TESTS THE PLUGIN, NOT JUST THE GLOBAL — and it has to, because clearing
     the memo above made a PARTIAL load reachable for the first time. Two scripts load in sequence.
     If jsPDF resolves and autoTable does NOT (an ad blocker on the second request, a 404, the
     connection dropping between them), the jsPDF UMD has already executed and `window.jspdf.jsPDF`
     is set. A probe that stopped there would answer "ready" on the retry, every caller's
     `try { await _ensurePDFLib() } catch` would pass, and `doc.autoTable(...)` would then throw
     OUTSIDE any catch: a silently dead Export button on ~20 doors instead of the honest message.
     That is strictly worse than the cached-rejection bug, so the probe asks for the thing the code
     actually calls. Erring strict is safe here: a false "not ready" costs one redundant fetch, a
     false "ready" costs the export. */
  _pdfLibReady() {
    const j = window.jspdf && window.jspdf.jsPDF;
    return !!(j && j.API && j.API.autoTable);
  },
  _ensurePDFLib() {
    if (this._pdfLibPromise) return this._pdfLibPromise;
    if (this._pdfLibReady()) { this._pdfLibPromise = Promise.resolve(); return this._pdfLibPromise; }
    /* ⚠⚠ HASH-PINNED (M7). These two are fetched at runtime, so they get the same protection the
       tags in index.html do: `integrity` refuses bytes that changed at a URL that did not.
       ⚠ `crossOrigin` IS NOT OPTIONAL — a cross-origin script carrying `integrity` and no
       `crossorigin` is blocked outright and the hash is never checked. cdnjs was measured sending
       `Access-Control-Allow-Origin: *`.
       ⚠ The hash is a REQUIRED argument, not an optional one. Written as `sri && (s.integrity = sri)`
       a call site that forgot it would load the script unprotected and silently — the shape
       [[the-loop]] #40 is about. A missing hash throws here instead, and `verify-cdn-integrity.js`
       asserts BOTH call sites pass one.
       ⭐ A failed hash rejects this promise, which lands in `_ensurePDFLib`'s own catch: the memo is
       dropped and the operator gets the real "PDF library did not load" message. So the worst case
       here is Export PDF refusing out loud, never a silent wrong number. */
    const load = (src, sri) => new Promise((res, rej) => {
      if (!sri) { rej(new Error('load() needs an integrity hash for ' + src)); return; }
      const s = document.createElement('script');
      s.src = src; s.integrity = sri; s.crossOrigin = 'anonymous';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    // Only fetch what is actually missing: after a partial load the retry needs the plugin alone,
    // not another 300KB of a library already sitting in the page.
    const havejsPDF = !!(window.jspdf && window.jspdf.jsPDF);
    /* ⚠⚠ AND THE OUTCOME IS CHECKED, NOT JUST THE INPUT. `onload` means "the browser fetched
       something and ran it", NOT "the library registered". A captive portal or a corporate proxy that
       answers the CDN with a 200 HTML interstitial fires onload for BOTH scripts, so the chain
       resolves, the memo becomes a permanently RESOLVED promise, every caller's `try/catch` passes,
       and `const { jsPDF } = window.jspdf;` then throws OUTSIDE all of them — the same silently dead
       Export button the strict probe was added to prevent, arriving through the other door. The
       probe only ever gated the SKIP; it has to gate the result too. Rejecting here reuses the catch
       below, so the memo is dropped and the operator gets the real message. */
    /* The two hashes are cdnjs's OWN published sha512 for these exact files, re-derived from the
       downloaded bytes and confirmed to agree — an independent second source, not a value copied
       off one measurement ([[the-loop]] #36). Re-measure both if either version is bumped. */
    this._pdfLibPromise = (havejsPDF ? Promise.resolve() : load('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'sha512-qZvrmS2ekKPF2mSznTQsxqPgnpkI4DNTlrdUmTzrDgektczlKNRRhy5X5AAOnx5S09ydFYWWNSfcEqDTTHgtNA=='))
      .then(() => load('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js', 'sha512-2/YdOMV+YNpanLCF5MdQwaoFRVbTmrJ4u4EpqS/USXAQNUDgI5uwYi6J98WVtJKcfe1AbgerygzDFToxAlOGEQ=='))
      .then(() => { if (!this._pdfLibReady()) throw new Error('PDF library loaded but did not register'); })
      .catch(err => { this._pdfLibPromise = null; throw err; });
    return this._pdfLibPromise;
  },

  /* ⚠ Ctrl vs Cmd (S310). Every one of the five spreadsheet doors offers a hard refresh as its only
     recovery, and "Ctrl+Shift+R" is literally unachievable on a Mac — so for a Mac operator the
     single piece of advice on screen could not be followed. `userAgentData.platform` first because
     `navigator.platform` is deprecated; both are absent under node, which falls to the Windows form. */
  hardRefreshKeys() {
    const p = (typeof navigator !== 'undefined'
      && ((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform)) || '';
    return /mac|iphone|ipad|ipod/i.test(p) ? 'Cmd+Shift+R' : 'Ctrl+Shift+R';
  },
  /* THE ONE SENTENCE FOR "THE SPREADSHEET LIBRARY IS NOT HERE" (S292). Five doors told five
     different stories about one fault — "The Excel reader", "The Excel builder", "The file builder",
     "Spreadsheet engine" — so an operator who hit it on Books and then on an import had no way to
     know it was the same problem, and a support email saying "the file builder is broken" could not
     be matched to a screen. One name, one recovery, and each door passes its own alternative.
     ⚠ IT ALSO LOGS, because this is BAR COP'S fault and not the operator's: a pulled tag, a dead
     CDN, a corporate proxy. Before this, `cdn.sheetjs.com` being blocked for one chain took out
     every Excel import plus Books, Year-End, QBO and payroll for that whole account, and the error
     log showed NOTHING — it surfaced only if someone wrote in. The same file already logs a failed
     import; this is the same class of fact. */
  excelMissing(where, alt) {
    /* ⚠ THE DOOR GOES IN THE MESSAGE, NOT ONLY THE DETAIL. `logClientError` dedupes on
       `kind + '|' + message`, so a constant message meant only the FIRST of the five doors ever
       reached `client_errors` — and telling them apart is the entire reason this logs at all. A
       support ticket reading "Books is broken" would never have shown that the importers died too,
       which is the blind spot this was added to close. `screen` is its own column, so it gets the
       door too rather than being left empty. */
    try {
      if (typeof DB !== 'undefined' && DB.logClientError) {
        DB.logClientError('xlsx_missing', 'SheetJS did not load at ' + String(where || 'unknown'), '', String(where || ''));
      }
    } catch (e) { /* reporting must never break the refusal */ }
    return 'The spreadsheet engine did not load. Hard refresh the page (' + this.hardRefreshKeys()
      + ') and try again' + (alt ? ', or ' + alt : '') + '.';
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
  /* Every string in every one of the 40 PDF exports passes through here, because exportPDF
     walks the rendered DOM and sanitises each node's text. jsPDF's built-in helvetica can only
     draw Latin-1, so anything outside it has to be dealt with somehow.

     THE LAST STEP USED TO BE A BLANKET DELETE of everything outside Latin-1. Measured on real
     staff names: "Lukasz Nowak" (L-with-stroke) printed as "ukasz Nowak", "Dorde" as "ore",
     "Sahin Yilmaz" as "ahin Ylmaz", "Nguyen Van An" as "Nguyn Vn An", and a name written in
     Chinese or Cyrillic came out EMPTY. Pay Period, Labor Reports and the Server Check
     scorecard all render staff names and all three export through here, so the worst case was
     a payroll-adjacent worksheet handed to a bookkeeper with hours and dollars on a row that
     carried no name at all. A rule about which characters count is a rule about whose name
     counts, and deleting silently is the one option that looks complete and is not.

     KEEP THE LETTER WHEREVER A LETTER CAN BE KEPT. A Latin letter carrying a diacritic that
     Latin-1 lacks decomposes (NFD) to a base letter Latin-1 has; the handful of Latin letters
     that do NOT decompose get the explicit map below. Latin-1 itself is deliberately left
     alone: Jose keeps its accent, because that already renders.

     The map stays INSIDE this function. As a sibling property it would be invisible to every
     method slicer in the harness suite, and verify-pdf-table-layout.js lifts this function by
     name ([[the-loop]] #16).
     KNOWN LIMIT: a name in a NON-LATIN script (Chinese, Cyrillic, Arabic, Hebrew, Greek, Thai)
     has no Latin letters to fall back to, so it is still dropped. Transliterating it would be
     inventing a name; embedding a Unicode font is the real answer and that is a bundle-size
     call. Pinned as a STATED limitation in verify-pdf-name-safe.js, not an oversight. */
  _pdfSafe(s) {
    const XLIT = { 'Ł': 'L', 'ł': 'l', 'Đ': 'D', 'đ': 'd', 'Ð': 'D',
      'ı': 'i', 'ẞ': 'SS', 'Ħ': 'H', 'ħ': 'h', 'Ŋ': 'N', 'ŋ': 'n',
      'Ŧ': 'T', 'ŧ': 't', 'Ə': 'E', 'ə': 'e', 'Œ': 'OE', 'œ': 'oe',
      'ƒ': 'f', 'Ɖ': 'D', 'Ǥ': 'G', 'ǥ': 'g', 'Ɨ': 'I', 'ɨ': 'i' };
    return String(s == null ? '' : s)
      .replace(/→/g, '->').replace(/←/g, '<-')
      .replace(/↑/g, 'up').replace(/↓/g, 'down')
      .replace(/▲/g, '+').replace(/▼/g, '-')
      .replace(/[–—]/g, '-')
      .replace(/[‘’′]/g, "'").replace(/[“”]/g, '"')
      .replace(/•/g, '-').replace(/ /g, ' ').replace(/…/g, '...')
      .replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/×/g, 'x')
      .replace(/[^\x00-\xFF]/gu, ch => {
        if (XLIT[ch]) return XLIT[ch];
        const base = ch.normalize('NFD').replace(/[\u0300-\u036F]/g, '');   // drop the combining marks, keep the base letter
        return /^[\x00-\xFF]*$/.test(base) ? base : '';
      });
  },

  // Clean text of a node for the PDF: strip buttons, tooltips, and no-print chrome.
  _pdfNodeText(node) {
    if (!node) return '';
    const clone = node.cloneNode(true);
    clone.querySelectorAll('button, .no-print, .tt, .tt-badge, [data-tt]').forEach(el => el.remove());
    // ⚠ STACKED BLOCK CHILDREN MUST NOT RUN TOGETHER. `textContent` concatenates every
    // descendant with no separator, so a cell holding
    //     <div class="val">Avocado Toast</div><div>from recipe</div>
    // exported as "Avocado Toastfrom recipe" — in EVERY PDF the app produces, not just
    // the one it was reported on. Worse, the run-on string then drives the column widths
    // (see _pdfColWidths), so a cell carrying a name plus an explanation claimed half the
    // page and squeezed the numeric columns until they wrapped mid-figure.
    // A space before each block-level child, then the existing whitespace collapse.
    clone.querySelectorAll('div, p, li, br, tr, td, th, h1, h2, h3, h4, h5, h6, option, optgroup, label, dt, dd, section, article').forEach(el => {
      if (el.parentNode) el.parentNode.insertBefore(clone.ownerDocument.createTextNode(' '), el);
    });
    return this._pdfSafe((clone.textContent || '').replace(/\s+/g, ' ').trim());
  },

  _pdfTableData(table) {
    const headRow = table.querySelector('thead tr');
    const head = headRow ? [Array.from(headRow.children).map(th => this._pdfNodeText(th))] : [];
    let body = Array.from(table.querySelectorAll('tbody tr'))
      .filter(tr => !tr.closest('.no-print'))
      .map(tr => Array.from(tr.children).map(td => this._pdfNodeText(td)));
    if (!body.length && !head.length) return null;
    // Drop EVERY column that is empty across the header and every row — action columns
    // at the end, and equally the row-select checkbox column at the START, which used to
    // survive (the loop stopped at the first non-empty column) and exported as a
    // permanent empty stripe down the left of every table in every report.
    // Walking backwards keeps the indices valid as columns are spliced out.
    const cols = Math.max(head[0] ? head[0].length : 0, ...body.map(r => r.length), 0);
    for (let c = cols - 1; c >= 0; c--) {
      const headEmpty = !head[0] || !(head[0][c] || '').trim();
      const bodyEmpty = body.every(r => !(r[c] || '').trim());
      if (headEmpty && bodyEmpty) {
        if (head[0]) head[0].splice(c, 1);
        body.forEach(r => r.splice(c, 1));
      }
    }
    const outCols = (head[0] ? head[0].length : (body[0] ? body[0].length : 0));
    // ⚠ NULL WHEN NOTHING SURVIVES (S130). An all-blank table (blank headers + empty body) drops
    // every column and reaches 0 columns. Pushed as a block it went to autoTable with head:[[]],
    // body:[] — which can leave lastAutoTable unset, so the next block's `y = lastAutoTable.finalY`
    // reads the PREVIOUS table's position and paints over it. There is nothing to render, so skip
    // it: the caller's `if (t)` already handles null. A header-only table with REAL headers keeps
    // its columns (headEmpty is false), so this only drops the genuinely-empty case.
    if (!outCols) return null;
    return { head, body, cols: outCols };
  },

  // Walk a report container into ordered PDF blocks: headings, key/value tiles,
  // sub-headers, and tables — in document order, skipping no-print chrome.
  _collectPDFBlocks(root) {
    const blocks = [];
    root.querySelectorAll('.card-title, .sh, .pdf-para, .pdf-fine, .calc-item, table.tbl, table.row-list, table.pnl-list, .empty-title, .empty-sub, .alert-text').forEach(node => {
      if (node.closest('.no-print')) return;
      if (node.matches('table.tbl, table.row-list, table.pnl-list')) {
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
      } else if (node.matches('.pdf-fine')) {
        const text = this._pdfNodeText(node);
        if (text) blocks.push({ type: 'fine', text });
      } else {
        const text = this._pdfNodeText(node);
        if (text) blocks.push({ type: 'note', text });
      }
    });
    return blocks;
  },

  // Shared column widths for every table of the same shape in one export, so the
  // sections line up down the page instead of each sizing itself.
  // ⚠ THE CAP IS THE POINT. Widths are proportional to the LONGEST cell in a column, and
  // a single explanatory cell — a dish name plus "INGREDIENT DELETED" plus "Not costed
  // until you replace or remove it. Bar Cop will not price it cheaper in the meantime."
  // — runs to about 95 characters. Uncapped, that column took over half the page and
  // "$12.00" and "Sold/wk" wrapped mid-figure. Capping the character count a column may
  // CLAIM leaves the long text to wrap (which is exactly what overflow:'linebreak' is
  // for) without starving the columns beside it.
  _pdfColWidths(tbls, n, availW) {
    const clen = c => { const s = (c && typeof c === 'object' && c.content != null) ? c.content : c; return String(s == null ? '' : s).length; };
    const maxLen = new Array(n).fill(1);
    (tbls || []).forEach(b => {
      (b.head || []).forEach(hr => (hr || []).forEach((c, i) => { if (i < n) maxLen[i] = Math.max(maxLen[i], clen(c)); }));
      (b.body || []).forEach(row => (row || []).forEach((c, i) => { if (i < n) maxLen[i] = Math.max(maxLen[i], clen(c)); }));
    });
    const CAP = 28;
    const capped = maxLen.map(v => Math.min(v, CAP));
    const total = capped.reduce((s, v) => s + v, 0) || 1;
    const styles = {};
    capped.forEach((v, i) => { styles[i] = { cellWidth: (v / total) * availW }; });
    return styles;
  },

  /* "Last 4 Weeks · Jun 1, 2026 to Jun 28, 2026" — the range a list export covers, built
     from the screen's OWN chip config so the PDF names the chip the operator actually
     picked. `chips` is the screen's RANGE_CHIPS ([{v,label}]). An all-time selection has no
     dates to print, so it is just the chip name. */
  chipRangeLabel(chips, preset, from, to) {
    const hit = (chips || []).find(c => (c.v || '') === (preset || ''));
    const name = hit ? hit.label : '';
    if (!from && !to) return name;
    const fmt = d => {
      if (!d) return '';
      const dt = new Date(String(d).slice(0, 10) + 'T00:00:00');
      return isNaN(dt.getTime()) ? String(d)
        : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };
    const span = from && to ? fmt(from) + ' to ' + fmt(to) : (from ? 'from ' + fmt(from) : 'through ' + fmt(to));
    return name ? name + ' · ' + span : span;
  },

  /* ⚠ A REVERSED CUSTOM RANGE IS NOT AN EMPTY ONE (SH10). From after To matches nothing, so every
     list falls through to its DAY-ONE empty state — "No cash activity in this range. Log a drop,
     deposit, or safe count above to get started." — which sends the operator off to create data
     when the only thing wrong is that two dates are the wrong way round. The empty-state copy is
     right for an empty range and wrong for an impossible one, and nothing on screen told them
     apart.
     Returns '' whenever the range is usable — including a half-typed one, because they are still
     typing, and including from === to, which is a legitimate single day — so a screen can drop it
     in unconditionally next to its date inputs. */
  rangeWarning(from, to) {
    const f = String(from || '').slice(0, 10), t = String(to || '').slice(0, 10);
    if (!f || !t || f <= t) return '';
    return '<div style="width:100%;font-size:11px;color:var(--amber);margin-top:2px;">'
      + 'From is after To, so no date can fall inside this range. Swap the two dates.</div>';
  },

  /* Export a LIST screen as the WHOLE CHIP SELECTION, not just the page on screen.

     Every log renders `filtered.slice(0, App.listLimit(mod, kind))` — LIST_PAGE (50) rows at
     a time behind a "Show older" button — so handing the rendered container to exportPDF
     capped the PDF at the first page with nothing in the document saying so. Pick the "All"
     chip on a 300-entry log and you handed your accountant 50 rows that looked complete.
     That is the export equivalent of a number that is simply wrong. (The stray "Show older"
     button printed into the PDF too: showOlderBar is not marked no-print.)

     The opposite failure was live as well: four screens built their own offscreen table from
     EVERY record ever and ignored the chips completely. One helper now, so they cannot drift
     into three behaviours again.

     ⚠ ONLY LIFTS WHEN THE PAGE IS ACTUALLY SHORT. The tell is the screen's own "Show older"
     button (`data-older-mode="reveal"`, rendered only when filtered.length > limit). No
     button means the page already holds the whole selection, so nothing re-renders and a
     half-typed entry or an in-progress edit is never disturbed. The re-render is reserved
     for exactly the case where NOT doing it produces a truncated document. (Screens with an
     entry form also carry App.captureDraft/restoreDraft, which already survives the
     re-render a filter click causes — this is the same re-render.)

     lists:    [[mod, kind], ...] — the same pairs the screen passes to App.listLimit.
     reRender: the screen's own re-render, the one already wired to "Show older".
     rootId:   for a root looked up by id — it must be re-resolved AFTER the re-render,
               because the old node is detached by then. Pass `root` for a stable element
               (this.container survives, only its innerHTML is replaced).
     range:    App.chipRangeLabel(...), printed in the PDF header. */
  async exportListPDF(opts) {
    opts = opts || {};
    const baseRoot = opts.root || (opts.rootId ? document.getElementById(opts.rootId) : null);
    const truncated = !!(baseRoot && baseRoot.querySelector('[data-show-older][data-older-mode="reveal"]'));
    const saved = (truncated ? (opts.lists || []) : []).map(p => {
      const key = this._listKey(p[0], p[1]);
      const st = this._listState[key] || {};
      const had = Object.prototype.hasOwnProperty.call(st, 'limit');
      const prev = st.limit;
      st.limit = Infinity;
      this._listState[key] = st;
      return { key: key, had: had, prev: prev };
    });
    // Restore must run even if the PDF engine fails to load or export throws, or the screen
    // is left showing an unbounded list forever.
    const restore = () => saved.forEach(s => {
      const st = this._listState[s.key] || {};
      if (s.had) st.limit = s.prev; else delete st.limit;
      this._listState[s.key] = st;
    });
    const o = {};
    Object.keys(opts).forEach(k => { if (k !== 'lists' && k !== 'reRender' && k !== 'rootId') o[k] = opts[k]; });
    try {
      if (saved.length && opts.reRender) opts.reRender();
      if (opts.rootId) o.root = document.getElementById(opts.rootId) || o.root || null;
      else if (opts.root) o.root = opts.root;
      await this.exportPDF(o);
    } finally {
      if (saved.length) {
        restore();
        if (opts.reRender) opts.reRender();
      }
    }
  },

  async exportPDF(opts) {
    opts = opts || {};
    const title = opts.title || 'Report';
    // Prefer an explicit root. Otherwise pick the LAST .screen that actually holds
    // report content — the visible one — never the first/empty .screen in the DOM.
    let root = opts.root;
    if (!root) {
      const screens = Array.from(document.querySelectorAll('.screen'));
      root = screens.reverse().find(s => s.querySelector('table.tbl, table.row-list, table.pnl-list, .rpt-panel, .calc, .tbl-wrap'))
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
    doc.text(this._pdfSafe(opts.brand || venue || 'Bar Cop'), margin, y);   // the operator's business is the prominent name; Bar Cop stays in the footer only
    doc.setFontSize(12);
    doc.text(this._pdfSafe(subtitle ? title + ' - ' + subtitle : title), pageW - margin, y, { align: 'right' });
    y += 16;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110, 110, 110);
    const dstr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    doc.text(this._pdfSafe(dstr), margin, y);
    // The range the export actually covers, opposite the generated date. Without it an
    // "Adjustment Log" could be one week or one year and the saved file cannot tell you
    // which — the same document, twice, meaning different things. Printed on the existing
    // date line rather than a new row, so no other export's layout moves.
    if (opts.range) doc.text(this._pdfSafe(String(opts.range)), pageW - margin, y, { align: 'right' });
    y += 8;
    doc.setDrawColor(205, 205, 205); doc.line(margin, y, pageW - margin, y);
    y += 16;

    /* ── THE FOOTER IS MEASURED BEFORE CONTENT IS LAID OUT, BECAUSE IT RESERVES SPACE ──
       It used to be drawn as ONE unwrapped doc.text at pageH-22, with "Page N of M" right
       aligned on the same baseline. Anything past a single line ran off the page edge and
       collided with the page number, so a long disclaimer printed mostly invisible. Now it
       WRAPS, and the space it needs is reserved from the content area.
       ⚠ THE RESERVE ONLY EVER GROWS (Math.max against today's values). Tightening it would
       re-paginate every one of the ~40 existing PDFs, all of which pass a one-line footer —
       a layout change nobody asked for, dressed as a bug fix. With a 1-line footer both
       numbers below are byte-for-byte what they were before this change. */
    const footTxtRaw = (opts.footer != null) ? opts.footer
      : 'Generated by Bar Cop. Figures are derived from your inputs; verify before relying on them.';
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
    const FOOT_LEAD = 8.5;                       // line height at 7pt
    const PAGENUM_W = 70;                        // room kept for "Page N of M" on every line
    const footLines = footTxtRaw
      ? doc.splitTextToSize(this._pdfSafe(footTxtRaw), pageW - 2 * margin - PAGENUM_W)
      : [];
    const footBlockH = footLines.length ? (footLines.length - 1) * FOOT_LEAD : 0;
    const bottomKeep = 28 + footBlockH;

    const ensure = h => { if (y > pageH - Math.max(60, bottomKeep) - h) { doc.addPage(); y = margin; } };

    // Give every table that shares a column count the SAME column widths, so the
    // sections line up down the whole export (autoTable otherwise sizes each table
    // on its own content and they drift). Widths track the widest cell per column.
    const availW = pageW - 2 * margin;
    const _wGroups = {};
    blocks.forEach(b => { if (b.type === 'table' && b.cols) (_wGroups[b.cols] = _wGroups[b.cols] || []).push(b); });
    const _sharedCols = {};
    Object.keys(_wGroups).forEach(cc => {
      const n = parseInt(cc), tbls = _wGroups[cc];
      // Cap EVERY group's column widths, not just 2+-table groups (S126): a single-table report (one
      // menu section, or a CSV import that left everything Uncategorized) otherwise fell to autoTable's
      // own 'auto' sizing with no 28-char cap. Aligning across tables is the bonus when there are 2+;
      // the cap is the point and applies to one table just as well.
      _sharedCols[n] = this._pdfColWidths(tbls, n, availW);
    });

    blocks.forEach(b => {
      if (b.type === 'heading') {
        // Lead-in space ABOVE the title (separates it from the section above) and
        // a small gap BELOW so the title sits with the table it labels, not the one
        // before it. Text draws at its baseline, so most of the visible space lands
        // below; shifting it above fixes the "title hugs the wrong section" gap.
        y += 12; ensure(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(20, 20, 20);
        doc.text(b.text, margin, y); y += 16;
      } else if (b.type === 'subheading') {
        y += 10; ensure(16); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(130, 130, 130);
        doc.text(b.text.toUpperCase(), margin, y); y += 13;
      } else if (b.type === 'kv' || b.type === 'note') {
        doc.setFont('helvetica', b.type === 'kv' ? 'bold' : 'normal'); doc.setFontSize(10); doc.setTextColor(45, 45, 45);
        // Wrap like para/fine below: a long note (e.g. an empty-state .empty-sub routed here) used to
        // draw one unwrapped line and run ~600pt off the page. Split on newlines, then to the width.
        this._pdfSafe(b.text).split('\n').forEach(seg => {
          doc.splitTextToSize(seg || ' ', pageW - 2 * margin).forEach(ln => { ensure(14); doc.text(ln, margin, y); y += 14; });
        });
      } else if (b.type === 'para') {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(55, 55, 55);
        this._pdfSafe(b.text).split('\n').forEach(seg => {
          doc.splitTextToSize(seg || ' ', pageW - 2 * margin).forEach(ln => { ensure(13); doc.text(ln, margin, y); y += 12.5; });
        });
        y += 6;
      } else if (b.type === 'fine') {
        y += 4; doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(120, 120, 120);
        this._pdfSafe(b.text).split('\n').forEach(seg => {
          doc.splitTextToSize(seg || ' ', pageW - 2 * margin).forEach(ln => { ensure(11); doc.text(ln, margin, y); y += 10; });
        });
        doc.setFont('helvetica', 'normal'); y += 4;
      } else if (b.type === 'table') {
        const cs = _sharedCols[b.cols];
        doc.autoTable({
          startY: y + 2,
          head: b.head, body: b.body,
          // bottom clears the wrapped footer. autoTable defaults bottom to 40 when unset, and
          // a multi-line footer reaches higher than that; Math.max keeps 40 for every existing
          // one-line-footer export so their page breaks do not move.
          margin: { left: margin, right: margin, bottom: Math.max(40, bottomKeep) },
          styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak', lineColor: [225, 225, 225], lineWidth: 0.5 },
          headStyles: { fillColor: [28, 28, 28], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [246, 246, 246] },
          columnStyles: cs || {},
          tableWidth: cs ? availW : 'auto',
          theme: 'grid'
        });
        y = doc.lastAutoTable.finalY + 16;
      }
    });

    const pages = doc.internal.getNumberOfPages();
    /* opts.footer: pass '' to drop the standard Bar Cop line (a customer-facing agreement
       should not carry it); a string replaces it; omitted = the default. The wrap and the
       space reserve were computed above, before content was laid out.
       ⚠ THE LINES STACK UPWARD so the LAST one shares the page-number baseline. That keeps a
       one-line footer in exactly the position it has always been in, and lets a longer one
       grow into the reserved space rather than off the edge of the page. */
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(150, 150, 150);
      footLines.forEach((ln, k) => {
        doc.text(ln, margin, pageH - 22 - (footLines.length - 1 - k) * FOOT_LEAD);
      });
      doc.text('Page ' + i + ' of ' + pages, pageW - margin, pageH - 22, { align: 'right' });
    }

    /* The period the document COVERS beats the day it was printed, which is why `range` wins
       here. Two exports of the same view then produce the same file, exactly as the workbooks
       already behave (`Month-End Books Worksheet - July 2026.xlsx` is that name every time). */
    await this._savePDF(doc, this.pdfFileName(
      opts.fileTag || (subtitle ? title + ' - ' + subtitle : title), opts.range));
  },

  /* ONE FILENAME CONVENTION FOR EVERY DOCUMENT BAR COP PRODUCES: `<Bar> - <What> - <Period>.pdf`.

     The workbooks always did this right -- "Anchor Bar - Annual Review Worksheet - 2026.xlsx"
     names the bar, the document and the period in plain language. The PDFs did not: they saved
     as "BarCop_WeeklyHistory_20260729.pdf" with NO BAR NAME AT ALL, so an accountant or a lender
     holding files for several bars could not tell whose was whose. Sixteen call sites had drifted
     onto the BarCop_ shape while four had already found the venue shape on their own, which is
     the usual tell that a convention was never written down anywhere ([[the-loop]] step 0.6:
     where there are three of the same decision, extract ONE helper). Kyle, 2026-07-29, asked for
     the workbook convention app-wide.

     `_savePDF` runs fileSafe and guarantees the .pdf extension, so neither is repeated here.
     A missing period falls back to today, never to an empty segment. */
  pdfFileName(docName, period) {
    const venue = ((this.data && this.data.settings && this.data.settings.bar_name) || 'Bar Cop');
    const what = String(docName == null ? '' : docName).trim() || 'Report';
    const when = String(period == null ? '' : period).trim() || this.todayLocal();
    return venue.trim() + ' - ' + what + ' - ' + when + '.pdf';
  },

  async _savePDF(doc, filename) {
    filename = App.fileSafe(filename);
    // Guarantee the extension HERE, once, rather than trusting 17 call sites to
    // remember it. Three did not (the Cash Audit, the Week in Review and the Recovery
    // Playbook), and the download fallback below writes `a.download = filename`
    // verbatim, so any browser without showSaveFilePicker handed the operator a file
    // with no extension that Windows will not open on a double-click. Appended only
    // when missing, so the 14 callers that already pass "....pdf" cannot end up with
    // ".pdf.pdf". fileSafe keeps dots, so this survives it.
    if (!/\.pdf$/i.test(filename)) filename += '.pdf';
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
        doc.text(App._pdfSafe(o.brand || venue || 'Bar Cop'), margin, this.y);
        doc.setFontSize(12);
        doc.text(App._pdfSafe(o.right || title), this.pageW - margin, this.y, { align: 'right' });
        this.y += 16;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110, 110, 110);
        const meta = o.meta != null ? o.meta : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        doc.text(App._pdfSafe(meta), margin, this.y);
        this.y += 8;
        doc.setDrawColor(205, 205, 205); doc.line(margin, this.y, this.pageW - margin, this.y);
        this.y += 16;
        return this;
      },
      sectionTitle(text) {
        // Lead-in space ABOVE the title separates it from the section above; a
        // tight gap BELOW the underline keeps it with the table it labels.
        this.y += 10; this._need(26);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(150, 140, 90);
        doc.text(App._pdfSafe(String(text).toUpperCase()), margin, this.y);
        this.y += 5;
        doc.setDrawColor(225, 225, 225); doc.line(margin, this.y, this.pageW - margin, this.y);
        this.y += 8;
        return this;
      },
      heading(text, size) {
        size = size || 12;
        this.y += 10; this._need(size + 8);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(size); doc.setTextColor(20, 20, 20);
        doc.text(App._pdfSafe(text), margin, this.y); this.y += size + 4;
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
  // Per-piece cost of a Food / Misc product bought by a container that carries a
  // pack size (unit_cost / pack_size) — e.g. a $20 bag of 100 wings = $0.20 each.
  // null when there is no pack size (the unit itself is the piece, like each/lb),
  // in which case the piece cost IS the unit cost. Recipes and loose counts read
  // this so a "6 wings" line costs correctly off a bag-bought item.
  piecePrice(p) {
    if (!p) return null;
    const c = parseFloat(p.unit_cost);
    if (isNaN(c)) return null;
    const pk = parseFloat(p.pack_size);
    return (pk > 0) ? c / pk : c;
  },

  // ── Recipe costing engine ────────────────────────────────────────────────
  // A menu recipe costs each ingredient in its NATURAL measure: liquids by the
  // OUNCE (a pour), countable/portioned solids by the SERVING (a slice, a patty,
  // one each). Both reduce to a cost per that measure = purchase cost divided by
  // how many ounces or servings are in one stock unit. recipeBasis is the single
  // source both menuItemCost and the Menu Builder read, so they never disagree.

  // Ounces in one of a named volume unit, else null (not a liquid volume unit).
  // Tolerant of spelled-out and abbreviated forms so seed + user entries map.
  ozPerUnit(unit) {
    if (!unit) return null;
    const u = String(unit).trim().toLowerCase();
    const MAP = {
      oz:1, ounce:1, ounces:1, 'fl oz':1, floz:1,
      cup:8, cups:8,
      pt:16, pint:16, pints:16,
      qt:32, quart:32, quarts:32,
      l:33.814, liter:33.814, litre:33.814, liters:33.814, litres:33.814,
      // ⚠ LTR / LT are what a distributor order guide actually prints (Southern Glazer's, RNDC,
      // Breakthru, Johnson Brothers all use "1.75LTR"). Without them a 1.75L handle read as 1.75
      // OUNCES — a 34x error that reached pours-per-container, cost-per-pour, theoretical usage,
      // Variance, Menu Engineering and COGS, with the row still marked Complete.
      ltr:33.814, ltrs:33.814, lt:33.814,
      gal:128, gallon:128, gallons:128,
      cl:0.33814, centiliter:0.33814, centilitre:0.33814, centiliters:0.33814, centilitres:0.33814,
      // ⚠ THE PLURALS ARE NOT OPTIONAL. `liter`/`liters` were both here but only the SINGULAR
      // `milliliter` — so a spelled-out "750 milliliters" read as 750 OUNCES: 500 pours, a 0.6%
      // pour cost against a true 18.4%, marked Complete and rendered green. That is the original
      // 750ML defect surviving under one more spelling.
      ml:0.033814, milliliter:0.033814, millilitre:0.033814, mls:0.033814,
      milliliters:0.033814, millilitres:0.033814
    };
    return MAP[u] != null ? MAP[u] : null;
  },

  // Is this product a liquid an operator pours into a drink/recipe by the ounce?
  isLiquidIngredient(p) {
    if (!p) return false;
    if (['Liquor', 'Wine', 'Draft Beer'].includes(p.category)) return true;
    if (p.category === 'Bottle Beer') return false; // used by the bottle, not a pour
    // Food/Misc is a liquid (recipe-costed by the ounce, fill-slider count) when the
    // operator gave it a Container Size in ounces — NOT by its unit name or misc type.
    // A custom unit like "bottle" becomes a liquid only when a size is entered.
    return parseFloat(p.container_size_oz) > 0;
  },

  // What a Food/Misc product is, for costing + counting. Mirrors
  // ic-product-setup's divisor roles so the form and the count sheet agree:
  // supply (pieces), liquid (ounces), each (the unit is the piece), serving
  // (a countable solid). One source so nothing drifts.
  productRole(p) {
    const ut = p && p.unit_type, mt = p && p.misc_type;
    if ((this.MISC_SUPPLY_TYPES || []).includes(mt)) return 'supply';
    // Liquid is driven by an explicit Container Size (oz), not the unit name or
    // misc type, so any unit (incl. a custom one) can be a liquid or a solid.
    if (parseFloat(p && p.container_size_oz) > 0) return 'liquid';
    if (String(ut || '').toLowerCase() === 'each') return 'each';
    return 'serving';
  },

  // The practical Count By for a product's role: a liquid gets the Fill Slider,
  // an "each" a Total Count, a countable/supply with a pack Full + Loose, else a
  // Total Count. This is the DEFAULT when a product has no saved count_style.
  defaultCountStyle(p) {
    const role = this.productRole(p);
    if (role === 'liquid') return 'slider';
    if (role === 'each') return 'number';
    const pack = p && p.pack_size;
    return (pack != null && pack !== '' && parseFloat(pack) > 0) ? 'loose' : 'number';
  },

  // The effective Count By: an explicit saved choice wins, else the role default.
  // Take Inventory and Spot Check read this so a seeded product (no count_style)
  // counts the same way the edit form shows it.
  countStyle(p) {
    return (p && p.count_style) || this.defaultCountStyle(p);
  },

  // Which count-slider silhouette a product uses (BottleSlider SHAPES). One
  // source so Take Inventory and Spot Check never pick different shapes.
  sliderShape(p) {
    const c = p && p.category;
    if (c === 'Draft Beer') return 'keg';
    if (c === 'Wine') return 'bottle';
    if (c === 'Liquor') return 'liquor';
    // Food / Misc: a jug for liquids (oil, cream, syrup), a box for solids.
    return this.isLiquidIngredient(p) ? 'jug' : 'box';
  },

  // Ounces in ONE stock unit of a liquid product (a 25.4 oz bottle, a 32 oz
  // quart, a 1984 oz keg). Prefers an explicit container size, else the unit.
  ozPerContainer(p) {
    if (!p) return null;
    const c = parseFloat(p.container_size_oz);
    if (c > 0) return c;
    return this.ozPerUnit(p.unit_type);
  },

  // Cost of one ounce of a liquid ingredient. unit_cost is per stock unit (per
  // bottle for liquor, per keg for draft, per quart for a mixer); bottle beer
  // resolves its per-case cost through bottleCost first.
  costPerOz(p) {
    if (!p) return null;
    const oz = this.ozPerContainer(p);
    if (!(oz > 0)) return null;
    const base = (p.category === 'Bottle Beer') ? this.bottleCost(p) : parseFloat(p.unit_cost);
    if (base == null || isNaN(base)) return null;
    return base / oz;
  },

  // How many recipe servings come from one stock unit (16 slices per lb, 3
  // patties per lb); an item with no pack size is 1 serving = 1 stock unit.
  servingsPerUnit(p) {
    if (!p) return null;
    const pk = parseFloat(p.pack_size);
    return (pk > 0) ? pk : 1;
  },

  // Cost of one serving of a solid ingredient (piecePrice already = unit_cost /
  // pack_size, or unit_cost when the stock unit itself is the serving).
  costPerServing(p) { return this.piecePrice(p); },

  // Products a recipe can use: everything except bottle beer (used whole) and
  // the non-food supply types (paper, cleaning). Drives the Menu Builder picker.
  isRecipeIngredient(p) {
    if (!p) return false;
    if (p.category === 'Bottle Beer') return false;
    if ((this.MISC_SUPPLY_TYPES || []).includes(p.misc_type)) return false;
    return true;
  },

  // The canonical recipe basis for an ingredient. measure:
  //   'oz'      → a liquid pour; enter ounces; unitLabel 'oz'.
  //   'serving' → a countable/portioned solid; enter servings; unitLabel = the
  //               serving noun (slice/patty), default 'serving' or 'ea'.
  //   'unit'    → a solid with no serving size set yet; fall back to stock unit.
  recipeBasis(p) {
    if (!p) return { measure: 'unit', unitLabel: 'units', costPerUnit: 0 };
    if (this.isLiquidIngredient(p)) {
      return { measure: 'oz', unitLabel: 'oz', costPerUnit: this.costPerOz(p) || 0 };
    }
    // Bottle beer is tracked/priced by the CASE, so unit_cost is a case price.
    // Cost a recipe use (a beer cocktail) per BOTTLE via bottleCost (case_size
    // conversion) — the stock-unit fallback below would charge the full case.
    if (p.category === 'Bottle Beer') {
      return { measure: 'unit', unitLabel: 'bottle', costPerUnit: this.bottleCost(p) || 0 };
    }
    const pk = parseFloat(p.pack_size);
    const isEach = String(p.unit_type || '').toLowerCase() === 'each';
    if (pk > 0 || isEach) {
      const noun = p.serving_name || (isEach ? 'ea' : 'serving');
      return { measure: 'serving', unitLabel: noun, costPerUnit: this.piecePrice(p) || 0 };
    }
    // No serving size configured yet: cost by the stock unit (honest fallback).
    return { measure: 'unit', unitLabel: (p.unit_type || 'units'), costPerUnit: parseFloat(p.unit_cost) || 0 };
  },

  // Ingredient ids in this item's recipe whose product or prep batch no longer exists. Mirrors
  // ic-prep-batches.missingIngredients, which does the same job one level down.
  // ⚠ A row with NO source/id is a hand-entered line carrying its own cost_per_unit. That is a
  // legitimate shape, not a missing ingredient, and it must keep costing.
  // Products a PREP BATCH names that are no longer on file. The one definition of "this batch is
  // broken", used by menuItemMissingIngredients below and delegated to by ic-prep-batches so the
  // screen and the menu cannot drift apart on it — two copies of one predicate is the mechanism
  // that gave computeUsagePair five copies and split the client from the server in S49.
  batchMissingIngredients(b) {
    const prods = (this.inventoryData && this.inventoryData.ic_products) || [];
    return (((b && b.ingredients) || [])
      .filter(i => i && i.product_id && !prods.some(p => p && p.id === i.product_id))
      .map(i => i.product_id));
  },

  menuItemMissingIngredients(item) {
    const prods = (this.inventoryData && this.inventoryData.ic_products) || [];
    const out = [];
    // ⚠ A DELETED LINKED PRODUCT BELONGS ON THIS LIST TOO. menuItemCost gives
    // `linked_product_id` priority, so a deleted link leaves the cost exactly as
    // unknowable as a deleted recipe ingredient — and it was worse in practice, because
    // the link path fell straight through to the STALE stored `item.cost` while this list
    // came back empty, so nothing anywhere flagged it and menuItemPct said `costed: true`.
    // A pint kept reporting last season's keg price and "on target" for ever.
    if (item && item.linked_product_id && !prods.some(p => p && p.id === item.linked_product_id)) {
      out.push(item.linked_product_id);
    }
    const ings = (item && item.recipe && Array.isArray(item.recipe.ingredients)) ? item.recipe.ingredients : [];
    if (!ings.length) return out;
    const batches = (this.inventoryData && this.inventoryData.ic_prep_batches) || [];
    ings.forEach(ing => {
      const src = ing.source || (ing.product_id ? 'product' : null);
      const id  = ing.id || ing.product_id;
      if (!src || !id) return;
      // ⚠ A BATCH IS MISSING WHEN IT IS GONE **OR WHEN IT IS ITSELF BROKEN** (S107). This used to
      // ask only whether the batch existed. Meanwhile ic-prep-batches deliberately HOLDS a batch's
      // last-good cost_per_serving when one of ITS products is deleted (S25: flag it, do not recost
      // it cheaper), and menuItemCost's batch branch reads that held number — so deleting the only
      // product inside a batch left every dish built on it reporting a confident cost, `costed:
      // true`, an empty missing list and therefore no flag anywhere, while the identical delete one
      // level up correctly returned null. Measured: a Margarita printed 8.75% food cost off a
      // batch whose ingredient no longer existed. The deletion was visible only on Prep Batches.
      // ⚠⚠ AND A BATCH WITH NO PER-SERVING COST IS EQUALLY UNUSABLE (S26). computeRows now returns
      // null rather than falling back to the whole batch cost when servings-per-batch is unknown.
      // Three consumers read `b.cost_per_serving || 0`, so WITHOUT this line that null would cost
      // the dish at ZERO — making it look CHEAPER, which is precisely the S14/S107 failure this
      // whole guard exists to stop. Refuse instead, and the dish presents as not costed.
      if (src === 'batch') {
        const b = batches.find(x => x && x.id === id);
        if (!b || this.batchMissingIngredients(b).length || b.cost_per_serving == null) out.push(id);
        return;
      }
      if (!prods.some(p => p && p.id === id)) out.push(id);
    });
    return out;
  },

  // Products in this item's recipe that are still on file but marked INACTIVE.
  // ⚠ DELIBERATELY SEPARATE from menuItemMissingIngredients, and it must stay that way.
  //   deleted  = the cost is UNKNOWN. menuItemCost refuses to cost the dish. Load-bearing, amber.
  //   inactive = the cost is KNOWN and CORRECT. Nothing is lying. The only issue is operational:
  //              you may not be able to make this right now.
  // So this changes NO math and no ranking. The app's own help documents Hide from operations as
  // covering "a seasonal pour or a discontinued item" — a seasonal ingredient going inactive in
  // January must not strip a dish out of Menu Engineering or Pre-Shift. If "cannot make this
  // tonight" is ever wanted, that is a stronger, separate concept (an 86) and deserves its own flag
  // rather than being smuggled in on this one.
  menuItemInactiveProducts(item) {
    const prods = (this.inventoryData && this.inventoryData.ic_products) || [];
    const out = [];
    // ⚠ A LINKED PRODUCT COUNTS TOO (S108). menuItemMissingIngredients was taught this door and its
    // adjacent, explicitly-documented twin was not — so a pint that POURS an inactive keg directly
    // said nothing, while a cocktail using the SAME keg in a recipe was annotated. Two items
    // resting on one hidden product, annotated differently on one list, and the direct pour — the
    // more common shape — was the silent one. The old early return on an empty recipe was what hid
    // it: an inventory-linked item has no recipe at all.
    if (item && item.linked_product_id) {
      const lp = prods.find(x => x && x.id === item.linked_product_id);
      if (lp && lp.active === false) out.push(lp);
    }
    const ings = (item && item.recipe && Array.isArray(item.recipe.ingredients)) ? item.recipe.ingredients : [];
    ings.forEach(ing => {
      const src = ing.source || (ing.product_id ? 'product' : null);
      const id  = ing.id || ing.product_id;
      if (src !== 'product' || !id) return;
      const p = prods.find(x => x && x.id === id);
      if (p && p.active === false) out.push(p);
    });
    return out;
  },

  menuItemCost(item) {
    if (!item) return null;

    // Linked product takes priority. For Bottle Beer with case_size,
    // bottleCost handles the per-case → per-bottle conversion.
    if (item.linked_product_id) {
      const prods = (this.inventoryData && this.inventoryData.ic_products) || [];
      const p = prods.find(x => x.id === item.linked_product_id);
      if (p) return this.menuLinkCost(p, (p.category === 'Food' || p.category === 'Misc') ? item.portion : item.pour_size_oz);
      // ⚠ THE LINKED PRODUCT HAS BEEN DELETED, so the cost is UNKNOWN — the same rule the
      // recipe branch below applies to a deleted ingredient. This used to fall through to
      // `return parseFloat(item.cost) || 0` at the bottom, handing back whatever was stored
      // at the item's last save as though it were live: a keg goes $180 -> $260, the vendor
      // is dropped, the product is deleted, and the pint reports its old cost and "on
      // target" for ever. Refusing is what makes `costed` false everywhere downstream.
      // ⚠ UNCONDITIONAL, including when the item also carries a recipe. An item with a
      // linked product is configured as inventory-sourced (r-menu-items.sourceOf returns
      // 'inventory' on the link alone), so a dead link is BROKEN CONFIGURATION, not a cue
      // to quietly cost from a different basis. Refusing surfaces it — the row shows
      // INGREDIENT DELETED and the operator clears the stale link or replaces it — and a
      // refusal is visible and recoverable, where a silent switch of basis is neither.
      // This also keeps one rule: menuItemMissingIngredients reports the dead link, and
      // every branch of this function refuses whenever that list is non-empty.
      return null;
    }

    if (item.recipe && Array.isArray(item.recipe.ingredients) && item.recipe.ingredients.length) {
      const prods = (this.inventoryData && this.inventoryData.ic_products) || [];
      const batches = (this.inventoryData && this.inventoryData.ic_prep_batches) || [];

      // ⚠ A DELETED INGREDIENT IS NOT A FREE ONE. A missing product used to fall through to
      // `ing.cost_per_unit` — which recipe rows do not store (r-menu-items persists {source, id,
      // quantity} only) — and a missing batch returned 0 outright. So deleting the ground beef
      // dropped the Smash Burger from $4.20 to $0.85 silently, and every margin, food-cost %,
      // Star/Dog rating and reprice suggestion built on it moved the flattering way.
      // Unlike a prep batch there is no stored "last good" cost to hold here: a menu item's cost is
      // recomputed from its recipe on every read. So the honest answer is to REFUSE to cost it.
      // null flows through menuItemPct's `costed` flag, and the item then reads "not costed"
      // everywhere instead of cheap — off the Menu Engineering board (it filters on a truthy cost),
      // dashed out on Recipe Cost Analysis, Incomplete in the Menu Builder.
      // Costing the REST and calling that the dish cost would be the same lie in a smaller font: a
      // partial cost is not a cost.
      if (this.menuItemMissingIngredients(item).length) return null;

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
        // product: cost the quantity in its natural measure (ounces for a liquid
        // pour, per-serving for a solid) via the shared recipeBasis, so the live
        // menu cost and the Menu Builder always agree.
        const p = prods.find(x => x.id === id);
        if (!p) return (parseFloat(ing.cost_per_unit) || 0) * qty;
        return (this.recipeBasis(p).costPerUnit || 0) * qty;
      };

      const tc = item.recipe.ingredients.reduce((s, ing) => s + ingCost(ing), 0);
      if (item.recipe.mode === 'food' && item.recipe.plate_yield > 0) {
        return tc / item.recipe.plate_yield;
      }
      return tc;
    }
    return parseFloat(item.cost) || 0;
  },

  // Canonical menu price-change logger. Every door that changes a menu item's
  // live price (the Menu Items edit form, Menu Engineering's reprice) routes
  // through here, so there is ONE price-change record + ONE Pricing fix event,
  // never duplicated logic. opts: { reason, source, volPct, predictedWeekly }.
  // volPct/predictedWeekly are set only for a modeled reprice (Menu Engineering);
  // a direct edit leaves them null (no prediction to verify). Pricing is a
  // no-dollar metric, so the fix event records the change and its date, never an
  // invented recovered figure.
  async logPriceChange(item, oldPrice, newPrice, opts) {
    opts = opts || {};
    // ⚠ NULL, not a fabricated 0. This used to be `menuItemCost(item) || 0`, so an item
    // Bar Cop cannot cost was logged with cost 0 — and the verification that reads this
    // row back treats the whole menu price as margin, printing a wrong dollar figure
    // under the word "actual" (a $16 -> $17 change on a dish whose real cost is $4.15
    // read as -$220/wk instead of -$137/wk). A cost we do not have is not zero.
    // Same canonical rule as App.menuItemPct's `costed`: real means non-null AND > 0.
    const raw = this.menuItemCost(item);
    const cost = (raw != null && raw > 0) ? raw : null;
    await this.putRecord('core', 'revenue_price_log', {
      id: this.uid(), date: this.todayLocal(), item_id: item.id, item_name: item.name,
      old_price: oldPrice, new_price: newPrice, cost,
      reason: opts.reason || 'Price change', margin_impact: newPrice - oldPrice,
      covers_at_change: item.weekly_covers || 0,
      predicted_vol_pct: opts.volPct != null ? (parseFloat(opts.volPct) || 0) : null,
      predicted_weekly_impact: opts.predictedWeekly != null ? opts.predictedWeekly : null,
      source: opts.source || 'menu', saved_at: new Date().toISOString()
    });
    await this.putRecord('core', 'fix_log', {
      id: this.uid(), module: 'revenue', gap_id: 'pricing', gap_name: 'Pricing',
      date: this.todayLocal(), source: 'price-change',
      note: 'Price change on ' + (item.name || '') + ': ' + this.fmtCurrency(oldPrice) + ' to ' + this.fmtCurrency(newPrice)
    });
  },

  // ── Menu cost vs target + cost-creep attribution ───────────────────────────
  // Per-item cost target: the item's own override, else the default for its kind
  // (food plate vs cocktail).
  menuTargetPct(item) {
    if (item && item.target_cost_pct) return parseFloat(item.target_cost_pct);
    // Only made-to-recipe items carry a cost-% target: a plate dish or a cocktail. No-prep
    // resale beverages (beer/wine/NA, inventory-linked) are markup-priced and have NONE
    // unless the operator sets a per-item override — return null so they drop out of the
    // "over target" check (menuItemPct guards target != null) rather than being flagged
    // against the cocktail number. THE single target rule: Menu Engineering's targetPctFor
    // and the Menu Items list both defer to this, so no two screens drift.
    // ⚠ THIS USED TO REACH FOR S.RevenueMenuItems.classifyItem WITH ITS OWN INFERENCE AS A
    // FALLBACK — a THIRD copy of the type rule, and a divergent one: it read neither
    // linked_product_id nor the legacy category signal, so with the screen not yet loaded a
    // seeded cocktail (no type, no recipe) resolved to null and carried no target at all.
    // classifyItem is now a delegate to menuTypeOf, so this calls the one rule directly.
    const type = this.menuTypeOf(item);
    if (type === 'plate')    return this.MENU_TARGET_COST_PCT.plate;
    if (type === 'cocktail') return this.MENU_TARGET_COST_PCT.cocktail;
    return null;
  },
  // Live cost percentage of a menu item against its menu price, plus its target.
  // ⚠ AN ITEM WITH NO COST IS NOT AN ITEM WITH A ZERO COST. menuItemCost returns 0 for an item with
  // no recipe, no linked product and a blank cost field — the day-one state of any menu imported
  // from a CSV without a cost column, which the importer deliberately makes optional. Zero is the
  // most flattering number possible: it says the plate is pure profit. So `pct` is NULL when the
  // cost is not a real figure, and `costed` says so out loud.
  // Every consumer already guards on `pct != null`, so this alone stops Recipe Cost Analysis
  // printing "0.0% · ON TARGET" beside a dashed-out Cost and Margin on the one screen whose job is
  // finding margin leaks, and keeps menuItemsOverTarget from grading an item it cannot measure.
  // `cost` stays a NUMBER on purpose: recipe-cost-analysis already prints `cost ? ... : '-'` so 0
  // dashes out on its own, and ic-receive-delivery's cost-creep comparison does arithmetic on it.
  menuItemPct(item) {
    const raw = this.menuItemCost(item);
    const cost = raw || 0;
    const price = parseFloat(item && item.price) || 0;
    const costed = raw != null && raw > 0;
    const pct = (costed && price > 0) ? cost / price * 100 : null;
    const target = this.menuTargetPct(item);
    return { cost, price, pct, target, costed, over: (pct != null && target != null && pct > target + 0.05) };
  },
  // Menu items that reference any of the given inventory product ids — either a
  // linked product or a recipe ingredient sourced from a product. idSet = a Set.
  // Every LIVE place an inventory product is used, for the delete cross-check.
  // Returns { menuItems, prepBatches, openOrders, total, any }.
  //
  // ⚠ LIVE ONLY, and that is the whole design. HISTORY — past counts, deliveries, waste, spot
  // checks, adjustments, variance runs — is never reported here and is never touched by a delete.
  // Pulling a product out of last month's count would rewrite a closed period's COGS and change
  // numbers the operator may already have handed their accountant. A count is a record of what was
  // counted, not a list of what you currently stock.
  //
  // ⚠ WHY THIS EXISTS RATHER THAN REUSING menuItemsUsingProducts: that helper covers menu recipes
  // and linked products but NOT prep batches. A check built on it alone reports "nothing uses this"
  // for a product sitting in a batch recipe — and deleting it re-costs that batch cheaper, which is
  // the exact silent-discount ic-prep-batches.missingIngredients was built to stop.
  //
  // A RECEIVED order is history too (it arrived; its line items are the cost record), so only a
  // not-yet-Received order is live. Same test the Order Sheet uses to decide a vendor still has
  // something outstanding.
  //
  // ARCHIVED menu items ARE reported: they can be restored, and restoring one must not quietly
  // produce a cheaper dish. So this reads data.menu_items raw, not this.menuItems().
  productReferences(idSet) {
    const none = { menuItems: [], prepBatches: [], openOrders: [], investigations: [], total: 0, any: false };
    if (!idSet || !idSet.size) return none;
    const inv = this.inventoryData || {};
    const allItems = (this.data && Array.isArray(this.data.menu_items)) ? this.data.menu_items : [];
    const menuItems = allItems.filter(it => {
      if (!it) return false;
      if (it.linked_product_id && idSet.has(it.linked_product_id)) return true;
      const ings = (it.recipe && Array.isArray(it.recipe.ingredients)) ? it.recipe.ingredients : [];
      return ings.some(ing => {
        const src = ing.source || (ing.product_id ? 'product' : null);
        const id  = ing.id || ing.product_id;
        return src === 'product' && id && idSet.has(id);
      });
    });
    const prepBatches = (Array.isArray(inv.ic_prep_batches) ? inv.ic_prep_batches : []).filter(b =>
      b && Array.isArray(b.ingredients)
      && b.ingredients.some(i => i && i.product_id && idSet.has(i.product_id)));
    const openOrders = (Array.isArray(inv.ic_orders) ? inv.ic_orders : []).filter(o =>
      o && o.status !== 'Received' && Array.isArray(o.line_items)
      && o.line_items.some(li => li && li.product_id && idSet.has(li.product_id)));
    /* ⛔ THE FOURTH REFERENCE KIND WENT WITH LOSS PREVENTION (2026-08-24). An OPEN loss investigation
       used to block deleting the product it named, read off `variance_investigations`. That store is
       gone, so this guard is back to the three things that can still reference a product.
       ⚠ IT WOULD HAVE GONE QUIET, NOT BROKEN, WHICH IS WHY IT IS CUT RATHER THAN LEFT: the refusal
       card renders each kind through `line(n, …)`, which returns '' at zero, so a permanently empty
       fourth kind renders nothing and NOTHING would have reported it ([[lessons-paid-for]] #134).
       This member was not on the retirement plan at all; only a sweep of who READS the store found
       it (#111). The refusal card loses one row and keeps the other three. */
    const total = menuItems.length + prepBatches.length + openOrders.length;
    return { menuItems, prepBatches, openOrders, total, any: total > 0 };
  },

  // Menu items that use this PREP BATCH as a recipe ingredient (source:'batch'). The batch twin of
  // productReferences (S153): deleting a batch out from under a dish makes menuItemCost refuse to
  // cost it (it reads cost_per_serving straight off the batch), so the delete guard names them first
  // instead of letting the dish silently go "not costed". A batch is referenced ONLY by menu items —
  // batch recipes hold products, not other batches (ic-prep-batches saveBatch builds {product_id,
  // quantity} rows). Reads data.menu_items RAW so an ARCHIVED item is reported too (restoring it must
  // not quietly produce an uncosted dish — same reasoning as productReferences).
  batchReferences(batchId) {
    const none = { menuItems: [], total: 0, any: false };
    if (!batchId) return none;
    const allItems = (this.data && Array.isArray(this.data.menu_items)) ? this.data.menu_items : [];
    const menuItems = allItems.filter(it => {
      const ings = (it && it.recipe && Array.isArray(it.recipe.ingredients)) ? it.recipe.ingredients : [];
      return ings.some(ing => ing && ing.source === 'batch' && (ing.id || ing.product_id) === batchId);
    });
    return { menuItems, total: menuItems.length, any: menuItems.length > 0 };
  },

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
  /* ⚠⚠ ARCHIVED ITEMS ARE EXCLUDED, AND THIS WAS THE ODD ONE OUT (I6, fixed 2026-07-30).
     `menuItems()` returns the RAW array — archived included — and `menuItemPct` has no notion of
     archived, so a Cut item counted here. Menu Engineering, the Operations Audit and Menu Rundown all
     filter `!archived` already (r-menu-engineering:119/151, and its own comment at :566 says "A Cut
     item is archived and never reaches this list").
     THE COST: this is the ONE door for the count (profit-fix:140 and r-fix:128 both say "One door
     now") and FOUR consumers read it — the IC dashboard tile, profit-fix, r-fix and Recipe Cost
     Analysis. So an item the operator DELIBERATELY CUT kept Revenue Fix's "N items over target"
     step amber with no live row behind it, which the operator could not clear by working the list
     because the row is not on the list. Pinned by verify-archived-not-over-target.js. */
  menuItemsOverTarget() {
    return this.menuItems().filter(it => it && !it.archived)
      .map(it => this.menuItemPct(it)).filter(m => m.over);
  },

  /* ⚠⚠ THE ITEMS BAR COP CANNOT GRADE — the other half of "N items over target" (I7, 2026-07-30).
     `menuItemsOverTarget` can only ever count items it can MEASURE: with no cost or no price,
     `menuItemPct.pct` is null and the item can never be "over". So a menu with 40 items and 2
     costed, both at target, produced a count of ZERO — and both Fix screens printed
     **"All at target" in green** while 38 items were ungradeable and the operator was told there
     was no pricing work to do. Exactly what a partial import produces.
     A zero is only all-clear when there was something to measure; this is what makes that
     testable. Archived items are excluded for the same reason they are above (I6): a Cut item is
     not work. Deliberately NO threshold — the honest question is "is anything ungradeable", not
     "how much of the menu is costed", so there is no number to fit to a fixture. */
  menuItemsUngradeable() {
    return this.menuItems().filter(it => it && !it.archived)
      .map(it => ({ item: it, m: this.menuItemPct(it) }))
      .filter(x => x.m.pct == null || x.m.target == null);
  },

  // ── Perpetual on-hand (the CURRENT picture, not just the latest count) ───────
  // The reorder math + inventory value read current on-hand, which is NOT the
  // single latest count: a count can cover one location and skip products, so
  // each product's on-hand is the sum across its locations of the most-recent
  // value where that product@location was actually COUNTED. An item flagged
  // `counted:false` (operator skipped it) never overwrites a prior value, so a
  // count submitted with everything not counted changes nothing. Older counts
  // predate the flag, so their items are treated as counted. { pid: {onHand,value} }.
  //
  // A count item is keyed to the location NAME it was taken at, and nothing ever
  // rewrites a finalized count. So a shelf the operator RENAMED, or one a product
  // no longer lives in, left rows behind that nothing superseded — they kept being
  // summed next to the current rows and on-hand DOUBLE-COUNTED forever, which
  // suppresses reorders (running dry mid-service is the worse failure). Two guards:
  // a location's prior names resolve forward to its current name, and a row at a
  // location the product no longer occupies is dropped.
  // `asOf` (optional 'YYYY-MM-DD') values the shelf as it stood on a date: counts
  // after it are invisible. The tax sheets need that — a Schedule C figure is the
  // shelf at period end, not the shelf today. `exclusive` makes the boundary `<`
  // instead of `<=`, which is what a BEGINNING-of-period figure wants.
  // Each product also carries the oldest/newest count date that fed it, so a caller
  // can say WHICH figures rest on an older count instead of quietly mixing them.
  _perpetualInventory(asOf, exclusive) {
    // ic_counts + ic_dispositions: the two kinds that move on-hand. A disposition (S182) carries the
    // same item shape and a date, so it flows through the per-key newest-wins logic below exactly like
    // a count. Stored apart from ic_counts so the computeUsagePair usage readers never see it.
    const _inv = this.inventoryData || {};
    const counts = [...(Array.isArray(_inv.ic_counts) ? _inv.ic_counts : []),
                    ...(Array.isArray(_inv.ic_dispositions) ? _inv.ic_dispositions : [])]
      .filter(c => !asOf || (c && c.date && (exclusive ? String(c.date) < asOf : String(c.date) <= asOf)))
      .sort(App.cmpNewest);   // newest first by record date
    const locs = (this.inventoryData && this.inventoryData.ic_locations) || [];
    // A name that is CURRENTLY a live location is never remapped, so two shelves that
    // swapped names cannot absorb each other's stock through a stale trail.
    const live = new Set(locs.map(l => l && l.name).filter(Boolean));
    const canon = {};   // a location's PRIOR name -> the name it goes by now
    locs.forEach(l => ((l && l.prior_names) || []).forEach(pn => { if (pn && !live.has(pn)) canon[pn] = l.name; }));
    // An ARCHIVED shelf is pulled out of the count picker but stays on its products, so its rows
    // could never be superseded and were summed forever — the same permanent double-count as a
    // rename, on the archive path. It is not a home any more.
    const archived = new Set(locs.filter(l => l && l.archived).map(l => l.name).filter(Boolean));
    // pid -> the locations it lives in now. null means "keep every row": an unplaced
    // product, or one whose locations were all deleted, can never be counted again, so
    // its last known figures are all there is and zeroing it would invent a shortage.
    const homes = {};
    // `assigned` is the product's TICKED locations INCLUDING archived ones; `homes` drops the
    // archived. The as-of retirement below needs the difference (S133): a shelf the product is still
    // ASSIGNED to but that is archived can never be recounted, so a newer count elsewhere is not
    // evidence its stock left — it carries forward. A shelf the product was UNticked from (a move) is
    // not assigned and is retired by a strictly newer count (the C1 pin).
    const assigned = {};
    ((this.inventoryData && this.inventoryData.ic_products) || []).forEach(p => {
      if (!p || !p.id) return;
      const all = this.productLocations(p);
      assigned[p.id] = new Set(all);
      const pl = all.filter(n => !archived.has(n));
      homes[p.id] = pl.length ? new Set(pl) : null;
    });
    const seen = {};      // "pid@@loc" already resolved to its newest counted value
    const byProd = {};
    const stale = {};     // pid -> { key: {it,date} } dropped as stale, held in reserve
    const newestSeen = {};// pid -> date of the NEWEST count that measured it anywhere (see the
                          // as-of rule below). Counts are newest-first, so first write wins.
    // Which counts fed this product's figure. `oldest` is what a disclosure should
    // quote: it is the weakest link, the part of the number resting furthest back.
    const stampDate = (rec, d) => {
      if (!d) return;
      const s = String(d);
      if (!rec.oldest || s < rec.oldest) rec.oldest = s;
      if (!rec.newest || s > rec.newest) rec.newest = s;
    };
    // ⚠ Each product records WHICH COUNT each part of its figure came from (`byDate`), plus the
    // name / category / unit cost of the item that fed it. Both are what an honest disclosure
    // needs: a sheet has to say HOW MUCH of a value rests on an older count, not merely that some
    // of it does (S92) — and a product since DELETED is not in ic_products at all, so the count
    // row is the only place its name and category still exist (S95). Counts run newest-first, so
    // the first item to fill the identity fields is the most recent record of them.
    const newRec = () => ({ onHand: 0, value: 0, oldest: null, newest: null, byDate: {},
      name: '', category: '', unitCost: null });
    const contribute = (rec, item, date) => {
      const units = item.total || 0, val = item.value || 0;
      rec.onHand += units;
      rec.value  += val;
      const d = String(date || '');
      const slot = rec.byDate[d] || (rec.byDate[d] = { onHand: 0, value: 0 });
      slot.onHand += units;
      slot.value  += val;
      if (!rec.name && item.name) rec.name = item.name;
      if (!rec.category && item.category) rec.category = item.category;
      if (rec.unitCost == null && item.unit_cost != null) rec.unitCost = parseFloat(item.unit_cost);
      stampDate(rec, date);
    };
    counts.forEach(cnt => {
      (cnt.items || []).forEach(it => {
        if (it.counted === false) return;
        // A real measurement, so this count COVERS the product. Skipped rows deliberately do not
        // establish a date (the same rule receivedSinceCount follows).
        if (!newestSeen[it.product_id]) newestSeen[it.product_id] = cnt.date || '';
        const loc = it.location ? (canon[it.location] || it.location) : '';
        const home = homes[it.product_id];
        const key = it.product_id + '@@' + (loc || 'Unassigned');
        // Legacy rows carry no location at all, so they are always kept.
        if (loc && home && !home.has(loc)) {
          // ⚠ Stale, but NOT thrown away yet. Every consumer walks Object.keys(currentOnHand()) —
          // the Order Sheet's belowParByVendor, the IC dashboard reorder plan, the cash engine's
          // trapped(). A product with no key does not read zero, it VANISHES: no line on the order
          // sheet, never reordered, run dry. So if scoping would empty a product out completely
          // (moved to a shelf not yet counted, or its only shelf renamed then re-created), its
          // last known figures stand. Held per key so the newest stale count still wins.
          const bucket = stale[it.product_id] || (stale[it.product_id] = {});
          if (!bucket[key]) bucket[key] = { it, date: cnt.date || '', loc };
          return;
        }
        if (seen[key]) return;
        seen[key] = true;
        const rec = byProd[it.product_id] || (byProd[it.product_id] = newRec());
        contribute(rec, it, cnt.date);
      });
    });
    // ⚠⚠ TWO DIFFERENT QUESTIONS, TWO DIFFERENT RULES. Do not collapse them (S88).
    // A CURRENT read asks "what do I reorder against TODAY", so today's shelf layout is exactly
    // the right lens: a shelf the operator took this product off is not stock any more, and
    // carrying it forever suppresses reorders (running dry mid-service is the worse failure).
    // That behaviour is UNCHANGED and is pinned by verify-onhand-stale-location.js.
    // An AS-OF read asks "what was on the shelf on DATE D". A Product Setup edit made LATER is
    // not evidence about D — the count taken on or before D is. Scoping a historical row against
    // TODAY's layout rewrote a past month's ending inventory and INVENTED cost of goods on a
    // Schedule C sheet: the emptiness test below resolves differently at the two ends of a
    // period, so one shelf counted in full at the period START was dropped at the period END and
    // the difference surfaced as usage nobody poured ($320 on the harness fixture, undisclosed).
    // So on the as-of path a vacated shelf is retired only by a STRICTLY NEWER COUNT that also
    // measured the product. That still retires the renamed/archived shelf the original guard was
    // built for (a later count supersedes it) and treats both boundaries identically.
    Object.keys(stale).forEach(pid => {
      const bucket = stale[pid];
      const asg = assigned[pid];
      const keep = asOf
        ? Object.keys(bucket).filter(k => {
            // A shelf the product is STILL ASSIGNED to (archived, so dropped from homes) can never be
            // recounted, so a newer count at ANOTHER shelf is not evidence its stock left — carry it
            // forward + disclose (S133). Only a shelf the product was UNticked from (a move) is
            // retired by a strictly newer count that measured the product (the C1 double-count pin).
            if (bucket[k].loc && asg && asg.has(bucket[k].loc)) return true;
            return !(newestSeen[pid] && bucket[k].date < newestSeen[pid]);
          })
        : (byProd[pid] ? [] : Object.keys(bucket));   // current read: a live row wins outright
      if (!keep.length) return;
      const rec = byProd[pid] || (byProd[pid] = newRec());
      keep.forEach(k => contribute(rec, bucket[k].it, bucket[k].date));
    });
    return byProd;
  },
  currentOnHand() {
    const m = this._perpetualInventory();
    const out = {};
    Object.keys(m).forEach(pid => { out[pid] = m[pid].onHand; });
    return out;
  },

  // Products with COUNTED stock standing at a location right now: the newest counted on-hand for
  // each product AT THAT SHELF (prior names resolve forward, same as _perpetualInventory). Drives
  // the S133 disposition prompt — archiving a shelf, or unticking a product off it, must ask "what
  // happened to the stock?" ONLY when it would strand real inventory. Empty when nothing was ever
  // counted there or it was counted to 0, so a new operator rearranging empty shelves is never
  // prompted. `onlyPid` limits it to one product (the untick path). Returns
  // [{ product_id, name, onHand, value, date, unitCost }], newest count per product at the shelf.
  countedStockAt(locName, onlyPid) {
    if (!locName) return [];
    // Counts + dispositions (S182), same as _perpetualInventory, so a shelf already zeroed by a prior
    // disposition reads as empty here and is not re-prompted.
    const _inv = this.inventoryData || {};
    const counts = [...(Array.isArray(_inv.ic_counts) ? _inv.ic_counts : []),
                    ...(Array.isArray(_inv.ic_dispositions) ? _inv.ic_dispositions : [])].sort(App.cmpNewest);
    const locs = (this.inventoryData && this.inventoryData.ic_locations) || [];
    // Resolve a shelf's PRIOR names forward to its current name, never remapping a name that is
    // currently live (mirrors _perpetualInventory so the two never disagree on which shelf a row is).
    const liveNames = new Set(locs.map(l => l && l.name).filter(Boolean));
    const canon = {};
    locs.forEach(l => ((l && l.prior_names) || []).forEach(pn => { if (pn && !liveNames.has(pn)) canon[pn] = l.name; }));
    const prods = (this.inventoryData && this.inventoryData.ic_products) || [];
    const prodOf = pid => prods.find(p => p && p.id === pid) || null;
    const seen = {};   // pid already resolved at this shelf (counts are newest-first, so first wins)
    const out = [];
    counts.forEach(cnt => {
      (cnt.items || []).forEach(it => {
        if (it.counted === false || !it.product_id) return;   // a skip is not a measurement
        if (onlyPid && it.product_id !== onlyPid) return;
        const loc = it.location ? (canon[it.location] || it.location) : '';
        if (loc !== locName) return;
        if (seen[it.product_id]) return;
        seen[it.product_id] = true;
        const onHand = it.total || 0;
        if (onHand <= 0) return;   // counted to zero (or empty) — nothing to dispose
        const p = prodOf(it.product_id);
        const uc = (p && p.unit_cost != null) ? parseFloat(p.unit_cost) : (it.unit_cost != null ? parseFloat(it.unit_cost) : null);
        out.push({ product_id: it.product_id, name: (p && p.name) || it.name || '',
          onHand, value: it.value || 0, date: cnt.date || '', unitCost: (uc != null && !isNaN(uc)) ? uc : null });
      });
    });
    return out;
  },

  // Record what the operator said happened to the stock on a shelf they are retiring (archive or
  // untick) — the S133 clean-signal write. Each disposition is one product: 'used' (gone → it flows
  // to THIS period's COGS), 'moved' to another shelf (total unchanged, relocated), or 'stay' (nothing
  // written — _perpetualInventory carries the last count forward + discloses it). Writes a single
  // DATED count today, so a past period's ending never moves. Unified across archive + untick: the
  // retired shelf's product is written to 0 TODAY, and because today == newestSeen that 0 both wins
  // as the current value (archived-assigned path, piece 1) AND is never retired-as-stale on the
  // untick path (date is not < newestSeen). Returns the write's ok (true when nothing to write).
  // dispositions: [{ product_id, name, choice:'used'|'moved'|'stay', destLoc?, onHand, unitCost }]
  async disposeShelfStock(fromLoc, dispositions) {
    const list = (dispositions || []).filter(d => d && d.product_id && (d.choice === 'used' || d.choice === 'moved'));
    if (!list.length) return true;   // everything stays — piece 1 carries it forward, nothing to write
    const prods = (this.inventoryData && this.inventoryData.ic_products) || [];
    const catOf = pid => (prods.find(p => p && p.id === pid) || {}).category || '';
    // S183: a product 'moved' to a shelf it is not assigned to now LIVES there — assign it, or the
    // moved units land on a shelf the product does not occupy, drop into _perpetualInventory's stale
    // bucket, and the CURRENT on-hand read (order sheet / trapped) drops them while the as-of read
    // keeps them, so the reorder math re-orders stock that was only relocated. Snapshot for rollback;
    // the assignment writes BEFORE the disposition so the destination row is a real home.
    const touched = [], undo = [];
    list.forEach(d => {
      if (d.choice !== 'moved' || !d.destLoc) return;
      const p = prods.find(x => x && x.id === d.product_id);
      if (!p) return;
      const locs = this.productLocations(p);
      if (!locs.includes(d.destLoc)) { undo.push(...App.snapshotRows([p])); p.locations = [...locs, d.destLoc]; touched.push(p); }
    });
    const mkItem = (d, loc, total) => ({
      product_id: d.product_id, name: d.name || '', category: catOf(d.product_id),
      location: loc, total: total,
      unit_cost: (d.unitCost != null ? d.unitCost : null),
      value: (d.unitCost != null ? Math.round(d.unitCost * total * 100) / 100 : 0),
      counted: true, disposition: true
    });
    const items = [];
    list.forEach(d => {
      items.push(mkItem(d, fromLoc, 0));   // the retired shelf holds none of it now (used, or moved away)
      if (d.choice === 'moved' && d.destLoc) {
        // The destination gains the moved units on top of whatever it was last counted holding.
        const existing = this.countedStockAt(d.destLoc, d.product_id)[0];
        const base = existing ? existing.onHand : 0;
        items.push(mkItem(d, d.destLoc, base + (d.onHand || 0)));
      }
    });
    const record = {
      id: App.uid(), date: this.todayLocal(), type: 'Disposition',
      locations: [...new Set(items.map(i => i.location))],
      items: items, item_count: items.length,
      total_value: items.reduce((s, i) => s + (i.value || 0), 0),
      disposition: true, disposition_from: fromLoc, created_at: new Date().toISOString()
    };
    // Assign the moved products to their destinations FIRST (idempotent upserts), so the disposition's
    // dest rows count as on-hand there; a failed assignment rolls back and aborts (no orphaned move).
    if (touched.length && !(await App.putRecordsBulk('ic', 'product', touched))) { App.restoreRows(undo); return false; }
    // Kind 'disposition' → ic_dispositions, NOT 'count' → ic_counts (S182): keeps it out of every
    // computeUsagePair usage reader while _perpetualInventory / countedStockAt still merge it.
    const ok = await App.putRecord('ic', 'disposition', record);
    if (!ok) App.restoreRows(undo);   // roll the assignment back if the disposition did not land
    return ok;
  },

  /* THE S133 DISPOSITION PROMPT, REBUILT 2026-08-15 (Kyle, looking at Back Bar and its 17 rows).
     ⛔ THIS IS THE SCREEN [[color-system-policing]] WAS WRITTEN ABOUT, AND IT NEVER GOT THE SWEEP.
     That rule was created 2026-07-30 over this exact modal: selects carrying an inline
     `padding:7px 9px` copied off `.form-input` with `class=""`, so every one rendered browser
     defaults, plus a hand-rolled table instead of the app's. Both were still shipped this morning.
     WHAT CHANGED, all of it his:
       · ONE control at the top, not one per row. 17 products meant up to 34 dropdowns on screen
         (each row can also carry a destination); it is now tick the rows, say what happened, Apply.
       · An answered row LEAVES the work list and joins a section for that answer, so the counts are
         visible and a wrong answer is one tick from being fixed. The Add Products review's shape.
       · The list scrolls inside a capped box, so the dialog does not grow with the shelf.
       · ONE button, left, and it is the JOB rather than a Confirm. No Cancel: the X already runs the
         identical abort, and buttons-left-primary-first-no-Cancel is the locked popup standard.
       · Every select sits in a `.f`, which is what gives it the `--input` fill and the soft-grey
         chevron. No new CSS: the app already had the look, this dialog was just not using it.
     ⛔⛔ NOTHING IS WRITTEN UNTIL THAT ONE BUTTON. Applying an answer only records it in memory.
     Writing per batch was the alternative and it breaks the guarantee this dialog has always made:
     abandon it half done and you would have stock booked off a shelf that still exists and was
     never archived, and `disposeShelfStock` writes ONE record per call, so four batches would book
     four dispositions where the books expect one. X still aborts with nothing done.
     ⚠ AND THE SILENT DEFAULT IS GONE. The archive path used to open with every row preset to
     "Still here", so Confirm alone carried the whole shelf forward. That value lands on the tax
     worksheets, which this dialog's own copy warns about, so it is now an answer the operator gives
     rather than one they fail to change. It costs one press: Select all, Still here, Apply. */
  promptShelfDisposition(fromLoc, stock, proceed, opts) {
    opts = opts || {};
    const untick = !!opts.untick;
    stock = (stock || []).filter(s => s && s.product_id && s.onHand > 0);
    if (!stock.length) { if (typeof proceed === 'function') proceed(); return; }
    const money = v => '$' + (Math.round((v || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const totalVal = stock.reduce((s, x) => s + (x.value || 0), 0);
    // Destinations: active shelves other than the one being retired. You cannot move stock onto the
    // shelf you are retiring, or onto one already archived.
    const dests = ((this.inventoryData && this.inventoryData.ic_locations) || [])
      .filter(l => l && l.name && !l.archived && l.name !== fromLoc).map(l => l.name);

    // Memory only, both of them. `answers` is each product's fate; `checked` is what Apply acts on.
    const answers = {}, checked = {};

    /* ⚠ "Still here" IS NOT OFFERED ON THE UNTICK PATH, and never was: the product is being taken
       OFF this shelf, so staying is a contradiction. `disposeShelfStock` writes nothing for 'stay'
       and the stock drops out of on-hand, while the copy promises it is carried forward. */
    const CHOICES = (untick ? [] : [{ v: 'stay', label: 'Still here, carry forward' }])
      .concat([{ v: 'used', label: 'Used / sold / tossed' }])
      .concat(dests.length ? [{ v: 'moved', label: 'Moved to another shelf' }] : []);
    // A moved row names WHERE, because "Moved to another shelf" on a row is not an answer.
    const labelFor = a => a.choice === 'moved' ? 'Moved to ' + a.destLoc
      : ((CHOICES.find(c => c.v === a.choice) || {}).label || a.choice);
    const actionLabel = untick ? 'Save Changes' : 'Archive ' + fromLoc;
    const plural = (k, one, many) => k + ' ' + (k === 1 ? one : many);

    const rowHtml = s => {
      const a = answers[s.product_id];
      return '<tr>'
        + '<td class="cb-left"><input type="checkbox" class="bc-check disp-cb" value="' + esc(s.product_id) + '"'
          + (checked[s.product_id] ? ' checked' : '') + '/></td>'
        + '<td>' + esc(s.name || 'Product') + '</td>'
        + '<td style="white-space:nowrap;">' + (Math.round(s.onHand * 100) / 100)
          + ' <span style="color:var(--t3);">(' + money(s.value) + ')</span></td>'
        + '<td>' + (a ? esc(labelFor(a)) : '<span style="color:var(--t3);">Not answered yet</span>') + '</td>'
        + '</tr>';
    };
    // ⚠ `container-type` is what lets the row-list stack on a narrow screen; without it the
    // @container rule that does the stacking never fires. Same reason the import review carries it.
    const section = (title, sub, rows, first) =>
      '<div class="card" style="padding:0!important;container-type:inline-size;margin-top:' + (first ? '0' : '12') + 'px;">'
      + '<div style="padding:12px 14px;">'
        + '<div style="font-size:13px;font-weight:700;color:var(--t1);">' + esc(title) + '</div>'
        + '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + esc(sub) + '</div></div>'
      + '<div style="padding:0 14px 12px;overflow-x:auto;">'
      + '<table class="row-list" style="table-layout:fixed;width:100%;">'
      + '<colgroup><col style="width:9%;"/><col style="width:37%;"/><col style="width:22%;"/><col style="width:32%;"/></colgroup>'
      + '<thead><tr><th></th><th>Product</th><th>On hand</th><th>What happened</th></tr></thead>'
      + '<tbody>' + rows.map(rowHtml).join('') + '</tbody></table></div></div>';

    const html = '<div class="card form-card">'
      + '<div class="card-title">What happened to the stock on ' + esc(fromLoc) + '?</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:14px;">'
      + esc(fromLoc) + ' still holds ' + money(totalVal) + ' of counted stock. Tell Bar Cop where it went so your books stay right. '
      + (untick
          ? 'You are taking ' + (stock.length > 1 ? 'these products' : 'it') + ' off ' + esc(fromLoc)
            + ', so ' + (stock.length > 1 ? 'they cannot' : 'it cannot') + ' stay here.'
          : 'Anything carried forward stays on your inventory value and is flagged on your tax worksheets until you count it again.')
      + '</div>'
      // The whole batch interaction, in one row: tick rows, say what happened, Apply.
      + '<div class="no-print" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px;">'
        /* ⛔ THE LABEL SAYS WHAT IT REACHES (Kyle, 2026-08-15). "Select all" beside a list that is
           part work and part already answered reads as "all of them", which is what it used to do
           and what he caught: answer five, tick Select all to sweep up the rest, and the five you
           had already filed came back with it. It only ever touches the work list now, and the
           words say so rather than leaving the operator to find out. */
        + '<label style="display:flex;align-items:center;gap:6px;margin:0;font-size:12px;color:var(--t2);cursor:pointer;white-space:nowrap;">'
        + '<input type="checkbox" class="bc-check" id="disp-all"/> <span id="disp-all-lbl">'
        + 'Select all still to answer</span></label>'
        + '<div class="f" style="max-width:215px;margin:0;flex:1 1 170px;"><select id="disp-choice">'
        + '<option value="">What happened...</option>'
        + CHOICES.map(c => '<option value="' + c.v + '">' + esc(c.label) + '</option>').join('')
        + '</select></div>'
        + (dests.length ? '<div class="f" id="disp-dest-wrap" style="max-width:190px;margin:0;display:none;"><select id="disp-dest">'
            + '<option value="">Pick a shelf...</option>'
            + dests.map(d => '<option value="' + esc(d) + '">' + esc(d) + '</option>').join('')
            + '</select></div>' : '')
        + '<button type="button" class="btn btn-primary btn-sm" id="disp-apply" disabled>Apply</button>'
      + '</div>'
      // ⚠ THE HEIGHT IS CAPPED, NOT FIXED (Kyle asked for a set height so the dialog does not grow
      // with the shelf). A hard height would leave a two-product shelf staring at an empty box; a
      // cap gives the same "never taller than this, then it scrolls" without the dead space.
      + '<div id="disp-body" style="max-height:380px;overflow-y:auto;"></div>'
      + '<div id="disp-err" style="display:none;color:var(--red);font-size:12px;margin-top:10px;"></div>'
      // ⛔ ONE BUTTON, LEFT. `.card-actions` is already flex with default left alignment, so the
      // old inline `justify-content:flex-end` was the only thing putting it on the right.
      + '<div class="card-actions"><button type="button" class="btn btn-primary" id="disp-go" disabled>'
      + esc(actionLabel) + '</button></div>'
      + '</div>';

    const cancel = () => { App.closeModal('shelf-disp'); if (typeof opts.onCancel === 'function') opts.onCancel(); };
    /* ⛔⛔ 780, NOT 660, AND IT IS THE TABLE THAT SETS IT (Kyle, 2026-08-15: *"why are they in mobile
       view?"*). `.row-list` stacks on a CONTAINER query, `@container (max-width:700px)`, measured
       against the card it sits in rather than the viewport, so that a sidebar can never push it
       into a sideways scroll. I brought that pattern over from the full-width Add Products review
       without asking what the container is worth INSIDE a modal: at 660 the section card measures
       630, which is under 700, so it stacked on every screen ever made.
       ⚠ MEASURED ON THE LIVE BUILD, not reasoned: 660 gives 630 and stacks · 720 gives 690 and
       still stacks · 780 gives 750 and lays out as a table, with 50px of headroom over the
       breakpoint. And the mobile behaviour the container query exists for is untouched, because a
       phone modal is viewport-width, not maxWidth: 375 gives a 313px card and still stacks.
       ⛔ SO THIS NUMBER IS TIED TO `@container (max-width:700px)` IN style.css. Retune that and this
       has to move with it, which is why `verify-shelf-disposition` X22 reads both and does the
       arithmetic rather than trusting either. */
    const overlay = App.openModal(html, { id: 'shelf-disp', maxWidth: 780, onClose: cancel });
    const bodyEl = overlay.querySelector('#disp-body');
    const choiceEl = overlay.querySelector('#disp-choice');
    const destWrap = overlay.querySelector('#disp-dest-wrap');
    const destEl = overlay.querySelector('#disp-dest');
    const allEl = overlay.querySelector('#disp-all');
    const allLbl = overlay.querySelector('#disp-all-lbl');
    const applyBtn = overlay.querySelector('#disp-apply');
    const goBtn = overlay.querySelector('#disp-go');
    const err = overlay.querySelector('#disp-err');

    const openRows = () => stock.filter(s => !answers[s.product_id]);
    const nChecked = () => stock.filter(s => checked[s.product_id]).length;

    /* The toolbar and the action live OUTSIDE the redrawn body on purpose: a redraw would otherwise
       reset the operator's half-made choice in the selector every time they ticked a row. */
    const syncControls = () => {
      const moved = choiceEl.value === 'moved';
      if (destWrap) destWrap.style.display = moved ? '' : 'none';
      const answerable = !!choiceEl.value && (!moved || !!(destEl && destEl.value));
      const k = nChecked();
      applyBtn.disabled = !(answerable && k > 0);
      applyBtn.textContent = k ? 'Apply to ' + k : 'Apply';
      const left = openRows().length;
      goBtn.disabled = left > 0;
      // The label says why it is disabled, so the operator never has to hunt for what is left.
      goBtn.textContent = left ? actionLabel + ' (' + left + ' to answer)' : actionLabel;
      /* ⚠ THE BOX READS THE WORK LIST, not the shelf. Comparing against every product meant it
         could never show as checked once anything had been filed, which is the same confusion from
         the other end. And with nothing left to answer there is nothing for it to reach, so it goes
         out of service rather than sitting there implying it would do something. */
      if (allEl) {
        const open = openRows();
        allEl.checked = open.length > 0 && open.every(s => checked[s.product_id]);
        allEl.disabled = open.length === 0;
        /* ⛔ AND THE WORDS GO WITH IT (Kyle, 2026-08-15). Greying the box out while it still read
           "Select all still to answer" left the label describing work that no longer exists, which
           is a control explaining itself wrong rather than a control that is merely off. */
        if (allLbl) allLbl.textContent = open.length ? 'Select all still to answer' : 'None left to select';
      }
    };

    const draw = () => {
      const open = openRows();
      const groups = {};
      stock.forEach(s => { const a = answers[s.product_id]; if (!a) return;
        const key = labelFor(a); (groups[key] = groups[key] || []).push(s); });
      let out = '', first = true;
      if (open.length) {
        out += section('Still to answer', plural(open.length, 'product', 'products') + ' left', open, first);
        first = false;
      }
      Object.keys(groups).forEach(key => {
        out += section(key, plural(groups[key].length, 'product', 'products'), groups[key], first);
        first = false;
      });
      bodyEl.innerHTML = out;
      syncControls();
    };

    // Delegated, because the body is rewritten on every change and per-row listeners would not survive.
    bodyEl.addEventListener('change', e => {
      const cb = e.target;
      if (!cb || !cb.classList || !cb.classList.contains('disp-cb')) return;
      if (cb.checked) checked[cb.value] = true; else delete checked[cb.value];
      syncControls();
    });
    /* ⛔⛔ IT REACHES THE WORK LIST ONLY. It used to walk every product on the shelf, so ticking it
       after filing a group pulled those rows back in and the next Apply would silently overwrite an
       answer the operator had already given, in a section they had stopped looking at. That is the
       same shape as the bulk control that once took a whole import ([[the-loop]]: a control that
       reaches past what the operator is working on is not thorough, it is invisible).
       ⚠ UNTICKING clears everything, including a row the operator ticked in a filed section to
       correct it. "None selected" has to mean none, or the next Apply carries a passenger. */
    if (allEl) allEl.addEventListener('change', () => {
      if (allEl.checked) openRows().forEach(s => { checked[s.product_id] = true; });
      else stock.forEach(s => { delete checked[s.product_id]; });
      draw();
    });
    choiceEl.addEventListener('change', syncControls);
    if (destEl) destEl.addEventListener('change', syncControls);

    applyBtn.addEventListener('click', () => {
      const choice = choiceEl.value;
      if (!choice) return;
      const destLoc = (choice === 'moved' && destEl) ? destEl.value : '';
      if (choice === 'moved' && !destLoc) return;
      // ⚠ The tick is dropped as the answer lands, so the next Apply cannot act on a row the
      // operator has already dealt with and stopped looking at.
      stock.forEach(s => {
        if (!checked[s.product_id]) return;
        answers[s.product_id] = { choice: choice, destLoc: destLoc };
        delete checked[s.product_id];
      });
      if (err) err.style.display = 'none';
      draw();
    });

    goBtn.addEventListener('click', async () => {
      if (openRows().length) return;   // the button is disabled, but never trust that alone
      /* ⛔ THE SAME PAYLOAD SHAPE THE PER-ROW VERSION BUILT, in the file's own order.
         `disposeShelfStock` is untouched by this rebuild, so the write, its rollback and the
         disposition record are exactly what they were. */
      const dispositions = stock.map(s => {
        const a = answers[s.product_id] || {};
        return { product_id: s.product_id, name: s.name, choice: a.choice, destLoc: a.destLoc || '',
                 onHand: s.onHand, unitCost: s.unitCost };
      });
      goBtn.disabled = true; goBtn.textContent = 'Saving...';
      const ok = await App.disposeShelfStock(fromLoc, dispositions);
      if (!ok) {
        goBtn.disabled = false; goBtn.textContent = actionLabel;
        if (err) { err.textContent = 'Could not save that. Check your connection and try again.'; err.style.display = 'block'; }
        return;
      }
      App.closeModal('shelf-disp');
      if (typeof proceed === 'function') proceed();
    });

    draw();
  },


  // ── Inventory value AS OF a date — the ONE door for the tax sheets ──────────
  // Schedule C COGS is `beginning + purchases - ending`, so a deflated ending figure
  // OVERSTATES COGS and understates taxable profit. Every tax sheet used to read a
  // single count's stored `total_value`, which is a flat sum over ALL of that count's
  // items — and `ic-take-inventory` gives a SKIPPED product total 0 and therefore
  // value 0. So one shelf the operator did not get to made the whole shelf read as
  // consumed, on Books, the Year-End Tax Helper and the Year End export at once.
  //
  // Kyle's call 2026-07-21: CARRY FORWARD + DISCLOSE. A skipped product keeps its last
  // counted value, so the bottle that is physically still on the shelf still counts —
  // and the sheet NAMES which products rest on an older count and when it was taken,
  // because carrying a value forward silently would be its own dishonesty.
  // Rejected: refusing to print a COGS figure at all on a partial count (one skipped
  // bottle would kill the whole sheet, and a bar that never counts perfectly would
  // never get a figure), and keeping the wrong math behind a warning stamp.
  //
  // Routed through _perpetualInventory deliberately — that reader ALREADY carries a
  // skipped product forward for the Inventory dashboard, so the tax sheets and the
  // dashboard now read the same shelf. Hand-rolling a second copy is exactly the
  // five-drifted-copies failure App.computeUsagePair was created to end.
  //
  // Returns { value, countDate, carried: [{id,name,date,value,onHand}], byProduct }.
  // `value` is null when no count exists on or before the date — an honest "cannot
  // say", never a $0 that reads as an empty shelf.
  inventoryValueAsOf(asOf, exclusive) {
    const counts = ((this.inventoryData && this.inventoryData.ic_counts) || [])
      .filter(c => c && c.date && (exclusive ? String(c.date) < asOf : String(c.date) <= asOf))
      .slice().sort(App.cmpNewest);
    const NO_FIGURE = { value: null, countDate: null, count: null, carried: [], byProduct: {} };
    const boundary = counts.length ? counts[0] : null;
    if (!boundary) return NO_FIGURE;
    const m = this._perpetualInventory(asOf, exclusive);
    // ⚠ A COUNT RECORD IS NOT A MEASUREMENT (S97). The boundary is picked from count RECORDS, so a
    // count whose items are ALL `counted:false` — with nothing earlier to carry forward — used to
    // give a truthy boundary, an empty map, and a value that summed to 0. That printed "$0.00" as
    // ending inventory: the skipped-is-not-zero failure surviving one line before the null that
    // exists to prevent it. Emptiness of the MAP is the right test, not a zero value: a count that
    // genuinely finds every shelf empty is a real measurement and must still report 0.
    if (!Object.keys(m).length) return NO_FIGURE;
    // ⚠ A STOCKTAKE IS OFTEN SEVERAL COUNTS (S93). A big place counts the bar one night, the
    // cooler the next and the store room the night after — that is ONE measurement of the shelf,
    // not three. Treating each count record as its own boundary made the sheet announce that two
    // thirds of the inventory "was not counted" when all of it had been, days apart, and buried
    // the COGS block under 80 rows of it. Counts within a week of the boundary are part of the
    // same stocktake; a figure older than that really is resting on an earlier measurement.
    // ⚠ Do NOT widen this to the reporting period. On an ANNUAL sheet that would call a product
    // last counted in May "current" against a stocktake dated 28 June — five weeks stale, exactly
    // the disclosure this whole mechanism exists to make. verify-partial-count-cogs case D pins it.
    const STOCKTAKE_DAYS = 7, DAY_MS = 24 * 60 * 60 * 1000;
    const bTime = new Date(boundary.date + 'T00:00:00').getTime();
    let stocktakeStart = boundary.date;
    counts.forEach(c => {
      const t = new Date(c.date + 'T00:00:00').getTime();
      // ⚠ CALENDAR DAYS, not raw milliseconds (S137). Two local midnights 7 calendar days apart span
      // 7*24h + 1h across the US DST fall-back (and 7*24h - 1h across spring-forward), so a fixed
      // 7*24*60*60*1000 window flipped the carried-forward disclosure on exactly those weeks. Round
      // the span to whole days so the window is 7 CALENDAR days everywhere.
      if (!isNaN(t) && Math.round((bTime - t) / DAY_MS) <= STOCKTAKE_DAYS && String(c.date) < stocktakeStart) stocktakeStart = String(c.date);
    });
    const prods = (this.inventoryData && this.inventoryData.ic_products) || [];
    const nameOf = (pid) => (prods.find(p => p && p.id === pid) || {}).name || '';
    let value = 0;
    const carried = [];
    Object.keys(m).forEach(pid => {
      const r = m[pid];
      value += (r.value || 0);
      // ⚠ Report the CARRIED PART, not the whole product (S92): a product counted at one shelf on
      // the boundary date and carried at another used to disclose its entire value as resting on
      // the older count. And "carried" now means the figure predates the WINDOW, not the boundary
      // count RECORD (S93) — the old rule flagged every product on a stocktake spread across two
      // or three days, which is ordinary practice, and told the accountant most of the inventory
      // had never been counted when all of it had.
      let cv = 0, cu = 0, oldest = null;
      Object.keys(r.byDate || {}).forEach(d => {
        if (!(d < stocktakeStart)) return;
        cv += r.byDate[d].value  || 0;
        cu += r.byDate[d].onHand || 0;
        if (!oldest || d < oldest) oldest = d;
      });
      if (cv || cu) {
        // A DELETED product is not in ic_products, so fall back to the name the count recorded
        // rather than printing "Unnamed product" next to a real dollar figure (S95).
        const live = prods.find(p => p && p.id === pid) || null;
        carried.push({ id: pid, name: (live && live.name) || r.name || '', date: oldest,
          value: Math.round(cv * 100) / 100, onHand: cu,
          // ⚠ FULL vs PARTIAL carry (S134/S135). `full` = the ENTIRE product rests on the old count
          // (nothing of it was counted inside the window). A product counted at one shelf on the
          // boundary and carried at another is PARTIAL: it WAS counted, so it must not be announced
          // as "not counted", and its Bottle Detail row must not claim the whole figure is carried —
          // only the carried PART (cv/cu above) is. The sheet phrases the two cases differently.
          full: cu >= (r.onHand || 0) - 0.001,
          // ⚠ HIDDEN FROM OPERATIONS is a different fact from NOT COUNTED, and the sheet has to
          // say which (S89). ic-take-inventory.products() drops an inactive product, so once
          // hidden it can NEVER appear in a count again and its figure can never be corrected or
          // zeroed — it just sits on Line 41. Reported as "was not counted on <date>" it read as
          // somebody forgetting, and sent the operator hunting for a bottle on a shelf no count
          // sheet will ever list. The FIGURE is deliberately still held (Kyle's S5 call, and the
          // order sheet's "flag it, don't change the math"); only the explanation changed.
          inactive: !!(live && live.active === false) });
      }
    });
    carried.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    // ⚠ UNCOSTED PRODUCTS (S136). A product on the shelf with NO unit cost recorded stores value:null
    // in its count (ic-take-inventory), which sums here as $0 — so real units print at $0.00 on
    // Schedule C Line 41, inside the category subtotal and the Bottle Detail, with none of the
    // carried/inactive machinery covering it (it is neither). Surface them so the sheet discloses the
    // gap instead of silently understating ending inventory. `unitCost == null` (never recorded) is
    // the test, NOT value 0 — a product genuinely priced at $0 has unitCost 0, not null.
    const carriedIdSet = new Set(carried.map(c => c.id));
    const uncosted = [];
    Object.keys(m).forEach(pid => {
      const r = m[pid];
      if (!((r.onHand || 0) > 0 && r.unitCost == null)) return;
      const live = prods.find(p => p && p.id === pid) || null;
      // ⚠ DISCLOSE EACH PRODUCT ONCE (round-N+1 scan). An uncosted product that is ALSO carried (last
      // counted before the window) or inactive is already surfaced by those notes — listing it here
      // too announced one product as TWO, and for an inactive one gave contradictory guidance ("can
      // no longer be counted" vs "enter its cost"). The carried/inactive note is the primary one.
      if (carriedIdSet.has(pid) || (live && live.active === false)) return;
      uncosted.push({ id: pid, name: (live && live.name) || r.name || '', onHand: r.onHand });
    });
    uncosted.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    // ⚠ RETURNS THE BOUNDARY RECORD ITSELF (S96). Callers used to re-derive "the latest count" with
    // their own date-only sort plus `.slice(-1)[0]`, which ties on two counts sharing a date and
    // hands back whichever sat last in the ARRAY — while this reader sorts with cmpNewest, which
    // tiebreaks on created_at. So the ending FIGURE came from one count and the Source footer named
    // the other, on a tax sheet's provenance line. One door, so they cannot disagree.
    return { value: Math.round(value * 100) / 100, countDate: boundary.date, count: boundary,
      carried, uncosted, byProduct: m };
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
        spot_check: 'ic_spot_checks', variance_run: 'ic_variance_runs',
        // Shelf-retirement stock dispositions (S182): dated records of what happened to a shelf's
        // stock when it was archived / unticked (used / moved). Stored APART from ic_counts on
        // PURPOSE — _perpetualInventory + countedStockAt merge them for on-hand and the as-of tax
        // value, but the computeUsagePair usage readers (weekly COGS, variance, dead-stock, cash
        // recovery) read ic_counts ONLY and must NEVER see a disposition: it is a PARTIAL record
        // (just the disposed products) and would collapse their newest-count-as-full-snapshot math.
        // Windowed (carries a date), same as a count.
        disposition: 'ic_dispositions',
        // Product master: row-per-record (data-safety migration 2026-07-19, so a bug
        // can only ever touch one product, never wipe the master list). No business
        // date -> NULL event date (NONWINDOWED_KINDS in db.js) so the whole product
        // list always loads in full. Locations/vendors/par+variance settings stay in
        // the ic_data config blob and still save via saveInventory (prep batches below).
        product: 'ic_products',
        // Prep batches (recipe sub-recipes): row-per-record (control-blob data-safety
        // migration). No business date -> NULL event date (NONWINDOWED_KINDS) so the whole
        // set always loads. Reads (menu cost roll-ups) unchanged; App.inventoryData.ic_prep_batches.
        prep_batch: 'ic_prep_batches',
        // Vendors (config): row-per-record, NONWINDOWED. Products reference a vendor by NAME
        // (p.vendor); a rename cascades to product rows (see ic-vendors saveVendor).
        vendor: 'ic_vendors',
        // Locations / shelves (config): row-per-record, NONWINDOWED. Count-sheet order is a
        // per-location `sort_order` (rows have no inherent array order), applied after load
        // in loadAllData. Products reference a location by NAME; rename/delete cascade to
        // product rows (see ic-locations). Still App.inventoryData.ic_locations for reads.
        location: 'ic_locations'
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
        safe_count: 'sc_safe_counts', incident: 'sc_incidents',
        briefing: 'sc_briefings',
        // Checklist TEMPLATES (reusable, config — distinct from the `checklist` RUNS above):
        // row-per-record (control-blob data-safety migration), NONWINDOWED so all load. The
        // sc_starter_seeded flag stays in the sc_data blob (still saved via saveShift).
        checklist_template: 'sc_checklist_templates',
        // Cash registers / drawers (config): row-per-record, NONWINDOWED. Carry pos_aliases
        // for POS cash-import matching. Still App.shiftData.sc_drawers for reads.
        drawer: 'sc_drawers'
      }
    },
    lc: {
      table: 'lc_events',
      data: () => App.laborData,
      kinds: {
        actual: 'lc_actuals', schedule: 'lc_schedules', tip: 'lc_tips',
        tip_pool: 'lc_tip_pools', callout: 'lc_callouts', pay_period: 'lc_pay_periods',
        time_off: 'lc_time_off',
        // Positions (job roles — config): row-per-record (control-blob data-safety
        // migration), NONWINDOWED so all load. Staff reference a position by position_id
        // (read-only; a deleted position leaves a dangling ref by design). The
        // lc_positions_seeded flag stays in the lc_data blob (saved via saveLabor).
        position: 'lc_positions',
        // Reusable schedule TEMPLATES (config — distinct from the `schedule` built-week RUNS
        // above): row-per-record, NONWINDOWED. Written from Build Schedule's Template Name box.
        schedule_template: 'lc_schedule_templates',
        // Staff certifications + coaching notes (config, keyed to a staff member by staff_id):
        // row-per-record, NONWINDOWED. Deleting a staff member removes its certs/notes by
        // staff_id (see lc-staff-roster confirmDel).
        cert: 'lc_certs',
        staff_note: 'lc_staff_notes',
        // Staff roster (config, referenced everywhere by staff_id): row-per-record,
        // NONWINDOWED. wage_history is a sub-array on each staff record (a wage edit rewrites
        // the whole staff row). Deleting a staff member also removes its certs/notes (above).
        staff: 'lc_staff'
      }
    },
    // Core / Recovery (Profit pass): unbounded recovery logs live row-per-record
    // in core_events. Config (settings, targets, getting-started, fix_progress,
    // vestigial shifts/vendor_log/reconciliations) stays in the user_data blob.
    // The entered-data lists (products/menu/permits/expenses, the Events rate
    // cards / regulars / calendar, the experiment initiatives, and the fix
    // activity feed) are all row-per-record now (data-safety migration).
    core: {
      table: 'core_events',
      data: () => App.data,
      kinds: {
        week: 'weeks',
        /* ⛔ `variance_investigation: 'variance_investigations'` WENT WITH LOSS PREVENTION
           (2026-08-24), and unregistering the kind is what actually drops the store: it stops
           loading at login, `putRecord` has nowhere to land, and `_configBlob` has no such array to
           strip, so `App.data.variance_investigations` simply never exists. Same mechanism as the
           `cash_outflow` removal documented below. */
        sales_review: 'sales_reviews',
        vendor_discrepancy: 'vendor_discrepancies', audit: 'audits', cash_audit: 'cash_audits',
        /* ⛔ `cash_outflow: 'cash_outflows'` WAS REMOVED HERE (build order E). Unregistering the kind
           is what actually drops the store: it stops loading at login, `putRecord('core',
           'cash_outflow', …)` has nowhere to land, and `_configBlob` has no such array to strip —
           `App.data.cash_outflows` simply never exists. Every dollar out is an `operating_expense`
           row now, stamped `migrated_from: 'cash_outflow'` so the cash engine can still tell a draw
           from a bill. The WORD survives as that stamp; the STORE does not.
           ⚠ The rows already written under this kind are left on the server, untouched and unread.
           The first RESTORE clears them for good, because seedEventStores clears the table and then
           reseeds only registered kinds — harmless, because their money is in the ledger, but worth
           knowing rather than discovering. */
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
        // Hub — executive monthly audit history.
        bar_cop_audit: 'bar_cop_audits',
        // Permits/licenses: row-per-record (data-safety migration 2026-07-19, so a bug
        // can only ever touch one permit, never wipe the set). Stored with a NULL event
        // date (NONWINDOWED_KINDS in db.js) so the 24-month window never drops one — the
        // renewal date lives in the payload, read/sorted client-side. (operating_expenses
        // is the next array to move the same way; until then it stays in the blob.)
        permit: 'permits_compliance',
        // Menu items: row-per-record (data-safety migration). No business date -> NULL
        // event date (NONWINDOWED_KINDS) so the whole menu always loads in full.
        menu_item: 'menu_items',
        // Operating expenses: row-per-record (data-safety migration). NULL event date
        // (NONWINDOWED_KINDS) so every logged bill loads regardless of the 24-month
        // window — the bill's own date lives in the payload, read/summed by period.
        operating_expense: 'operating_expenses',
        // Events section entered-data lists — rate-card packages, the regulars book,
        // and the manually-added planning calendar dates. Row-per-record so a bug can
        // only ever touch one record, never wipe the list (data-safety migration).
        // All NONWINDOWED (date:null) so they always load in full.
        event_rate_card: 'event_rate_cards',
        event_regular: 'event_regulars',
        event_calendar_entry: 'event_calendar',
        /* ⛔ THE THREE EXPERIMENT STORES WENT WITH EXPERIMENTS (2026-08-24): `profit_initiatives`,
           bare `initiatives` (Revenue, the back-compat spelling) and `cash_initiatives`.
           ⚠ THREE, NOT ONE, AND THE PLAN SAID ONE. `initiative-tracker.js` declared all three as
           separate `dataKey`s — that is what its header meant by "multi-instance" — so a delete list
           written from the Profit store alone would have left two live stores with no reader, two
           seeds writing into them, and two Week in Review recap lines counting them
           ([[lessons-paid-for]] #111: the plan names what dies, only a reader sweep names what
           breaks). Unregistering the kind is what drops each store, same as above. */
        // Fix System activity feed (row-per-record, NONWINDOWED). fix_progress (the
        // per-gap checkbox map) stays in the blob; only the append-only feed moves.
        fix_activity: 'fix_activity',
        // The LAST week-scoped entered-data array still living in the config blob. Migrated for
        // the same reason as the other 21: a whole-blob rewrite could drop the operator's entire
        // set of weekly revenue forecasts in one write. Row-per-record makes that impossible.
        revenue_forecast: 'revenue_forecasts'
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
    // Snapshot each array's BLOB copy before the row-load overwrites it, so a newly
    // MIGRATED array (its rows not written yet) is backfilled from the blob instead of
    // being discarded (loadEvents returns [] until its rows exist). See the migration plan.
    const blobCopy = {}; kinds.forEach(k => { const arr = store.kinds[k]; blobCopy[arr] = Array.isArray(dataObj[arr]) ? dataObj[arr].slice() : []; });
    // Per-kind "this array already lives in rows" marker. Lives in the CORE config blob as a
    // plain object (so _configBlob never strips it) and covers every module's kinds, since kind
    // names are unique account-wide. Mutated in memory here; loadAllData persists it once at the
    // end, after every store has loaded (persisting mid-load would hit the total-wipe backstop,
    // because the core arrays aren't filled yet when the ic/lc/sc passes run).
    if (!this.data.migrated_kinds || typeof this.data.migrated_kinds !== 'object') this.data.migrated_kinds = {};
    const migrated = this.data.migrated_kinds;
    const migratedBefore = Object.assign({}, migrated);
    const results = await Promise.all(kinds.map(k => DB.loadEvents(store.table, k)));
    for (let i = 0; i < kinds.length; i++) {
      const k = kinds[i], arr = store.kinds[k], rows = results[i] || [], prior = blobCopy[arr];
      // Only a SERVER-CONFIRMED read may set the permanent marker. Rows served from the offline
      // cache are indistinguishable from real ones, so marking a kind migrated off a stale or
      // partial cache would strip the blob backup for records the cache never held — silent,
      // permanent loss on exactly the flaky-connection login where it matters most.
      // A cache-served or truncated read means this login did NOT see the whole account. Record it
      // once, globally, so _maybeAutoBackup can refuse to capture a partial picture. Checked
      // before the length test so an EMPTY cached result counts too — that is the same failure.
      if (rows._fromCache) DB._loadDegraded = true;
      if (rows.length) { dataObj[arr] = rows; if (!rows._fromCache) migrated[k] = true; continue; }   // rows exist: already row-per-record
      // No rows. That is AMBIGUOUS on its own — it means either "this array has never been
      // migrated" or "the operator deleted every record". The marker below is what tells them
      // apart. Without it, emptying a list (all your permits expired, you cleared the calendar)
      // let the STALE blob copy back-fill itself on the very next login, resurrecting records
      // the operator deliberately deleted — and re-persisting them as rows so they stuck.
      if (prior.length && !migratedBefore[k]) {                         // never migrated: one-time backfill
        const r = await DB.putEventsBulk(store.table, k, prior);
        dataObj[arr] = prior;                                           // keep the data either way — never lose it
        if (r && r.ok) migrated[k] = true;
        else {
          DB._backfillPending[k] = true;                                // rows not CONFIRMED on the server (failed OR merely queued offline): keep the array in the blob too (see _configBlob) until a real server write confirms them, so a never-draining queue can't orphan the only copy
          // A stuck backfill means this account's data is living only in the blob backup. It is
          // safe, but it is not yet where the app expects it, and nothing else would ever say so.
          // Guarded: this runs during BOOT, and a reporter that throws here would stop the app
          // from loading — an observability call must never be able to do that.
          try { DB.logClientError && DB.logClientError('backfill_failed', 'Blob-to-rows backfill not confirmed', 'kind=' + k + ' records=' + prior.length); } catch (e) {}
        }
      } else {
        dataObj[arr] = [];                                              // genuinely empty (new account, or deleted to empty post-migration)
        if (migratedBefore[k]) migrated[k] = true;                      // stay migrated: an empty migrated array must never fall back to the blob
      }
    }
    this.resetListState(mod);
  },

  // Append an older page of one kind ("Show older"). Returns the fetched rows.
  async loadOlder(mod, kind, cursor, limit) {
    const store = this.EVENT_STORES[mod];
    if (!store) return [];
    const dataObj = store.data();
    const key = store && store.kinds[kind];
    if (!dataObj || !key) return [];
    // cursor may be a {date,id} keyset or a bare date string (back-compat).
    const beforeDate = (cursor && typeof cursor === 'object') ? cursor.date : cursor;
    const beforeId   = (cursor && typeof cursor === 'object') ? cursor.id : null;
    const older = await DB.loadEvents(store.table, kind, { before: beforeDate, beforeId: beforeId, limit: limit || 200 });
    if (!Array.isArray(dataObj[key])) dataObj[key] = [];
    const seen = new Set(dataObj[key].map(r => r && r.id));
    older.forEach(r => { if (r && !seen.has(r.id)) dataObj[key].push(r); });
    return older;
  },

  // Seed a module's event rows from the current in-memory arrays (sample data).
  // Clears existing rows first so a reload replaces rather than accumulates.
  // Returns { ok } so loadSample can tell the operator if a persist failed rather
  // than reloading into half-written data (the class that lost logged hours: a
  // transient write failure was logged and silently swallowed).
  async seedEventStores(mod) {
    const store = this.EVENT_STORES[mod];
    if (!store) return { ok: true };
    const dataObj = store.data();
    if (!dataObj) return { ok: true };
    // A restore/seed REPLACES, so a failed clear must write NOTHING. putEventsBulk upserts on
    // (account_id, kind, id): records the operator created AFTER the backup carry DIFFERENT ids,
    // so they survive a failed clear and coexist with the restored rows, and loadEventStores
    // treats rows as authoritative on the next boot — the account comes back as the UNION of the
    // backup and the very data they were rolling back, under a "Backup restored" message. This
    // result was being discarded while `ok` tracked only putEventsBulk, so the whole path
    // reported success. Reporting the failure having written nothing is recoverable; a silent
    // merge is not.
    // ⚠ RETRY THE CLEAR, exactly as the write below is retried (S11). Two reasons, and the second
    // is the one that loses data. First, the retry loop below exists because "a transient hiccup
    // must not clear the rows and leave nothing written" — and the step that CLEARS THE ROWS had
    // no such protection, so one blip abandoned the seed. Second, `clearEvents`' own catch
    // (db.js) fires on a NETWORK throw, which includes the DELETE reaching Supabase and
    // COMMITTING while the response is lost: the client reports failure, the rows are already
    // gone server-side, and returning here writes nothing back. The module's data is then lost.
    // A DELETE scoped to account_id is IDEMPOTENT — deleting already-deleted rows succeeds and
    // removes nothing — so a retry is safe and resolves that ambiguity: once one returns ok, the
    // end state is known-cleared and seeding can proceed.
    // ⚠ A PERSISTENT failure must still write NOTHING. Clearing and then failing to seed is the
    // exact data-loss shape this guard exists to prevent, so the give-up path is unchanged.
    let cleared = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      cleared = await DB.clearEvents(store.table);
      if (!cleared || cleared.ok !== false) break;
      console.error('seedEventStores ' + mod + ': clearEvents attempt ' + attempt + ' failed', cleared.error);
      if (attempt < 3) await new Promise(r => setTimeout(r, 500));
    }
    if (cleared && cleared.ok === false) {
      console.error('seedEventStores ' + mod + ': clearEvents failed, writing nothing', cleared.error);
      return { ok: false };
    }
    let ok = true;
    for (const kind of Object.keys(store.kinds)) {
      const recs = dataObj[store.kinds[kind]] || [];
      // Defensive: an event row with no id is silently dropped by putEventsBulk
      // (this is what lost the audits on reload). Assign one in place so
      // the in-memory record and the seeded row stay in sync.
      recs.forEach(r => { if (r && r.id == null) r.id = this.uid(); });
      if (!recs.length) continue;
      // Retry a failed persist a couple times so a transient hiccup (DO/Supabase
      // flakiness) does not clear the rows and leave nothing written.
      let res = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        res = await DB.putEventsBulk(store.table, kind, recs);
        if (!res || res.ok !== false) break;
        console.error('seedEventStores ' + mod + '/' + kind + ' attempt ' + attempt + ' failed', res.error);
        if (attempt < 3) await new Promise(r => setTimeout(r, 500));
      }
      if (res && res.ok === false) ok = false;
    }
    return { ok };
  },

  // Add or update one event record: updates the in-memory array AND persists one
  // row. True if saved or safely queued offline; reverts + false on hard failure
  // (viewer / no account).
  // One audit record per day: if today already holds an audit of this kind, reuse
  // its id so putRecord replaces it in place (the last run of the day wins, so
  // the history stays one clean row per day). arr is the live list
  // (App.data.audits / revenue_audits / cash_audits / bar_cop_audits).
  dedupeAuditToday(arr, record) {
    if (!record) return record;
    const rd = String(record.date || '').slice(0, 10) || this.todayLocal();
    const existing = (arr || []).find(a => a && String(a.date || '').slice(0, 10) === rd);
    if (existing && existing.id != null) record.id = existing.id;
    return record;
  },

  // ── Write-failure reporting: ONE door for every row write ───────────────────
  // 105 of the 239 call sites discarded the result of putRecord / putRecordsBulk /
  // removeRecord. Nothing is corrupted when a write fails — putRecord REVERTS the row — but
  // the record then silently DISAPPEARS on the next render with no explanation, which is its
  // own kind of lie. Reporting here covers every site at once and leaves all three return
  // values untouched, so the 134 callers that DO check keep working exactly as before.
  //
  // ⚠ THE SILENCE MATTERS MORE THAN THE MESSAGE. Three results look like failures and are not:
  //   • offline / queued (and not storageFull) — it IS on disk and it WILL sync. The offline
  //     pill already says so; a red "not saved" here would be a lie that teaches operators to
  //     distrust every save they make.
  //   • deferred — a save that fired before the initial load finished. Deliberately dropped;
  //     the next real edit saves normally (see DB.writeData).
  //   • blocked — the total-wipe backstop caught an all-empty write over a populated account.
  //     The data was PROTECTED and ops is already alerted. "Save failed" is exactly backwards.
  // Returns null to stay quiet, else { msg, ownedBy } — `ownedBy` naming a PERSISTENT banner that
  // already reports this failure and says it better than a 6-second toast can. Pure: the DOM check
  // lives in _reportWriteFail so this stays testable on its own.
  //
  // ⚠ TWO FAILURES ALREADY OWN A BANNER, and stacking on them is worse than silence:
  //   • storageFull — DB._lsSafeSet fires App._showStorageFullBanner, a full-width bar at the SAME
  //     z-index as this toast carrying the load-bearing line "write it down before you leave this
  //     page". Being later in the DOM, the toast painted straight over that instruction and
  //     offered a different remedy underneath it.
  //   • viewer — App._showViewerBanner keeps "Viewer access, read-only" up for the whole session.
  //     ⚠⚠ THE `viewer` ROLE IS NOT REACHABLE FROM THE PRODUCT AND MAY NEVER BE. Verified
  //     2026-07-21: the invite form offers Staff/Admin only (hub-user-accounts.js:144), the
  //     change-role dropdown offers Admin/Staff only (:475-476), the server hard-clamps to
  //     `validRoles = ['admin','staff']` (server/index.js:1407), the memberships default is
  //     'staff', and the per-area access grid is TWO options — No Access / Full Access
  //     (hub-user-accounts.js:173-174). "View Only" was deliberately REMOVED from the product
  //     because it kept causing problems. The only way into this state is editing the
  //     memberships table by hand in Supabase.
  //     KEPT ON PURPOSE, not because anything needs it: db.js still enforces read-only on the
  //     role at every write, so if the tier is ever offered again the enforcement and this
  //     message are already correct. Treat it as dormant, not as evidence the feature exists —
  //     do not build anything on top of it, and do not "fix" a bug reported against it without
  //     first checking whether a real person can reach it.
  // Each still falls through to a toast if its banner is somehow not up, so nothing goes unsaid.
  _writeFailMsg(r) {
    const generic = { msg: 'Not saved. Check your connection and try again.', ownedBy: '' };
    if (!r) return generic;
    if (r.ok || r.deferred || r.blocked) return null;
    if ((r.offline || r.queued) && !r.storageFull) return null;
    // S195: the config-blob pre-load gate, refused AFTER the load finished — distinct from `deferred`
    // (the harmless mid-load race above). The gate stays shut for the session, so this settings change
    // was dropped and reloading is the only route back to a saving app.
    if (r.configGate) return { msg: 'Settings were not saved — Bar Cop has not loaded this account on this device yet. Reconnect, reload, and try again.', ownedBy: '' };
    if (r.storageFull) return { msg: 'Out of space on this device. Nothing was saved — free up some space and try again.', ownedBy: 'storage-full-banner' };
    const err = String((r.error && r.error.message) || r.error || '');
    if (/read-only|viewer/i.test(err)) return { msg: 'Your access is view-only, so nothing was saved.', ownedBy: 'viewer-banner' };
    // ⚠ A MEMBERSHIP FAILURE IS NOT A CONNECTION PROBLEM (S167). db.js returns this when the write
    // reaches the server but the user has no membership row for the active account (removed from a
    // bar, an account switch that did not settle). "Check your connection" sends the operator after
    // something no connection can fix — the same wrong-diagnosis class as the S10 banner. Reloading
    // re-resolves the account, which is the actual remedy.
    if (/account membership|no account/i.test(err)) return { msg: 'Your account access could not be confirmed, so nothing was saved. Reload Bar Cop and try again.', ownedBy: '' };
    return generic;
  },
  // Show a write failure once. COALESCED on purpose: a bulk write, or a burst of row writes from
  // one handler, must leave ONE message on screen rather than a wall of them. Wrapped so a broken
  // reporter can never break the save path itself.
  _reportWriteFail(r) {
    try {
      const f = this._writeFailMsg(r);
      if (!f) return;
      if (f.ownedBy && document.getElementById(f.ownedBy)) return;   // a banner already says it
      const ID = 'write-fail-toast';
      const prior = document.getElementById(ID);
      if (prior) prior.remove();
      const el = document.createElement('div');
      el.id = ID;
      // Sits BELOW the top bars on purpose. At top:10px it shared exact coordinates with the
      // offline pill and the "Synced N offline changes" toast, and overlapped every full-width
      // banner (storage-full, viewer, session-expired).
      // ⚠ OFF --navh, NOT A HARDCODED 52px (S31, my own-goal from that move). style.css declares
      // `--navh: 118px` as "row1 52 + row2 66", so 52px is the SEAM between the two nav rows: on
      // desktop the toast painted over the section-pill row. Deriving it from the variable also
      // follows the nav collapsing to one row on mobile, where 52px happened to be correct.
      // ⚠ pointer-events:none because this is purely informational. Without it the toast sat over
      // live controls and swallowed every click there for the full 6 seconds, and no amount of
      // repositioning makes an unclickable overlay safe on a screen it does not own.
      el.style.cssText = 'position:fixed;top:calc(var(--navh) + 10px);left:50%;transform:translateX(-50%);z-index:9600;pointer-events:none;'
        + 'background:var(--red);color:var(--w);border-radius:3px;padding:8px 18px;max-width:92vw;'
        + 'font-size:11px;font-weight:800;letter-spacing:.5px;box-shadow:0 2px 10px rgba(0,0,0,0.5);';
      el.textContent = f.msg;
      document.body.appendChild(el);
      clearTimeout(this._writeFailTimer);
      this._writeFailTimer = setTimeout(() => {
        const n = document.getElementById(ID);
        if (n) n.remove();
      }, 6000);
    } catch (e) { /* never let the reporter break a save */ }
  },
  _writeFailTimer: null,
  // Take the write-failure toast down (S3). It was body-level with nothing but a 6s timer holding
  // it, so a failed save followed by Sign Out left a red failure message floating over the login
  // card of the account they had just left — and on any navigation it named a row that was no
  // longer on the page, so it could not be acted on. Called from the two ++this._mountSeq sites
  // (the app's canonical "a new screen is going up" signal) and from showAuth, which is a view
  // switch that routes through neither. The pending timer is cleared too: left alive it would fire
  // over whatever screen came next and delete a toast that belongs to it.
  _dismissWriteFail() {
    try {
      clearTimeout(this._writeFailTimer);
      this._writeFailTimer = null;
      const n = document.getElementById('write-fail-toast');
      if (n) n.remove();
    } catch (e) { /* never let the dismisser break a navigation */ }
  },

  // ── Undo for an in-place BULK mutation ─────────────────────────────────────
  // putRecordsBulk cannot revert a failed write the way putRecord does: by contract the caller has
  // ALREADY mutated the records in place, so the pre-change values are gone before it is called.
  // Unchecked, that means a failed bulk write keeps the change on screen, never gets it to the
  // server, never retries, and loses it on the next reload — a pay period reading Closed while the
  // server has it Open (and payroll export reads the screen), a menu price the register never gets.
  // Snapshot BEFORE mutating, restore if the write comes back false:
  //   const undo = App.snapshotRows(rows);
  //   rows.forEach(r => { ...mutate... });
  //   if (!(await App.putRecordsBulk(mod, kind, rows))) App.restoreRows(undo);
  // DEEP copies on purpose — several callers mutate nested values (pos_aliases, participants,
  // location_sequences) and a shallow copy would share them and restore nothing.
  snapshotRows(rows) {
    return (rows || []).filter(Boolean).map(row => {
      let copy;
      try { copy = JSON.parse(JSON.stringify(row)); } catch (e) { copy = Object.assign({}, row); }
      return { row, copy };
    });
  },
  restoreRows(snap) {
    (snap || []).forEach(s => {
      if (!s || !s.row || !s.copy) return;
      // Delete keys the mutation ADDED (pay_period_id on a close), then put the rest back. The
      // live object is restored in place, never replaced, so every holder of the reference sees it.
      Object.keys(s.row).forEach(k => { if (!(k in s.copy)) delete s.row[k]; });
      Object.assign(s.row, s.copy);
    });
  },
  // The other half: records APPENDED to a live list that never reached the server. There is nothing
  // to restore them to, so take them back out.
  dropRows(list, recs) {
    if (!Array.isArray(list)) return;
    const ids = new Set((recs || []).map(r => r && r.id).filter(x => x != null));
    if (!ids.size) return;
    for (let i = list.length - 1; i >= 0; i--) if (list[i] && ids.has(list[i].id)) list.splice(i, 1);
  },

  // ── "Is this the same bill?" — ONE definition, because two systems have to agree ──────────────
  // A recurring bill exists in two shapes at once: the rows Bar Cop GENERATES for each elapsed
  // month, and whatever the operator logs themselves (by hand, or off a bank register through the
  // expense importer). Both the Operating Expenses catch-up and CashEngine's forecast have to answer
  // "has this month already been paid for?", and they were answering it differently: each recognised
  // only its own generated children, so a bill the operator logged themselves counted TWICE — the
  // month read double on the books AND a second copy was projected into the cash forecast.
  // Identity is category + vendor + amount, deliberately WITHOUT the day: a bill entered off a bank
  // statement lands on the day it cleared, not the day the series says it is due.
  // ⚠⚠ WHAT THIS DOES **NOT** REACH, MEASURED, because an earlier version of this comment claimed
  // it did: a row that arrives through the EXPENSE IMPORTER off a bank register does not match. The
  // importer stores the raw bank description as the vendor ("LANDLORD LLC RENT") and falls back to
  // the category "Other" when the file's own column does not match one of ours — so on a real Chase
  // header row NEITHER half of the identity agrees with the recurring bill it is paying, and the
  // month still books twice. Suppression is deliberately strict because it changes a number; the
  // importer case is caught by the WARNING instead (hub-operating-expenses._doubleBookedThisMonth,
  // which also matches on amount alone), and that is a sentence, not a silent adjustment.
  // Also asymmetric on purpose-of-note: vendor is case- and space-normalised, category is not,
  // because category is chosen from a fixed list at every hand-entry door.
  // ⚠ The amount is part of it on purpose. Two payments to one vendor in one month are ordinary in a
  // bar (two ice runs, two kegs); two payments of the IDENTICAL amount, in the same category, in the
  // month a recurring bill of exactly that amount falls due, is the same bill entered twice. Where
  // the amount differs, nothing is suppressed and both are counted — see the pins in
  // verify-opex-recurring.js, which assert BOTH directions.
  // ⚠ TWO RECORD SHAPES, ONE KEY. An operating expense carries category + vendor; a CASH OUTFLOW
  // (owner draw, loan payment, tax remittance) carries neither — it has a `type`. Falling back to
  // `type` keeps a $4,000 draw and a $4,000 loan payment distinct, which a bare category|vendor key
  // would have collapsed into one. Both stores ask the same question of the same forecast, so they
  // get the same answer from the same place rather than a second copy that drifts (S228a).
  billIdentityKey(r) {
    if (!r) return '';
    /* ⚠⚠ AN OUTFLOW'S NAME LIVES IN ITS NOTE (round 3, F1). Expenses discriminate on vendor; cash
       outflows have none, and there are only five type values, so type|amount collapsed the whole
       keyspace: two financed pieces of equipment at the same monthly payment, or a regular draw plus
       an extra draw of the same size, cancelled each other and HALF the outflow vanished from the
       13-week forecast and the Cash Bridge — a report of money that has already left the bank.
       Measured $1,850 against a truth of $3,700. The note is what the operator types to tell them
       apart ("Equipment loan" vs "SBA loan"), so it is the discriminator.
       ⚠ App.parseNum, not parseFloat: this key decides whether money is suppressed, and parseFloat
       reads "4,200.00" as 4. Nothing writes a formatted string today; the key should not be the
       place that assumption is load-bearing. */
    /* ⚠⚠ THE NOTES FALLBACK IS FOR OUTFLOWS ONLY, AND IT LEAKED (round 4). An expense carries a
       VENDOR; a cash outflow has none and carries a note instead. Written as a bare
       vendor-or-notes fallback it also changed EXPENSES: Vendor is optional on the add form, and
       the importer writes the file's Memo column into notes — so a QuickBooks Desktop import
       (vendor unmapped, notes populated) stopped matching the operator's own logged payment of the
       same bill and the month booked TWICE. Measured $8,400 against a truth of $4,200.
       An expense always has a category; an outflow always has a type and never a category. */
    /* ⚠⚠ AN EMPTY DISCRIMINATOR MUST NOT MATCH ANOTHER EMPTY ONE (round 5). The note is OPTIONAL on
       the cash-outflow form, so two separate equipment loans at the same payment both keyed
       type|""|amount and cancelled each other: measured, a forecast charging $1,850 against a truth
       of $3,700, and $3,700 against $5,550 with three of them. That is round 3's collapsed-keyspace
       defect coming back through the empty-string door.
       Falling back to the record's own id makes a nameless row match ONLY itself — so nothing is
       suppressed, which over-projects rather than under-projects. Money that might not leave the
       bank is the safe way to be wrong here. */
    /* ⚠⚠⚠ AND THE CUTOVER BROKE THE DISCRIMINATOR ITSELF, BECAUSE A LEDGER TWIN HAS BOTH (2026-08-05).
       The test was "no category AND a type" — true of a cash outflow in its own store, and FALSE of
       the same outflow once it lives in the ledger, where `migrateCashOutflowRow` gives it a
       category. So at the flip every cash row silently switched from the notes branch to the vendor
       branch, and the twin keys `Owner Draw|#id|400000` where its source keyed `draw|march draw|400000`.
       Nothing matched its own history any more: a payment the operator had logged themselves stopped
       suppressing the projected occurrence, and the month was charged twice. Measured $3,700 against
       a truth of $1,850 — the identical figure round 3 of this same function was written to fix.
       `migrated_from` is the mark the mapping always stamps and nothing else writes, so a twin keys
       EXACTLY as the outflow it came from, which is what makes the cutover invisible. */
    const isCash = r.migrated_from === 'cash_outflow' || (!r.category && !!r.type);
    const raw = isCash ? String(r.notes || '') : String(r.vendor || '');
    const who = raw.trim() ? raw.trim().toLowerCase() : ('#' + String(r.id || ''));
    return String(isCash ? (r.type || '') : (r.category || r.type || '')) + '|' + who
      // ⚠ `this.parseNum`, NOT `App.parseNum` — same reason windowCutoff uses `this.ymdLocal`.
      // A helper lifted out of this file for a harness has no `App` in scope, so an absolute
      // reference throws the moment the lift is exercised. It broke 38 harnesses in one run.
      + '|' + Math.round((this.parseNum(r.amount) || 0) * 100);
  },

  // `opts.quiet` suppresses the failure toast for an UNATTENDED write — one fired by a render or a
  // background resync rather than by something the operator just did. Reporting those pops a red
  // message over a page they merely opened, having done nothing. It never changes the return value,
  // and it never suppresses anything for an operator-initiated save.
  async putRecord(mod, kind, rec, opts) {
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
    // Saved, offline, or safely queued for replay (a dropped connection with
    // navigator.onLine still true) — keep the row in the list; it will sync.
    // Only a genuine rejection (viewer read-only) falls through to the revert.
    // storageFull is NOT safely queued: localStorage refused the write even after evicting the
    // disposable caches, so nothing is on disk and nothing will sync. Revert and report failure
    // rather than showing a save that silently disappears on the next reload.
    if (r.ok || ((r.offline || r.queued) && !r.storageFull)) return true;
    const back = arr.findIndex(x => x && x.id === rec.id);
    // ⚠ THE LIMIT OF THIS REVERT, and it is load-bearing — read it before assuming you are covered.
    // It restores the ARRAY SLOT. It can only undo your change if you handed us a DIFFERENT object
    // than the one already in the list. The very common shape
    //     const it = list.find(i => i.id === id);  it.price = np;  await App.putRecord(..., it);
    // makes `prev` and `rec` THE SAME OBJECT, so this line assigns it to itself and undoes NOTHING —
    // and putRecord cannot fix that from in here, because the mutation happened before it was
    // called and the old values are already gone. A same-object caller MUST snapshot for itself:
    //     const undo = App.snapshotRows([it]);  it.price = np;
    //     if (!(await App.putRecord(...))) App.restoreRows(undo);
    // (see App.snapshotRows). r-menu-engineering's four price doors were rebuilt this way on
    // 2026-07-21 after a rejected save left the new price on screen all session while the server
    // kept the old one.
    if (prev) { if (back >= 0) arr[back] = prev; }
    else if (back >= 0) arr.splice(back, 1);
    if (!(opts && opts.quiet)) this._reportWriteFail(r);   // the row just vanished from the screen — say why
    return false;
  },

  // Persist many event rows of one kind in a SINGLE request (one round-trip
  // instead of N). The caller is expected to have already updated the in-memory
  // records in place — this only writes them. Used where a batch changes at once
  // (close / reopen a pay period locks or unlocks a whole week of logged hours);
  // turns a 5-10s per-row loop into one bulk upsert.
  /* ── PARTIAL-SAVE HONESTY, shared by every per-row importer ───────────────────────────────────
     PosIngest's committers walk their rows ONE AT A TIME, do not stop at the first refusal, and
     AND a single boolean. So `false` means "at least one row was refused", never "nothing was
     written" — and reported flat as "Save failed" it reads as "nothing happened" over records that
     are already feeding Where You Stand, Confirm the Week, the cash-forecast baseline, the tax hold
     and the loss screens. The operator's natural next move is to enter them all again by hand.
     These live on App because FIVE import doors need them (sales, cash, per-server, voids, and the
     two labour doors). Three of them had already drifted into three different wordings of the same
     lie before this was extracted; that is what a copy-per-door buys.
     ⚠ IDENTITY, NOT ID. Sales and cash REUSE the prior record's id when they replace a row, so the
     id is already in the array before the write and an id test would call every row landed.
     putRecord assigns the exact object on success and puts the PREVIOUS object back (or splices it
     out) on a genuine refusal, so "is this exact object in the list" is the honest question. */
  landedOf(list, arr) {
    const live = (arr || []);
    return (list || []).filter(r => live.indexOf(r) !== -1).length;
  },
  /* THREE STATES, NOT TWO.
     `landed === total` is REACHABLE and must not read as a partial save: _commitSales and
     _commitCashRows fold the STALE-ROW RETIREMENT into the same `ok` they return, so when every
     insert lands and only a `removeRecord` is refused, the write succeeded completely and the real
     problem is a superseded row that could not be deleted — the date now holds two rows, and every
     consumer sums by date, so it is DOUBLE-COUNTED. Re-running is still the fix, for a different
     reason, so say which.
     `landed === 0` is scoped to the rows THIS call tried to write, never a blanket "nothing was
     saved": a caller may append "N days were already cleared to zero and stayed cleared", and those
     deletes really did happen — they run before the write is even attempted.
     Both noun forms are required because `total === 1` is the commonest failure shape at every door
     ("None of the 1 reconciles were saved"), and the VERB follows `landed` while the NOUN follows
     `total` ("1 of 2 days was saved"). */
  partialSaveNote(landed, total, one, many) {
    if (landed && landed >= total) {
      return (total === 1 ? 'The ' + one + ' was saved' : 'All ' + total + ' ' + many + ' were saved')
        + ', but an older record could not be cleared out, so '
        + (total === 1 ? 'it' : 'one of them') + ' may be counted twice until you run this again.';
    }
    return landed
      ? landed + ' of ' + total + ' ' + many + (landed === 1 ? ' was' : ' were') + ' saved before the save was refused. '
        + 'Run it again to finish. Bar Cop will not double anything that already saved.'
      : 'Save failed. ' + (total === 1 ? 'The ' + one + ' was not saved.'
                                       : 'None of the ' + total + ' ' + many + ' were saved.') + ' Try again.';
  },

  async putRecordsBulk(mod, kind, recs, opts) {
    const store = this.EVENT_STORES[mod];
    if (!store) return false;
    const list = (recs || []).filter(r => r && r.id != null);
    if (!list.length) return true;
    const res = await DB.putEventsBulk(store.table, kind, list);
    // Saved, offline, or safely queued for replay all count as success — the
    // caller's in-memory rows stay put and the queue will sync them. storageFull does NOT:
    // nothing reached disk, so reporting success would lose the batch on reload.
    const ok = !!(res && (res.ok || ((res.offline || res.queued) && !res.storageFull)));
    if (!ok && !(opts && opts.quiet)) this._reportWriteFail(res);   // one message for the whole batch, not one per row
    return ok;
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
    // Removed, offline, or safely queued for replay — keep it removed; the delete will sync.
    // Only a viewer rejection (or a full disk, where nothing was queued) restores the row.
    if (r.ok || ((r.offline || r.queued) && !r.storageFull)) {
      // Re-derive "this account is known-populated". That flag is computed once per LOAD, and a
      // delete never goes through writeData, so without this an operator who deletes their LAST
      // record leaves it stuck TRUE over an App.data whose arrays are now all empty — and the
      // total-wipe backstop then REFUSES EVERY CONFIG SAVE for the rest of the session (a pour
      // target, a Getting Started tick, anything through saveKey), firing a wipe_blocked alert
      // each time. Nothing is lost, but it reads as "Save failed" until they reload, and a bar in
      // its first week with one array populated reaches it doing nothing unusual.
      // Safe to lower HERE precisely because the emptying was the operator's own confirmed
      // delete, not the in-memory corruption the backstop exists to catch. Lowered only on
      // SUCCESS: a rejected delete restores the row below, so the account is still populated and
      // the backstop has to stay armed.
      // Route by STORE. The core flag and the three control flags are separate backstops over
      // separate objects, and lowering the wrong one is a real hazard: an Inventory delete used
      // to re-derive the CORE flag off App.data, so a delete could disarm the core backstop for
      // a corruption it had nothing to do with.
      if (mod === 'core') {
        DB._loadedNonEmpty = DB._blobHasArrayData(this.data);
      } else {
        // The SAME bug lived in the mirror. `_controlNonEmpty` is the identical flag for
        // ic_data / lc_data / sc_data, set once at load and never re-derived, so deleting the
        // last staff member left every Labor config save refused for the session — and Business
        // Profile's state-minimum-wage save does not check its return, so the value silently
        // never reached the server while the form reported success. More reachable than the core
        // case: a control object holds ~12 arrays to a bar's ~25.
        DB._controlNonEmpty[mod + '_data'] = DB._blobHasArrayData(dataObj);
      }
      return true;
    }
    if (removed) arr.splice(idx, 0, removed);
    this._reportWriteFail(r);   // the row just came BACK on screen — say why
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

  /* ⚠⚠ DERIVED LIST VIEWS (S328). A list built by MERGING or COMPUTING from other kinds rather than
     stored under a kind of its own: Cash Activity merges drops, safe logs, variances and safe
     counts; Vendor Price Changes are computed off deliveries. They still need a paging key — the
     "Show older" reveal and its per-list state are keyed by `mod.kind` — but there is nothing on the
     server to page, because no row is stored under that name. You cannot ask for "older
     cash_activity".
     ⭐ THE POINT OF DECLARING THEM IS THAT THE ABSENCE WAS INDISTINGUISHABLE FROM A TYPO. Before
     this, these two names were simply missing from EVENT_STORES, and a genuinely MISSPELLED kind
     fails in exactly the same way and just as silently — `store.kinds[kind]` is undefined, so `all`
     is `[]`, `hasServerOlder` is permanently false, and the button that offers the multi-year
     lookback can never appear. Nothing errors, so nothing surfaces it. Declared here, the intent is
     stated, and `verify-list-kind-names.js` can sweep the whole tree and fail on a real typo.
     ⚠ `resetListState` reads this too — it iterates a module's kinds, so an undeclared view key's
     reveal state was never cleared on a fresh window load. */
  VIEW_KINDS: ['sc|cash_activity', 'core|vendor_price_changes'],
  isViewKind(mod, kind) { return this.VIEW_KINDS.indexOf(mod + '|' + kind) >= 0; },

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
    /* ⚠ AND THE DERIVED VIEWS (S328). This iterated the module's stored kinds only, so a view key
       like `sc|cash_activity` was invisible to it: once the operator pressed "Show older" on Cash
       Activity, that raised limit survived every fresh window load and account switch, because
       nothing could ever clear it. */
    this.VIEW_KINDS.forEach(vk => {
      const [m, k] = vk.split('|');
      if (m === mod) delete this._listState[this._listKey(m, k)];
    });
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

  // Oldest loaded record as a {date,id} keyset cursor: the minimum date, and
  // among records at that date the minimum row id. Used to page older records
  // without skipping rows that share the boundary date.
  oldestLoaded(mod, kind) {
    const store = this.EVENT_STORES[mod];
    if (!store) return null;
    const dataObj = store.data();
    const key = store.kinds[kind];
    const arr = (dataObj && Array.isArray(dataObj[key])) ? dataObj[key] : [];
    let date = null, id = null;
    arr.forEach(r => {
      const d = DB._eventDate(r); if (!d) return;
      const rid = r && r.id != null ? String(r.id) : null;
      if (date == null || d < date) { date = d; id = rid; }
      else if (d === date && rid != null && (id == null || rid < id)) { id = rid; }
    });
    return date ? { date: date, id: id } : null;
  },

  // Could older-than-window records plausibly exist on the server? True only
  // when the oldest loaded record sits within ~5 weeks of the window's old edge
  // (so the window is saturated and there's likely more beyond it), or we've
  // already pulled an older page. Keeps the DB fetch off young accounts and the
  // sample data, whose full history is already in memory.
  hasServerOlder(mod, kind) {
    /* ⚠⚠ A NONWINDOWED KIND HAS NOTHING OLDER TO LOAD — IT IS ALL ALREADY HERE. These rows are
       stored with a null date on purpose, but oldestLoadedDate falls back to created_at, so once
       an account's oldest record drifted within 35 days of the window edge every one of these lists
       started offering "Load records older than 24 months" under a footnote reading "Showing the
       last 24 months". Both statements are false — nothing is windowed — and the button is a dead
       end, because the pager filters on date.lt.<cursor> and a NULL date can never match, so it
       round-trips to the server and flips to "All records loaded".
       Measured on the Regulars book: an account whose oldest regular was created 23 months ago. It
       affects every NONWINDOWED kind that carries a created_at, which is all of them. */
    /* A DERIVED VIEW has no rows of its own on the server, so there is nothing older to fetch —
       stated rather than left to fall out of `store.kinds[kind]` being undefined (S328). */
    if (this.isViewKind(mod, kind)) return false;
    if (DB.NONWINDOWED_KINDS && DB.NONWINDOWED_KINDS.indexOf(kind) >= 0) return false;
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
      const cursor = this.oldestLoaded(mod, kind);
      btn.disabled = true; btn.textContent = 'Loading...';
      const PAGE = 200;
      const older = cursor ? await this.loadOlder(mod, kind, cursor, PAGE) : [];
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
    // Strip arrays stored row-per-record so they are not double-stored — EXCEPT a
    // just-migrated kind whose backfill FAILED this session (DB._backfillPending): keep
    // its array in the blob as a backup until its rows are confirmed, so a failed
    // backfill can never orphan the data.
    const stripped = new Set();
    if (store) Object.keys(store.kinds).forEach(k => { if (!DB._backfillPending[k]) stripped.add(store.kinds[k]); });
    const out = {};
    Object.keys(dataObj || {}).forEach(k => { if (!stripped.has(k)) out[k] = dataObj[k]; });
    return out;
  },
  _inventoryConfig() { return this._configBlob('ic', this.inventoryData); },

  // An offline save is NOT a failure (see saveKey): the copy is kept on-device and
  // queued, and the offline banner tells the operator it will sync. Report success
  // so form handlers render the record instead of a misleading "Save failed."
  async saveInventory() {
    const r = await DB.writeInventoryData(this._inventoryConfig());
    if (!r.ok && !r.offline) console.error('saveInventory failed:', r.error);
    return r.ok || !!r.offline;
  },

  async saveLabor() {
    const r = await DB.writeLaborData(this._configBlob('lc', this.laborData));
    if (!r.ok && !r.offline) console.error('saveLabor failed:', r.error);
    return r.ok || !!r.offline;
  },

  async saveShift() {
    const r = await DB.writeShiftData(this._configBlob('sc', this.shiftData));
    if (!r.ok && !r.offline) console.error('saveShift failed:', r.error);
    return r.ok || !!r.offline;
  },

  navigate(id) {
    // Not signed in / no account data loaded — never render a data-driven screen
    // (every screen reads App.data). Defense in depth against a stray navigate (e.g.
    // browser back on the sign-in page, or a queued callback after sign-out) painting
    // a broken app shell over the auth screen.
    if (!this.data) return;
    /* A modal belongs to the screen that opened it. Bare call, no existence guard: this is a
       method on this very object, and guarding a helper correctness depends on just turns a loud
       failure into a silently stuck overlay ([[the-loop]] #40). */
    this.closeAllModals();
    /* ⚠ SELF-HEAL THE BAR SWITCHER (S313, second half). `renderAccountSwitcher` runs at boot and
       after a bar-name save, never on navigation — so when the memberships query failed once, a
       multi-location owner's switcher stayed gone for the entire session with nothing on screen
       saying why. Not caching the failure (db.js) makes a retry POSSIBLE; this is what makes one
       actually happen, on the operator's next click. Gated on the error flag, so it is a no-op on
       every normal navigation and cannot loop: a success clears the flag, and a further failure
       simply leaves it set for the click after that. */
    // Bare call, no `&& this.renderAccountSwitcher` existence guard: it is a method on this very
    // object, and guarding a helper that correctness depends on just turns a loud failure into a
    // silent one ([[the-loop]] #40). The cross-file callers guard it for load-order reasons; this
    // one cannot have that problem.
    if (window.DB && DB._acctListErr) this.renderAccountSwitcher();
    // Role-based block: a member can't navigate to a screen they don't have
    // access to. Show the no-access notice and stay put (no bounce).
    if (!this.canAccess(id)) { this.showNoAccess(); return; }
    // Settings and Getting Started are Hub-owned views, never module screens —
    // open them in the Hub container regardless of where the call came from.
    if (id === 'settings') { S.HubSettings.open(); return; }
    /* ⛔⛔ THE SAME DOOR HAS TO EXIST HERE TOO, AND FORGETTING IT WOULD HAVE LEFT HALF THE FIX DEAD.
       `openScreen` now routes `week-close`, but `navigate` is a SEPARATE entry point and plenty of
       callers reach it directly — `S.Hub._enter` does `showApp` then `navigate`, so every Hub due-row
       and money tile comes through here, not through `openScreen`. Teaching only one of the two
       would have fixed the audit rows and left the Hub's own rows saying "Coming soon.", which is
       exactly the shape of the defect this whole sweep is about: one door fixed, its twin missed
       ([[the-loop]] step 0.5 — find the twin before you fix). */
    /* ⭐ ALL FOUR WEEK IDS THROUGH THE ONE DOOR (2026-08-23). `week-close` was intercepted alone;
       Review reached its page through `navigate` and History through `_CONVERTED` + the module
       router. History has now LEFT `_CONVERTED`, so without naming it here `openScreen('week-history')`
       falls through to the module router and renders "Coming soon." — the `hub-permits` defect
       arriving through a DELETION rather than an addition.
       ⚠ THIS LINE EXISTS TWICE ON PURPOSE, in `openScreen` AND in `navigate`. `_enter` uses the
       second one, so teaching only the first fixes the audit rows and leaves every Hub row dead
       ([[the-loop]] #24). Both were measured before this edit rather than assumed. */
    if (id === 'week' || id === 'week-close' || id === 'week-review' || id === 'week-history') {
      this._protoGlobalClick(id); return;
    }
    // Retire the old standalone "This Week" / "Revenue This Week" write screens.
    // Confirm the Week is the single weekly-close writer: it writes BOTH the profit
    // `week` and the revenue_week with the correct hourly-labor split and catering
    // handling that the old saveWeek forms did not, so leaving those forms reachable
    // let a divergent second record be written. Every entry point that still targets
    // them (Getting Started, a Fix result link, a stale nav) now opens the Confirm
    // the Week popup for the current week over the section's Close The Week dashboard.
    /* ⛔⛔⛔ THIS OPENED A DYING COCKPIT BEHIND THE POPUP, AND KYLE FOUND IT ON WEEK HISTORY.
       *"click confirm the week button under the popup it goes to the old close the week page ...
       again.. i shouldn't have to keep finding these."* He is right, and worse: I READ THIS EXACT
       CODE earlier in the same build, wrote down that `dashId` lands on one of the six screens 1c
       deletes, and filed it as a future liability instead of fixing it. It was never a future
       liability — it is the page an operator lands on today.
       ⭐ CLOSE THE WEEK IS THE PAGE NOW, so the popup opens over the page that owns the weekly close
       rather than over a cockpit that is being deleted. Through `_protoGlobalClick`, which is the
       ONE door the rail already uses — never a second `S.WeekClose.open()` call, because two doors
       to one page drift ([[the-list]] step 1b).
       ⚠ THE WEEK COMES FROM THE PAGE THAT IS ABOUT TO BE ON SCREEN, not from the cockpit's selector.
       `S.WeekClose.weekEnd()` is its own accessor and falls back to `App.nextSunday()`, so the popup
       and the page behind it can never disagree about which week is being confirmed — which was a
       real defect on this exact pairing once before. */
    if (id === 'this-week') {
      this._protoGlobalClick('week-close');
      const wc = (typeof S !== 'undefined') && S.WeekClose;
      const pe = (wc && wc.weekEnd) ? wc.weekEnd() : this.nextSunday();
      if (typeof ConfirmWeek !== 'undefined' && ConfirmWeek.open) {
        /* ⛔ `render(container)`, NOT `rerender()`. My first version called `wc.rerender()`, which is
           UNDEFINED on `S.WeekClose` — measured on the shipped build. `rerender` exists only on the
           two HOST literals inside that file (`SC_HOST` / `LB_HOST`), and `sliceMember` refusing to
           slice it was the tell. Behind a `&&` guard it would have failed silently: confirm a week
           and the page behind the popup never repaints, which reads as "the save did nothing".
           Same family as a `window.X` read on a bare const — the guard turns a loud failure into a
           quiet wrong result ([[the-loop]] #40). */
        ConfirmWeek.open(pe, { onDone: () => {
          if (wc && wc.render && wc.container) wc.render(wc.container);
        } });
      }
      return;
    }
    // Landing on a screen is the base of its in-screen view history (floating back).
    this._currentScreenId = id;
    this._viewStack = [];
    this._viewCur = () => this.navigate(id);
    this._updateFloatNav();
    try {
    ++this._mountSeq;               // a new screen is going up — see App._mountSeq
    this._dismissWriteFail();       // the old screen's failure message must not follow it here (S3)
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

    /* ⛔⛔⛔ WHICH VENDOR PAGE TO RENDER, DECIDED BEFORE THE MODULE DISPATCH — AND IT HAS TO BE HERE.
       Kyle, 2026-08-23, on the pushed build: *"price changes and discrepancies links do not change
       to those pages it stays on scorecard page."* Reproduced by clicking, live: `_currentScreenId`
       moved to `vendor-watch` and `vendor-discrepancy` correctly while `S.VendorTracker.page` stayed
       `'scorecard'` on every press.
       ⭐ THE CAUSE IS POSITION, NOT LOGIC. This block used to sit in the PROFIT fall-through, 133
       lines below the Inventory branch's `return`. The moment the four vendor ids moved into the
       Inventory screen map, the only path that reaches them stopped reaching this — so the screen
       rendered with whatever `page` already held, which is its default.
       ⛔ IT IS A FACT ABOUT THE ID, NOT ABOUT THE MODULE, so it belongs above every module branch.
       Copying it into the Inventory block would have worked today and drifted the first time a
       vendor page is reached from anywhere else ([[the-loop]] #149 — enumerate every registration
       for an id and say what each one is FOR).
       ⚠ AND MY PIN COULD NOT SEE IT: it asserted this block SAYS the right thing and that the three
       ids map to three different values. Neither is a claim that the block RUNS. Existence is not
       reachability ([[lessons-paid-for]] #107), and rendering is downstream of reaching (#120).
       Now pinned by ORDER: this must sit above the first `_activeModule` branch. */
    if (S.VendorTracker) {
      if (id === 'vendor-watch') S.VendorTracker.page = 'watch';
      else if (id === 'vendor-discrepancy') S.VendorTracker.page = 'discrepancies';
      else if (id === 'vendor-scorecard' || id === 'vendor-tracker') S.VendorTracker.page = 'scorecard';
    }

    // Events module screens
    if (this._activeModule === 'events') {
      const evTitles = {
        'hub':          ['Hub', ''],
        'ev-bookings':  ['Bookings', 'Events'],
        'ev-calendar':  ['Calendar', 'Events'],
        'ev-regulars':  ['Regulars', 'Events'],
        'ev-pricing':   ['Pricing', 'Events'],
        'ev-help':      ['Help and FAQ', 'Events'],
      };
      const evScreens = {
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
        'hub':                    ['Hub', ''],
        'r-audit':            ['Revenue Audit', 'Monthly Score and Progress'],
        'r-forecast':             ['Revenue Forecast', 'Plan Next Week'],
        'week-history':           ['Week History', 'Weekly Recovery'],
        'r-server-check':         ['Server Check', ''],
        'r-menu-items':           ['Menu Builder', ''],
        'r-menu-planning':        ['Menu Rundown', ''],
        'r-menu-engineering':     ['Menu Engineering', ''],
        'r-dog-test':             ['Dog Test Tracker', ''],
        'r-help':                 ['Help and FAQ', ''],
      };
      const revScreens = {
        'r-audit':            S.RevenueAudit,
        'r-forecast':         S.RevenueForecast,
        'week-history':       S.WeekHistory,
        'r-server-check':     S.RevenueServerCheck,
        'r-menu-items':       S.RevenueMenuItems,
        'r-menu-planning':    S.RevenueMenuPlanning,
        'r-menu-engineering': S.RevenueMenuEngineering,
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
        'hub':           ['Hub', ''],
        'c-audit':       ['Cash Audit', 'Weekly Score and Progress'],
        // ⛔ Trapped Cash and Purchasing left for INVENTORY, 2026-08-23 — registered there now, and
        //   out of here so one page renders from one shell whatever door the operator came through.
        'c-capital':     ['Capital Efficiency', 'Books'],
        'c-forecast':    ['Cash Forecast', 'Books'],
        'c-position':    ['Cash Position', 'Books'],
        'c-bridge':      ['Cash Bridge', 'Books'],
        'c-help':        ['Help and FAQ', ''],
      };
      const cashScreens = {
        'c-audit':       S.CashAudit,
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
        'hub':                 ['Hub', ''],
        'ic-product-setup':    ['Add Products', 'Inventory'],
        'ic-prep-batches':     ['Prep Batches', 'Inventory'],
        'ic-locations':        ['Set Locations', 'Inventory'],
        'ic-vendors':          ['List Vendors', 'Inventory'],
        'ic-take-inventory':   ['Take Inventory', 'Inventory'],
        'ic-count-history':    ['Count History', 'Inventory'],
        'ic-spot-check':       ['Spot Check', 'Inventory'],
        'ic-transfers':        ['Transfer Log', 'Inventory'],
        'ic-empties':          ['Empties Log', 'Inventory'],
        'ic-adjustments':      ['Adjustment Log', 'Inventory'],
        'ic-par-suggestions':  ['Dynamic Pars', 'Inventory'],
        'ic-receive-delivery': ['Receive Delivery', 'Inventory'],
        'ic-delivery-history': ['Delivery History', 'Inventory'],
        'ic-order-sheet':      ['Order Sheet', 'Inventory'],
        'ic-order-history':    ['Order History', 'Inventory'],
        'ic-report-usage':     ['Usage Report', 'Inventory'],
        'ic-report-variance':  ['Variance Report', 'Inventory'],
        'ic-report-stock':     ['Stock Report', 'Inventory'],
        /* ⭐ MOVED IN FROM CASH AND SHIFT (Kyle, 2026-08-23). The SUBTITLE moves with the page: it
           says which section you are in, and these are Inventory pages now. Their files did not
           move and their screen objects are unchanged; what moved is where the app files them. */
        'c-purchasing':        ['Purchasing', 'Inventory'],
        'c-trapped':           ['Trapped Cash', 'Inventory'],
        'sc-void-comp':        ['Voids / Comps Log', 'Inventory'],
        'sc-waste':            ['Waste / Spill Log', 'Inventory'],
        /* ⛔⛔⛔ THE VENDOR PAGES MOVED HERE FROM THE PROFIT BLOCK ON 2026-08-23, AND WITHOUT THIS
           THE THREE NEW NAV LINKS RENDER "Coming soon." `navigate` keeps a SEPARATE screen map per
           module and only ever consults the ACTIVE one, so re-pointing the nav row, `_moduleOf` and
           `SCREEN_GROUPS` still left every one of them landing in a shell whose map had never heard
           of the id ([[lessons-paid-for]] #24/#146 — `navigate` is module-internal, and a hub page
           is not a module screen).
           ⭐ `verify-hub-destinations` C2 caught it on the first gate run, naming
           `vendor-watch/inventory` exactly. Three dead links, and nothing else in the suite would
           have said a word.
           ⚠ ONE SCREEN, FOUR IDS: the id selects the TAB (see the deep-link block further down), so
           all four resolve to the same object and share its page name. */
        'vendor-tracker':      ['Vendor Tracker', 'Inventory'],
        'vendor-scorecard':    ['Vendor Tracker', 'Inventory'],
        'vendor-watch':        ['Vendor Tracker', 'Inventory'],
        'vendor-discrepancy':  ['Vendor Tracker', 'Inventory'],
        'ic-help':             ['Help and FAQ', 'Inventory'],
      };
      const icScreens = {
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
        // Moved in from Cash and Shift (see the note in icTitles above). The objects are untouched;
        // only which module's map holds them changed, and they are out of the old maps so a page
        // cannot render from two shells depending on where the operator came from.
        'c-purchasing':       S.CashPurchasing,
        'c-trapped':          S.CashTrapped,
        'sc-void-comp':       S.ShiftVoidComp,
        'sc-waste':           S.ShiftWaste,
        // Moved out of the Profit block with the section (see the note in icTitles above).
        'vendor-tracker':     S.VendorTracker,
        'vendor-scorecard':   S.VendorTracker,
        'vendor-watch':       S.VendorTracker,
        'vendor-discrepancy': S.VendorTracker,
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
        'hub':                   ['Hub', ''],
        'sc-cash-control':       ['Cash Control', 'The Floor'],
        'sc-cash-history':       ['Cash History', 'The Floor'],
        // ⛔ The Void/Comp and Waste/Spill logs left for INVENTORY's "Logs" group, 2026-08-23. Both
        //   feed Inventory's own Variance Report, so that is where they were always filed in fact.
        'sc-maintenance':        ['Maintenance Log', 'The Floor'],
        'sc-incidents':          ['Incidents', 'The Floor'],
        'sc-licensing':          ['Licensing', 'The Floor'],
        'sc-walked-tabs':        ['Walked Tabs', 'The Floor'],
        'sc-checklists':         ['Run Checklists', 'The Floor'],        'sc-checklist-templates':['Build Checklists', 'The Floor'],
        'sc-preshift':           ['Pre-Shift Briefing', 'The Floor'],
        'sc-drawers':            ['Drawers / Registers', 'The Floor'],
        'sc-help':               ['Help and FAQ', 'The Floor'],
      };
      const scScreens = {
        'sc-cash-control': S.ShiftCashControl,
        'sc-cash-history': S.ShiftCashHistory,
        'sc-maintenance': S.ShiftMaintenance,
        'sc-incidents': S.ShiftIncidents,
        // ⭐ build piece 5: the permits tracker moved out of the Books shell into Shift Control.
        // The OBJECT keeps its name (`S.HubPermits`) because five callers reach it by that name;
        // only where it MOUNTS changed.
        'sc-licensing': S.HubPermits,
        'sc-walked-tabs': S.ShiftWalkedTabs,
        'sc-checklists': S.ShiftChecklists,        'sc-checklist-templates': S.ShiftChecklistTemplates,
        'sc-preshift': S.ShiftPreShift,
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
        'hub':                   ['Hub', ''],
        'lc-build-schedule':     ['Build Schedule', 'The Floor'],        'lc-schedule-history':   ['Schedule History', 'The Floor'],
        'lc-log-hours':          ['Log Hours', 'The Floor'],
        'lc-pay-periods':        ['Pay Periods', 'The Floor'],
        'lc-payroll-export':     ['Payroll Export', 'The Floor'],
        'lc-positions':          ['Add Positions', 'The Floor'],
        'lc-staff-roster':       ['Staff Roster', 'The Floor'],
        'lc-training':           ['Training', 'The Floor'],
        'lc-tip-log':            ['Tip Tracking', 'The Floor'],
        'lc-tip-history':        ['Tip History', 'The Floor'],
        'lc-reports':            ['Labor History', 'The Floor'],
        'lc-overtime-watch':     ['Overtime Watch', 'The Floor'],
        'lc-callout-log':        ['Call-Out Log', 'The Floor'],
        'lc-time-off':           ['Time Off Log', 'The Floor'],
        'lc-help':               ['Help and FAQ', 'The Floor'],
      };
      const lcScreens = {
        'lc-positions': S.LaborPositions,
        'lc-staff-roster': S.LaborStaffRoster,
        'lc-training': S.LaborTraining,
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
      'hub':           ['Hub', ''],
      // T1: no 'this-week' entry. The interception above returns before this map is
      // ever read for that id, and the grid it titled is gone. The interception STAYS —
      // three callers still openScreen('this-week') to reach Confirm the Week.
      'week-history':  ['Week History', 'Weekly Recovery'],
      'profit-forecast':['Profit Forecast', ''],
      'recipe-cost-analysis':['Recipe Summary', ''],
      /* ⛔ THE FOUR VENDOR IDS LEFT THIS MAP ON 2026-08-23 and live in the Inventory block above
         (Kyle: "so it no longer is in profit at all"). Removing them from BOTH module maps rather
         than leaving a copy behind is the point: a duplicate registration is what lets a stale
         `showApp('profit')` caller keep working and hide that it is pointing at the wrong section
         ([[the-loop]] #149 — enumerate every registration for an id and say what each survivor is
         FOR). Every caller now resolves the shell through `_moduleOf`, which answers 'inventory'. */
      'sales-integrity': ['Sales Integrity', 'Shift Sales Review'],
      'cash-recon':    ['Over and Short', ''],
      'help':          ['Help and FAQ', ''],
      'audit-tracker': ['Profit Audit', 'Monthly Score & Progress']
    };

    const screens = {
      'hub':           S.Hub,
      'week-history':  S.WeekHistory,
      'profit-forecast':S.ProfitForecast,
      'recipe-cost-analysis':S.RecipeCostAnalysis,
      // The four vendor ids moved to the Inventory block (see the note in the Profit titles above).
      'sales-integrity': S.SalesIntegrity,
      'cash-recon':    S.CashRecon,
      'help':          S.Help,
      'audit-tracker': S.AuditTracker
    };

    const [title, sub] = titles[id] || [id, ''];
    document.getElementById('topbar-title').textContent = title;
    document.getElementById('topbar-sub').textContent = sub;

    /* ⛔ THE VENDOR PAGE SELECTOR MOVED OUT OF HERE on 2026-08-23 and now runs above the module
       dispatch. It sat in this Profit fall-through, which the Inventory branch returns long before
       reaching — so all three drop-down rows rendered the Scorecard. See the block above the Events
       branch for the whole story; there must not be a second copy down here. */
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
    /* ⛔⛔ SYNC THE TITLE HERE, WHERE THE ACTIVE ROW IS ACTUALLY SET. This is the module twin of the
       call in `openHubFullPage`, and leaving it out is what Kyle saw on Events: clicking "Book The
       Events" in the overlay gave the title "Dashboard".
       ⚠ WHY THE OBSERVER WAS NOT ENOUGH, and why it looked fine when I tested it. The module side
       mirrors via a MutationObserver on `#topbar-title`, which fires as a MICROTASK — fine when the
       whole navigation happens in one synchronous block, which is exactly what
       `App.showApp(m); App.navigate(id)` does, so a scripted probe passed on all twelve screens.
       A REAL CLICK goes capture-then-bubble through two handlers and the screen's own async render,
       so the observer can fire while no `.nav-item.active` exists yet — and the fallback then reads
       the old `#topbar-title`. Reproduced by clicking the overlay rather than calling navigate.
       ⭐ THE LESSON: an ordering fix is not done until BOTH mechanisms are ordered. I fixed the hub
       half and left the module half depending on timing. */
    this._syncPageTitle();
  },

  updatePeriod() {
    const el = document.getElementById('sidebar-period');
    if (!el) return;
    const weeks = this.data?.weeks || [];
    if (weeks.length > 0) {
      // Event stores load date/id-DESC, so weeks[last] is the OLDEST-created week, not
      // the current one. Pick the newest via App.latestEvent so the sidebar label
      // matches what the dashboards show (never pick "latest" by array position).
      const w = App.latestEvent(weeks) || weeks[weeks.length - 1];
      el.textContent = 'Week ' + w.week_num + '   ' + (w.period_end || '');
    } else {
      el.textContent = 'No data yet';
    }
  },

  // ── A BALANCE, negative-safe. THE canonical one: do not hand-roll another. ──────
  // fmtCurrency is '$' + v, so a raw negative renders "$-2,340.00", which is right for
  // nothing. Plenty of screens print a balance on a line that fires ONLY when the value
  // is under zero (Safe to Spend "under zero", the cash low point, a losing month's
  // Cash You Kept), so those printed malformed EVERY time they appeared, lender PDFs
  // included.
  //   fmtBal  = a BALANCE or a LEVEL: "-$2,340.00" / "$2,340.00". Never a plus sign.
  //   signed  = a NET or a CHANGE, where "+$500" carries meaning. Stays per-file.
  // Pick by what the number IS. c-bridge's waterfall states the rule best: a FLOW takes
  // +/-, the RESULT line takes neither.
  // This does NOT change fmtCurrency's contract, so the many callers that already do
  // their own Math.abs + sign cannot double up.
  // ⚠ The sign reads off the ROUNDED value on purpose: fmtCurrency normalizes -0 so it
  // never prints "$-0.00", and testing the raw v would hand back "-$0.00" instead,
  // reintroducing the same malformed-currency bug one layer up. `decimals` is forwarded
  // untouched so fmtBal(v, 0) still gives whole dollars.
  /* A SIGNED DIFFERENCE for display: a variance, a delta, a "vs scheduled", a change column.
     Every hand-rolled version of this in the app got the same three things wrong, and Kyle
     caught the result on the live variance report (Athletic NA, a row that balanced perfectly,
     showing "Case Var -0.0 / Btl Var -0"):

       1. NORMALISE -0 AT THE DISPLAYED PRECISION. A count that comes out exactly even still
          leaves floating-point residue — 0.5 cases can be 0.4999999999999998 — so the
          difference is -2e-16 and toFixed keeps the sign. A minus in front of a variance reads
          as a real shortage.
       2. DECIDE THE "+" ON THE DISPLAYED VALUE, not the raw one. Tested against the raw value,
          whichever way the residue happened to fall decided the sign, so one balanced row
          printed "+0.0" and the next "-0.0".
       3. RETURN THE SIGN so the caller colours off the SAME decision it printed. Two sites
          drive a red/green class off this, and a residue-negative was painting a balanced row
          red (ic-count-history) or green (lc-reports).

     Returns { text, sign }, sign being -1 / 0 / 1 AT THE DISPLAYED PRECISION. A real difference
     that rounds to a non-zero keeps its sign, so nothing is ever hidden. */
  fmtSigned(v, decimals, suffix) {
    const d = decimals == null ? 1 : decimals;
    if (v == null || isNaN(v)) return { text: '-', sign: 0 };
    const x = Number(v);
    const shown = Number(x.toFixed(d));
    const sign = shown > 0 ? 1 : (shown < 0 ? -1 : 0);
    return { text: (sign > 0 ? '+' : '') + (sign === 0 ? 0 : x).toFixed(d) + (suffix || ''), sign: sign };
  },

  fmtBal(v, decimals) {
    const d = decimals !== undefined ? decimals : 2;
    return (Number(Number(v).toFixed(d)) < 0 ? '-' : '') + App.fmtCurrency(Math.abs(v), decimals);
  },

  /* ── ONE sentence for the cash conversion cycle, because a NEGATIVE cycle means the
     OPPOSITE of a positive one and three screens print it.
     DIO minus DPO. Positive = your money is tied up for that many days. Negative = your
     vendors are financing the inventory and the cash is back before their bills are due,
     which is the good side. Both briefings used to render it as
        "Your cash is locked about -17 days"
     — a duration that cannot exist, describing the healthy case as the sick one — while
     Capital Efficiency and Cash Audit S2 both worded the same number correctly. That is a
     third implementation of one job, so there is now exactly one
     ([[the-loop]] "WHEN YOU FIX A SHARED THING, GREP FOR OTHER IMPLEMENTATIONS").
     `cashCycle()` already agrees with this: it clamps lockedCash to 0 below zero, because
     nothing is locked. Takes plain numbers so a stored audit `raw` block can call it too. */
  cashCycleSentence(cycleDays, dio, dpo) {
    const c = Math.round(cycleDays || 0), i = Math.round(dio || 0), p = Math.round(dpo || 0);
    const sits = 'product sits ' + i + ' and you take ' + p + ' to pay.';
    if (c > 0) return 'Your cash is locked about ' + c + ' days: ' + sits;
    if (c === 0) return 'Your cash comes back about the day the bills are due: ' + sits;
    return 'Your vendors are financing your inventory: your cash comes back about ' + Math.abs(c)
      + ' day' + (Math.abs(c) === 1 ? '' : 's') + ' before the bills are due, because ' + sits;
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
  /* One recipe/batch quantity -> the draw the variance report's theoretical side expects.

     A stored recipe quantity is ALWAYS in the measure recipeBasis(p) reports, because
     that is what the Menu Builder labels the input with, what the prep-batch builder
     labels and costs with, and what menuItemCost multiplies by recipeBasis' costPerUnit:
     OUNCES for any liquid (Liquor, Wine, Draft Beer, and a Food/Misc product carrying a
     container size), SERVINGS for a portioned solid, BOTTLES for bottle beer, the stock
     unit otherwise.

     usageVarRows then converts that draw to stock units per category: it divides by
     container_size_oz for every bar product (so bar wants OUNCES), and for Food/Misc it
     divides by ozPerContainer for a liquid, servingsPerUnit for a portioned solid, and 1
     otherwise (so Food/Misc wants the recipeBasis measure as-is). Bottle beer is the only
     one whose recipeBasis measure and the divisor's expectation differ, so it is the only
     conversion here. */
  recipeDraw(p, qty) {
    if (!p || !(qty > 0)) return 0;
    if (p.category === 'Bottle Beer') return qty * (parseFloat(p.container_size_oz) || 0);
    return qty;
  },

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
            // A batch ingredient quantity is in recipeBasis measure, exactly like a menu
            // recipe's: ic-prep-batches labels the column and costs the line off
            // App.recipeBasis. This used to multiply it by container_size_oz on the
            // premise that "batch ingredients are typically in product units (bottles)",
            // which predates recipeBasis and is false: a batch calling for 8 oz of syrup
            // drew 256 oz, 32x the real usage, straight into theoretical variance.
            result[bp.id] = (result[bp.id] || 0) + (this.recipeDraw(bp, biQty / spb) * qty * perUnit);
          });
          return;
        }

        // source === 'product'
        const p = prodById(id);
        if (!p) return;
        // The quantity is ALREADY in recipeBasis measure: it is the same number
        // menuItemCost multiplies by recipeBasis' costPerUnit, and the Menu Builder
        // labels the field with recipeBasis' unitLabel. This used to re-multiply it by
        // pour_size_oz ("qty is in pours") or container_size_oz ("qty is in bottles"),
        // conventions that predate recipeBasis and no longer hold: a 2 oz pour drew 3 oz,
        // and a bar product in a food recipe drew 25x. recipeBasis is documented as the
        // single source menuItemCost and the Menu Builder both read so they never
        // disagree; this is the third reader and it has to read it too.
        result[p.id] = (result[p.id] || 0) + (this.recipeDraw(p, qty) * perUnit);
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

  // Hourly wage for a staff member working a given POSITION on a date. The primary
  // position uses the wage-history-aware rate; a configured SECONDARY position uses
  // its own flat rate (no history), so a cross-trained employee's secondary-role
  // hours cost at the right rate. Salaried = exempt, no hourly wage.
  wageForStaffPosition(staffOrId, positionId, dateStr) {
    const staff = (staffOrId && typeof staffOrId === 'object')
      ? staffOrId
      : (this.laborData?.lc_staff || []).find(x => x.id === staffOrId);
    if (!staff) return 0;
    if (this.isSalaried(staff)) return 0;
    if (positionId && staff.secondary_position_id && positionId === staff.secondary_position_id) {
      return parseFloat(staff.secondary_wage) || 0;
    }
    return this.wageForStaffOn ? this.wageForStaffOn(staff.id, dateStr) : (staff.wage || 0);
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
    // ROUND, not floor. These are local midnights, so a span containing the March
    // spring-forward Sunday is one hour short of a whole number of days and floor()
    // silently dropped a day: March came out 30 days, and every salaried figure on the
    // annual workbook, the cash forecast and the audit window read low. Mon-Sun weekly
    // rollups were never hit (the 2am change lands after the Sunday-00:00 anchor), so
    // this only ever bit the month and rolling-window callers. Fall-back adds an hour,
    // which round() absorbs the same way.
    const days = Math.round((ed.getTime() - sd.getTime()) / 86400000) + 1;
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
  // Weekly overtime premium for a set of actual labor rows: 0.5x the straight-time
  // rate on hours over OT_THRESHOLD (40) per staff, per Mon-Sun week. lc_actuals
  // store straight-time cost only (cost = hours x wage), so this premium must be
  // ADDED at every weekly labor rollup or the booked P&L / prime cost / labor %
  // understate labor whenever anyone crosses 40 hours (Build Schedule and the Range
  // lens already add it; the actuals-side weekly feeds did not). Salaried staff are
  // exempt. Returns { total, byStaff }.
  // The ONE key an OT premium is bucketed and reported under. Any caller that
  // attributes premium back onto its own per-staff rollup must key it the same way,
  // or the premium lands on a staff row that does not exist while the total still
  // counts it, and Total Wages Paid stops equalling the sum of its own breakdowns.
  otStaffKey(a) { return (a && (a.staff_id || a.name)) || '?'; },

  /* ⚠⚠ IS THIS DATE INSIDE A CLOSED PAY PERIOD? (L6) Closing a period stamps `locked: true` on
     every lc_actuals row that EXISTS AT THAT MOMENT, so the lock is a property of the rows, not of
     the week. Anything created afterwards is unlocked by construction and walks straight in.
     Measured on the live app: a period closed at 87 entries / $5,867.49 took 11 more shifts through
     Log Hours and became 98 / $6,691.24 while still reading "Closed" — and the payroll CSV then
     exported the post-lock total. The Close & Lock confirm promises the period is settled; an
     operator does not read "locked" as "still open to additions".
     THREE doors write lc_actuals (the Log Hours form, its fill-from-schedule batch, and the
     timeclock import), so this is ONE shared question rather than three copies that drift
     ([[the-loop]]: find the second implementation, not the second caller). A bar that has never
     closed a period is never blocked, because there is nothing to be inside of. */
  payPeriodClosedFor(dateStr) {
    const d = String(dateStr || '').slice(0, 10);
    if (!d) return false;
    const ws = this.weekStartFor(d);
    if (!ws) return false;
    return ((this.laborData && this.laborData.lc_pay_periods) || [])
      .some(p => p && p.status === 'Closed' && p.week_start === ws);
  },

  /* ⛔⛔⛔ THE OVERTIME PREMIUM IS HALF THE **REGULAR RATE**, AND FOR A TIPPED EMPLOYEE THAT
     IS NOT THEIR CASH WAGE (2026-08-17).
     Under the FLSA, an employer taking a tip credit still owes overtime on the employee's
     REGULAR rate, which is at least the full minimum wage — not on the $2.13 cash wage. The
     cash actually due for an overtime hour is `1.5 x minimum - tipCredit`, where
     `tipCredit = minimum - cashWage`. That rearranges to `cashWage + 0.5 x minimum`, so with
     straight time already booked at the cash wage, the PREMIUM owed is `0.5 x minimum`.
     For anyone paid at or above the minimum the tip credit is zero and this collapses to the
     familiar `0.5 x wage`, byte-for-byte what it always was — which is why routing every
     caller through here moves no existing number except a tipped employee's.
     ⚠ MEASURED LIVE before this existed: a $2.13 server with one overtime hour was priced at
     $3.20 where the FLSA figure is $5.76, on the Pay Periods payroll worksheet.
     ⚠ `state_min_wage` unset returns the old behaviour exactly, so an account that has not
     configured it is never silently given a different number.
     ⛔ NEVER re-derive this at a call site — four of them had their own copy of the OT math
     and two disagreed ([[labor-cost-model]]). */
  otMinWage() {
    const s = (this.laborData && this.laborData.settings) || {};
    const m = parseFloat(s.state_min_wage);
    return (isFinite(m) && m > 0) ? m : 0;
  },
  // The premium owed on ONE overtime hour, given the rate that hour was logged at
  // (a blended per-week rate for a cross-trained employee).
  otHourlyPremium(loggedRate) {
    const w = parseFloat(loggedRate) || 0;
    return 0.5 * Math.max(this.otMinWage(), w);
  },
  // The full cash owed for ONE overtime hour: straight time plus that premium.
  otHourlyPay(loggedRate) {
    const w = parseFloat(loggedRate) || 0;
    return w + this.otHourlyPremium(w);
  },

  otPremiumForRows(rows) {
    const OT = this.OT_THRESHOLD || 40;
    const wk = {};
    (rows || []).forEach(a => {
      if (!a || this.isSalaried(a.staff_id)) return;
      const ws = this.weekStartFor ? this.weekStartFor(a.date) : (a.date || '');
      const key = this.otStaffKey(a) + '|' + ws;
      if (!wk[key]) wk[key] = { staff: this.otStaffKey(a), hours: 0, cost: 0 };
      wk[key].hours += (a.hours || 0);
      wk[key].cost  += (a.cost  || 0);
    });
    let total = 0; const byStaff = {};
    Object.keys(wk).forEach(k => {
      const b = wk[k];
      const otH = Math.max(0, b.hours - OT);
      if (otH <= 0 || b.hours <= 0) return;
      const prem = otH * this.otHourlyPremium(b.cost / b.hours);
      total += prem;
      byStaff[b.staff] = (byStaff[b.staff] || 0) + prem;
    });
    return { total: total, byStaff: byStaff };
  },

  /* The OT premium attributable to an arbitrary date window [start, end] (inclusive
     ymd). Overtime is a WEEKLY threshold, so the premium has to be computed over whole
     Mon-Sun weeks and only THEN allocated to the window.

     Handing a cut window straight to otPremiumForRows ALWAYS under-counts: a calendar
     month or a rolling 28 days slices the weeks at its edges, and the slice of a
     45-hour week that lands inside the window is under 40 on its own, so it draws no
     premium at all. Pass ALL rows here, never a pre-filtered set: the filtering is the
     bug. Each week's premium is then allocated by that week's share of hours inside the
     window, the same blended model otPremiumForRows already uses for the rate. A window
     that covers whole weeks allocates 1.0 and returns exactly what otPremiumForRows
     would. */
  otPremiumInWindow(rows, start, end) {
    const OT = this.OT_THRESHOLD || 40;
    const wk = {};
    (rows || []).forEach(a => {
      if (!a || !a.date || this.isSalaried(a.staff_id)) return;
      const ws = this.weekStartFor ? this.weekStartFor(a.date) : (a.date || '');
      const key = this.otStaffKey(a) + '|' + ws;
      if (!wk[key]) wk[key] = { staff: this.otStaffKey(a), hours: 0, cost: 0, inHours: 0 };
      const h = a.hours || 0;
      wk[key].hours += h;
      wk[key].cost  += (a.cost || 0);
      const d = String(a.date).slice(0, 10);
      if ((!start || d >= start) && (!end || d <= end)) wk[key].inHours += h;
    });
    let total = 0, otHours = 0; const byStaff = {};
    Object.keys(wk).forEach(k => {
      const b = wk[k];
      const otH = Math.max(0, b.hours - OT);
      if (otH <= 0 || b.hours <= 0 || b.inHours <= 0) return;
      const share = b.inHours / b.hours;
      const prem = otH * this.otHourlyPremium(b.cost / b.hours) * share;
      total += prem;
      otHours += otH * share;
      byStaff[b.staff] = (byStaff[b.staff] || 0) + prem;
    });
    // `hours` = the OT hours behind `total`, allocated the same way, for sheets that
    // report an OT Hours column alongside the dollars.
    return { total: total, hours: otHours, byStaff: byStaff };
  },
  /* ── TIP-CREDIT MAKEUP PAY ────────────────────────────────────────────────────
     A tipped employee whose CASH WAGE plus TIPS lands under the state minimum is owed the
     difference. That makeup is real money the business pays, so it belongs in labor cost
     everywhere labor cost is reported, not only on the Pay Periods screen.
     ⛔ IT IS THE SECOND ADJUSTMENT THAT LIVES OUTSIDE lc_actuals. Those rows store straight
     time only (cost = hours x wage); the 0.5x OT premium is added at every weekly rollup and
     this is added the same way, in the same places, keyed by App.otStaffKey so both land on
     the same staff bucket. Miss a rollup and the P&L understates labor, which is the
     direction nobody reports.
     ⚠ STRAIGHT TIME, NOT GROSS. The effective rate is (straight cost + tips) / hours. Gross
     carries the 1.5x premium and would inflate the rate, hiding a shortfall for anyone who
     worked overtime — the same reason the Pay Periods test is written this way.
     ⚠ IT NEVER JUDGES OFF MISSING TIPS. No tips recorded for the week means the real rate is
     unknowable, so it returns nothing rather than inventing a shortfall.
     ⛔ NOT APPLIED TO A SCHEDULE. lc-build-schedule plans a future week whose tips do not
     exist yet; makeup there would be a guess, so that rollup deliberately does not add it. */
  tipShareForStaffInWeek(staffId, weekStart, weekEnd) {
    const pools = ((this.laborData && this.laborData.lc_tip_pools) || []);
    const shifts = ((this.shiftData && this.shiftData.sc_shifts) || []);
    let total = 0;
    pools.forEach(p => {
      const inRange = (p.date && p.date >= weekStart && p.date <= weekEnd)
        || (p.shift_id && shifts.find(s => s.id === p.shift_id && s.date >= weekStart && s.date <= weekEnd));
      if (!inRange) return;
      (p.participants || []).forEach(part => {
        if (part.staff_id === staffId) total += parseFloat(part.share) || 0;
      });
    });
    if (total > 0) return total;
    // No pool split saved this week: fall back to the person's own logged NET tips, so a
    // house that logs tips without splitting a pool still gets a real number rather than a
    // false $0 that would read as a shortfall.
    /* ⛔ SETTLED ROWS ONLY. This figure decides whether a tipped employee cleared minimum wage and
       therefore how much MAKEUP PAY is owed. A shift half entered at 9pm would understate their
       tips and manufacture a shortfall that is not real. */
    const tips = this.settledTips((this.laborData && this.laborData.lc_tips) || []);
    return tips.reduce((s, t) => (t.staff_id === staffId && t.date >= weekStart && t.date <= weekEnd)
      ? s + this.netTips(t) : s, 0);
  },
  // Bucket rows into staff-weeks the way both premium helpers do, then hand each whole week
  // to the caller. Shared so makeup and its window variant cannot drift apart.
  _tipMakeupBuckets(rows, start, end) {
    const wk = {};
    (rows || []).forEach(a => {
      if (!a || !a.date || this.isSalaried(a.staff_id)) return;
      const ws = this.weekStartFor ? this.weekStartFor(a.date) : (a.date || '');
      const key = this.otStaffKey(a) + '|' + ws;
      if (!wk[key]) wk[key] = { staff: this.otStaffKey(a), sid: a.staff_id, ws: ws, hours: 0, cost: 0, inHours: 0 };
      const h = a.hours || 0;
      wk[key].hours += h;
      wk[key].cost  += (a.cost || 0);
      const d = String(a.date).slice(0, 10);
      if ((!start || d >= start) && (!end || d <= end)) wk[key].inHours += h;
    });
    return wk;
  },
  // The makeup owed for one staff-week, or 0. Returns 0 for every reason the Pay Periods
  // screen refuses to judge, so the two can never disagree about who is short.
  _makeupForBucket(b, min) {
    if (!b || b.hours <= 0 || !b.sid) return 0;
    if (!this.isTipped(b.sid)) return 0;
    // setDate, never a ms offset: an offset shifts an hour across DST and rolls the day.
    const d = new Date(b.ws + 'T00:00:00');
    if (isNaN(d.getTime())) return 0;
    d.setDate(d.getDate() + 6);
    const tips = this.tipShareForStaffInWeek(b.sid, b.ws, this.ymdLocal(d));
    if (!(tips > 0)) return 0;
    const eff = (b.cost + tips) / b.hours;
    return eff < min ? (min - eff) * b.hours : 0;
  },
  tipMakeupForRows(rows) {
    const min = parseFloat(((this.laborData && this.laborData.settings) || {}).state_min_wage);
    if (isNaN(min) || min <= 0) return { total: 0, byStaff: {} };
    const wk = this._tipMakeupBuckets(rows);
    let total = 0; const byStaff = {};
    Object.keys(wk).forEach(k => {
      const m = this._makeupForBucket(wk[k], min);
      if (m <= 0) return;
      total += m;
      byStaff[wk[k].staff] = (byStaff[wk[k].staff] || 0) + m;
    });
    return { total: total, byStaff: byStaff };
  },
  /* A window that cuts weeks always under-counts, same as overtime: the slice of a short week
     inside a calendar month is not the week the minimum is tested over. Bucket whole weeks,
     compute the makeup for the WEEK, then allocate by that week's share of hours in the
     window. A window covering whole weeks allocates 1.0 and returns exactly what
     tipMakeupForRows does. PASS ALL ROWS — pre-filtering is the bug. */
  tipMakeupInWindow(rows, start, end) {
    const min = parseFloat(((this.laborData && this.laborData.settings) || {}).state_min_wage);
    if (isNaN(min) || min <= 0) return { total: 0, byStaff: {} };
    const wk = this._tipMakeupBuckets(rows, start, end);
    let total = 0; const byStaff = {};
    Object.keys(wk).forEach(k => {
      const b = wk[k];
      if (b.inHours <= 0 || b.hours <= 0) return;
      const m = this._makeupForBucket(b, min) * (b.inHours / b.hours);
      if (m <= 0) return;
      total += m;
      byStaff[b.staff] = (byStaff[b.staff] || 0) + m;
    });
    return { total: total, byStaff: byStaff };
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
    // ⚠ Every caller hands us the LIVE lc_actuals row, so putRecord's revert is a no-op for it (it
    // re-seats the array slot with the object we just changed — see App.putRecord). This is the one
    // owner of the hours -> wage -> cost math, so undoing here fixes it for every caller at once
    // rather than each screen having to remember. Without it a refused edit left Daily View and the
    // Weekly Summary showing hours and a payroll cost the server never took, and payroll export
    // reads what is on screen.
    const undo = this.snapshotRows([rec]);
    if (fields.hours != null && !isNaN(fields.hours) && fields.hours >= 0) {
      rec.hours = fields.hours;
      const wage = rec.wage != null ? rec.wage
        : (this.wageForStaffOn ? this.wageForStaffOn(rec.staff_id, rec.date) : 0);
      rec.cost = rec.hours * wage;
    }
    if (fields.notes != null) rec.notes = String(fields.notes).trim();
    rec.updated_at = new Date().toISOString();
    const ok = await this.putRecord('lc', 'actual', rec);
    if (!ok) this.restoreRows(undo);
    return ok;
  },

  // Logged hours for a staff member on a date, read from lc_actuals. Tip Log
  // and Tip Pool both auto-fill hours from here, so the lookup lives once.
  //
  // A SPLIT SHIFT is two records: Log Hours dedupes on staff_id + date + shift_type, so lunch and
  // dinner are separate rows by design. Picking one with .find() reported 4 hours for a 9-hour day
  // — and that figure is the TIP POOL denominator, so it short-paid that person and over-paid
  // everyone else. Pass `shiftType` for a single service period (Log Tips is per period); leave it
  // off and the whole day is summed, which is what the per-day Tip Pool wants. Null when nothing is
  // logged, so callers can still fall back to the schedule.
  hoursFor(staffId, date, shiftType) {
    if (!staffId || !date) return null;
    let rows = ((this.laborData && this.laborData.lc_actuals) || [])
      .filter(x => x && x.staff_id === staffId && x.date === date);
    if (shiftType) {
      rows = rows.filter(x => (x.shift_type || '') === shiftType);
      if (!rows.length) return null;
    }
    const total = rows.reduce((t, x) => t + (parseFloat(x.hours) || 0), 0);
    return total || null;
  },

  // Currently-open shift, if any. The 3rd+ consumer of this pattern, so it
  // lives in App so dropdowns can auto-fill manager / reported-by / counted-by
  // from one source of truth. Returns the most recently-started Open shift,
  // or null.
  activeShift() {
    const list = (this.shiftData && this.shiftData.sc_shifts) || [];
    const open = list.filter(s => s.status === 'Open');
    if (!open.length) return null;
    return open.slice().sort(App.cmpNewest)[0];
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

  /* ── THE "LAST N DAYS" WINDOW. One implementation, because eight of them had drifted. ─────────
     A window labelled "Last 7 Days" must contain SEVEN days, today included — so it starts at
     today-(N-1), not today-N. Eight sites had written `today - N` with an inclusive `>=`, which is
     N+1 days, and every one of them PRINTED the day count to the operator: the Server Check
     7/30/90 chips, the "90-day review" Theft & Loss Brief, vendor purchasing, the Revenue audit's
     "trailing four weeks", the Events win rate, and the vendor price re-drift sweep.
     ⚠ THIS IS NOT A NEW CONVENTION — it is the one `datePresetRange` already uses (`-27` for four
     weeks, `-83` for twelve) and the one `r-audit._windowedServerCount` uses (`-(4*7-1)`). The
     eight were the outliers, inside an app that had already decided.
     Returns the INCLUSIVE LOWER BOUND only, as 'YYYY-MM-DD'. It does not bound the top, and the
     caller must decide that separately: a window left open at the top lets one mistyped year into
     every window at once (measured: a single 2027 row moved a Last-7-Days team average from $35.00
     to $56.67, and diluted the Revenue audit's comp rate to 5% against a truth of 10%).
     ⚠ AS OF 2026-07-27 ONLY TWO CALLERS BOUND THE TOP — r-server-check's scorecard and r-audit's S4
     window, the two that were measured. cash-engine's vendor scorecard and hub's price re-drift are
     still open at the top (S217 on THE LIST). ⚠ Two more used to be on that list and went with their
     screens: the Events dashboard's win rate (deleted 2026-08-12) and theft-risk's brief (deleted
     2026-08-24 with Loss Prevention). Retiring a feature shortens this list; it does not clear it.
     Stated as a measurement with its scope, not as an all-clear.
     ⚠ Compare DATE STRINGS, not Date objects. Building the cutoff from `new Date()` keeps the
     current time of day, so a row stamped earlier in the day on the boundary date falls out and
     the same window returns different answers at 9am and 5pm. */
  /* ⛔ ONE DOOR FOR "WHAT DID THIS PERIOD TAKE", shared by the MONTHLY Form 8027 and Labor Cost
     Analysis in `hub-books.js` and the ANNUAL Form 8027 in `hub-year-end.js`. All three carried the
     identical `shifts.reduce(… total_revenue …)`, and none of them knew about the operator
     `cash-engine.js` names explicitly: *"a weekly-only operator confirms weeks and never logs
     nightly"*. For them `sc_shifts` is empty, so every one of those sheets printed $0 gross
     receipts — including the annual 8027, which is the one that gets filed. Measured on the
     deployed demo, August 2026: Line 6 $84,304 -> $0, Line 7 $6,744.32 -> $0.
     ⭐ IT LIVES ON App RATHER THAN ON EITHER SCREEN because two screens need it, and a member one
     screen borrows off another carries that screen's assumptions with it ([[lessons-paid-for]]
     #135). Two copies of a rule about a tax figure is the drift this suite exists to catch.
     ⭐ THE FALLBACK IS SAFE BECAUSE THE TWO BASES RECONCILE EXACTLY, measured before it was written:
     a confirmed week is booked whole to the month it ENDS in, so the weeks basis is a different
     WINDOW, not a different number. On the live seed the nightly log across Jul 27 to Aug 30 equals
     the confirmed weeks' bar+food for August to the cent, 94,723 both ways.
     ⚠ PREFIX, NOT A MONTH KEY, so the annual sheet asks the same question of '2026' that the
     monthly one asks of '2026-08'. `slice(0, prefix.length)` is the whole generalisation.
     ⚠ BAR + FOOD ONLY, matching what `sc_shifts.total_revenue` covers — catering and ancillary stay
     out, or the fallback widens the DEFINITION as well as the window. The field names are the
     NESTED week shape (`w.bar.revenue`), not `revenue_week`'s flat `bar_revenue`; reading the wrong
     store's names returns a silent 0, which is the defect wearing the fix's name ([[the-loop]]
     #113). `verify-books-weekly-only-operator` pins this against the Income Statement's own
     `_sumWeeks` so the two can never disagree.
     ⚠ ZERO, NEVER NULL. A genuine $0.00 rendered as a blank cell reads as "never counted", which is
     the opposite of what happened — the defect `verify-export-zero-not-blank` exists for. The
     difference between "measured zero" and "no basis" lives in `basis`, never in an empty cell. */
  /* ⛔ ONE DOOR FOR "IS THIS SALES ROW A WHOLE WEEK". Close The Week's week-total entry writes ONE
     `sc_shifts` row dated the week's end and marks it here, so nothing downstream has to infer it
     from the date. Two screens need to ask: the lane itself (to keep the week row out of the daily
     grid) and Week in Review (whose recap counts rows as DAYS and would call a week "1 day of sales
     logged"). A literal in both is the drift this suite exists to catch, and a member borrowed off
     another screen carries that screen's assumptions ([[lessons-paid-for]] #135) — so it lives here.
     ⚠ The string is the stored value; `shift_type` on a sales row is a LABEL and the Books cash
     reconciliation prints it, which is why the week row says what it is rather than 'Full Day'.
     ⛔⛔ A METHOD, NOT A DATA PROPERTY, AND I LEARNED THIS TWICE IN ONE DAY. Written as
     `WEEK_TOTAL_SHIFT_TYPE: 'Week Total'` it was invisible to `_app-lift`, which closes over the
     `App.x(` CALLS a lifted body makes and cannot see a property — so `_weekTotalType()` returned
     `undefined` in every harness, and `s.shift_type !== undefined` then EXCLUDED every row that had
     no shift_type from the save's prior-state map. `verify-manual-sales-grid` went red claiming
     three untouched days had been hand-entered, which is a data-loss shape, not a cosmetic one.
     I had already converted the screen's own `WEEK_TOTAL_TYPE` to a method for this exact reason an
     hour earlier ([[the-loop]] #16/#26/#120 — the tell is writing `NAME:` at object level). */
  weekTotalShiftType() { return 'Week Total'; },
  isWeekTotalShift(s) { return !!s && s.shift_type === this.weekTotalShiftType(); },

  grossReceiptsFor(prefix) {
    const p = String(prefix || '');
    const inP = (d) => d && String(d).slice(0, p.length) === p;
    const shifts = ((this.shiftData && this.shiftData.sc_shifts) || []).filter(s => inP(s.date));
    if (shifts.length) {
      return { value: shifts.reduce((s, sh) => s + (parseFloat(sh.total_revenue) || 0), 0), basis: 'log' };
    }
    const weeks = ((this.data && this.data.weeks) || []).filter(w => inP(w.period_end));
    if (weeks.length) {
      return {
        value: weeks.reduce((s, w) => s
          + (parseFloat(w.bar && w.bar.revenue) || 0)
          + (parseFloat(w.food && w.food.revenue) || 0), 0),
        basis: 'weeks'
      };
    }
    return { value: 0, basis: 'none' };
  },

  /* The one place a basis becomes words, so no sheet can describe a source it did not read. The
     labor analysis used to claim "Revenue from your confirmed weeks" in its footer while summing
     the nightly log — a name asserting something untrue ([[lessons-paid-for]] #99). */
  grossReceiptsBasisNote(basis) {
    if (basis === 'weeks') {
      return 'Revenue is taken from your confirmed weeks, because no nightly sales were logged for '
        + 'this period. A week is counted whole in the period it ends in, so this window can start '
        + 'before it.';
    }
    if (basis === 'none') {
      return 'No revenue basis for this period: no nightly sales were logged and no week was '
        + 'confirmed, so revenue reads zero here rather than being left blank.';
    }
    return 'Revenue is taken from your nightly logged sales for this period.';
  },

  windowCutoff(days) {
    const n = Math.max(1, Math.floor(Number(days) || 1));
    const d = new Date(); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (n - 1));
    return this.ymdLocal(d);
  },

  /* ── THE SAME WINDOW, BOUNDED AT BOTH ENDS. Use THIS unless you specifically want a bare lower
     bound (S217). `windowCutoff` returns only the floor, and six read surfaces used it with
     `>= cutoff` and nothing above — so one mistyped year sat inside every one of them at once.
     Measured at door 11 before it was bounded: a single 2027 row moved a Last-7-Days team average
     from $35.00 to $56.67, and diluted the Revenue audit's comp rate to 5% against a truth of 10%
     (wrong in the reassuring direction, which is why nothing ever reported it).
     ⭐ THE POINT OF THE HELPER: the upper bound becomes the DEFAULT rather than something every
     caller has to remember. Returns a predicate, so a row's date is tested in one place.
     ⚠ Excluding a future row from an AGGREGATE is safe because the record still lives in its own
     editable list. Where the aggregate and the record share a screen — door 11's scorecard and its
     log — the row must stay VISIBLE and be excluded from the math instead, or it can never be
     corrected. That door bounds by hand and reports the count; it is one of the two documented
     `windowCutoff` callers left. */
  inWindow(days) {
    const from = this.windowCutoff(days);
    const to = this.todayLocal();
    return d => { const s = String(d == null ? '' : d).slice(0, 10); return !!s && s >= from && s <= to; };
  },

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
    const matches = list.filter(f => f && f.week_start === ws);
    if (matches.length < 2) return matches[0] || null;
    // Row-per-record removed the blob's last-write-wins collapse, so two devices saving a
    // forecast for the same untouched week can now leave TWO rows. A bare .find would return
    // whichever the array order happened to surface, and this value drives the cash forecast,
    // the labor budget and the schedule builder — it must not depend on load order.
    // Newest wins, matching what the operator last entered.
    const key = f => String((f.updated_at || f.created_at || f.id) || '');
    return matches.slice().sort((a, b) => key(b).localeCompare(key(a)))[0];
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

  // Auto-defaults for a coming week's COVER goal, same method as
  // forecastDefaultsFor but on shift covers instead of revenue: sum covers per
  // date first (a day can run several services), then the weighted 8-week
  // same-weekday average. Returns per-day covers plus the total.
  coverDefaultsFor(weekStart) {
    const ws = this.weekStartFor(weekStart);
    if (!ws) return { per_day: {}, total: 0 };
    const shifts = (this.shiftData && this.shiftData.sc_shifts) || [];
    const covByDate = {};
    shifts.forEach(s => {
      if (!s || !s.date || s.covers == null) return;
      covByDate[s.date] = (covByDate[s.date] || 0) + (parseFloat(s.covers) || 0);
    });
    const start = new Date(ws + 'T00:00:00');
    const perDay = {};
    let total = 0;
    this.DAYS_MON_FIRST.forEach((day, idx) => {
      const target = new Date(start.getTime());
      target.setDate(target.getDate() + idx);
      const samples = [];
      for (let back = 1; back <= 8; back++) {
        const probe = new Date(target.getTime());
        probe.setDate(probe.getDate() - back * 7);
        const key = this.ymdLocal(probe);
        if (covByDate[key] != null) samples.push(covByDate[key]);
      }
      let avg = 0;
      if (samples.length) {
        let wsum = 0, vsum = 0;
        samples.forEach((v, i) => { const w = samples.length - i; vsum += v * w; wsum += w; });
        avg = wsum > 0 ? Math.round(vsum / wsum) : 0;
      }
      perDay[day] = avg;
      total += avg;
    });
    return { per_day: perDay, total: total };
  },

  // Expected revenue from confirmed events (Booked or Completed) landing in the
  // Mon-Sun week starting ws, pulled straight from the Events bookings. Uses the
  // pre-tax receipts (F&B subtotal + service charge, tax excluded) so it lines up
  // with the net-sales baseline. Added on top of the computed forecast so an
  // event week's number and its labor budget reflect the booking with no manual
  // entry. Returns 0 when Events is unavailable or nothing is booked that week.
  bookedEventRevenueForWeek(weekStart) {
    const ws = this.weekStartFor(weekStart);
    const EB = window.S && S.EventsBookings;
    if (!ws || !EB || typeof EB.quoteParts !== 'function') return 0;
    const end = this.periodEndFor(ws);
    const list = (this.data && Array.isArray(this.data.bookings)) ? this.data.bookings : [];
    return list.reduce((sum, b) => {
      if (!b || (b.stage !== 'Booked' && b.stage !== 'Completed')) return sum;
      const d = String(b.event_date || '').slice(0, 10);
      if (!d || d < ws || d > end) return sum;
      const q = EB.quoteParts(b);
      return sum + (q.subtotal || 0) + (q.service || 0);
    }, 0);
  },

  // The EFFECTIVE forecast Bar Cop uses for a week: the operator's saved
  // override if there is one (used as-is), otherwise the computed baseline
  // (weighted 8-week same-weekday average of revenue and covers) PLUS the
  // revenue of any events booked that week. This is what the schedule builder,
  // This Week, and the Revenue Forecast page read, so a week always carries a
  // real forecast, event-aware, without the operator saving anything. Cash reads
  // the plain baseline (forecastDefaultsFor) instead, since it books event cash
  // separately. `source` is 'saved' or 'auto'; on 'auto', base_total is the
  // baseline and events_total is the booked-event add. total is 0 only when
  // there is no shift history to average and nothing booked.
  effectiveForecast(weekStart) {
    const ws = this.weekStartFor(weekStart);
    if (!ws) return null;
    const saved = this.forecastForWeek(ws);
    if (saved) return Object.assign({ source: 'saved', base_total: Number(saved.total) || 0, events_total: 0 }, saved);
    const rev = this.forecastDefaultsFor(ws);
    const cov = this.coverDefaultsFor(ws);
    const events = this.bookedEventRevenueForWeek(ws);
    return {
      source: 'auto', week_start: ws,
      per_day: rev.per_day,
      base_total: rev.total, events_total: events,
      total: rev.total + events,
      covers_per_day: cov.per_day, total_covers: cov.total
    };
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
    doc.text(this._pdfSafe(venue || 'Bar Cop'), margin, y);
    doc.setFontSize(12);
    doc.text(this._pdfSafe(title), pageW - margin, y, { align: 'right' });
    y += 16;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110, 110, 110);
    const dstr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    doc.text(this._pdfSafe(dstr), margin, y);
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
    await this._savePDF(doc, this.pdfFileName(base + ' Worksheet'));
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
    /* ⚠⚠ `== null`, NOT `||` — AN EMPTY STRING IS A DELIBERATE "NO CANCEL BUTTON" (2026-07-30).
       This was `opts.cancelText || 'Cancel'`, and an empty string is falsy, so `cancelText: ''`
       fell through to the default and rendered a button labelled **Cancel**. SEVEN call sites had
       written `cancelText: ''` plainly meaning "one button" — "Could not save", "Connection
       error", "Nothing to pull yet", "The file builder did not load" — and every one of them
       showed a Cancel next to OK. On a notice the answer is discarded either way, so that button
       was a choice that does not exist, inviting the operator to cancel something that had
       already failed. Same family as [[the-loop]] #19: the code was written against an intent it
       silently did not honour. Pinned by verify-notice-one-button.js, which RUNS this function and
       counts the rendered buttons. */
    const cancelText  = opts.cancelText == null ? 'Cancel' : opts.cancelText;
    const danger      = opts.danger !== false; // default to danger (red) confirm button
    // ack-only dialog: render just the confirm button. `cancelText: ''` means the same thing and is
    // the spelling most call sites already use, so it counts here rather than needing both options.
    const oneButton   = opts.oneButton === true || cancelText === '';
    /* ⚠⚠ A THIRD ANSWER (S331). Some questions genuinely have two "yes"es and a "no": correcting a
       count that a confirmed week has already booked can be saved WITH the week updated or WITHOUT,
       and Esc must still mean "do nothing". A boolean cannot carry that, and building a second
       dialog for it would be a second implementation of the app's one confirm box.
       `altText` resolves the STRING 'alt', never `true` — so a caller that does not pass it can
       never receive it, and every existing `if (!(await App.confirm(...)))` is untouched.
       MEASURED at the time of writing: 65 call sites, exactly one passing altText. */
    const altText     = opts.altText == null ? '' : String(opts.altText);
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      // z defaults to 9500; callers layering over the plan gate (9700) pass higher.
      overlay.style.cssText = 'position:fixed;inset:0;background:var(--overlay);z-index:' + (opts.z || 9500) + ';display:flex;align-items:center;justify-content:center;padding:20px;';
      /* ⚠ `white-space:pre-line` so a message that carries its own line breaks renders as written.
         MEASURED before adding it: not one of the app's 94 `message:` strings contains a newline,
         and `pre-line` collapses runs of whitespace exactly as `normal` does — so every existing
         dialog renders byte-for-byte where it always did ([[the-loop]] #65: a shared layout change
         has to be proved inert at the old inputs, not assumed). */
      overlay.innerHTML = '<div style="background:var(--surface);border:1px solid var(--b-edge);border-radius:6px;padding:24px 28px;max-width:' + (opts.maxWidth || 420) + 'px;width:100%;">'
        + '<div style="font-size:14px;font-weight:700;color:var(--t1);margin-bottom:' + (message ? '10' : '18') + 'px;">' + (opts.titleHtml || esc(title)) + '</div>'
        + (message ? '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:18px;white-space:pre-line;">' + esc(message) + '</div>' : '')
        + '<div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">'
          + (oneButton ? '' : '<button class="btn btn-ghost" data-act="cancel">' + esc(cancelText) + '</button>')
          + (altText ? '<button class="btn btn-ghost" data-act="alt">' + esc(altText) + '</button>' : '')
          + '<button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" data-act="confirm">' + esc(confirmText) + '</button>'
        + '</div></div>';
      /* ⛔⛔⛔ THE DIALOG TAKES FOCUS, AND THAT IS NOT A POLISH ITEM (2026-08-06, found on the live
         app). The overlay is `position:fixed; inset:0; z-index:9500+`, so a second MOUSE click
         cannot reach the button that opened it — but an overlay is POINTER HIT-TESTING AND NOTHING
         ELSE ([[the-loop]] #92). It does not blur the focused element and it does not leave the tab
         order. MEASURED on the deployed build: with a delete confirm open, `document.activeElement`
         was still the Delete button — so Enter fired it again and the dialogs stacked, Tab walked
         the page behind the dialog, and a screen-reader user was never taken into it.
         ⭐⭐ FOCUS GOES TO THE **SAFE** CONTROL, and that is the whole decision. Focusing the confirm
         button would stop the stacking and arm a DESTRUCTIVE action under a held Enter — strictly
         worse than the defect it fixes. Cancel takes it when there is one; a one-button notice has
         only a safe choice, so that gets it.
         ⚠ ~65 call sites share this dialog, so the change is deliberately confined to FOCUS: no
         button, no resolve value and no Esc behaviour moves. `verify-confirm-takes-focus.js` block C
         proves that inertness rather than assuming it ([[the-loop]] #65). */
      const prevFocus = document.activeElement;
      document.body.appendChild(overlay);
      const safeBtn = overlay.querySelector('[data-act="cancel"]')
        || overlay.querySelector('[data-act="confirm"]');
      if (safeBtn && safeBtn.focus) safeBtn.focus();
      /* ⚠⚠ CLEANUP HAS TO TAKE THE KEY LISTENER WITH IT (found scanning S331; PRE-EXISTING, not
         introduced by it). Only the Esc path removed the listener, so every dialog closed by a
         BUTTON left its `keydown` handler on `document` forever, holding a detached overlay in the
         closure. The next Escape keypress anywhere in Bar Cop then ran the stale handler and
         `document.body.removeChild(overlay)` threw NotFoundError on a node that is no longer a
         child -- once per stale dialog, growing all session. The live dialog still closed (each
         listener is its own registration and a throw in one does not stop the next), which is
         precisely why nobody saw it. `cleanup` is the ONE exit now, so there is no second path to
         keep in step ([[the-loop]] step 0.6). */
      const cleanup = (val) => {
        document.removeEventListener('keydown', onKey);
        document.body.removeChild(overlay);
        /* ⛔ GIVE FOCUS BACK, BEFORE RESOLVING. Without this it falls to <body> and Tab restarts
           from the top of the page — the corollary [[the-loop]] #92 records: ask what happens to
           FOCUS when you take it off the thing that had it.
           ⚠ BEFORE `resolve`, deliberately: a caller that focuses something of its own after the
           await then wins, instead of racing this.
           ⚠ `isConnected !== false` because the launcher may be GONE — the row it sat in is often
           re-rendered by the very action being confirmed, and focusing a detached node throws in
           some browsers and silently does nothing in others. */
        if (prevFocus && prevFocus.focus && prevFocus.isConnected !== false) prevFocus.focus();
        resolve(val);
      };
      overlay.addEventListener('click', e => {
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (act === 'confirm') cleanup(true);
        else if (act === 'alt') cleanup('alt');
        else if (act === 'cancel' || e.target === overlay) cleanup(false);
      });
      // Esc cancels
      const onKey = (e) => { if (e.key === 'Escape') cleanup(false); };
      document.addEventListener('keydown', onKey);
    });
  },

  // ⚠ THE EXPORT-ACK POPUP IS GONE (2026-07-30, Kyle's call). There used to be a
  //    confirmExport() gate before Books / Year-End / Weekly P&L / Payroll / the lender
  //    forecast. Five popups, five in-memory flags, so every one reset on every page load,
  //    and three of them printed nearly the same sentence — a month-end package for the
  //    accountant meant that paragraph three times in one sitting. On four of the five it
  //    was the THIRD or FIFTH copy of a notice already on screen and already written into
  //    the file, and ToS §7/§8 carry it behind a required signup checkbox.
  //    THE PROTECTION NOW LIVES IN THE TWO CARRIERS THAT MATTER: the on-screen Heads Up
  //    box and App.deliverableFooter() inside the artifact. The file is the one that
  //    counts — it travels to the accountant or the bank, which is where a dispute starts;
  //    a popup only ever protected us against the person who already agreed to the terms.
  //    Do NOT reintroduce a pre-download gate: verify-export-notice-carried.js fails on it,
  //    and enforces the screen + file notice instead. See [[legal-protection]].

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
  // Weekly P&L Brief, Operations Audit PDF, and any
  // future operator-facing export. Centralizing means the legal language
  // stays in lockstep when it gets edited.
  //
  // Usage:
  //   For XLSX consumers (Books, Year-End, Weekly P&L):
  //     const f = App.deliverableFooter();
  //     f.disclaimerLines  // array of 3 short strings, one per sheet footer row
  //     f.workbookSubject  // single-line string for wb.Props.Subject
  //
  //   For PDF/HTML consumers (Operations Audit PDF):
  //     html += App.deliverableFooter({ kind: 'pdf-html', tagline: 'Operations Audit' });
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
      'Bar Cop is a software tool, not a CPA, accountant, tax preparer, payroll provider, attorney, or other professional advisor.',
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
    let v = Number(n);
    if (Number(v.toFixed(d)) === 0) v = 0;   // normalize -0 / tiny negatives so it never prints "-0.0%"
    return v.toFixed(d) + '%';
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

  // SUPERSEDED by weekNumFor/renumberWeekStore below. Do not reach for it: a running
  // max+1 is the bug those two helpers exist to fix.
  // ⚠ THE REASON IT SURVIVES CHANGED AT T1, so do not act on the old one. It used to read
  // "left only because the retired this-week.js still references it" — that reference was
  // this-week's saveWeek, and T1 deleted it, so NOTHING in the app calls this now. It is
  // NOT therefore free to delete: verify-week-num.js LIFTS AND RUNS it as the control that
  // proves the old shape hands a back-filled earliest week the highest number. Deleting it
  // would quietly take that control with it ([[the-loop]] #66/#72).
  // ⚠ And it is invisible to verify-no-retired-code: revenue/r-this-week.js has its own
  // nextWeekNum, and a qualified `.nextWeekNum` anywhere in the corpus reads as a reference.
  nextWeekNum() {
    const weeks = this.data?.weeks || [];
    if (weeks.length === 0) return 1;
    return Math.max(...weeks.map(w => w.week_num || 0)) + 1;
  },

  // ── week_num: a CHRONOLOGICAL label, the Nth week you have logged, ranked by
  //    period_end. NEVER a running max+1. Back-filling a missed week is a normal
  //    supported flow (Week History puts a Confirm button on every unconfirmed
  //    week), and max+1 handed that EARLIEST week the HIGHEST number. Both readers
  //    show the number beside its date in date order, so it read as nonsense:
  //    reports.js sorts the accountant export by period_end, so its Week Number
  //    column ran 3, 1, 2 down the sheet, and the sidebar labelled the newest week
  //    with a lower number than an older one. Nothing sorts or does math on
  //    week_num (checked app-wide), so re-ranking is safe. ───────────────────────
  weekNumFor(arr, pe) {
    const k = String(pe || '').slice(0, 10);
    if (!k) return 1;
    return (arr || []).filter(w => w && w.period_end
      && String(w.period_end).slice(0, 10) < k).length + 1;
  },

  // Re-rank a week store IN PLACE after an insert so the sequence stays dense and in
  // date order (a back-fill shifts every later week up one). Returns only the records
  // whose number actually moved, so the caller writes just those. A no-op on the
  // normal path (the new week is the latest) and on the seed (its week 1 is already
  // its oldest, `endAgo = (weeks.length - wk) * 7`), so the demo does not churn.
  renumberWeekStore(arr) {
    const moved = [];
    (arr || []).filter(w => w && w.period_end).slice()
      .sort((a, b) => String(a.period_end).slice(0, 10).localeCompare(String(b.period_end).slice(0, 10)))
      .forEach((w, i) => { if (w.week_num !== i + 1) { w.week_num = i + 1; moved.push(w); } });
    return moved;
  },

  // The Sunday that ENDS the current Mon-Sun week. On a Sunday that is TODAY.
  // ⚠ This used to read `(7 - d.getDay()) % 7 || 7`, and on a Sunday getDay() is 0, so the `|| 7`
  // pushed it a full week forward — the "current" week started TOMORROW and today was not in it.
  // It drives weekEnd() on the Shift cockpit, the Revenue dashboard, Confirm the Week, breakeven and
  // the Hub, so every Sunday: a close finished on Saturday read as undone (the done-key is built
  // from weekEnd, so redoing it stamped NEXT week's key and Monday opened already showing 4 of 4
  // done), "this week" counts of voids and comps read 0 with today's entries logged, and the manual
  // sales grid offered a week that had not started with no row for today.
  nextSunday() {
    const d = new Date();
    d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
    return this.ymdLocal(d);
  },

  // Newest event record by date. Event logs load date-desc from the events
  // tables, so the last array element is no longer the latest — pick by date
  // (date / period_end / generated_at) instead. Used wherever the Hub and the
  // recovery dashboards show "the latest audit / week".
  latestEvent(arr) {
    if (!Array.isArray(arr) || !arr.length) return null;
    // Same business-date field union as _recDate (keep in sync), with created_at as the last
    // resort so a record with only created_at still orders instead of collapsing to index 0.
    // ⚠ created_at is a TIEBREAKER, not just a fallback. It used to be `|| r.created_at`, so once a
    // business date existed it was never consulted — two records on the SAME date compared equal and
    // Array.sort stability returned whichever sat earlier in the array. A manager who reconciles a
    // register at close (-$60) and recounts an hour later (-$4) could have the tile show the -$60.
    // The business date still dominates; created_at only separates records that share one.
    const bd = r => String((r && (r.date || r.period_end || r.event_date || r.date_time || r.opened_date
      || r.resolved_date || r.date_reported || r.date_86 || r.filed_at || r.closed_at
      || r.generated_at || r.saved_at)) || '');
    // ⚠ created_at is NORMALISED, not compared as raw text (S69). The key is compared with
    // localeCompare, so a numeric epoch ("1782000000000") and an ISO string ("2026-07-01T...") on
    // the SAME business date order by their first byte — '1' before '2' — and the ISO one wins no
    // matter which is actually newer. Every producer in the tree writes ISO today, so nothing mixes
    // and there is no live wrong number; this makes the function correct BY CONSTRUCTION instead of
    // by that accident. An all-ISO list is byte-for-byte unaffected (pinned).
    const ts = r => {
      const c = r && r.created_at;
      if (c == null || c === '') return '';
      const n = typeof c === 'number' ? c : (/^\d+$/.test(String(c)) ? Number(c) : NaN);
      if (!isNaN(n)) { const d = new Date(n); return isNaN(d.getTime()) ? '' : d.toISOString(); }
      return String(c);
    };
    // ⛔⛔ DO NOT "SIMPLIFY" THIS BY TRUNCATING THE BUSINESS DATE (`bd(r).slice(0,10)`). That was
    // proposed, implemented and REJECTED: it makes a same-day timestamped record and a date-only
    // record produce BYTE-IDENTICAL keys, localeCompare returns 0, and Array.sort stability hands
    // the answer back to ARRAY POSITION — the class that has bitten this repo ten times and the
    // exact thing this composite key exists to end. verify-latest-event-order.js case E runs that
    // shape and proves the answer flips with input order.
    const dk = r => (bd(r) || ts(r) || '') + '|' + ts(r);
    return arr.slice().sort((x, y) => dk(y).localeCompare(dk(x)))[0];
  },

  // OLDEST-FIRST comparator for a CONFIG list (positions, checklist templates, registers,
  // rate cards, vendors, prep batches...). These arrays used to live in a JSON blob, where
  // array position WAS insertion order; they are row-per-record now and load newest-first
  // (`date DESC, id DESC`, and uid is Date.now-prefixed), so every reader that treated
  // position as "the order the operator built them in" silently inverted. Sort a COPY with
  // this instead of relying on position. created_at when present, else the id (also
  // time-prefixed, so it orders the same way).
  // ⚠ Config lists have no business date — do NOT use cmpNewest/latestEvent here; those key
  // on date fields these records don't carry, so they fail open and do nothing.
  byCreation(a, b) {
    const k = r => String((r && (r.created_at || r.id)) || '');
    return k(a).localeCompare(k(b));
  },

  // Sort comparators keyed on a record's real DATE, with created_at only as a
  // tiebreak. Use these anywhere you sort event records — NEVER sort by
  // created_at first. Event stores load date-desc and both the sample seed and
  // a batch POS import stamp every record with one identical created_at, so a
  // created_at-primary sort collapses to array order on the tie (insertion
  // order right after Re-Load, date-desc after a refresh). That is the "the
  // date flipped when I refreshed" class of bug. cmpNewest = newest first,
  // cmpOldest = oldest first. Reference as App.cmpNewest (not this.) since they
  // are passed straight to .sort() where `this` would be lost.
  // Business-date resolver for sorting event records: the UNION of every business-date field
  // used across kinds, most-specific first. Without the full list, cmpNewest silently no-ops
  // (fail open) on a kind whose date lives in an unlisted field — date_time (adjustments/
  // transfers), event_date (bookings), opened_date/resolved_date (variance investigations),
  // filed_at/closed_at. created_at is deliberately NOT here: it stays the cmpNewest tiebreak
  // (below) / latestEvent last resort, never a primary key (seed + POS imports stamp one
  // identical created_at, which would collapse the sort to array order — the "date flipped on
  // refresh" bug). NOTE: keep this field list in sync with latestEvent's `dk` above.
  _recDate(r) {
    return String((r && (r.date || r.period_end || r.event_date || r.date_time || r.opened_date
      || r.resolved_date || r.date_reported || r.date_86 || r.filed_at || r.closed_at
      || r.generated_at || r.saved_at)) || '');
  },
  cmpNewest(a, b) {
    return App._recDate(b).localeCompare(App._recDate(a))
        || String((b && b.created_at) || '').localeCompare(String((a && a.created_at) || ''));
  },
  cmpOldest(a, b) { return -App.cmpNewest(a, b); },

  // Record id. Collision-safe under bulk mint (POS imports / seed mint hundreds of ids in
  // one millisecond): a per-process monotonic counter guarantees uniqueness within this tab
  // even inside the same ms, and 6 random base36 chars (~2.2B) make a cross-device same-ms
  // collision negligible. A duplicate id would silently overwrite a record (putRecord) or
  // fail a whole bulk chunk (Postgres "ON CONFLICT cannot affect row a second time").
  _uidCounter: 0,
  uid() {
    this._uidCounter = (this._uidCounter + 1) & 0xffff;
    return Date.now().toString(36)
      + this._uidCounter.toString(36).padStart(4, '0')
      + Math.random().toString(36).slice(2, 8);
  }
};

/* ── Global screen namespace (declared in index.html before screen scripts) ── */

/* ── HTML escape ── */
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,'&#39;');
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
  const AUTH_PANELS = ['auth-login','auth-signup','auth-reset','auth-set-password','auth-paywall'];
  const show = (id) => {
    AUTH_PANELS.forEach(x => { const el = document.getElementById(x); if (el) el.style.display = x===id?'':'none'; });
  };
  document.getElementById('show-reset')?.addEventListener('click',  () => show('auth-reset'));
  document.getElementById('show-login2')?.addEventListener('click', () => show('auth-login'));
  /* ⛔ TO THE PRICING PAGE, NOT THE SIGNUP FORM. Under checkout-first the plan is chosen BEFORE
     payment, so a door that opens the account form skips the toggle entirely and lands the
     operator in the old create-account-then-pay flow. Every route to a new account has to start
     where the price is chosen. */
  document.getElementById('show-signup')?.addEventListener('click', () => {
    window.location.href = 'https://www.barcop.com/pages/pricing';
  });

  /* Signups closed: cover the card so EVERY route into it lands on the same message — the login
     link, the demo's "Run It On My Bar" button, and a bookmarked /?signup=1. The button handler
     refuses independently below, so a hidden form is not the only stop.
     ⛔⛔⛔ IT COVERS. IT DOES NOT REPLACE, AND THAT IS THE WHOLE POINT. This used to write over
     `#auth-signup .auth-card` — and that card is ALSO the "Finish Setting Up" screen every paying
     customer lands on (`_showFinishSetup`), reached from `boot()` off `needs_password`, which is
     stored ON THE ACCOUNT and so is not gated on this flag at all. Overwriting it deleted the
     email field, both password boxes and the button, so with the door shut a customer who had
     PAID and not yet set a password was handed "not taking new accounts": no password box, no way
     in, money already taken. Same defect as the $1 cover of 2026-08-13 that deleted the signup
     form out of the DOM ([[lessons-paid-for]] #59), with a flag as the trigger.
     ⚠ AND RESTORING THE HTML LATER IS NOT THE FIX EITHER: re-writing `.auth-card` rebuilds
     `#su-sp-mount` as fresh nodes, leaving `App._suSpCtrl` bound to a detached control, so Service
     Periods would come back empty with nothing on screen saying so. Nothing may destroy this card.
     ⚠ ORDER-INDEPENDENT ON PURPOSE: hiding cannot strand anything, so it does not matter whether
     a visitor opened the shut form earlier in the same page load. */
  if (!App.SIGNUPS_OPEN) {
    const _sc = document.querySelector('#auth-signup .auth-card');
    const _cc = document.getElementById('signup-closed-card');
    /* ⚠ THE FOOT IS DELIBERATELY LEFT ALONE. The shipped build only ever wrote over `.auth-card`,
       so "Already have an account? Log in" and Cancel stayed on screen under the notice. Hiding
       them here would be a visual change nobody asked for, riding in on a lockout fix. */
    if (_sc && _cc) {
      _cc.style.display = '';
      _sc.style.display = 'none';
    }
  }
  document.getElementById('show-login-from-signup')?.addEventListener('click', () => show('auth-login'));

  // Plan pickers (signup + paywall): click a card to select it. Selection is
  // read back off the card carrying the .plan-selected marker.
  const wirePlanPicker = (pickerId) => {
    const picker = document.getElementById(pickerId);
    if (!picker) return;
    const opts = Array.from(picker.querySelectorAll('.plan-opt'));
    const select = (el) => opts.forEach(o => {
      const on = o === el;
      o.classList.toggle('plan-selected', on);
      o.style.borderColor = 'var(--b-edge)';
      // ⛔ `--sel-plan-bg`, the SAME token the plan gate reads. These two were separate copies of
      // #1E2B34 and had to be changed together by hand; one token is what stops the next reprice
      // or retune moving one picker and not the other.
      o.style.background   = on ? 'var(--sel-plan-bg)' : 'var(--gold-tint)';
    });
    opts.forEach(o => o.addEventListener('click', () => select(o)));
    if (opts[0]) select(opts[0]);  // default to Monthly
  };
  /* ⛔ `wirePlanPicker('signup-plan-picker')` WAS HERE AND WIRED NOTHING — measured: no element of
     that id exists in index.html. It is debris from when the plan was chosen on the signup form,
     before the in-app gate replaced that shape. Removed rather than left looking load-bearing. */
  wirePlanPicker('paywall-plan-picker');

  /* ── THE MERGED SIGNUP FORM'S SERVICE PERIODS (Kyle's mockup, 2026-08-12) ─────────────────────
     The same control Onboarding mounts, with the same defaults: every preset except Breakfast, on.
     Mounted once here because the panel is static markup — there is nothing to re-bind, the same
     reason #tn-acct and the rail are wired once at boot.
     ⚠ LIFTED FROM THE PRESETS, never a hand-typed list: `App.SERVICE_PERIOD_PRESETS` is the one
     source of what a period is called and when it runs, and a second copy here would drift the day
     a preset changes. */
  (() => {
    const mountEl = document.getElementById('su-sp-mount');
    if (!mountEl || !window.ServicePeriods) return;
    const defaults = (App.SERVICE_PERIOD_PRESETS || [])
      .filter(p => p.name !== 'Breakfast')
      .map(p => ({ id: 'sp_su_' + p.name.toLowerCase().replace(/[^a-z]/g, ''), name: p.name, start: p.start, end: p.end }));
    App._suSpCtrl = ServicePeriods.mount(mountEl, { selected: defaults });
  })();
  const selectedPlan = (pickerId) => {
    const sel = document.querySelector('#' + pickerId + ' .plan-opt.plan-selected');
    return (sel && sel.dataset.plan) || 'monthly';
  };

  // Shared: create a checkout session for the signed-in owner and go to Stripe.
  // Sends the JWT — the endpoint verifies the caller owns the account (the server
  // derives user_id from the token, ignoring anything in the body).
  const goToCheckout = async (plan, onErr) => {
    const accountId = await DB._ensureAccountId();
    const headers = await DB._authHeaders();
    const r = await fetch('/api/create-checkout-session', {
      method: 'POST', headers,
      body: JSON.stringify({ accountId, plan })
    });
    const data = await r.json();
    if (data.url) { window.location.href = data.url; return true; }
    onErr(data.error || 'Could not start checkout. Try again, or contact support.');
    return false;
  };

  document.getElementById('signup-btn')?.addEventListener('click', async () => {
    /* Independent of the cover in wireAuth. That one hides the form; this one is the stop that
       survives a stale cached page or a console call, and it fires BEFORE DB.signUp so no auth
       user is ever minted while the door is shut.
       ⛔ FINISH MODE IS EXEMPT, AND IT HAS TO BE. This same button is the paid customer's "Finish
       Setup". That branch mints nothing — it sets a password on an account Stripe has already been
       paid for — so a shut door has nothing to protect here, and refusing it locks a paying
       customer out of the one screen that can let them in. The guard below still stands for every
       route that would create something. */
    if (!App.SIGNUPS_OPEN && !App._finishMode) {
      const e0 = document.getElementById('signup-error');
      if (e0) { e0.textContent = 'Bar Cop is not taking new accounts right now. Check back shortly.'; e0.style.display = 'block'; }
      return;
    }
    const email = document.getElementById('signup-email').value.trim();
    const pw1   = document.getElementById('signup-pw1').value;
    const pw2   = document.getElementById('signup-pw2').value;
    const tos   = document.getElementById('signup-tos').checked;
    const err   = document.getElementById('signup-error');
    const btn   = document.getElementById('signup-btn');
    const showErr = (t) => { err.textContent = t; err.style.display = 'block'; };
    err.style.display = 'none';
    if (!email || email.indexOf('@') < 1) return showErr('Enter a valid email address.');
    if (!pw1 || pw1.length < 8) return showErr('Password must be at least 8 characters.');
    if (pw1 !== pw2) return showErr('Passwords do not match.');

    /* ── THE ONBOARDING HALF, VALIDATED BEFORE ANYTHING IS CREATED ────────────────────────────
       ⛔ ORDER IS THE WHOLE POINT: every one of these refusals fires BEFORE `DB.signUp`, so a blank
       bar name can never leave a half-made auth user behind. A guard placed after the create would
       be the "what has the operator already spent" mistake — here it would be an account.
       ⚠ The rules are Onboarding.finish's, not new ones: name/city/state required, at least one
       service period, and no unnamed custom period. Copying the REASON, not just the shape. */
    const suName  = (document.getElementById('su-name').value || '').trim();
    const suCity  = (document.getElementById('su-city').value || '').trim();
    const suState = (document.getElementById('su-state').value || '').trim();
    const flag = (id, bad) => document.getElementById(id)?.closest('.f')?.classList.toggle('ob-invalid', bad);
    flag('su-name', !suName); flag('su-city', !suCity); flag('su-state', !suState);
    if (!suName || !suCity || !suState) return showErr('Enter your bar name, city and state.');

    const spAll = App._suSpCtrl ? App._suSpCtrl.value() : [];
    if (spAll.some(p => !(p.name || '').trim())) return showErr('Name your custom period, or turn it off.');
    const spPicked = spAll.filter(p => p && p.name);
    if (!spPicked.length) return showErr('Pick at least one service period.');

    // Terms were collected and recorded by Stripe on the checkout session in finish mode, so the
    // row is hidden and this refusal would be asking for something that is not on screen.
    if (!App._finishMode && !tos) return showErr('Please agree to the Terms of Use and Privacy Policy to continue.');

    /* ⭐ HANDED TO BOOT, NOT WRITTEN HERE. `App.data.settings` does not exist yet — it arrives with
       `loadAllData()` on SIGNED_IN — so this stashes the answers and boot applies them at the one
       point the settings object is guaranteed to be there. That also keeps ONE write path: boot
       already decides onboarding-or-Hub, and it now has a third case. */
    App._signupDraft = {
      bar_name: suName,
      city_state: suCity && suState ? suCity + ', ' + suState : (suCity || suState || ''),
      service_periods: spPicked
    };

    btn.textContent = App._finishMode ? 'Setting up...' : 'Creating account...'; btn.disabled = true;
    try {
      /* ⛔ FINISH MODE DIVERGES HERE AND NOWHERE ELSE. The account already exists — it was created
         from the paid Stripe session — so creating one would be a second account for a customer
         who has paid once. All that is owed is the password, and the draft above, which boot
         applies exactly as it does for the ordinary path. ONE write path, two ways in. */
      if (App._finishMode) {
        /* The marker rides in the SAME call as the password, so the two can never disagree — a
           password set without it sends them back here forever, and it without the password would
           strand them with no way to log in. `DB.setPassword` is now the only writer of both, for
           all three screens that set a password. */
        const { data: upd, error: pwErr } = await DB.setPassword(pw1);
        if (pwErr) {
          btn.textContent = 'Finish Setup'; btn.disabled = false;
          return showErr(pwErr.message || 'Could not set your password. Please try again.');
        }
        /* ⛔ REFRESH THE CACHED USER. `boot()` two lines down reads `DB._user.user_metadata`, and a
           stale copy still says password_set is missing — which routes straight back to this screen
           in a loop, on the one path where the operator has done everything right. */
        if (upd && upd.user) DB._user = upd.user;
        App._finishMode = false;
        await App.loadAllData();
        App.subscription = await DB.getSubscription();
        App.boot();
        return;
      }
      const { data: suData, error: signErr } = await DB.signUp(email, pw1);
      if (signErr) {
        btn.textContent = 'Create Account'; btn.disabled = false;
        const already = (signErr.message || '').toLowerCase().includes('registered');
        return showErr(already
          ? 'That email already has an account. Log in to Bar Cop instead.'
          : (signErr.message || 'Could not create the account.'));
      }
      // Anti-enumeration: signing up an email that already exists returns NO
      // error but an obfuscated user with empty identities and no session
      // (email confirmations are OFF, so a real new signup ALWAYS returns a
      // live session). Without this guard the handler falls through, SIGNED_IN
      // never fires, and the button hangs on "Creating account..." forever.
      if (!suData || !suData.session) {
        btn.textContent = 'Create Account'; btn.disabled = false;
        const already = Array.isArray(suData && suData.user && suData.user.identities)
          && suData.user.identities.length === 0;
        return showErr(already
          ? 'That email already has an account. Log in to Bar Cop instead.'
          : 'Could not start your account. Try again, or contact support.');
      }
      // Record the clickwrap acceptance (best-effort). Then the SIGNED_IN handler
      // boots into onboarding, then the Hub with the locked "Choose your plan"
      // popup. The account exists but stays LOCKED (server-side) until payment,
      // so backing out of Stripe never strands anyone — they just land back here.
      let accountId = null;
      for (let i = 0; i < 5 && !accountId; i++) {
        accountId = await DB._ensureAccountId();
        if (!accountId) await new Promise(r => setTimeout(r, 400));
      }
      try { await DB.recordTosAcceptance(accountId, App.TOS_VERSION, App.TOS_TERMS_URL, App.TOS_PRIVACY_URL); }
      catch (e) { console.error('ToS record failed', e); }
    } catch (e) {
      btn.textContent = 'Create Account'; btn.disabled = false;
      showErr('Connection error. Try again.');
    }
  });

  document.getElementById('paywall-btn')?.addEventListener('click', async () => {
    const err = document.getElementById('paywall-error');
    const btn = document.getElementById('paywall-btn');
    const showErr = (t) => { err.textContent = t; err.style.display = 'block'; };
    err.style.display = 'none';
    btn.textContent = 'Going to checkout...'; btn.disabled = true;
    try {
      const ok = await goToCheckout(selectedPlan('paywall-plan-picker'), showErr);
      if (!ok) { btn.textContent = 'Continue to Payment'; btn.disabled = false; }
    } catch (e) {
      btn.textContent = 'Continue to Payment'; btn.disabled = false;
      showErr('Connection error. Try again.');
    }
  });

  document.getElementById('paywall-signout')?.addEventListener('click', async () => {
    await DB.signOut();
    show('auth-login');
    App.showAuth();
  });

  // "Wrong email? Start over": discard the just-created unpaid account (frees the
  // email) and drop back on a fresh signup so they can use a different email.
  document.getElementById('paywall-different-email')?.addEventListener('click', async () => {
    const ok = await App.confirm({
      title: 'Start over with a different email?',
      message: 'This discards the account you just started. No payment was made. You will go back to sign up with a different email.',
      confirmText: 'Start Over', cancelText: 'Cancel'
    });
    if (!ok) return;
    // Same guard as abandonAndRestart: never sign out into a fresh signup if the server refused the
    // delete. "No payment was made" is the ASSUMPTION this flow is built on, and it is exactly the
    // assumption that is wrong in the webhook-lag window — so honour the server's answer.
    let refused = null;
    try {
      const headers = await DB._authHeaders();
      const accountId = await DB._ensureAccountId();
      if (accountId) {
        const resp = await fetch('/api/abandon-account', { method: 'POST', headers, body: JSON.stringify({ accountId }) });
        if (!resp.ok) refused = await App._abandonError(resp);
      }
    } catch (e) { refused = 'Could not reach the server. Nothing was changed. Please try again.'; }
    if (refused) {
      const reload = await App.confirm({
        title: 'This account is still active',
        message: refused + ' You have not been signed out. If you just paid, reload to open your account.',
        confirmText: 'Reload', cancelText: 'Stay on this page', danger: false
      });
      if (reload) window.location.reload();
      return;
    }
    try { await DB.signOut(); } catch (e) {}
    ['signup-email','signup-pw1','signup-pw2'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const tos = document.getElementById('signup-tos'); if (tos) tos.checked = false;
    App.showAuth();
    show('auth-signup');
  });

  document.getElementById('login-btn')?.addEventListener('click', async () => {
    const email = document.getElementById('login-email').value.trim();
    const pass  = document.getElementById('login-password').value;
    const err   = document.getElementById('login-error');
    const btn   = document.getElementById('login-btn');
    if (!email || !pass) { err.textContent='Enter email and password.'; err.style.display='block'; return; }
    btn.textContent='Logging in...'; btn.disabled=true;
    // Clear any stale boot marker so the SIGNED_IN that follows a successful
    // login always boots (a failed prior sign-out could leave it set, which
    // would make the guard early-return and hang the button on "Logging in...").
    App._bootedUserId = null;
    const {error} = await DB.signIn(email, pass);
    if (error) {
      btn.textContent='Log In'; btn.disabled=false;
      err.textContent=error.message; err.style.display='block';
    } else {
      // Success: keep the button in its loading state. boot() (fired by the
      // SIGNED_IN handler) replaces the whole screen, so "Logging in..." holds
      // steady until the Hub appears — no flip back to "Log In" during the
      // async loadAllData/boot handoff, and nothing clickable mid-boot.
      err.style.display='none';
    }
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
    /* ⛔ THROUGH THE HELPER. This handler set the password and then called `App.boot()` on the line
       below — and because it never stamped the marker, boot sent the customer straight to the
       finish screen, permanently. The reset link was a trap for every checkout-provisioned
       account. */
    const { data: updateData, error } = await DB.setPassword(pw1);
    if (error) {
      btn.textContent='Set Password and Sign In'; btn.disabled=false;
      msg.style.color='var(--red)'; msg.textContent=error.message; msg.style.display='block';
    } else {
      msg.style.color='var(--gold)'; msg.textContent='Password set. Signing you in...'; msg.style.display='block';
      // Manually boot since SIGNED_IN may not re-fire after updateUser. Mark the
      // booted user so a later tab-focus SIGNED_IN doesn't re-boot and bounce the
      // operator back to the Hub.
      App._bootedUserId = (DB._user && DB._user.id) || null;
      await App.loadAllData();
      App.subscription = await DB.getSubscription();
      App.boot();
    }
  });

  // One sign-out implementation, shared with the rail's Sign Out row (App._signOut).
  document.getElementById('signout-btn')?.addEventListener('click', () => App._signOut());
  // The rail overlay's backdrop / link / Escape handlers. Wired ONCE here rather than on every
  // open, so nothing accumulates a second listener each time the menu is used.
  App._wireRailMenu();
  // Mirror the page name into the top bar. Wired once, after the static nodes exist.
  App._wirePageTitle();
}

/* ⭐ THE PERMISSION UNITS ARE REGISTERED AT PARSE TIME, NOT AT BOOT, AND THAT IS DELIBERATE.
   `db.js` loads before this file, so `DB` exists here; registering a FUNCTION rather than a built
   map means nothing is computed until the first gate asks, by which point every nav source is
   loaded. Putting it inside the DOMContentLoaded block instead would tie a permission decision to a
   boot path — and `startDemo()` skips `boot()`, which is exactly how a start-up call once reached
   only one of the two ways this app produces a ready session ([[lessons-paid-for]] #101). At parse
   time there is only one path. */
if (typeof DB !== 'undefined' && DB.registerSectionMap) DB.registerSectionMap(() => App._permissionUnits());

/* ── Boot ── */
document.addEventListener('DOMContentLoaded', () => {
  // Nav items are injected dynamically   wired in App._renderNav()
  // Settings is one unified platform-wide screen (Hub-owned)
  document.getElementById('nav-settings')?.addEventListener('click', () => {
    App.navigate('settings');
  });
  wireAuth();
  // A bare App.init() left any boot-chain rejection as a silent blank page (L14) — see _bootFailed.
  App.init().catch(e => App._bootFailed(e));

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

});
