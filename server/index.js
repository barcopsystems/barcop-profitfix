'use strict';
const express  = require('express');
const path     = require('path');
const https    = require('https');
const http     = require('http');
const fs       = require('fs');
const multiparty = require('multiparty');
let XLSX;
try { XLSX = require('xlsx'); } catch(e) { XLSX = null; }
const { computeProfitAudit, computeRevenueAudit } = require('./audit-compute');
const { profitNarrative, revenueNarrative } = require('../public/components/audit-narrative');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── SIGNUPS CLOSED ──────────────────────────────────────────────────────────────────────────
// Flip to true to reopen public signup. Set false 2026-07-20, with ZERO live accounts, while the
// pre-live hardening is taken to completion. Gates the TWO endpoints that mint a new account +
// subscription: /api/create-checkout-session AND /api/add-account (adding a second bar), so nobody
// reaches payment and no new bar is created. Existing customers keep everything else — login, the
// billing portal, the Stripe webhook, invites, health — fully open; only creating a NEW bar is
// paused, and it returns the moment this flips back to true.
// ⚠ MIRRORS App.SIGNUPS_OPEN in public/app.js, which blocks the signup form in the browser.
// CHANGE BOTH. verify-signups-closed.js FAILS if they disagree, so a half-open door is caught.
const SIGNUPS_OPEN = false;

// Skip JSON parsing for the Stripe webhook route — it needs the raw body for signature verification
app.use((req, res, next) => {
  if (req.path === '/api/stripe-webhook') return next();
  express.json({ limit: '50mb' })(req, res, next);
});

// No-cache headers for JS/CSS
app.use((req, res, next) => {
  if (req.url.match(/\.(js|css)(\?.*)?$/)) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

app.use(express.static(path.join(__dirname, '..', 'public')));

// (Removed the /api/claude proxy — the app makes no Anthropic API calls anymore;
//  audits are computed and narrated entirely in code. Left no unauthenticated
//  passthrough to Claude.)

// ── Rate limiter for the two UNAUTHENTICATED audit-compute endpoints ──────────
// generate-profit-audit / generate-revenue-audit take no JWT (the public demo computes audits
// without a login) and parse up to 50MB before computing, so an un-capped flood is a CPU/bandwidth
// DoS on every tenant sharing the box. Mirrors notifyRateLimited (global backstop FIRST to defeat
// X-Forwarded-For spoofing, then per-IP, memory-bounded) but with its OWN state, so an audit flood
// and an email flood cap independently. Best-effort, in-memory, per-instance. Generous caps: a real
// operator or a demo visitor runs a handful of audits, never dozens a minute.
const _auditHits = new Map();
let _auditGlobal = [];
function auditRateLimited(req, maxPerMin, globalMax) {
  const now = Date.now();
  _auditGlobal = _auditGlobal.filter(t => now - t < 60000);
  if (_auditGlobal.length >= globalMax) return true;
  const ip = String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || 'unknown').split(',')[0].trim();
  const arr = (_auditHits.get(ip) || []).filter(t => now - t < 60000);
  if (arr.length >= maxPerMin) { _auditHits.set(ip, arr); return true; }
  arr.push(now); _auditHits.set(ip, arr);
  _auditGlobal.push(now);
  if (_auditHits.size > 5000) { for (const [k, v] of _auditHits) { if (!v.length || now - v[v.length - 1] > 60000) _auditHits.delete(k); } }
  return false;
}

// ── Profit audit — JSON only, no PDF ──────────────────────────────────────────
app.post('/api/generate-profit-audit', (req, res) => {
  if (auditRateLimited(req, 30, 150)) return res.status(429).json({ error: 'Too many audit requests. Please wait a minute and try again.' });
  const apiKey = process.env.ANTHROPIC_API_KEY;   // unused now; audit is code-only

  const form = new multiparty.Form({ maxFilesSize: 50 * 1024 * 1024 });
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ error: 'Form parse error: ' + err.message });

    const appDataStr = fields.appData?.[0] || '{}';
    let appData = {};
    try { appData = JSON.parse(appDataStr); } catch(e) {}
    let practices = {};
    try { practices = JSON.parse(fields.practices?.[0] || '{}'); } catch(e) {}

    const uploadedFiles = [];
    for (const [key, fileArr] of Object.entries(files)) {
      for (const f of fileArr) {
        if (f.size > 0) uploadedFiles.push({ field: key, path: f.path, name: f.originalFilename, size: f.size });
      }
    }

    let controlData = null;
    try { controlData = JSON.parse(fields.controlData?.[0] || 'null'); } catch(e) {}

    try {
      const auditData = await generateProfitAudit(apiKey, uploadedFiles, appData, practices, controlData);
      res.json({ ok: true, auditData });
    } catch(e) {
      console.error('Profit audit error:', e);
      res.status(500).json({ error: e.message || 'Audit generation failed' });
    } finally {
      for (const f of uploadedFiles) fs.unlink(f.path, () => {});
    }
  });
});

/* ── Profit audit — honest pipeline (2026-05-29 rebuild) ───────────────────────
   1. EXTRACTION (only if files uploaded): the model reads uploads and returns a
      small JSON of raw observed input metrics — no scores, no gaps, no prose.
   2. COMPUTE: code (computeProfitAudit) calculates every score and dollar figure
      from intake + Control data + extracted inputs. This is the source of truth.
   3. NARRATIVE: the model is GIVEN the computed numbers and writes only the
      operator-voice prose, echoing the numbers, never recomputing.
   4. MERGE: computed numbers overwrite anything the model returned, so code's
      figures are always authoritative. See memory: audit-honesty-rebuild. */
async function generateProfitAudit(apiKey, files, appData, practices, controlData) {
  // Audits no longer intake uploaded files, so nothing is extracted from them.
  // This keeps xlsx out of the request path (no ReDoS surface) and makes no
  // Anthropic API call. Scores come purely from in-app + Control data.
  const extracted = {};
  // Honest-by-construction: the audit scores solely on measured data. Self-reported
  // operating practices are intentionally ignored (nothing sends them) so a claim
  // can never override, or inflate past, what the data actually shows.
  const numbers = computeProfitAudit(appData, controlData, extracted);
  // Stamp identifiers code owns (not the model).
  numbers.AUDIT_ID = 'PFA-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 9000) + 1000);
  // (The audit's business date is stamped client-side with App.todayLocal(); the
  // server has no knowledge of the operator's timezone, so it derives no date.)
  const prose = profitNarrative(numbers);   // code-generated findings, no API
  // Computed numbers win over anything the model echoed back.
  return Object.assign({}, prose, numbers);
}

// ── Revenue audit — JSON only, no PDF ─────────────────────────────────────────
app.post('/api/generate-revenue-audit', (req, res) => {
  if (auditRateLimited(req, 30, 150)) return res.status(429).json({ error: 'Too many audit requests. Please wait a minute and try again.' });
  const apiKey = process.env.ANTHROPIC_API_KEY;   // unused now; audit is code-only

  const form = new multiparty.Form({ maxFilesSize: 50 * 1024 * 1024 });
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ error: 'Form parse error: ' + err.message });

    const appDataStr = fields.appData?.[0] || '{}';
    let appData = {};
    try { appData = JSON.parse(appDataStr); } catch(e) {}
    let practices = {};
    try { practices = JSON.parse(fields.practices?.[0] || '{}'); } catch(e) {}

    const uploadedFiles = [];
    for (const [key, fileArr] of Object.entries(files)) {
      for (const f of fileArr) {
        if (f.size > 0) uploadedFiles.push({ field: key, path: f.path, name: f.originalFilename, size: f.size });
      }
    }

    let controlData = null;
    try { controlData = JSON.parse(fields.controlData?.[0] || 'null'); } catch(e) {}

    try {
      const auditData = await generateRevenueAudit(apiKey, uploadedFiles, appData, practices, controlData);
      res.json({ ok: true, auditData });
    } catch(e) {
      console.error('Revenue audit error:', e);
      res.status(500).json({ error: e.message || 'Audit generation failed' });
    } finally {
      for (const f of uploadedFiles) fs.unlink(f.path, () => {});
    }
  });
});

/* ── Revenue audit — same honest pipeline as Profit ───────────────────────────
   EXTRACT (files -> raw input numbers) -> COMPUTE (code) -> NARRATE (prose) ->
   MERGE with computed numbers authoritative. */
async function generateRevenueAudit(apiKey, files, appData, practices, controlData) {
  // No file intake anymore — keeps xlsx out of the request path and makes no
  // Anthropic API call. Scores come purely from in-app + Control data.
  const extracted = {};
  // Honest-by-construction: scores solely on measured data; self-reported practices
  // are intentionally ignored (nothing sends them) and never override the numbers.
  const numbers = computeRevenueAudit(appData, controlData, extracted);
  numbers.AUDIT_ID = 'RFA-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 9000) + 1000);
  // (Business date is stamped client-side with App.todayLocal(); see profit audit.)
  const prose = revenueNarrative(numbers);   // code-generated findings, no API
  return Object.assign({}, prose, numbers);
}

// ── Health check (unauthenticated) ───────────────────────────────────────────
// A trivial liveness probe for uptime monitoring (e.g. UptimeRobot). Returns 200
// as long as the Node server is up and routing /api. No DB call on purpose, so a
// transient Supabase blip can't false-alarm the monitor — this checks "is the
// backend running," not "is every dependency healthy."
// Health check. Was a bare {ok:true} liveness ping, which only proved Node was running — it
// would happily report healthy while Supabase was unreachable and every customer save was
// failing. Now it actually probes the dependencies, so an external uptime monitor (UptimeRobot
// or similar, free) can watch this URL and tell you the app is BROKEN, not just "up".
//
// Safe to leave unauthenticated: it returns BOOLEANS only, never a key, an env value, a count or
// any customer data. The DB probe is cached for 30s so hammering this endpoint cannot turn into
// a database load amplifier.
// Caches the in-flight PROMISE, not just the result. Caching only the result left the window
// between "probe started" and "probe resolved" wide open: N requests arriving in that window all
// saw a stale timestamp and each fired its own service-role query. Unauthenticated, so a burst
// against /api/health became N concurrent Supabase queries and could exhaust the connection
// pool — degrading saves for every paying customer, which is the opposite of a health check's job.
let _healthCache = { at: 0, dbOk: null, inFlight: null };
app.get('/api/health', async (req, res) => {
  const out = {
    ok: true,                                   // kept for anything already pinging this
    uptime_s: Math.round(process.uptime()),
    stripe_configured: !!(process.env.STRIPE_SECRET_KEY || '').trim(),
    email_configured: !!(process.env.RESEND_API_KEY || '').trim()
      && !/resend\.dev$/i.test((process.env.BUG_REPORT_SENDER || 'onboarding@resend.dev').trim()),
    alerts_configured: !!((process.env.OPS_ALERT_EMAIL || process.env.BUG_REPORT_NOTIFY_EMAIL || '').trim())
  };
  try {
    const now = Date.now();
    if (now - _healthCache.at > 30000 && !_healthCache.inFlight) {
      _healthCache.inFlight = (async () => {
        // Bounded. Without a timeout a blackholed connection (TCP dropped, not reset) leaves this
        // promise pending forever, and because every later request now JOINS the in-flight promise
        // instead of firing its own, they all park — sockets accumulating without bound on an
        // UNAUTHENTICATED endpoint that a monitor polls on a timer. Caching the promise fixed the
        // stampede but created this; a probe that cannot answer is an unhealthy DB either way.
        const { error } = await Promise.race([
          supabaseAdmin.from('accounts').select('id', { head: true, count: 'exact' }).limit(1),
          new Promise(res => setTimeout(() => res({ error: { message: 'probe timed out after 5s' } }), 5000))
        ]);
        if (error) console.error('health: database probe failed:', error.message);
        // Stamp the time on COMPLETION, and always clear inFlight — including on a throw, or a
        // permanently failing probe would re-query on every single request forever.
        _healthCache = { at: Date.now(), dbOk: !error, inFlight: null };
        return !error;
      })().catch(e => {
        console.error('health: database probe threw:', e.message);
        _healthCache = { at: Date.now(), dbOk: false, inFlight: null };
        return false;
      });
    }
    if (_healthCache.inFlight) await _healthCache.inFlight;
    out.database = _healthCache.dbOk === null ? 'unknown' : (_healthCache.dbOk ? 'ok' : 'unreachable');
  } catch (e) {
    out.database = 'unreachable';
    console.error('health: database probe threw:', e.message);
  }
  // A reachable server with an unreachable database is NOT healthy — say so with a 503 so a
  // monitor actually pages instead of seeing 200 and staying quiet.
  if (out.database === 'unreachable') { out.ok = false; return res.status(503).json(out); }
  res.json(out);
});

// ── Stripe checkout session ───────────────────────────────────────────────────
// Per-bar billing, two prices on the one "Bar Cop" product. Price IDs come ONLY
// from the environment — there is deliberately NO hardcoded fallback. A hardcoded
// test-mode price ID is a go-live landmine: with a LIVE secret key but the price
// env unset, checkout would silently charge against the wrong (test) product.
// Missing/mis-set price envs now FAIL LOUDLY at checkout (see the guard below).
// Set STRIPE_PRICE_MONTHLY / STRIPE_PRICE_ANNUAL in every env: the test IDs in
// sandbox, the LIVE IDs in production.
// .trim() so a stray leading/trailing space pasted into the env var can't produce
// a "No such price: ' price_...'" error (a space in the pasted value is invisible
// in most dashboards but Stripe searches for the literal, space-and-all).
const STRIPE_PRICE_MONTHLY = (process.env.STRIPE_PRICE_MONTHLY || '').trim(); // $249/mo
const STRIPE_PRICE_ANNUAL  = (process.env.STRIPE_PRICE_ANNUAL  || '').trim(); // $2,490/yr
const ALL_MODULES     = ['profit', 'revenue'];
// Stripe states that count as a LIVE subscription for a bar (do not let a second one be
// created, and do not discard the account). Only terminal states (canceled,
// incomplete_expired) are absent so reactivation / a genuine fresh start still works.
const LIVE_SUB_STATES = ['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused'];

// ...but 'incomplete' must NOT block a new CHECKOUT. An 'incomplete' subscription is one whose
// very first payment never succeeded (declined card, abandoned 3-D Secure). Treating it as live
// trapped the customer between two closed doors: "Continue to Payment" 409'd here, and
// abandon-account refused to let them start over — so a failed card meant a locked Hub with no
// way out until Stripe expired the sub (~23h) or reconcile ran. Nothing is being billed on an
// incomplete sub, so retrying is safe; the handler cancels the stale one first so no orphan is
// left behind. Same reasoning for abandon-account: no money is at stake, let them start over.
const CHECKOUT_BLOCK_STATES = LIVE_SUB_STATES.filter(s => s !== 'incomplete');

// Parse a timestamp to epoch ms, forcing UTC when the string carries NO timezone.
// Why this exists: the webhook ordering guard compares subscriptions.updated_at against the
// Stripe event time (always UTC 'Z'). If that column is `timestamp` rather than `timestamptz`,
// PostgREST returns "2026-07-19T12:00:00.123456" with no offset and JS parses it as SERVER-LOCAL
// time. On a UTC-5 host every stored stamp then reads 5 hours in the FUTURE, so the guard drops
// genuinely newer events for 5 hours after each write — a customer who just fixed their card
// stays locked out. Rather than depend on the column type being right, normalise here: a
// date-time string with no 'Z' and no ±HH:MM offset is treated as UTC, which is what Postgres
// means by it. Returns 0 for null/unparseable so the guard fails OPEN (event applies).
function tsToMs(v) {
  if (!v) return 0;
  let s = String(v).trim();
  if (!s) return 0;
  // "YYYY-MM-DD HH:MM:SS[.ffffff]" -> ISO, then stamp UTC if no zone designator is present.
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(s)) {
    s = s.replace(' ', 'T');
    if (!/(Z|[+-]\d{2}:?\d{2})$/.test(s)) s += 'Z';
  }
  const ms = Date.parse(s);
  return isNaN(ms) ? 0 : ms;
}

app.post('/api/create-checkout-session', async (req, res) => {
  // SIGNUPS CLOSED — refuse before anything else runs. This is the money endpoint, so it is the
  // one that has to hold even if the browser is stale, cached, or bypassed entirely. A visitor
  // could still mint a bare Supabase auth user (that call goes browser-to-Supabase and never
  // touches this server), but without a subscription the app grants them nothing.
  if (!SIGNUPS_OPEN) {
    return res.status(503).json({ error: 'Bar Cop is not taking new accounts right now. Please check back shortly.' });
  }
  const { accountId, plan } = req.body || {};
  if (!accountId) return res.status(400).json({ error: 'Missing accountId' });

  try {
    // Verify the caller via their JWT and confirm they own/administer the target
    // account. Never trust a client-supplied user id, and never let a caller
    // start billing (which the webhook keys by account_id) for an account they
    // are not entitled to — otherwise an outsider could bind or overwrite a
    // subscription on someone else's bar.
    const authHeader = req.headers.authorization || '';
    const jwt = authHeader.replace(/^Bearer\s+/, '');
    if (!jwt) return res.status(401).json({ error: 'Missing auth token' });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !userData?.user) return res.status(401).json({ error: 'Invalid auth token' });
    const userId = userData.user.id;

    const { data: acct } = await supabaseAdmin
      .from('accounts').select('owner_user_id').eq('id', accountId).single();
    if (!acct) return res.status(404).json({ error: 'Account not found' });

    let allowed = acct.owner_user_id === userId;
    if (!allowed) {
      const { data: mem } = await supabaseAdmin
        .from('memberships').select('role').eq('account_id', accountId).eq('user_id', userId).single();
      allowed = !!(mem && mem.role === 'admin');
    }
    if (!allowed) return res.status(403).json({ error: 'Not allowed to start billing for this account.' });

    // Defense in depth: never start a second subscription for a bar that already
    // has one active. The UI gates this, but a duplicate/direct call must not
    // create a second Stripe subscription and double-charge the customer.
    const { data: existingSub } = await supabaseAdmin
      .from('subscriptions').select('subscription_status').eq('account_id', accountId).maybeSingle();
    // Block on ANY live Stripe state, not just 'active'. A past_due/unpaid/incomplete/paused
    // (or trialing) subscription is still a live subscription in Stripe; letting one through
    // here would mint a SECOND recurring subscription for the same bar (the webhook upsert
    // then orphans the first in the DB while it keeps billing in Stripe). Only terminal
    // states (canceled, incomplete_expired) fall through so reactivation still works.
    if (existingSub && CHECKOUT_BLOCK_STATES.includes(existingSub.subscription_status)) {
      return res.status(409).json({ error: 'This bar already has a subscription. Manage it under Billing.' });
    }

    const stripe = require('stripe')((process.env.STRIPE_SECRET_KEY || '').trim());

    // SOURCE-OF-TRUTH dup guard: our subscriptions row is written only by the webhook, which
    // lags checkout completion by seconds-to-minutes. In that window the DB check above sees
    // no row, so a customer who gave up on the ~12s client poll and clicked "Continue to
    // Payment" again would mint a SECOND subscription (first orphaned, keeps billing). Ask
    // Stripe directly. Scope by the account_id we stamp on the subscription (subscription_data
    // .metadata below) so a multi-bar owner (same email, one Stripe Customer per bar) is NOT
    // wrongly blocked from adding a second bar. Best-effort: a Stripe read hiccup must not
    // block a legitimate first checkout, so failures fall through to the (still-present) webhook path.
    if (userData.user.email) {
      try {
        const custs = await stripe.customers.list({ email: userData.user.email, limit: 20 });
        for (const cust of (custs && custs.data) || []) {
          const subs = await stripe.subscriptions.list({ customer: cust.id, status: 'all', limit: 20 });
          const mine = ((subs && subs.data) || []).filter(s => s.metadata && s.metadata.account_id === accountId);
          if (mine.some(s => CHECKOUT_BLOCK_STATES.includes(s.status))) {
            return res.status(409).json({ error: 'This bar already has a subscription. Manage it under Billing.' });
          }
          // Retiring the customer's failed attempt before opening a new one keeps a dead
          // 'incomplete' sub from lingering in Stripe (and from being counted by any future
          // guard). Best-effort — a failure here must never block the retry.
          // Only subs older than 15 minutes. A subscription sits in 'incomplete' for the WHOLE
          // duration of a 3-D Secure challenge, so cancelling on sight could kill the payment
          // the customer is authenticating with their bank right now — in the worst case the
          // PaymentIntent succeeds against a subscription being cancelled in the same second:
          // money captured, no access. A genuinely stale attempt is minutes old, not seconds.
          const _staleBefore = Math.floor(Date.now() / 1000) - 900;
          for (const s of mine.filter(s => s.status === 'incomplete' && (s.created || 0) < _staleBefore)) {
            try { await stripe.subscriptions.cancel(s.id); console.log('checkout: canceled stale incomplete sub ' + s.id); }
            catch (e2) { console.error('checkout: could not cancel incomplete sub ' + s.id + ':', e2.message); }
          }
        }
      } catch (e) {
        console.error('create-checkout-session: Stripe dup-check failed (non-fatal):', e.message);
      }
    }
    const priceId = plan === 'annual' ? STRIPE_PRICE_ANNUAL : STRIPE_PRICE_MONTHLY;
    // Fail loudly if the price env for this plan is not configured, rather than
    // sending an empty/undefined price to Stripe or (previously) a hardcoded test
    // ID. Prevents a charge from ever landing on the wrong product after go-live.
    if (!priceId) {
      console.error('create-checkout-session: STRIPE_PRICE_' + (plan === 'annual' ? 'ANNUAL' : 'MONTHLY') + ' is not set — refusing checkout.');
      return res.status(500).json({ error: 'Billing is not fully configured yet. Please try again shortly or contact support.' });
    }
    const sessionArgs = {
      ui_mode: 'embedded',
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      // Embedded checkout stays on app.barcop.com; on completion Stripe redirects
      // the page to return_url, where the existing ?checkout=success boot flow
      // (webhook poll + activation) takes over. The bar id makes the return land
      // on the bar that was just paid for (needed for Add Another Bar).
      return_url: 'https://app.barcop.com/?checkout=success&bar=' + accountId,
      metadata: { user_id: userId, account_id: accountId },
      // Stamp account_id onto the SUBSCRIPTION itself (session metadata does NOT propagate to
      // the subscription). The source-of-truth dup guard above reads this to scope "already
      // has a live sub" to THIS bar, so a multi-bar owner isn't blocked from adding another.
      subscription_data: { metadata: { user_id: userId, account_id: accountId } }
    };
    // Pre-fill the checkout with the account's own email so Stripe Link can't
    // auto-fill a different email remembered from a prior checkout in the same
    // browser. (Billing still keys to account_id in the webhook regardless.)
    if (userData.user.email) sessionArgs.customer_email = userData.user.email;
    const session = await stripe.checkout.sessions.create(sessionArgs);
    res.json({ clientSecret: session.client_secret, publishableKey: (process.env.STRIPE_PUBLISHABLE_KEY || '').trim() });
  } catch (e) {
    console.error('Checkout session error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── Stripe billing portal ─────────────────────────────────────────────────────
// Owner-only. Verifies the caller's JWT (never trusts a client-supplied user id)
// and confirms they own the target account before opening the portal. Billing
// lives with the account owner, so the subscription is looked up by owner id.
app.post('/api/billing-portal', async (req, res) => {
  const { accountId } = req.body || {};
  if (!accountId) return res.status(400).json({ error: 'Missing accountId' });

  try {
    const authHeader = req.headers.authorization || '';
    const jwt = authHeader.replace(/^Bearer\s+/, '');
    if (!jwt) return res.status(401).json({ error: 'Missing auth token' });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !userData?.user) {
      return res.status(401).json({ error: 'Invalid auth token' });
    }
    const requesterUserId = userData.user.id;

    const { data: acct } = await supabaseAdmin
      .from('accounts')
      .select('owner_user_id')
      .eq('id', accountId)
      .single();

    if (!acct || !acct.owner_user_id || acct.owner_user_id !== requesterUserId) {
      return res.status(403).json({ error: 'Only the account owner can manage billing.' });
    }

    const stripe = require('stripe')((process.env.STRIPE_SECRET_KEY || '').trim());
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('account_id', accountId)
      .single();

    if (error || !data?.stripe_customer_id) {
      return res.status(404).json({ error: 'No Stripe customer found for this account.' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: 'https://app.barcop.com/'
    });

    res.json({ url: session.url });
  } catch (e) {
    console.error('Billing portal error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── Stripe webhook ────────────────────────────────────────────────────────────
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabaseAdmin = createClient(
  'https://plpikfpintruksclkwyb.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { realtime: { transport: ws } }
);

// ── Demo visit counter ────────────────────────────────────────────────────────
// Rate cap for the demo counter. Deliberately NOT notifyRateLimited: that one shares a
// global bucket sized for outbound EMAIL, so demo traffic could starve a bug report or
// support request. Best-effort, in-memory, per-instance. A real visitor fires this once
// per demo load, so neither cap is reachable by honest traffic. X-Forwarded-For is
// spoofable, hence the global backstop underneath the per-IP bucket.
const _demoHits = new Map();
let _demoGlobal = [];
function demoVisitLimited(req) {
  const now = Date.now();
  _demoGlobal = _demoGlobal.filter(t => now - t < 60000);
  if (_demoGlobal.length >= 300) return true;
  const ip = String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || 'unknown').split(',')[0].trim();
  const arr = (_demoHits.get(ip) || []).filter(t => now - t < 60000);
  if (arr.length >= 10) { _demoHits.set(ip, arr); return true; }
  arr.push(now); _demoHits.set(ip, arr);
  _demoGlobal.push(now);
  if (_demoHits.size > 5000) { for (const [k, v] of _demoHits) { if (!v.length || now - v[v.length - 1] > 60000) _demoHits.delete(k); } }
  return false;
}

// The public live demo only. No account, no user, no IP: vid is a random id the
// browser keeps in localStorage, so DISTINCT visitor_id = individual visitors and
// the row count = demo views. Never throws — a counter must not break the demo.
app.post('/api/demo-visit', async (req, res) => {
  try {
    // Unauthenticated service-role insert, so cap it. Uncapped, anyone could curl a
    // fresh random vid in a loop and turn the one number this table exists to produce
    // into whatever they felt like, plus grow the table without bound.
    if (demoVisitLimited(req)) return res.json({ ok: false });
    const vid = String((req.body && req.body.vid) || '').trim().slice(0, 64);
    if (!vid) return res.json({ ok: false });
    // Referrer keeps the ORIGIN AND PATH only. document.referrer arrives raw from the
    // browser, and a query string can carry personal data (?email=, ?token=) that this
    // table promises never to hold. Which page sent them is all the counter needs.
    const rawRef = String((req.body && req.body.ref) || '').trim();
    const ref = rawRef ? (rawRef.split('?')[0].split('#')[0].slice(0, 300) || null) : null;
    await supabaseAdmin.from('demo_visits').insert({ visitor_id: vid, referrer: ref });
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false });
  }
});

// ── Operational alerting ────────────────────────────────────────────────────────
// Until 2026-07-19 the ONLY way a customer's problem reached Kyle was the manual bug form.
// Everything else — a blocked wipe, a denied write, a reconcile abort — ended in console.error
// on a machine nobody watches. These two functions close that: alertOps() for the handful of
// events that mean act-now, and a once-a-day digest for everything else so the immediate alerts
// stay rare enough to still mean something.
async function alertOps(subject, lines) {
  try {
    const apiKey = (process.env.RESEND_API_KEY || '').trim();
    const to = (process.env.OPS_ALERT_EMAIL || process.env.BUG_REPORT_NOTIFY_EMAIL || '').trim();
    if (!apiKey || !to) { console.warn('alertOps: not configured, skipping:', subject); return false; }
    const from = (process.env.BUG_REPORT_SENDER || 'onboarding@resend.dev').trim();
    const esc = (s) => String(s == null ? '' : s).replace(/[<>&"]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;' }[c]));
    const html = '<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:640px;padding:20px;color:#111;">'
      + '<div style="font-size:11px;font-weight:700;letter-spacing:2px;color:#C03828;">BAR COP OPS ALERT</div>'
      + '<div style="font-size:17px;font-weight:700;margin:6px 0 14px;">' + esc(subject) + '</div>'
      + '<pre style="font-size:12px;background:#f6f6f6;padding:12px;white-space:pre-wrap;">'
      + esc((lines || []).join('\n')) + '</pre>'
      + '<div style="font-size:11px;color:#888;margin-top:14px;">' + esc(new Date().toISOString()) + '</div></div>';
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject: 'Bar Cop ALERT: ' + subject, html })
    });
    // An unchecked send meant the ALERTING ITSELF could fail silently — the one thing that must
    // never be quiet. Nothing can be emailed about a failed email, so make it loud in the log.
    if (!resp.ok) {
      console.error('!! alertOps SEND FAILED — this alert did NOT reach anyone:', resp.status, await resp.text());
      console.error('!! the alert was:', subject, '|', (lines || []).join(' | '));
      return false;
    }
    return true;
  } catch (e) {
    console.error('!! alertOps SEND FAILED (exception) — this alert did NOT reach anyone:', e.message);
    console.error('!! the alert was:', subject, '|', (lines || []).join(' | '));
    return false;
  }
}

// Once-a-day roll-up of client_errors. Read with the SERVICE ROLE so it sees every account
// (the table's RLS scopes operators to their own bar). Grouped by kind so a single broken screen
// hitting 40 users reads as one line, not 40 alerts.
async function sendErrorDigest() {
  try {
    // Report ONLY events not already reported. The naive "last 24h" version re-sent the SAME
    // digest after every deploy, because each restart re-armed the boot timer and the window
    // still covered events already emailed. An alert that repeats itself is one you train
    // yourself to ignore, which defeats the entire point of having it.
    //
    // The high-water mark is stored as a marker row in client_errors itself (kind
    // 'digest_sent'), so this survives a restart with no extra table and no SQL for Kyle to
    // run. The server reads with the service role, which bypasses RLS, so a null account/user
    // on the marker is fine.
    // Retention FIRST, before any early return. client_errors is writable by any authenticated
    // user and nothing else bounds it, so without a prune it grows forever — on a small Supabase
    // tier that becomes a disk-pressure event that takes the actual product down. This has to run
    // on EVERY pass, not just the ones that send: the table grows most quietly on the days there
    // is nothing to report, which is exactly when the send path returns early. 30 days is well
    // past the point a row is useful (the digest reports within a day) and it bounds the marker
    // rows too. Piggy-backed on the daily job, so no scheduler and no pg_cron needed.
    // ⚠ The prune must NOT eat the high-water markers. They live in this same table, so a blanket
    // 30-day delete removed them too — and if the digest had not sent for over 30 days (server
    // down, OPS_ALERT_EMAIL unset, Resend broken) the newest marker vanished, `since` fell back
    // to 24h, and every unreported event between 24h and 30 days old was silently skipped and
    // then deleted on the same pass. That is precisely the go-silent failure this mechanism
    // exists to prevent. Markers are ~1 row per send, so a far longer horizon costs nothing.
    const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const markCutoff = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString();
    // (the EVENT prune moved below, after `since` is known — it must never outrun the mark)
    const { error: markPruneErr } = await supabaseAdmin.from('client_errors')
      .delete().lt('created_at', markCutoff).eq('kind', 'digest_sent');
    if (markPruneErr) console.error('errorDigest: marker prune failed (non-fatal):', markPruneErr.message);

    const { data: mark, error: markErr0 } = await supabaseAdmin
      .from('client_errors')
      .select('created_at').eq('kind', 'digest_sent')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    // A swallowed error here read as "no mark", which falls back to the retention cutoff and
    // re-reports the entire 30-day window. That was one 500-row page before the drain loop; it
    // is now up to 10,000 events, arriving with no explanation. A transient read failure must
    // not look like a fresh install — skip this pass and try again rather than mass-duplicate.
    if (markErr0) { console.error('errorDigest: could not read the high-water mark, skipping this pass:', markErr0.message); return; }
    // Clamp the mark: client_errors rows are written by the BROWSER, so created_at is
    // attacker-controlled. A single row stamped in the year 2099 would push the mark into the
    // future and silence every future digest — permanently, and looking exactly like a healthy
    // quiet system. The RLS policy now bounds created_at too; this is the belt to that braces,
    // because the server must not be one bad row away from going blind.
    const nowIso = new Date().toISOString();
    // With NO usable mark, fall back to the RETENTION cutoff, not 24h. Everything still in the
    // table is newer than the cutoff (the prune above guarantees it), so this reports the whole
    // surviving backlog rather than silently dropping anything older than a day. A 24h fallback
    // meant a digest returning after any outage longer than a day quietly lost the gap.
    let since = (mark && mark.created_at) || cutoff;
    let markUntrusted = false;
    if (since > nowIso) {
      const poisoned = since;
      console.error('errorDigest: stored high-water mark is in the FUTURE (' + poisoned + ') — ignoring it and reporting the full retained window.');
      since = cutoff;
      markUntrusted = true;
      // DELETE the poisoned marker rather than merely ignoring it. The mark is read newest-first
      // and the marker prune above only removes markers OLDER than a year, so a future-dated
      // marker SHADOWS every marker written after it: the pass makes zero forward progress and
      // repeats identically until wall-clock catches up. A container clock stepping back 30 days
      // therefore meant 30 consecutive full-window emails, and a daily identical 10,000-event
      // digest is functionally the same silence this module exists to prevent. Safe to delete
      // because the server never writes a future marker — markAt is clamped below — so any marker
      // ahead of now is invalid by construction rather than merely surprising.
      const { error: badMarkErr } = await supabaseAdmin.from('client_errors')
        .delete().gt('created_at', nowIso).eq('kind', 'digest_sent');
      if (badMarkErr) console.error('errorDigest: could not remove the future-dated marker:', badMarkErr.message);
      // And tell a HUMAN. Both arms of this branch were console-only, which is precisely the
      // failure this file's own header calls out: a log on a machine nobody watches reaches no
      // one. This is also the single condition the digest cannot report on itself, because the
      // digest is the thing that is stuck.
      await alertOps('Bar Cop digest: high-water mark was in the FUTURE and has been cleared', [
        'The stored digest marker read ' + poisoned + ', which is ahead of server time (' + nowIso + ').',
        'Retention was SKIPPED for this pass and the bad marker was deleted, so the next run should recover.',
        'If this repeats, the cause is the container clock or a client-supplied created_at.'
      ]);
    }
    // Prune events ONLY up to the older of (retention cutoff, high-water mark). Deleting on age
    // alone let the prune outrun the digest: if reporting ever fell more than 30 days behind,
    // rows aged out having never been emailed — silent permanent loss of exactly the events the
    // backlog was too big to reach. Never delete something that has not been reported.
    // ...and do not prune AT ALL on a pass where the mark was unusable. The clamp above forces
    // `since` FORWARD to the retention cutoff, and pruneBefore is derived from that same variable,
    // so the guard inverts into "delete the whole backlog this pass just declined to report".
    // Reachable after any stretch where reporting fell behind (revoked Resend key, unset
    // OPS_ALERT_EMAIL, server down) held the prune back, followed by a poisoned or clock-skewed
    // mark. A bad mark means we do not know what has been reported, so nothing here is safe to
    // delete; retention waits one pass, which costs a day of rows and no correctness.
    if (markUntrusted) {
      console.warn('errorDigest: retention prune SKIPPED — the stored mark was unusable, so nothing in this table is provably reported. It resumes next pass.');
    } else {
      const pruneBefore = since < cutoff ? since : cutoff;
      const { error: pruneErr } = await supabaseAdmin.from('client_errors')
        .delete().lt('created_at', pruneBefore).neq('kind', 'digest_sent');
      if (pruneErr) console.error('errorDigest: retention prune failed (non-fatal):', pruneErr.message);
    }
    // ASCENDING + stamp at the LAST row: with descending order the marker jumped to the newest
    // event, so a burst larger than the 500 cap silently discarded everything older than the
    // newest 500 — which is where the root cause of a burst usually is. Ascending means an
    // oversized burst is reported oldest-first across successive runs and nothing is skipped.
    // DRAIN, don't take one page. A single 500-row page + a 24h interval capped throughput at
    // 500 events/day with no way to catch up: a 3,000-event burst would take six days to finish
    // reporting, and the retention prune deletes on age alone — so a backlog deeper than 30 days
    // loses unreported rows permanently. Worse, it looks healthy: the same "500 event(s)" subject
    // arrives daily whether it is draining a month-old backlog or reporting yesterday.
    // Bounded at 20 pages (10k events) so one runaway client can't make this unbounded work;
    // whatever is left is picked up next run, and the count in the email is the honest total.
    const PAGE = 500, MAX_PAGES = 20;
    const data = [];
    let cursor = since, truncated = false;
    for (let page = 0; ; page++) {
      if (page >= MAX_PAGES) { truncated = true; break; }
      let { data: chunk, error } = await supabaseAdmin   // `chunk` is trimmed below, so not const
        .from('client_errors')
        .select('kind, message, user_email, app_version, screen, created_at')
        .gt('created_at', cursor)
        .neq('kind', 'digest_sent')
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })   // deterministic within a timestamp; ids are bigserial
        .limit(PAGE);
      if (error) {
        console.error('errorDigest read failed:', error.message);
        if (!data.length) return;         // nothing gathered at all — try again next run
        break;                            // partial gather: report what we have, mark advances only that far
      }
      if (!chunk || !chunk.length) break;
      // ⚠ THE CURSOR IS created_at ALONE WHILE THE SORT IS (created_at, id) — so when a group of
      // rows sharing ONE exact timestamp straddles the page boundary, the next .gt(created_at)
      // JUMPS OVER every remaining member of that group. They are never reported and the prune
      // below then deletes them, so the events are gone and the digest looks healthy while it
      // happens. Rather than build a composite keyset filter out of a timestamp string (PostgREST
      // .or() would need the value quoted, and this query cannot be exercised locally), TRIM the
      // trailing rows that share this page's newest timestamp and let the next page re-read them.
      // Costs at most one partial page of re-reads; never skips.
      const wasFull = chunk.length === PAGE;
      if (wasFull) {
        const lastTs = chunk[chunk.length - 1].created_at;
        let cut = chunk.length;
        while (cut > 0 && chunk[cut - 1].created_at === lastTs) cut--;
        // cut === 0 means all PAGE rows share one timestamp. Trimming would empty the page and
        // spin forever, so keep it whole and accept the jump — it needs 500+ rows written inside
        // one clock tick, and stalling the digest permanently is the worse failure.
        if (cut > 0) chunk = chunk.slice(0, cut);
        else console.warn('errorDigest: ' + PAGE + ' rows share one timestamp; cannot page past them safely.');
      }
      data.push(...chunk);
      cursor = chunk[chunk.length - 1].created_at;
      if (!wasFull) break;
    }
    if (!data.length) { console.log('errorDigest: nothing new since ' + since); return; }
    if (truncated) console.warn('errorDigest: hit the ' + (PAGE * MAX_PAGES) + '-event page cap; the remainder reports on the next run.');
    const byKind = {};
    data.forEach(r => {
      const k = r.kind || 'unknown';
      if (!byKind[k]) byKind[k] = { n: 0, users: new Set(), samples: [] };
      byKind[k].n++;
      if (r.user_email) byKind[k].users.add(r.user_email);
      if (byKind[k].samples.length < 3) {
        byKind[k].samples.push('    ' + (r.message || '').slice(0, 140)
          + (r.screen ? '  [' + r.screen + ']' : '') + (r.app_version ? '  (' + r.app_version + ')' : ''));
      }
    });
    // Most-frequent first, but the data-safety kinds always read as urgent regardless of count.
    const URGENT = ['wipe_blocked', 'restore_aborted', 'rls_denied', 'backfill_failed', 'storage_full', 'session_expired'];
    const lines = Object.keys(byKind)
      .sort((a, b) => (URGENT.includes(b) - URGENT.includes(a)) || (byKind[b].n - byKind[a].n))
      .map(k => (URGENT.includes(k) ? '!! ' : '   ') + k + ' — ' + byKind[k].n + ' event(s), '
        + byKind[k].users.size + ' user(s)\n' + byKind[k].samples.join('\n'));
    const urgentHit = Object.keys(byKind).filter(k => URGENT.includes(k));
    const sent = await alertOps('Daily error digest: ' + data.length + ' event(s)'
      + (urgentHit.length ? ' INCLUDING ' + urgentHit.join(', ') : ''), lines);
    // Advance the mark ONLY on a confirmed send. Advancing it after a failed send (a Resend
    // rate limit, an expired key, any 5xx) would permanently exclude that window from every
    // future digest — including wipe_blocked and restore_aborted, the two this code itself
    // labels urgent. Better to re-send a duplicate tomorrow than to lose the events.
    if (!sent) {
      console.error('errorDigest: send FAILED — high-water mark NOT advanced, these ' + data.length
        + ' event(s) will be retried on the next run.');
      return;
    }
    // Stamp at the LAST (newest) row of this ascending page, so an oversized burst resumes from
    // exactly where this run stopped rather than skipping the remainder.
    // Never stamp the mark in the FUTURE. RLS deliberately allows a client to postdate a row by
    // up to 5 minutes (SUPABASE_SETUP.sql: created_at < now() + interval '5 minutes') and these
    // rows are written by the BROWSER, so the newest row's timestamp is attacker-influenced. The
    // mark is GLOBAL — one service-role read across every account — so one tenant's postdated row
    // would set the watermark for everybody, and every genuine error created inside that window
    // is then skipped by the next run's .gt('created_at', cursor) and deleted by the prune.
    // Clamping costs at most one re-reported row on the next pass; not clamping costs a blind
    // window a client can reopen on demand (/api/health is unauthenticated and returns uptime_s,
    // so the firing time is observable). nowIso is from the top of this pass, which only makes
    // the clamp more conservative.
    const lastAt = data[data.length - 1].created_at;
    const markAt = lastAt > nowIso ? nowIso : lastAt;
    const { error: markErr } = await supabaseAdmin.from('client_errors').insert({
      kind: 'digest_sent', message: 'reported ' + data.length + ' event(s)',
      created_at: markAt
    });
    if (markErr) console.error('errorDigest: marker insert failed (next run will re-send these):', markErr.message);
    console.log('errorDigest: sent, ' + data.length + ' events');
  } catch (e) { console.error('sendErrorDigest failed (non-fatal):', (e && e.message) || e); }
}

// Best-effort "Welcome to Bar Cop" email, sent from the checkout webhook once a NEW
// subscriber is active (on top of Stripe's own receipt). Never throws — a failed or
// unconfigured send must not break account provisioning.
async function sendWelcomeEmail(email, barName) {
  try {
    const apiKey = (process.env.RESEND_API_KEY || '').trim();
    if (!apiKey || !email) return;
    const from    = (process.env.WELCOME_SENDER || process.env.BUG_REPORT_SENDER || 'onboarding@resend.dev').trim();
    const replyTo = (process.env.SUPPORT_NOTIFY_EMAIL || 'support@barcop.com').trim();
    const esc = (s) => String(s == null ? '' : s).replace(/[<>&"]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;' }[c]));
    const nm  = String(barName == null ? '' : barName).trim();
    const bar = (nm && nm !== 'My Bar') ? esc(nm) : '';
    const gold = '#DBAB46';
    const appUrl  = 'https://app.barcop.com';
    const helpUrl = 'https://www.barcop.com/blogs/help';
    const html =
        '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Arial,sans-serif;max-width:560px;margin:0 auto;color:#14222A;">'
      +   '<div style="background:#070E16;padding:20px 28px;text-align:center;">'
      +     '<img src="https://app.barcop.com/assets/logo.png" alt="Bar Cop" width="190" height="33" style="display:inline-block;border:0;width:190px;height:33px;color:#ffffff;font-size:20px;font-weight:800;letter-spacing:0.5px;line-height:33px;" />'
      +   '</div>'
      +   '<div style="padding:26px 28px;font-size:15px;line-height:1.6;color:#2A3942;">'
      +     '<div style="font-size:22px;font-weight:800;color:#14222A;margin-bottom:14px;">You\'re in.</div>'
      +     '<p style="margin:0 0 14px;">Welcome to Bar Cop' + (bar ? '. You just set up <b>' + bar + '</b>' : '') + '. From here, Bar Cop does one job: it turns the numbers you already have into the money you\'re leaving on the table.</p>'
      +     '<p style="margin:0 0 14px;">The loop is simple. Close your three Control sections each week (Inventory, Labor, Shift), work the money in Recovery (Profit, Revenue, Cash), then chase only what the week flags. Run your first audit and Bar Cop shows your biggest leaks in real dollars.</p>'
      +     '<p style="margin:0 0 18px;"><b>Where to start:</b> open Bar Cop and work the Get Started steps on your Hub. Add your products, take a count, close a week. Your numbers start paying off from week one.</p>'
      +     '<div style="margin:0 0 22px;"><a href="' + appUrl + '" style="display:inline-block;background:' + gold + ';color:#14222A;font-weight:800;font-size:14px;text-decoration:none;padding:13px 26px;border-radius:6px;">Open Bar Cop</a></div>'
      +     '<p style="margin:0 0 8px;font-weight:700;color:#14222A;">A few things worth knowing:</p>'
      +     '<ul style="margin:0 0 18px;padding-left:20px;">'
      +       '<li style="margin-bottom:6px;">Stuck on anything? The <a href="' + helpUrl + '" style="color:' + gold + ';font-weight:700;">Help Center</a> walks every screen.</li>'
      +       '<li style="margin-bottom:6px;">Questions? Just reply to this email, or reach <a href="mailto:support@barcop.com" style="color:' + gold + ';font-weight:700;">support@barcop.com</a>.</li>'
      +       '<li style="margin-bottom:6px;">Your subscription lives under <b>Settings &rarr; Your Account</b>. Cancel anytime; access runs through the period you\'ve paid for.</li>'
      +     '</ul>'
      +     '<p style="margin:0 0 16px;">Bar Cop was built by an operator who spent years watching good money walk out the door. Now it\'s yours. Let\'s go find it.</p>'
      +     '<p style="margin:0;color:#14222A;font-weight:700;">&mdash; Kyle, Bar Cop</p>'
      +   '</div>'
      +   '<div style="padding:16px 28px;border-top:1px solid #E5E9EC;font-size:11px;color:#8A98A0;">'
      +     'Bar Cop &middot; <a href="mailto:support@barcop.com" style="color:#8A98A0;">support@barcop.com</a><br>'
      +     '&copy; 2004&ndash;' + new Date().getFullYear() + ' Bar Cop'
      +   '</div>'
      + '</div>';
    // Bound the call so a hung Resend can never keep this promise (or, historically,
    // the webhook) pending. It is fired without await now, but the timeout also stops
    // a stuck socket from leaking.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    let resp;
    try {
      resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: email, subject: 'Welcome to Bar Cop', html, reply_to: replyTo }),
        signal: ctrl.signal
      });
    } finally { clearTimeout(timer); }
    if (!resp.ok) console.error('welcome email send failed:', resp.status, await resp.text());
  } catch (e) {
    console.error('welcome email error (non-fatal):', e.message);
  }
}

// Apply a subscription-event update to exactly the row for THIS Stripe subscription.
// Keying on the subscription id (not the customer) is the fix for the two-bars case:
// if an operator ever runs two bars under one Stripe Customer, a customer-keyed update
// would clobber the other bar's access. Rows created before we stored the subscription
// id have it null; we match those by customer once and stamp the id so every later
// event keys precisely.
// Returns { ok, changed, retry?, ambiguous?, error? } — the write can FAIL (transient DB error),
// and a discarded failure left a paying customer stuck in the wrong access state while every
// caller reported success. ok=false + retry means "the DB write failed, try again" (the webhook
// re-raises so Stripe re-delivers; reconcile counts it as a failure, not a fix). A stale event or
// an empty match is ok:true/changed:false — a legitimate no-op, not a failure.
async function applySubUpdate(sub, update, eventIso) {
  const subId = sub.id;
  const customerId = sub.customer;
  // Read the row keyed on THIS subscription id first, so we can (a) apply an ORDERING GUARD
  // and (b) never fall through to the customer-fallback when the row exists but the event is
  // stale. Stripe does not guarantee delivery order and retries old events — without the
  // guard, a re-delivered older 'past_due' could overwrite a newer 'active' and lock a
  // good-standing customer behind the past-due gate.
  const { data: existing, error: readErr } = await supabaseAdmin
    .from('subscriptions').select('account_id, updated_at')
    .eq('stripe_subscription_id', subId).maybeSingle();
  // A discarded READ error is the same silent drop as a discarded write. supabase RESOLVES a soft
  // read failure (timeout, pool exhaustion, PostgREST 5xx) as { data:null, error } rather than
  // rejecting — so without this an errored read looks like "no such row", falls through to the
  // customer-fallback, matches zero already-stamped candidates, and returns changed:false. The
  // webhook then 200s and Stripe never re-delivers. Treat a read error as retryable.
  if (readErr) return { ok: false, changed: false, retry: true, error: readErr.message || String(readErr) };
  if (existing) {
    const storedMs = tsToMs(existing.updated_at);
    const eventMs  = tsToMs(eventIso);
    // Drop only a STRICTLY-older event (same-second transitions still apply, last wins).
    if (eventMs && storedMs && storedMs > eventMs) return { ok: true, changed: false };
    const { error } = await supabaseAdmin
      .from('subscriptions').update({ ...update, updated_at: eventIso || update.updated_at })
      .eq('stripe_subscription_id', subId);
    if (error) return { ok: false, changed: false, retry: true, error: error.message || String(error) };
    return { ok: true, changed: true };
  }
  // Legacy/backfill: no row carries this subscription id yet. Match the customer's
  // row(s) that have no subscription id stored, and stamp it going forward.
  // Look FIRST and stamp exactly one row. Running this as a filtered update is an
  // unbounded multi-row write: two un-stamped rows under one Stripe Customer and a
  // single cancel event would set canceled + active_modules [] on BOTH bars, locking a
  // still-paying one out of everything. That is precisely the clobber the
  // subscription-id keying above exists to prevent, and it is reachable because
  // stripe_subscription_id arrived by ALTER TABLE, so every pre-existing row is null
  // until its first event. If it is ambiguous, do nothing and say so: a missed webhook
  // is recoverable, a wrongly canceled paying customer is not.
  const { data: cands, error: candErr } = await supabaseAdmin
    .from('subscriptions').select('account_id')
    .eq('stripe_customer_id', customerId).is('stripe_subscription_id', null);
  // Same as the read above: an errored candidate lookup must not read as "no candidates" and drop
  // the event silently — retry it.
  if (candErr) return { ok: false, changed: false, retry: true, error: candErr.message || String(candErr) };
  if (!cands || !cands.length) return { ok: true, changed: false };
  if (cands.length > 1) {
    console.error('applySubUpdate: ' + cands.length + ' un-stamped subscription rows for customer ' + customerId
      + '; refusing to guess which one ' + subId + ' belongs to. Stamp stripe_subscription_id by hand.');
    // A deliberate refusal, not a transient failure: retrying cannot resolve the ambiguity, only a
    // manual stamp can, so do NOT ask Stripe to re-deliver forever.
    return { ok: false, changed: false, ambiguous: true, retry: false };
  }
  const { error } = await supabaseAdmin
    .from('subscriptions').update({ ...update, stripe_subscription_id: subId, updated_at: eventIso || update.updated_at })
    .eq('account_id', cands[0].account_id).is('stripe_subscription_id', null);
  if (error) return { ok: false, changed: false, retry: true, error: error.message || String(error) };
  return { ok: true, changed: true };
}

// ── Missed-webhook reconciliation ────────────────────────────────────────────
// Access is webhook-driven, so a dropped Stripe event can leave a canceled sub stuck 'active'
// (a churned customer keeps free access) or a paid one stuck inactive (a wrong lockout). This
// re-checks every stamped subscription against Stripe — the source of truth — and corrects any
// drift. Runs nightly in-process (scheduled near app.listen) and can be triggered manually via
// the protected endpoint below. Uses "now" as the event time so the true current status wins
// over any older webhook stamp (applySubUpdate's ordering guard).
async function reconcileSubscriptions() {
  const stripe = require('stripe')((process.env.STRIPE_SECRET_KEY || '').trim());
  // Page past PostgREST's 1000-row cap — an unpaged read silently stops reconciling every
  // customer past the first page while still logging a healthy "checked 1000".
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .select('account_id, stripe_subscription_id, subscription_status')
      .not('stripe_subscription_id', 'is', null)
      .order('account_id', { ascending: true })
      .range(from, from + 999);
    if (error) { console.error('reconcile: could not read subscriptions:', error.message); return { checked: 0, fixed: 0 }; }
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  // ⚠ SAFETY PROBE — do not remove. A Stripe key that addresses a DIFFERENT Stripe account
  // (test key against live subs, a mis-rotated key, a staging box booted with the prod
  // service-role key) makes EVERY retrieve below return resource_missing/404, and that branch
  // marks the row canceled. Unattended, that cancels the entire customer base in one pass and
  // the RESTRICTIVE require_active_sub policy then denies every write for all of them.
  // resource_missing is only trustworthy once we know the key can see SOMETHING here.
  if (rows.length) {
    try {
      // status:'all' is REQUIRED. Stripe's default excludes canceled subscriptions, while the DB
      // read above keeps every row with a subscription id regardless of status. So once every
      // sub is canceled (entirely normal for a young product, guaranteed on a wound-down test
      // account) the probe returned empty, this guard aborted, and reconciliation disabled
      // itself permanently — re-aborting every 24h and emailing a false "wrong Stripe account"
      // alarm daily. Reconcile is what catches a dropped webhook for a RETURNING customer.
      const probe = await stripe.subscriptions.list({ limit: 1, status: 'all' });
      if (!probe || !probe.data || !probe.data.length) {
        console.error('reconcile: ABORT — Stripe reports no subscriptions at all while the DB holds '
          + rows.length + '. Refusing to run: this is the signature of a key pointed at the wrong Stripe account.');
        await alertOps('Reconcile aborted — Stripe key may point at the wrong account', [
          'Stripe returned ZERO subscriptions while the database holds ' + rows.length + '.',
          'The pass was refused. No subscription was changed.',
          'Check STRIPE_SECRET_KEY on this instance (test key against live data?).'
        ]);
        return { checked: 0, fixed: 0, aborted: 'stripe-empty' };
      }
    } catch (e) {
      console.error('reconcile: ABORT — could not reach Stripe:', (e && e.message) || e);
      await alertOps('Reconcile aborted — Stripe unreachable', [
        'Could not reach Stripe to verify subscriptions.',
        'The pass was refused. No subscription was changed.',
        String((e && e.message) || e)
      ]);
      return { checked: 0, fixed: 0, aborted: 'stripe-unreachable' };
    }
  }
  // Cancelling is the only irreversible-feeling action here, so cap it. A correct pass cancels
  // a handful of churned subs; a wrong-account key cancels everything.
  const cancelCap = Math.max(5, Math.ceil(rows.length * 0.1));
  let checked = 0, fixed = 0, canceled = 0, writeFailed = 0;
  for (const row of rows || []) {
    try {
      const sub = await stripe.subscriptions.retrieve(row.stripe_subscription_id);
      checked++;
      if (sub.status === row.subscription_status) continue;   // in sync, nothing to do
      const cpe = sub.current_period_end != null ? sub.current_period_end
                : (sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].current_period_end);
      const periodEnd = cpe ? new Date(cpe * 1000).toISOString() : null;
      const nowIso = new Date().toISOString();
      const update = { subscription_status: sub.status, updated_at: nowIso };
      if (periodEnd) update.current_period_end = periodEnd;
      if (sub.status === 'active') { update.active_modules = ALL_MODULES; update.subscription_plan = 'full_access'; }
      else if (sub.status === 'canceled') { update.active_modules = []; }
      const r = await applySubUpdate(sub, update, nowIso);
      // Count a fix ONLY when a row actually changed. A discarded write error used to inflate this
      // count, so the nightly log reported corrections that never reached the database while the
      // customer stayed locked out.
      if (r && r.changed) {
        fixed++;
        console.log('reconcile: ' + row.stripe_subscription_id + ' ' + row.subscription_status + ' -> ' + sub.status);
      } else {
        if (r && r.retry) writeFailed++;
        console.error('reconcile: did NOT apply ' + row.stripe_subscription_id + ' -> ' + sub.status
          + (r && r.error ? ' (' + r.error + ')' : r && r.ambiguous ? ' (ambiguous un-stamped rows)' : ''));
      }
    } catch (e) {
      if (e && (e.code === 'resource_missing' || e.statusCode === 404)) {
        // The subscription no longer exists in Stripe — it's gone; treat as canceled.
        if (++canceled > cancelCap) {
          console.error('reconcile: ABORT — more than ' + cancelCap + ' subscriptions reported missing in Stripe. '
            + 'That is a wrong-key/wrong-account signature, not real churn. No further cancels applied.');
          await alertOps('Reconcile hit the cancel cap — possible wrong Stripe account', [
            'More than ' + cancelCap + ' subscriptions reported missing in Stripe in one pass.',
            'The pass STOPPED. ' + (canceled - 1) + ' row(s) were already marked canceled before the cap tripped.',
            'If this was not real churn, verify STRIPE_SECRET_KEY and restore those rows from Stripe.'
          ]);
          break;
        }
        const { error: cancelErr } = await supabaseAdmin.from('subscriptions')
          .update({ subscription_status: 'canceled', active_modules: [], updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', row.stripe_subscription_id);
        if (cancelErr) {
          writeFailed++;
          console.error('reconcile: FAILED to mark ' + row.stripe_subscription_id + ' canceled: ' + cancelErr.message);
        } else {
          fixed++;
          console.log('reconcile: ' + row.stripe_subscription_id + ' missing in Stripe -> canceled');
        }
      } else {
        console.error('reconcile: error on ' + row.stripe_subscription_id + ':', (e && e.message) || e);
      }
    }
  }
  // A failed write means a customer may be stuck in the wrong access state until a later pass
  // succeeds. Surface it — this safety net going quietly ineffective is exactly the kind of
  // failure the observability build exists to catch.
  if (writeFailed > 0) {
    await alertOps('Reconcile: ' + writeFailed + ' subscription write(s) FAILED', [
      writeFailed + ' subscription correction(s) could not be written to the database this pass.',
      'Those customers may be in the wrong access state until the next successful run.',
      'Usually a transient database error; if it repeats, check Supabase.'
    ]);
  }
  console.log('reconcileSubscriptions: checked ' + checked + ', fixed ' + fixed + ', writeFailed ' + writeFailed);
  return { checked, fixed, writeFailed };
}

// Manual trigger (optional — the nightly interval is the primary path). Protected by a shared
// secret: set RECONCILE_SECRET in the server env, then POST with header X-Reconcile-Secret.
app.post('/api/reconcile-subscriptions', async (req, res) => {
  const secret = (process.env.RECONCILE_SECRET || '').trim();
  if (!secret || String(req.headers['x-reconcile-secret'] || '') !== secret) {
    return res.status(403).json({ error: 'forbidden' });
  }
  try { const r = await reconcileSubscriptions(); res.json({ ok: true, ...r }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const stripe = require('stripe')((process.env.STRIPE_SECRET_KEY || '').trim());
  const sig    = req.headers['stripe-signature'];
  const secret = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).send('Webhook Error: ' + err.message);
  }

  try {
    // Event creation time (Stripe, seconds). Used as `updated_at` on every write so the
    // ordering guard in applySubUpdate compares like-for-like and drops stale retries.
    const eventIso = event.created ? new Date(event.created * 1000).toISOString() : new Date().toISOString();
    if (event.type === 'checkout.session.completed') {
      const session    = event.data.object;
      const customerId = session.customer;
      const email      = session.customer_details?.email || session.customer_email;

      let userId    = session.metadata?.user_id || null;
      let accountId = session.metadata?.account_id || null;

      if (!userId && email) {
        // Paginate generously — an unpaginated listUsers() returns only the first
        // ~50 users, so past that a returning customer on a metadata-less (payment
        // link) checkout wouldn't be found and we'd wrongly try to re-create them.
        const { data: existing } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const found = existing?.users?.find(u => u.email === email);
        if (found) {
          userId = found.id;
        } else {
          const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: { created_via: 'stripe_checkout' },
          });
          if (createErr) {
            // Likely a concurrent webhook re-delivery already created them — re-look up.
            const { data: retry } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
            const now = retry?.users?.find(u => u.email === email);
            if (now) userId = now.id;
            else console.error('Failed to create Supabase user:', createErr.message);
          } else {
            userId = created.user.id;
            console.log('Account created for new subscriber:', email);
          }
        }
      }

      // Billing is per bar (per account). The signup flow passes account_id in
      // metadata; if it is missing (e.g. a raw payment link), fall back to the
      // account this user owns.
      if (!accountId && userId) {
        const { data: acct } = await supabaseAdmin
          .from('accounts')
          .select('id')
          .eq('owner_user_id', userId)
          .limit(1)
          .maybeSingle();
        accountId = acct?.id || null;
        // Metadata-less checkout by a user who owns no account yet (payment link):
        // provision an account + owner membership so a paying customer is never
        // left charged with nothing attached. Normal signup passes metadata and
        // skips this entirely.
        if (!accountId) {
          const { data: newAcct } = await supabaseAdmin
            .from('accounts').insert({ name: 'My Bar', owner_user_id: userId }).select('id').single();
          if (newAcct) {
            await supabaseAdmin.from('memberships').insert({ account_id: newAcct.id, user_id: userId, role: 'admin' });
            accountId = newAcct.id;
          }
        }
      }

      if (accountId) {
        // Only a brand-new subscription (no row yet) is a "new subscriber" — so the
        // welcome email fires once, never on a Stripe re-delivery or a reactivation.
        const { data: priorSub } = await supabaseAdmin
          .from('subscriptions').select('account_id').eq('account_id', accountId).maybeSingle();
        const isNewSubscriber = !priorSub;
        // Only grant ACTIVE access when the checkout's payment actually cleared. Card
        // checkout completes 'paid' (and free/trial is 'no_payment_required'); a delayed
        // method like bank debit can complete UNPAID and fail later. We still record the
        // subscription row (so the account is tracked and keyed by subscription id), but
        // hold it inactive until customer.subscription.updated confirms it went active.
        const paid = !session.payment_status
          || session.payment_status === 'paid'
          || session.payment_status === 'no_payment_required';
        // CHECK THIS WRITE. supabase-js returns {error} rather than throwing, so a discarded
        // result fell straight through to res.json({received:true}) below — Stripe marks the
        // event delivered and NEVER retries. There is no recovery path: reconcileSubscriptions
        // only walks rows that already exist, and later renewal events find no row by
        // subscription id and no un-stamped row by customer, then return silently. The customer
        // is billed monthly while has_active_subscription() stays false and the RESTRICTIVE
        // require_active_sub policy denies every write — paying, and permanently locked out,
        // with the app holding no record they ever paid. The `else` branch below already returns
        // 500 so Stripe re-delivers when it cannot resolve an account; the branch that actually
        // GRANTS access needs the same protection.
        const { error: subWriteErr } = await supabaseAdmin.from('subscriptions').upsert({
          account_id:             accountId,
          user_id:                userId,
          stripe_customer_id:     customerId,
          // Store the subscription id so later subscription.updated/deleted events key
          // on THIS subscription, not the customer. If an operator ever runs two bars
          // under one Stripe Customer (same email via Link), a customer-keyed update
          // would clobber the other bar; keying on the subscription id can't.
          stripe_subscription_id: session.subscription || null,
          subscription_status:    paid ? 'active' : 'incomplete',
          subscription_plan:      'full_access',
          active_modules:         paid ? ALL_MODULES : [],
          current_period_end:     null,
          updated_at:             eventIso,
        }, { onConflict: 'account_id' });
        if (subWriteErr) {
          // Before the welcome email, deliberately: welcoming a customer into an account whose
          // subscription row does not exist sends them to a screen that denies every write.
          console.error('checkout.session.completed: subscriptions upsert FAILED for account',
                        accountId, subWriteErr.message || subWriteErr);
          return res.status(500).json({ error: 'subscription write failed; Stripe will retry' });
        }
        if (paid && isNewSubscriber && email) {
          const { data: acctRow } = await supabaseAdmin
            .from('accounts').select('name').eq('id', accountId).maybeSingle();
          // Fire-and-forget on this long-running server: a slow or hung Resend call must
          // never delay the webhook ack (a delayed ack makes Stripe retry the whole
          // event). The priorSub check above already gates it to the first activation,
          // so this fires exactly once and never on a re-delivery.
          sendWelcomeEmail(email, acctRow && acctRow.name).catch(() => {});
        }
      } else {
        // We charged the customer but could not resolve an account to attach the
        // subscription to (e.g. a transient DB failure on a metadata-less payment
        // link). Return non-2xx so Stripe re-delivers and we can try again, rather
        // than acking success and stranding a paid customer with no account.
        console.error('checkout.session.completed: no account_id resolved for customer', customerId);
        return res.status(500).json({ error: 'account provisioning failed; Stripe will retry' });
      }
    }

    if (event.type === 'customer.subscription.updated') {
      const sub    = event.data.object;
      const status = sub.status;
      // current_period_end moved onto the subscription's items in newer Stripe API
      // versions. Guard so a missing value can't throw — an unguarded new Date(NaN)
      // .toISOString() would 500 and make Stripe retry the event forever.
      const cpe = sub.current_period_end != null ? sub.current_period_end
                : (sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].current_period_end);
      const periodEnd = cpe ? new Date(cpe * 1000).toISOString() : null;

      const update = { subscription_status: status, updated_at: eventIso };
      if (periodEnd) update.current_period_end = periodEnd;
      // On (re)activation restore module access — a prior 'deleted' event clears
      // active_modules to [], so an active payer whose subscription reactivated via
      // an update (not a fresh checkout) would otherwise be locked out of every
      // module despite an 'active' status.
      if (status === 'active') { update.active_modules = ALL_MODULES; update.subscription_plan = 'full_access'; }

      const r = await applySubUpdate(sub, update, eventIso);
      // A failed DB write must make Stripe RE-DELIVER, not silently 200. Only a real write error
      // (retry) re-raises; an ambiguous legacy row is logged and left for a manual stamp, since
      // re-delivery cannot resolve it and would just retry for days.
      if (r && r.retry) throw new Error('subscription update write failed (' + (r.error || 'unknown') + '); returning 500 so Stripe re-delivers');
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      const r = await applySubUpdate(sub, {
        subscription_status: 'canceled',
        active_modules:      [],
        updated_at:          eventIso,
      }, eventIso);
      if (r && r.retry) throw new Error('subscription delete write failed (' + (r.error || 'unknown') + '); returning 500 so Stripe re-delivers');
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

// ── Rate limiter for the two UNAUTHENTICATED notify endpoints ────────────────
// Both endpoints trigger an outbound Resend email to a fixed team inbox. They take
// no JWT (the bug/support forms are reachable pre-auth), so cap how often one IP can
// fire an email to stop a script flooding the inbox or burning the Resend quota.
// Best-effort, in-memory, per-instance — a real user sends once and never trips it.
const _notifyHits = new Map();
let _notifyGlobal = [];   // timestamps of ALL allowed notify sends this minute, any IP
function notifyRateLimited(req, key, maxPerMin, globalMax) {
  const now = Date.now();
  // Global backstop FIRST: the per-IP cap keys on X-Forwarded-For, which a client can
  // spoof to mint a fresh bucket per request. So cap the two unauth endpoints together
  // at globalMax emails/min regardless of IP — spoofing can no longer flood the inbox
  // or burn the Resend quota. Generous enough that real traffic never trips it.
  _notifyGlobal = _notifyGlobal.filter(t => now - t < 60000);
  if (_notifyGlobal.length >= globalMax) return true;
  const ip = String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || 'unknown').split(',')[0].trim();
  const bucket = key + ':' + ip;
  const arr = (_notifyHits.get(bucket) || []).filter(t => now - t < 60000);
  if (arr.length >= maxPerMin) { _notifyHits.set(bucket, arr); return true; }
  arr.push(now); _notifyHits.set(bucket, arr);
  _notifyGlobal.push(now);
  if (_notifyHits.size > 5000) { for (const [k, v] of _notifyHits) { if (!v.length || now - v[v.length - 1] > 60000) _notifyHits.delete(k); } }
  return false;
}

// ── Bug report notification ──────────────────────────────────────────────────
// Fires after the client successfully writes a bug report row to Supabase.
// The DB record is the source of truth; this endpoint just sends a courtesy
// email so the team gets pinged without polling the table. If Resend fails
// or the env vars are missing, we still return ok=true — the report itself
// is safely persisted, the email is best-effort.
app.post('/api/report-bug-notify', async (req, res) => {
  // The report row is already persisted client-side; the email is a courtesy, so a
  // throttled request still returns ok (nothing is lost, the email is just skipped).
  if (notifyRateLimited(req, 'bug', 5, 30)) return res.json({ ok: true, emailed: false, reason: 'rate_limited' });
  const apiKey = process.env.RESEND_API_KEY;
  const to     = process.env.BUG_REPORT_NOTIFY_EMAIL;
  const from   = process.env.BUG_REPORT_SENDER || 'onboarding@resend.dev';
  if (!apiKey || !to) {
    console.warn('report-bug-notify: RESEND_API_KEY or BUG_REPORT_NOTIFY_EMAIL not configured; skipping email');
    return res.json({ ok: true, emailed: false, reason: 'not_configured' });
  }
  try {
    const r = req.body || {};
    const esc = (s) => String(s == null ? '' : s).replace(/[<>&"]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;' }[c]));
    const sevLabel = { minor:'Minor', moderate:'Moderate', major:'Major', critical:'Critical' }[r.severity] || 'Moderate';
    const sevColor = { minor:'#888', moderate:'#9A5D34', major:'#C03828', critical:'#C03828' }[r.severity] || '#9A5D34';
    const subject  = 'Bar Cop Bug: ' + (r.title || 'Untitled report');
    const row = (label, value) => value
      ? '<tr><td style="padding:8px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#666;border-bottom:1px solid #eee;width:160px;vertical-align:top;">' + esc(label) + '</td>'
        + '<td style="padding:8px 12px;font-size:13px;color:#111;border-bottom:1px solid #eee;white-space:pre-wrap;">' + esc(value) + '</td></tr>'
      : '';
    const html =
        '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;max-width:680px;margin:0 auto;padding:24px;color:#111;">'
      +   '<div style="border-bottom:3px solid ' + sevColor + ';padding-bottom:14px;margin-bottom:18px;">'
      +     '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#999;">Bar Cop Bug Report</div>'
      +     '<div style="font-size:18px;font-weight:700;color:#111;margin-top:4px;">' + esc(r.title || 'Untitled report') + '</div>'
      +     '<div style="font-size:12px;color:' + sevColor + ';font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-top:6px;">' + sevLabel + ' severity</div>'
      +   '</div>'
      +   '<table style="width:100%;border-collapse:collapse;">'
      +     row('What Happened',      r.what_happened)
      +     row('Steps to Reproduce', r.steps_to_reproduce)
      +     row('Expected Behavior',  r.expected_behavior)
      +     row('Reporter Email',     r.user_email)
      +     row('From Screen',        r.previous_screen)
      +     row('Browser',            r.user_agent)
      +     row('Viewport',           r.viewport)
      +     row('Submitted',          new Date().toLocaleString('en-US', { dateStyle:'medium', timeStyle:'short' }))
      +   '</table>'
      +   '<div style="margin-top:18px;font-size:11px;color:#888;border-top:1px solid #eee;padding-top:12px;">Full report is also in your Supabase bug_reports table.</div>'
      + '</div>';

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html, reply_to: r.user_email || undefined })
    });
    if (!resp.ok) {
      const txt = await resp.text();
      console.error('Resend send failed:', resp.status, txt);
      return res.json({ ok: true, emailed: false, reason: 'send_failed' });
    }
    res.json({ ok: true, emailed: true });
  } catch (e) {
    console.error('report-bug-notify exception:', e);
    res.json({ ok: true, emailed: false, reason: 'exception' });
  }
});

// ── Support message notification ─────────────────────────────────────────────
// Email-only contact form from the Hub "Contact Support" screen. No DB row
// is kept — the support inbox is the record. The user's email is set as
// reply_to so the team can hit Reply and write back directly.
app.post('/api/support-message-notify', async (req, res) => {
  // No DB row is kept for support messages, so a throttled request is a genuine
  // failure to deliver — report it (429) rather than falsely claiming success.
  if (notifyRateLimited(req, 'support', 5, 30)) return res.status(429).json({ ok: false, emailed: false, reason: 'rate_limited' });
  const apiKey = process.env.RESEND_API_KEY;
  const to     = process.env.SUPPORT_NOTIFY_EMAIL || process.env.BUG_REPORT_NOTIFY_EMAIL;
  const from   = process.env.BUG_REPORT_SENDER || 'onboarding@resend.dev';
  if (!apiKey || !to) {
    console.warn('support-message-notify: RESEND_API_KEY or notify email not configured');
    return res.json({ ok: false, emailed: false, reason: 'not_configured' });
  }
  try {
    const r = req.body || {};
    const esc = (s) => String(s == null ? '' : s).replace(/[<>&"]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;' }[c]));
    const subject = 'Bar Cop Support: ' + (r.subject || '(no subject)');
    const row = (label, value) => value
      ? '<tr><td style="padding:8px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#666;border-bottom:1px solid #eee;width:160px;vertical-align:top;">' + esc(label) + '</td>'
        + '<td style="padding:8px 12px;font-size:13px;color:#111;border-bottom:1px solid #eee;white-space:pre-wrap;">' + esc(value) + '</td></tr>'
      : '';
    const html =
        '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;max-width:680px;margin:0 auto;padding:24px;color:#111;">'
      +   '<div style="border-bottom:3px solid #4C8EAB;padding-bottom:14px;margin-bottom:18px;">'
      +     '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#999;">Bar Cop Support Message</div>'
      +     '<div style="font-size:18px;font-weight:700;color:#111;margin-top:4px;">' + esc(r.subject || '(no subject)') + '</div>'
      +     '<div style="font-size:12px;color:#4C8EAB;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-top:6px;">' + esc(r.topic || 'Other') + '</div>'
      +   '</div>'
      +   '<table style="width:100%;border-collapse:collapse;">'
      +     row('Message',         r.message)
      +     row('Reporter Email',  r.user_email)
      +     row('From Screen',     r.previous_screen)
      +     row('Submitted',       new Date().toLocaleString('en-US', { dateStyle:'medium', timeStyle:'short' }))
      +   '</table>'
      +   '<div style="margin-top:18px;font-size:11px;color:#888;border-top:1px solid #eee;padding-top:12px;">Reply directly to this email to respond to the user.</div>'
      + '</div>';

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html, reply_to: r.user_email || undefined })
    });
    if (!resp.ok) {
      const txt = await resp.text();
      console.error('Resend send failed:', resp.status, txt);
      return res.json({ ok: false, emailed: false, reason: 'send_failed' });
    }
    res.json({ ok: true, emailed: true });
  } catch (e) {
    console.error('support-message-notify exception:', e);
    res.json({ ok: false, emailed: false, reason: 'exception' });
  }
});

// ── Delegated-admin helpers ───────────────────────────────────────────────────
// Access model: Owner (accounts.owner_user_id) has full control of everyone. A
// non-owner Admin can only manage Staff members THEY invited, can only grant
// areas they themselves hold, and never above their own level. These helpers
// keep those rules identical across invite / update-permissions / remove.
const PERM_RANK = { view: 1, edit: 2 };
// Clamp a requested permissions object to what the granting admin may hand out:
// drop any area the admin lacks, and cap each level to the admin's own. The
// owner grants freely (no clamp).
function clampPermsToGranter(requested, granterPerms, granterIsOwner) {
  if (granterIsOwner) return requested || {};
  const own = granterPerms || {};
  const out = {};
  for (const [area, lvl] of Object.entries(requested || {})) {
    const mine = own[area];
    if (!mine) continue;                                   // admin can't grant an area they lack
    out[area] = (PERM_RANK[lvl] <= PERM_RANK[mine]) ? lvl : mine;   // cap to admin's level
  }
  return out;
}
// Resolve the requester's membership (role + permissions) and owner status for
// an account from their JWT. Returns null if the token is bad or they are not a
// member. { userId, role, permissions, isOwner }.
async function resolveRequester(accountId, jwt) {
  if (!jwt) return null;
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt);
  if (userError || !userData?.user) return null;
  const userId = userData.user.id;
  const { data: membership } = await supabaseAdmin
    .from('memberships').select('role, permissions')
    .eq('account_id', accountId).eq('user_id', userId).single();
  if (!membership) return { userId, role: null, permissions: {}, isOwner: false };
  const { data: acct } = await supabaseAdmin
    .from('accounts').select('owner_user_id').eq('id', accountId).single();
  const isOwner = !!(acct?.owner_user_id && acct.owner_user_id === userId);
  // ownerUserId is returned so a caller can tell whether an EXISTING row was the
  // owner's doing, not just whether the requester is the owner (see /api/invite-user).
  return { userId, role: membership.role, permissions: membership.permissions || {}, isOwner,
           ownerUserId: acct?.owner_user_id || null };
}

// ── Invite user to an account (Phase 2 multi-user) ────────────────────────────
// Admin sends an invite from App Settings → Team. Recipient gets a Supabase
// magic-link email. When they sign up, the 24a trigger reads the metadata
// (invited_to_account_id + invited_role + invited_by) and links them to this
// account instead of creating a new one for them.
app.post('/api/invite-user', async (req, res) => {
  try {
    const { email, accountId, role, permissions } = req.body || {};
    if (!email || !accountId) {
      return res.status(400).json({ error: 'email and accountId required' });
    }
    // Permissions: optional JSON object { areaKey: 'view' | 'edit' } for Admin and
    // Staff members. Sanitized so only known levels are stored (No Access is simply
    // the area's absence, so it is filtered out here).
    const cleanPerms = (permissions && typeof permissions === 'object')
      ? Object.fromEntries(
          Object.entries(permissions).filter(([k, v]) => v === 'edit')
        )
      : {};

    // Verify the requester via their JWT (don't trust client-supplied user IDs)
    const authHeader = req.headers.authorization || '';
    const jwt = authHeader.replace(/^Bearer\s+/, '');
    if (!jwt) return res.status(401).json({ error: 'Missing auth token' });

    const requester = await resolveRequester(accountId, jwt);
    if (!requester) return res.status(401).json({ error: 'Invalid auth token' });
    if (!(requester.isOwner || requester.role === 'admin')) {
      return res.status(403).json({ error: 'Only the owner or an admin can send invites' });
    }
    const inviterUserId = requester.userId;

    // Only the owner can create another Admin; a non-owner admin invites Staff.
    const validRoles = ['admin', 'staff'];
    let inviteRole = validRoles.includes(role) ? role : 'staff';
    if (!requester.isOwner) inviteRole = 'staff';
    // Clamp the granted areas/levels to what this inviter may hand out.
    const grantPerms = clampPermsToGranter(cleanPerms, requester.permissions, requester.isOwner);
    const cleanEmail = String(email).toLowerCase().trim();

    // SECURITY: a pending invite the OWNER created is the owner's decision, and only
    // the owner may change it. The upsert below keys on (email, account_id), so a
    // non-owner admin re-inviting the same address wrote straight over the owner's
    // row: role forced down to staff (line above), permissions clamped to their own,
    // invited_by rewritten, no error to anyone. The signup trigger provisions the
    // membership from THIS row, so the invitee then arrived with less access than the
    // owner granted and the owner never saw it happen. Downgrade only (a non-owner
    // cannot raise a role or grant past their own perms), but a lower tier must not
    // silently overrule the owner on the table that decides access.
    if (!requester.isOwner) {
      const { data: existingInv, error: existingErr } = await supabaseAdmin
        .from('account_invites')
        .select('invited_by')
        .eq('email', cleanEmail)
        .eq('account_id', accountId)
        .maybeSingle();
      if (existingErr) {
        console.error('invite lookup failed:', existingErr.message);
        return res.status(500).json({ error: 'Could not check the invite. Please try again.' });
      }
      if (existingInv && requester.ownerUserId && existingInv.invited_by === requester.ownerUserId) {
        return res.status(403).json({
          error: 'That address already has a pending invite from the owner. Ask the owner to change it.'
        });
      }
    }

    // SECURITY: write the invite to a SERVER-ONLY table (service-role; no anon/user RLS
    // policy, so the browser can't read or forge it). The signup trigger provisions the
    // membership from THIS record, matched by the new user's signup email, and IGNORES
    // the signup metadata below. This is what stops a self-signup with a forged
    // invited_to_account_id from joining an account it was never invited to.
    // ⚠ That email is NOT verified — confirmations are off, so the trigger only honours invites
    // newer than 7 days (see handle_new_user in SUPABASE_SETUP.sql). created_at is stamped
    // EXPLICITLY here because this is an upsert on (email, account_id): without it a re-invite
    // kept the ORIGINAL timestamp, so re-sending an invite to someone who was slow would hand
    // them an already-expired one and the owner would have no way to tell why it did not work.
    const { error: inviteRecErr } = await supabaseAdmin
      .from('account_invites')
      .upsert({
        email: cleanEmail,
        account_id: accountId,
        role: inviteRole,
        permissions: grantPerms,
        invited_by: inviterUserId,
        created_at: new Date().toISOString()
      }, { onConflict: 'email,account_id' });
    if (inviteRecErr) {
      console.error('invite record write failed:', inviteRecErr.message);
      return res.status(500).json({ error: 'Could not record the invite. Please try again.' });
    }

    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      cleanEmail,
      {
        data: {
          invited_to_account_id: accountId,
          invited_role: inviteRole,
          invited_permissions: grantPerms,
          invited_by: inviterUserId
        },
        redirectTo: 'https://app.barcop.com/'
      }
    );

    if (inviteError) {
      // Common case: this person was previously invited/removed. Their auth
      // row still exists, so Supabase refuses a new invite. Look up the
      // existing user by email and add a membership row directly.
      const errMsg = (inviteError.message || '').toLowerCase();
      const isAlreadyRegistered = errMsg.includes('already') &&
        (errMsg.includes('registered') || errMsg.includes('exists'));

      if (isAlreadyRegistered) {
        let existingUserId = null;
        try {
          const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const found = (usersData?.users || []).find(u => u.email && u.email.toLowerCase() === cleanEmail);
          if (found) existingUserId = found.id;
        } catch (e) {
          console.error('listUsers fallback failed:', e);
        }

        if (!existingUserId) {
          return res.status(500).json({ error: 'Email is already registered but the user record could not be located.' });
        }

        const { data: alreadyMember } = await supabaseAdmin
          .from('memberships')
          .select('id')
          .eq('account_id', accountId)
          .eq('user_id', existingUserId)
          .maybeSingle();

        if (alreadyMember) {
          return res.status(400).json({ error: 'This person is already a member of this account.' });
        }

        const { error: insertError } = await supabaseAdmin
          .from('memberships')
          .insert({ account_id: accountId, user_id: existingUserId, role: inviteRole, permissions: grantPerms, invited_by: inviterUserId });

        if (insertError) {
          return res.status(500).json({ error: insertError.message });
        }

        // Also send a password recovery email so they can set (or reset) their
        // password and sign in. Triggers the recovery flow in app.js which
        // shows the set-password panel. Non-fatal if email send fails.
        let emailSent = false;
        try {
          const { error: resetErr } = await supabaseAdmin.auth.resetPasswordForEmail(cleanEmail, {
            redirectTo: 'https://app.barcop.com/'
          });
          emailSent = !resetErr;
          if (resetErr) console.error('Password reset email failed:', resetErr);
        } catch (e) {
          console.error('Password reset email exception:', e);
        }

        return res.json({ ok: true, email: cleanEmail, role: inviteRole, addedDirectly: true, emailSent });
      }

      console.error('Invite error:', inviteError);
      return res.status(500).json({ error: inviteError.message || 'Invite failed' });
    }

    res.json({ ok: true, email: cleanEmail, role: inviteRole });
  } catch (e) {
    console.error('Invite exception:', e);
    res.status(500).json({ error: e.message || 'Invite failed' });
  }
});

// ── Pending invites: list + revoke (L17) ──────────────────────────────────────
// An invite used to be fire-and-forget. `account_invites` is the SOURCE OF TRUTH the signup trigger
// provisions membership from, and it is service-role only (RLS with no anon/authenticated policy),
// so the browser cannot read or delete a row itself — both doors have to live here. Without them a
// typo'd address or a hire who never showed left a standing grant nobody could see or withdraw,
// bounded only by the TTL below.
// ⚠ MUST MATCH the interval in SUPABASE_SETUP.sql's handle_new_user (`created_at > now() - interval
// '7 days'`). THAT is what decides whether an invite still works; this constant only decides what the
// owner is TOLD, so a drift shows "Expired" on a live invite (or the reverse). Pinned by
// verify-invite-revoke.js, which reads the number out of BOTH files and fails if they disagree.
const INVITE_TTL_DAYS = 7;

app.post('/api/list-invites', async (req, res) => {
  try {
    const { accountId } = req.body || {};
    if (!accountId) return res.status(400).json({ error: 'accountId required' });

    const authHeader = req.headers.authorization || '';
    const jwt = authHeader.replace(/^Bearer\s+/, '');
    if (!jwt) return res.status(401).json({ error: 'Missing auth token' });

    const requester = await resolveRequester(accountId, jwt);
    if (!requester) return res.status(401).json({ error: 'Invalid auth token' });
    // Same tier as sending an invite: owner or admin. A pending invite names an address that is
    // about to get access, so it is not staff-visible.
    if (!(requester.isOwner || requester.role === 'admin')) {
      return res.status(403).json({ error: 'Only the owner or an admin can view pending invites' });
    }

    const { data: rows, error } = await supabaseAdmin
      .from('account_invites')
      .select('id, email, role, invited_by, created_at')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('list-invites error:', error.message);
      return res.status(500).json({ error: 'Could not load pending invites.' });
    }

    const cutoff = Date.now() - INVITE_TTL_DAYS * 86400000;
    const invites = (rows || []).map(r => ({
      id: r.id,
      email: r.email,
      role: r.role,
      created_at: r.created_at,
      // Past the TTL the signup trigger ignores the row, so it no longer grants anything. Shown
      // rather than hidden: it is the answer to "why didn't they get in?", and revoking clears it.
      expired: !(new Date(r.created_at).getTime() > cutoff),
      // Mirrors /api/remove-member: the owner manages everything; a non-owner admin may only
      // withdraw invites they personally sent, never the owner's.
      can_revoke: !!(requester.isOwner || r.invited_by === requester.userId)
    }));
    res.json({ ok: true, invites, requesterIsOwner: !!requester.isOwner });
  } catch (e) {
    console.error('list-invites exception:', e);
    res.status(500).json({ error: e.message || 'Could not load pending invites.' });
  }
});

app.post('/api/revoke-invite', async (req, res) => {
  try {
    const { accountId, inviteId } = req.body || {};
    if (!accountId || !inviteId) {
      return res.status(400).json({ error: 'accountId and inviteId required' });
    }

    const authHeader = req.headers.authorization || '';
    const jwt = authHeader.replace(/^Bearer\s+/, '');
    if (!jwt) return res.status(401).json({ error: 'Missing auth token' });

    const requester = await resolveRequester(accountId, jwt);
    if (!requester) return res.status(401).json({ error: 'Invalid auth token' });
    if (!(requester.isOwner || requester.role === 'admin')) {
      return res.status(403).json({ error: 'Only the owner or an admin can revoke invites' });
    }

    // Scoped to the account on the READ as well as the delete, so an id from another bar 404s
    // instead of being withdrawn by someone who only administers this one.
    const { data: invite, error: findErr } = await supabaseAdmin
      .from('account_invites')
      .select('id, email, invited_by')
      .eq('id', inviteId)
      .eq('account_id', accountId)
      .maybeSingle();
    if (findErr) {
      console.error('revoke-invite lookup failed:', findErr.message);
      return res.status(500).json({ error: 'Could not check the invite. Please try again.' });
    }
    if (!invite) return res.status(404).json({ error: 'That invite is no longer pending.' });

    // Parity with /api/invite-user's owner-protection and /api/remove-member: a lower tier must not
    // undo the owner's decision on the table that decides access.
    if (!requester.isOwner && invite.invited_by !== requester.userId) {
      return res.status(403).json({ error: 'You can only revoke invites you sent.' });
    }

    const { error: delErr } = await supabaseAdmin
      .from('account_invites')
      .delete()
      .eq('id', inviteId)
      .eq('account_id', accountId);
    // CHECKED: an unchecked delete would report the invite withdrawn while the row — and the access
    // it grants at signup — is still sitting there.
    if (delErr) {
      console.error('revoke-invite delete failed:', delErr.message);
      return res.status(500).json({ error: 'Could not revoke the invite. Please try again.' });
    }
    res.json({ ok: true, email: invite.email });
  } catch (e) {
    console.error('revoke-invite exception:', e);
    res.status(500).json({ error: e.message || 'Could not revoke the invite.' });
  }
});

// ── List members of an account (Phase 2 multi-user) ───────────────────────────
// Returns every member of the account along with their email and role. Caller
// must be a member of the account (any role) to see the list.
app.post('/api/list-members', async (req, res) => {
  try {
    const { accountId } = req.body || {};
    if (!accountId) return res.status(400).json({ error: 'accountId required' });

    const authHeader = req.headers.authorization || '';
    const jwt = authHeader.replace(/^Bearer\s+/, '');
    if (!jwt) return res.status(401).json({ error: 'Missing auth token' });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !userData?.user) {
      return res.status(401).json({ error: 'Invalid auth token' });
    }
    const requesterUserId = userData.user.id;

    const { data: requesterMembership } = await supabaseAdmin
      .from('memberships')
      .select('role, permissions')
      .eq('account_id', accountId)
      .eq('user_id', requesterUserId)
      .single();

    if (!requesterMembership) {
      return res.status(403).json({ error: 'Not a member of this account' });
    }

    // The account owner (accounts.owner_user_id) is the Owner tier — protected
    // in the UI (no role dropdown, no Remove) and on the server.
    const { data: acct } = await supabaseAdmin
      .from('accounts')
      .select('owner_user_id')
      .eq('id', accountId)
      .single();
    const ownerUserId = acct?.owner_user_id || null;
    const requesterIsOwner = !!ownerUserId && requesterUserId === ownerUserId;

    const { data: memberships, error: listError } = await supabaseAdmin
      .from('memberships')
      .select('id, user_id, role, permissions, created_at, invited_by')
      .eq('account_id', accountId)
      .order('created_at', { ascending: true });

    if (listError) {
      return res.status(500).json({ error: listError.message });
    }

    // can_manage = whether the requester may Edit Access / Remove this member.
    // Owner manages everyone but themselves/the owner row; a non-owner admin
    // manages only the Staff members they personally invited.
    const canManage = (m) => {
      if (!!ownerUserId && m.user_id === ownerUserId) return false;   // never the owner row
      if (m.user_id === requesterUserId) return false;               // never yourself
      if (requesterIsOwner) return true;
      return m.invited_by === requesterUserId && m.role === 'staff';
    };

    // Resolve emails via admin API
    const members = [];
    for (const m of memberships || []) {
      let email = '(unknown)', confirmed = false;
      try {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(m.user_id);
        email = u?.user?.email || '(unknown)';
        confirmed = !!u?.user?.confirmed_at;
      } catch (e) { /* keep defaults */ }
      members.push({
        id: m.id,
        user_id: m.user_id,
        email,
        role: m.role,
        permissions: m.permissions || {},
        confirmed,
        created_at: m.created_at,
        invited_by: m.invited_by || null,
        is_self: m.user_id === requesterUserId,
        is_owner: !!ownerUserId && m.user_id === ownerUserId,
        can_manage: canManage(m)
      });
    }

    res.json({ ok: true, members, requesterRole: requesterMembership.role, requesterPermissions: requesterMembership.permissions || {}, ownerUserId, requesterIsOwner });
  } catch (e) {
    console.error('list-members exception:', e);
    res.status(500).json({ error: e.message || 'List members failed' });
  }
});

// ── Update a member's role (Phase 2 multi-user) ───────────────────────────────
// Only admins can call. Cannot demote the last admin. Cannot change your own role.
app.post('/api/update-member-role', async (req, res) => {
  try {
    const { accountId, membershipId, newRole } = req.body || {};
    if (!accountId || !membershipId || !newRole) {
      return res.status(400).json({ error: 'accountId, membershipId, newRole required' });
    }
    const validRoles = ['admin', 'staff'];
    if (!validRoles.includes(newRole)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const authHeader = req.headers.authorization || '';
    const jwt = authHeader.replace(/^Bearer\s+/, '');
    if (!jwt) return res.status(401).json({ error: 'Missing auth token' });

    const requester = await resolveRequester(accountId, jwt);
    if (!requester) return res.status(401).json({ error: 'Invalid auth token' });
    // Only the owner sets roles (creating/removing admins is an owner-level act).
    if (!requester.isOwner) {
      return res.status(403).json({ error: 'Only the owner can change member roles' });
    }
    const requesterUserId = requester.userId;

    const { data: target } = await supabaseAdmin
      .from('memberships')
      .select('id, user_id, role')
      .eq('id', membershipId)
      .eq('account_id', accountId)
      .single();

    if (!target) return res.status(404).json({ error: 'Member not found in this account' });
    if (target.user_id === requesterUserId) {
      return res.status(400).json({ error: 'You cannot change your own role' });
    }

    // Owner protection: the account owner's role cannot be changed here. Ownership
    // moves only through Transfer Ownership, which reassigns owner_user_id.
    const { data: acctRole } = await supabaseAdmin
      .from('accounts')
      .select('owner_user_id')
      .eq('id', accountId)
      .single();
    if (acctRole?.owner_user_id && target.user_id === acctRole.owner_user_id) {
      return res.status(400).json({ error: "The account owner's role cannot be changed. Use Transfer Ownership." });
    }

    // Last-admin protection: if demoting an admin, ensure another admin exists
    if (target.role === 'admin' && newRole !== 'admin') {
      const { count } = await supabaseAdmin
        .from('memberships')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId)
        .eq('role', 'admin');
      if ((count || 0) <= 1) {
        return res.status(400).json({ error: 'Cannot remove the last admin from this account' });
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from('memberships')
      .update({ role: newRole })
      .eq('id', membershipId);

    if (updateError) return res.status(500).json({ error: updateError.message });
    res.json({ ok: true });
  } catch (e) {
    console.error('update-member-role exception:', e);
    res.status(500).json({ error: e.message || 'Update role failed' });
  }
});

// ── Update a member's permissions (Phase 2 Item 25b) ──────────────────────────
// Only admins can call. Permissions is a JSON object { groupKey: 'add' | 'edit' }.
// Missing keys mean no access to that group.
app.post('/api/update-member-permissions', async (req, res) => {
  try {
    const { accountId, membershipId, permissions } = req.body || {};
    if (!accountId || !membershipId) {
      return res.status(400).json({ error: 'accountId and membershipId required' });
    }
    const cleanPerms = (permissions && typeof permissions === 'object')
      ? Object.fromEntries(
          Object.entries(permissions).filter(([k, v]) => v === 'edit')
        )
      : {};

    const authHeader = req.headers.authorization || '';
    const jwt = authHeader.replace(/^Bearer\s+/, '');
    if (!jwt) return res.status(401).json({ error: 'Missing auth token' });

    const requester = await resolveRequester(accountId, jwt);
    if (!requester) return res.status(401).json({ error: 'Invalid auth token' });
    if (!(requester.isOwner || requester.role === 'admin')) {
      return res.status(403).json({ error: 'Only the owner or an admin can change permissions' });
    }

    // Load the target so a non-owner admin can only touch a Staff member they
    // personally invited (provenance), and never the owner or another admin.
    const { data: target } = await supabaseAdmin
      .from('memberships')
      .select('id, user_id, role, invited_by')
      .eq('id', membershipId)
      .eq('account_id', accountId)
      .single();
    if (!target) return res.status(404).json({ error: 'Member not found in this account' });

    if (!requester.isOwner) {
      if (target.invited_by !== requester.userId || target.role !== 'staff') {
        return res.status(403).json({ error: 'You can only change access for staff members you invited' });
      }
    }
    // Clamp to what this requester may grant (owner grants freely).
    const grantPerms = clampPermsToGranter(cleanPerms, requester.permissions, requester.isOwner);

    const { error: updateError } = await supabaseAdmin
      .from('memberships')
      .update({ permissions: grantPerms })
      .eq('id', membershipId)
      .eq('account_id', accountId);

    if (updateError) return res.status(500).json({ error: updateError.message });
    res.json({ ok: true });
  } catch (e) {
    console.error('update-member-permissions exception:', e);
    res.status(500).json({ error: e.message || 'Update permissions failed' });
  }
});

// ── Remove a member from an account (Phase 2 multi-user) ──────────────────────
// Only admins can call. Cannot remove the last admin. Cannot remove yourself.
app.post('/api/remove-member', async (req, res) => {
  try {
    const { accountId, membershipId } = req.body || {};
    if (!accountId || !membershipId) {
      return res.status(400).json({ error: 'accountId and membershipId required' });
    }

    const authHeader = req.headers.authorization || '';
    const jwt = authHeader.replace(/^Bearer\s+/, '');
    if (!jwt) return res.status(401).json({ error: 'Missing auth token' });

    const requester = await resolveRequester(accountId, jwt);
    if (!requester) return res.status(401).json({ error: 'Invalid auth token' });
    if (!(requester.isOwner || requester.role === 'admin')) {
      return res.status(403).json({ error: 'Only the owner or an admin can remove members' });
    }
    const requesterUserId = requester.userId;

    const { data: target } = await supabaseAdmin
      .from('memberships')
      .select('id, user_id, role, invited_by')
      .eq('id', membershipId)
      .eq('account_id', accountId)
      .single();

    if (!target) return res.status(404).json({ error: 'Member not found in this account' });
    if (target.user_id === requesterUserId) {
      return res.status(400).json({ error: 'You cannot remove yourself' });
    }

    // A non-owner admin can only remove a Staff member they personally invited.
    if (!requester.isOwner) {
      if (target.invited_by !== requesterUserId || target.role !== 'staff') {
        return res.status(403).json({ error: 'You can only remove staff members you invited' });
      }
    }

    // Owner protection: the account owner cannot be removed. Transfer ownership first.
    const { data: acctOwn } = await supabaseAdmin
      .from('accounts')
      .select('owner_user_id')
      .eq('id', accountId)
      .single();
    if (acctOwn?.owner_user_id && target.user_id === acctOwn.owner_user_id) {
      return res.status(400).json({ error: 'The account owner cannot be removed. Transfer ownership first.' });
    }

    if (target.role === 'admin') {
      const { count } = await supabaseAdmin
        .from('memberships')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId)
        .eq('role', 'admin');
      if ((count || 0) <= 1) {
        return res.status(400).json({ error: 'Cannot remove the last admin from this account' });
      }
    }

    const { error: deleteError } = await supabaseAdmin
      .from('memberships')
      .delete()
      .eq('id', membershipId);

    if (deleteError) return res.status(500).json({ error: deleteError.message });
    res.json({ ok: true });
  } catch (e) {
    console.error('remove-member exception:', e);
    res.status(500).json({ error: e.message || 'Remove member failed' });
  }
});

// ── Transfer account ownership (Phase 2 owner tier) ───────────────────────────
// Only the current owner can call. Reassigns accounts.owner_user_id to another
// existing member and makes that member an admin (an owner needs full access).
// The old owner keeps their membership/role. Ownership is the transferable tier
// that holds billing, so this is the only path that moves owner_user_id.
app.post('/api/transfer-ownership', async (req, res) => {
  try {
    const { accountId, membershipId } = req.body || {};
    if (!accountId || !membershipId) {
      return res.status(400).json({ error: 'accountId and membershipId required' });
    }

    const authHeader = req.headers.authorization || '';
    const jwt = authHeader.replace(/^Bearer\s+/, '');
    if (!jwt) return res.status(401).json({ error: 'Missing auth token' });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !userData?.user) {
      return res.status(401).json({ error: 'Invalid auth token' });
    }
    const requesterUserId = userData.user.id;

    // Requester must be the CURRENT owner of this account.
    const { data: acct } = await supabaseAdmin
      .from('accounts')
      .select('owner_user_id')
      .eq('id', accountId)
      .single();
    if (!acct || !acct.owner_user_id || acct.owner_user_id !== requesterUserId) {
      return res.status(403).json({ error: 'Only the account owner can transfer ownership.' });
    }

    // Target must be an existing member of this account.
    const { data: target } = await supabaseAdmin
      .from('memberships')
      .select('id, user_id, role')
      .eq('id', membershipId)
      .eq('account_id', accountId)
      .single();
    if (!target) return res.status(404).json({ error: 'Member not found in this account' });
    if (target.user_id === requesterUserId) {
      return res.status(400).json({ error: 'You already own this account.' });
    }

    // Promote the target to admin FIRST (owners need full access). Doing this
    // before the ownership reassign means a failure here never leaves the account
    // with an owner who is only a staff/viewer and can't manage the team.
    if (target.role !== 'admin') {
      const { error: promErr } = await supabaseAdmin
        .from('memberships')
        .update({ role: 'admin' })
        .eq('id', target.id)
        .eq('account_id', accountId);
      if (promErr) return res.status(500).json({ error: promErr.message });
    }

    // Reassign ownership.
    const { error: ownErr } = await supabaseAdmin
      .from('accounts')
      .update({ owner_user_id: target.user_id })
      .eq('id', accountId);
    if (ownErr) return res.status(500).json({ error: ownErr.message });

    res.json({ ok: true });
  } catch (e) {
    console.error('transfer-ownership exception:', e);
    res.status(500).json({ error: e.message || 'Transfer ownership failed' });
  }
});

// ── Add another bar (Phase 2 owner tier, multi-location Option A) ──────────────
// An existing owner spins up a second bar = its own account + subscription. The
// on_auth_user_created trigger only provisions for brand-new USERS, so an
// existing owner needs this explicit create (service role): new account owned by
// the caller + their admin membership. The client then sends them to checkout
// for the new account. onboarding_complete defaults false so the new bar
// onboards on first entry.
app.post('/api/add-account', async (req, res) => {
  try {
    // SIGNUPS CLOSED — adding a bar mints a NEW account + subscription, the same machinery a new
    // signup uses, so it is paused too while the door is shut. Refuse BEFORE creating anything: the
    // old flow created the bar here and then checkout 503'd, leaving a half-made bar the owner could
    // not pay for. Reopening SIGNUPS_OPEN restores add-a-bar. (create-checkout-session is the twin.)
    if (!SIGNUPS_OPEN) {
      return res.status(503).json({ error: 'Bar Cop is not taking new bars right now. Please check back shortly.' });
    }
    const { name } = req.body || {};
    // Capped at 120 like set-account-name: uncapped, this write was bounded only by the
    // 50mb JSON limit, so a 10MB bar name could land in the row that renders in the bar
    // switcher and gets echoed into the welcome email.
    const barName = (name && String(name).trim().slice(0, 120)) || 'My Bar';

    const authHeader = req.headers.authorization || '';
    const jwt = authHeader.replace(/^Bearer\s+/, '');
    if (!jwt) return res.status(401).json({ error: 'Missing auth token' });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !userData?.user) return res.status(401).json({ error: 'Invalid auth token' });
    const userId = userData.user.id;

    const { data: acct, error: acctErr } = await supabaseAdmin
      .from('accounts')
      .insert({ name: barName, owner_user_id: userId })
      .select('id')
      .single();
    if (acctErr || !acct) return res.status(500).json({ error: acctErr?.message || 'Could not create the bar.' });

    const { error: memErr } = await supabaseAdmin
      .from('memberships')
      .insert({ account_id: acct.id, user_id: userId, role: 'admin' });
    if (memErr) {
      // Roll back the orphan account so a retry starts clean.
      await supabaseAdmin.from('accounts').delete().eq('id', acct.id);
      return res.status(500).json({ error: memErr.message });
    }

    res.json({ ok: true, accountId: acct.id });
  } catch (e) {
    console.error('add-account exception:', e);
    res.status(500).json({ error: e.message || 'Add account failed' });
  }
});

// ── Set an account's display name (owner tier) ────────────────────────────────
// Keeps accounts.name (what the bar switcher shows) in sync with the in-app bar
// name (settings.bar_name), which onboarding + Business Profile write. Caller
// must be an owner or admin of the account.
app.post('/api/set-account-name', async (req, res) => {
  try {
    const { accountId, name } = req.body || {};
    if (!accountId || !name || !String(name).trim()) {
      return res.status(400).json({ error: 'accountId and name required' });
    }
    const barName = String(name).trim().slice(0, 120);

    const authHeader = req.headers.authorization || '';
    const jwt = authHeader.replace(/^Bearer\s+/, '');
    if (!jwt) return res.status(401).json({ error: 'Missing auth token' });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !userData?.user) return res.status(401).json({ error: 'Invalid auth token' });
    const userId = userData.user.id;

    const { data: acct } = await supabaseAdmin
      .from('accounts').select('owner_user_id').eq('id', accountId).single();
    if (!acct) return res.status(404).json({ error: 'Account not found' });

    let allowed = acct.owner_user_id === userId;
    if (!allowed) {
      const { data: mem } = await supabaseAdmin
        .from('memberships').select('role').eq('account_id', accountId).eq('user_id', userId).single();
      allowed = !!(mem && mem.role === 'admin');
    }
    if (!allowed) return res.status(403).json({ error: 'Not allowed to rename this account' });

    const { error: upErr } = await supabaseAdmin
      .from('accounts').update({ name: barName }).eq('id', accountId);
    if (upErr) return res.status(500).json({ error: upErr.message });

    res.json({ ok: true });
  } catch (e) {
    console.error('set-account-name exception:', e);
    res.status(500).json({ error: e.message || 'Rename failed' });
  }
});

// ── Abandon a just-created, unpaid account (signup "use a different email") ───
// A signup creates the account BEFORE payment (we need to set a password Stripe
// can't collect). If the user backs out of checkout to use a different email,
// this discards the abandoned account so nothing accumulates. Owner-only, and
// REFUSES if the account has an active subscription (never deletes a paid bar).
// If the user has no other memberships afterward, their auth user is deleted too
// so the email is free to sign up again.
app.post('/api/abandon-account', async (req, res) => {
  try {
    const { accountId } = req.body || {};
    if (!accountId) return res.status(400).json({ error: 'Missing accountId' });

    const authHeader = req.headers.authorization || '';
    const jwt = authHeader.replace(/^Bearer\s+/, '');
    if (!jwt) return res.status(401).json({ error: 'Missing auth token' });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !userData?.user) return res.status(401).json({ error: 'Invalid auth token' });
    const userId = userData.user.id;

    const { data: acct } = await supabaseAdmin
      .from('accounts').select('owner_user_id').eq('id', accountId).single();
    if (!acct || acct.owner_user_id !== userId) {
      return res.status(403).json({ error: 'Not allowed' });
    }

    // Safety: never discard an account that still has a LIVE subscription in Stripe (not
    // just 'active' — a past_due/unpaid/incomplete/paused/trialing sub is still billing or
    // could resume). Aligns with the checkout dup-guard so a still-billing account can't be
    // hard-deleted (which cascades away its data).
    const { data: sub } = await supabaseAdmin
      .from('subscriptions').select('subscription_status').eq('account_id', accountId).maybeSingle();
    // CHECKOUT_BLOCK_STATES, not LIVE_SUB_STATES: an 'incomplete' sub never billed successfully,
    // so it must not trap the customer here either. Blocking both this AND checkout on
    // 'incomplete' is what left a failed-card customer with no way forward and no way back.
    if (sub && CHECKOUT_BLOCK_STATES.includes(sub.subscription_status)) {
      return res.status(400).json({ error: 'This account has an active subscription and cannot be discarded.' });
    }

    // SOURCE OF TRUTH: ask STRIPE, not just our own table. The comment above says "never discard
    // an account that still has a LIVE subscription in Stripe" — until now nothing here asked
    // Stripe. Our subscriptions row is written ONLY by the webhook, which lags checkout by
    // seconds to minutes, and in that window the read above sees nothing. Meanwhile the client
    // poll gives up after ~12s and renders the new-signup gate with a "Start Over" link whose
    // confirm text reads "No payment was made." A customer who paid twelve seconds ago clicks it:
    // the account is deleted, the cascade takes the subscription row and their auth user, and the
    // webhook then fails its foreign key. Stripe bills $249/mo forever with no row, no
    // stripe_customer_id anywhere in the app, no billing-portal route to it, and reconcile (which
    // walks our table) blind to it. Only a manual Stripe dashboard search would ever find it.
    // The checkout dup-guard already asks Stripe this way; this is the same question.
    // ⚠ FAILS CLOSED, unlike that guard. There, a Stripe hiccup falls through because blocking a
    // legitimate first checkout is the worse outcome. Here the worse outcome is deleting a paying
    // account, so an unreadable Stripe must REFUSE.
    // FAIL CLOSED: if billing cannot be verified, REFUSE. Deleting a paying account is the one
    // outcome that cannot be undone (it cascades away the subscription row + auth user while Stripe
    // keeps billing). A MISSING key and a NULL owner email both mean "cannot check Stripe", so both
    // must refuse HERE rather than fall through to the delete below — those two paths used to skip
    // the check and delete anyway, defeating the fail-closed intent this block is built on.
    const stripeKey = (process.env.STRIPE_SECRET_KEY || '').trim();
    if (!stripeKey) {
      console.error('abandon-account: STRIPE_SECRET_KEY is not set — cannot verify billing, refusing to delete. account=' + accountId);
      return res.status(503).json({ error: 'Could not confirm your billing status just now. Nothing was deleted — please try again in a minute.' });
    }
    const ownerEmail = userData.user.email;
    if (!ownerEmail) {
      // A customer can pay with an email entered at checkout that differs from a null auth email,
      // so with no email to look up we genuinely cannot confirm they are unbilled. Refuse.
      console.error('abandon-account: owner has no email — cannot look up billing in Stripe, refusing to delete. account=' + accountId);
      return res.status(503).json({ error: 'Could not confirm your billing status just now. Nothing was deleted — please contact support.' });
    }
    const stripe = require('stripe')(stripeKey);
    try {
      const custs = await stripe.customers.list({ email: ownerEmail, limit: 20 });
      for (const cust of (custs && custs.data) || []) {
        const subs = await stripe.subscriptions.list({ customer: cust.id, status: 'all', limit: 20 });
        // Scope by the account_id stamped on the subscription, so a multi-bar owner
        // discarding one bar is not blocked by the subscription on another.
        const mine = ((subs && subs.data) || []).filter(s => s.metadata && s.metadata.account_id === accountId);
        if (mine.some(s => CHECKOUT_BLOCK_STATES.includes(s.status))) {
          return res.status(400).json({ error: 'This account has an active subscription and cannot be discarded.' });
        }
      }
    } catch (e) {
      console.error('abandon-account: could not confirm billing with Stripe, refusing to delete:', e.message);
      return res.status(503).json({ error: 'Could not confirm your billing status just now. Nothing was deleted — please try again in a minute.' });
    }

    // Delete the account (memberships + subscription cascade via FK ON DELETE CASCADE).
    const { error: delErr } = await supabaseAdmin.from('accounts').delete().eq('id', accountId);
    if (delErr) return res.status(500).json({ error: delErr.message });

    // If this was their only account, delete the auth user too so the email frees up.
    const { count } = await supabaseAdmin
      .from('memberships').select('id', { count: 'exact', head: true }).eq('user_id', userId);
    if (!count) {
      try { await supabaseAdmin.auth.admin.deleteUser(userId); } catch (e) { console.error('abandon deleteUser:', e); }
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('abandon-account exception:', e);
    res.status(500).json({ error: e.message || 'Could not discard the account' });
  }
});

// ── SPA fallback ──────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const server = app.listen(PORT, () => {
  console.log('\n  Bar Cop Recovery\n  http://localhost:' + PORT + '\n');
});
server.timeout = 300000;
server.headersTimeout = 310000;

// Missed-webhook reconciliation schedule: this server process is long-lived, so run it
// in-process — first pass 5 minutes after boot (so startup isn't slowed), then every 24h.
// No external cron needed. (If this ever moves to a scale-to-zero host, drive the
// /api/reconcile-subscriptions endpoint from a real scheduler instead.)
if ((process.env.STRIPE_SECRET_KEY || '').trim()) {
  const RECONCILE_MS = 24 * 60 * 60 * 1000;
  setTimeout(() => { reconcileSubscriptions().catch(e => console.error('reconcile (startup):', (e && e.message) || e)); }, 5 * 60 * 1000);
  setInterval(() => { reconcileSubscriptions().catch(e => console.error('reconcile (interval):', (e && e.message) || e)); }, RECONCILE_MS);
}

// ── Boot-time email configuration audit ─────────────────────────────────────────
// Every email path in this file is best-effort and fails QUIETLY by design (a bad send must
// never break provisioning). The cost of that is a misconfigured instance that looks perfectly
// healthy while no customer email has been delivered for weeks. This prints the truth into the
// deploy log at boot, once, so a missing env var is visible immediately instead of being
// discovered when a customer says "I never got the invite."
(function auditEmailConfig() {
  try {
    const has = (v) => !!(process.env[v] || '').trim();
    const sender = (process.env.BUG_REPORT_SENDER || '').trim();
    const welcome = (process.env.WELCOME_SENDER || sender || '').trim();
    const problems = [], notes = [];

    if (!has('RESEND_API_KEY')) problems.push('RESEND_API_KEY missing — NO email of any kind will send.');
    if (!sender) problems.push('BUG_REPORT_SENDER missing — sends fall back to onboarding@resend.dev, which is Resend\'s SANDBOX domain: it can only deliver to your own Resend account address, so CUSTOMER email (welcome) silently goes nowhere.');
    else if (/resend\.dev$/i.test(sender)) problems.push('BUG_REPORT_SENDER is a resend.dev sandbox address — customer email will not deliver.');
    if (/resend\.dev$/i.test(welcome)) problems.push('Welcome email sender is a resend.dev sandbox address — new subscribers get no welcome email.');
    if (!has('OPS_ALERT_EMAIL') && !has('BUG_REPORT_NOTIFY_EMAIL')) problems.push('OPS_ALERT_EMAIL and BUG_REPORT_NOTIFY_EMAIL both missing — ops alerts and the daily error digest are DISABLED.');
    if (!has('SUPPORT_NOTIFY_EMAIL')) notes.push('SUPPORT_NOTIFY_EMAIL not set (support messages fall back to the bug-report address).');

    // Staff invites and password resets do NOT go through Resend — they use Supabase Auth's
    // built-in mailer, which Supabase documents as development-only and rate-limits hard.
    notes.push('Invites + password resets use SUPABASE AUTH email, not Resend. If custom SMTP is not configured in the Supabase dashboard, those are rate-limited to a couple per hour and send from a Supabase domain — see the deliverability notes.');

    if (problems.length) {
      console.error('================ EMAIL CONFIG PROBLEMS ================');
      problems.forEach(p => console.error('  !! ' + p));
      console.error('=======================================================');
    } else {
      console.log('email config: OK (sender=' + sender + ')');
    }
    notes.forEach(n => console.log('email config note: ' + n));
  } catch (e) { console.error('auditEmailConfig failed (non-fatal):', e.message); }
})();

// Daily client-error digest. Independent of Stripe, so it is gated separately — observability
// must keep working even on an instance with no billing key. First pass 10 min after boot
// (offset from reconcile so the two never email at once), then every 24h.
if ((process.env.OPS_ALERT_EMAIL || process.env.BUG_REPORT_NOTIFY_EMAIL || '').trim()) {
  setTimeout(() => { sendErrorDigest().catch(e => console.error("errorDigest (startup):", (e && e.message) || e)); }, 10 * 60 * 1000);
  setInterval(() => { sendErrorDigest().catch(e => console.error("errorDigest (interval):", (e && e.message) || e)); }, 24 * 60 * 60 * 1000);
}

// RETENTION RUNS UNCONDITIONALLY — it must not be gated behind the alert config. The prune lives
// inside sendErrorDigest, and sendErrorDigest was only SCHEDULED when an alert address existed,
// so an instance with OPS_ALERT_EMAIL unset never pruned at all: client_errors is writable by any
// authenticated user, so it would grow without bound until it became the disk-pressure event that
// takes the product down. Retention is a survival property of the database; alerting is a feature
// on top of it, and one must not depend on the other.
// Also enforces an ABSOLUTE FLOOR the in-digest prune cannot: that one is clamped to the
// high-water mark so it never deletes an unreported row, which is right — but it means a
// permanently failing digest (revoked Resend key) pins the mark and disables retention forever.
// Past 90 days the row is unrecoverable context anyway; keeping the table alive matters more.
async function floorPruneClientErrors() {
  try {
    const floor = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
    const { error } = await supabaseAdmin.from('client_errors')
      .delete().lt('created_at', floor).neq('kind', 'digest_sent');
    if (error) console.error('client_errors floor prune failed:', error.message);
  } catch (e) { console.error('client_errors floor prune threw:', (e && e.message) || e); }
}
// Runs 15 min after boot AND every 24h. A bare 24h interval would never fire at all on a
// container that restarts more often than daily — which is exactly this deployment (every push
// redeploys), so the safety-net prune would have been dead on arrival. Offset from the digest's
// 10-min pass so the two don't hit the database together.
setTimeout(floorPruneClientErrors, 15 * 60 * 1000);
setInterval(floorPruneClientErrors, 24 * 60 * 60 * 1000);
