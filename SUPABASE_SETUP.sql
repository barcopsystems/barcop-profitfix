-- ============================================================
-- Bar Cop — Supabase Schema & RLS (reference)
-- ============================================================
-- This documents the LIVE database as audited on 2026-07-12. The Supabase
-- project is the source of truth; this file is the written record of the
-- current tables and the Row Level Security model, refreshed after the
-- single-user schema it used to hold went stale.
--
-- ARCHITECTURE
--   Multi-account / multi-bar. A user's access to an account runs through the
--   `memberships` table (user_id -> account_id + role + permissions). Every
--   read and write in the app is scoped by account_id, and RLS is the real
--   enforcement: the Supabase anon key is public in the browser, so the
--   database policies below (not the app UI) are what keep one account from
--   reading or writing another's data.
--
-- ISOLATION MODEL (verified)
--   Each account-scoped data table carries TWO policies:
--     1. *_member_access   (PERMISSIVE, ALL) — you may touch a row only if you
--        are a member of its account:
--          account_id IN (SELECT account_id FROM memberships
--                         WHERE user_id = auth.uid())
--     2. require_active_sub (RESTRICTIVE, ALL) — AND the account must have an
--        active subscription: has_active_subscription(account_id)
--   Because #2 is RESTRICTIVE it is AND-ed with #1, never OR-ed, so it can only
--   tighten access. (If it were PERMISSIVE it would OR open the isolation,
--   since has_active_subscription is caller-independent. It must stay
--   RESTRICTIVE.)
--
-- LIVE TABLES
--   accounts          id, name, owner_user_id
--   memberships       user_id, account_id, role, permissions (the access map)
--   subscriptions     account_id, user_id, subscription_status, subscription_plan,
--                     active_modules, current_period_end, cancel_at_period_end,
--                     stripe_customer_id, stripe_subscription_id
--   tos_acceptances   user_id, account_id, tos_version, terms_url, privacy_url
--   user_data         account_id (unique), user_id, data jsonb  (config blob)
--   ic_events         account_id, kind, id, date, data  (Inventory row-per-record)
--   sc_events         account_id, kind, id, date, data  (Shift row-per-record)
--   lc_events         account_id, kind, id, date, data  (Labor row-per-record)
--   core_events       account_id, kind, id, date, data  (Recovery/Events/Hub)
--   bug_reports       user_id, user_email, title, severity, ... (Report a Bug)
--   ic_data/lc_data/sc_data — LEGACY single-blob-per-module tables, superseded
--                     by *_events; kept with the same member-access + sub gate.
--   *_events primary/unique key: (account_id, kind, id).
--
-- The CREATE POLICY / function statements below reflect what is live. Table
-- DDL is documented in the comment block above rather than restated here,
-- to avoid a runnable file drifting from the real column definitions.
-- ============================================================


-- ── Subscription gate (SECURITY DEFINER, caller-independent) ────────────────
CREATE OR REPLACE FUNCTION public.has_active_subscription(acct uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  -- 'trialing' must be here too: the client (enforcePaywall) grants Hub access to a
  -- trial user, but if this gate stays 'active'-only their *_events writes get denied by
  -- RLS and silently queued (look saved, gone on reload). Keep the two in lockstep.
  SELECT EXISTS (SELECT 1 FROM public.subscriptions
                 WHERE account_id = acct AND subscription_status IN ('active', 'trialing'));
$function$;


-- ── accounts ────────────────────────────────────────────────────────────────
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members see their accounts"
  ON public.accounts FOR SELECT
  USING (id IN (SELECT account_id FROM public.memberships
                WHERE user_id = auth.uid()));


-- ── memberships (the access map) ────────────────────────────────────────────
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see their own memberships"
  ON public.memberships FOR SELECT
  USING (user_id = auth.uid());
-- Membership writes (invite / grant / make-owner) go through the API backend
-- with the service_role key, not the browser client.


-- ── account_invites (server-only invite source of truth) ────────────────────
-- SECURITY-CRITICAL. The signup trigger provisions an invited member's membership
-- from THIS table (matched by the new user's signup email, which is NOT verified —
-- see the trigger below), NOT from signup metadata. Because a user can set raw_user_meta_data via the public signUp call, a
-- trigger that trusted invited_to_account_id from metadata let anyone self-join any
-- account whose id they knew. This table is written ONLY by the API (service_role);
-- it has RLS enabled with NO anon/authenticated policy, so the browser cannot read,
-- forge, or delete invites. Run this whole block once.
CREATE TABLE IF NOT EXISTS public.account_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  account_id  uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'staff',
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  invited_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);
-- email is always stored lowercased by the API, so a plain unique index matches the
-- endpoint's upsert onConflict:'email,account_id'.
CREATE UNIQUE INDEX IF NOT EXISTS account_invites_email_account_idx
  ON public.account_invites (email, account_id);
ALTER TABLE public.account_invites ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated => only the service_role backend can touch it.

-- Replace the signup trigger function so it reads the SERVER-WRITTEN invite, never
-- the forgeable signup metadata. New-owner signup (no invite on file) is unchanged.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  new_account_id uuid;
  inv record;
  found_invite boolean := false;
BEGIN
  -- Honor every server-issued invite for this signup email. Signup metadata
  -- (raw_user_meta_data) is intentionally ignored — it is user-settable and forgeable.
  --
  -- ⚠ NEW.email IS NOT VERIFIED HERE. This comment used to say "VERIFIED signup email"; it was
  -- wrong. Email confirmations are OFF (public/db.js signUp: "Stripe verifies the email at
  -- payment"), so this trigger fires on INSERT into auth.users with an address nobody has proven
  -- they control, and signUp hands back a live session immediately. Anyone who registers an
  -- address that has an invite on file therefore lands inside that bar's account.
  --
  -- The 7-day window below bounds that. It was UNBOUNDED: invites had no expiry and no sweeper,
  -- so one typo'd address (manger@joesbar.com) or one departed employee left a permanent,
  -- invisible standing grant on the account. The API restamps created_at on every re-invite, so
  -- a genuine invitee who is slow simply gets sent another one.
  -- ⏳ STILL OPEN, deliberately: the real cure is requiring a confirmed email before the
  -- membership is granted, which means turning Supabase email confirmations ON. That changes the
  -- owner signup flow this app deliberately built around Stripe, so it is Kyle's call, not a
  -- silent change. There is also no owner-facing list/revoke for pending invites yet.
  FOR inv IN
    SELECT account_id, role, permissions, invited_by
    FROM public.account_invites
    WHERE lower(email) = lower(NEW.email)
      AND created_at > now() - interval '7 days'
  LOOP
    found_invite := true;
    INSERT INTO public.memberships (account_id, user_id, role, permissions, invited_by)
    VALUES (
      inv.account_id,
      NEW.id,
      CASE WHEN inv.role IN ('admin','staff','viewer') THEN inv.role ELSE 'staff' END,
      COALESCE(inv.permissions, '{}'::jsonb),
      inv.invited_by
    );
  END LOOP;

  DELETE FROM public.account_invites WHERE lower(email) = lower(NEW.email);

  -- No invite on file => a brand-new owner creating their own bar.
  IF NOT found_invite THEN
    INSERT INTO public.accounts (name, owner_user_id)
    VALUES (COALESCE(NEW.email, 'My Bar'), NEW.id)
    RETURNING id INTO new_account_id;
    INSERT INTO public.memberships (account_id, user_id, role)
    VALUES (new_account_id, NEW.id, 'admin');
  END IF;

  RETURN NEW;
END;
$function$;


-- ── subscriptions ───────────────────────────────────────────────────────────
-- Per-subscription key so subscription.updated/deleted webhooks target exactly the
-- right bar's row instead of every row sharing a Stripe Customer (two-bars case).
-- Safe to re-run; the webhook backfills existing rows on their next event.
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
CREATE INDEX IF NOT EXISTS subscriptions_stripe_subscription_id_idx
  ON public.subscriptions (stripe_subscription_id);

-- Is this subscription set to END at current_period_end rather than renew?
-- ⚠ WITHOUT THIS COLUMN THE APP CANNOT TELL THE TWO APART, and it told the operator the wrong one.
-- Cancelling AT PERIOD END does not change a subscription's STATUS: Stripe keeps status 'active'
-- right up to the end of the paid period and sets cancel_at_period_end beside it. So Bar Cop had
-- the end date and no way to know it was an end, and the Your Account card printed
-- "Renews Aug 13" on the same day Stripe's own portal said "Cancels Aug 13".
-- ⚠ DEFAULT false, NOT NULL: every existing row must read as "renewing" immediately, because a NULL
-- would make every reader guard it and a guard that is missed reads as cancelling.
-- Safe to re-run; the webhook stamps each row on its next subscription event.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can manage subscriptions"
  ON public.subscriptions FOR ALL
  USING (auth.role() = 'service_role'::text);
CREATE POLICY "Users can read own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "subscriptions_select_members"
  ON public.subscriptions FOR SELECT
  USING (account_id IN (SELECT account_id FROM public.memberships
                        WHERE user_id = auth.uid()));


-- ── tos_acceptances ─────────────────────────────────────────────────────────
ALTER TABLE public.tos_acceptances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tos_acceptances_insert_self"
  ON public.tos_acceptances FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "tos_acceptances_select_self"
  ON public.tos_acceptances FOR SELECT
  USING (user_id = auth.uid());


-- ── user_data (config blob, one row per account) ────────────────────────────
ALTER TABLE public.user_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "account_members_all_user_data"
  ON public.user_data FOR ALL
  USING (account_id IN (SELECT account_id FROM public.memberships
                        WHERE user_id = auth.uid()))
  WITH CHECK (account_id IN (SELECT account_id FROM public.memberships
                             WHERE user_id = auth.uid()));


-- ── Row-per-record event tables: ic_events / sc_events / lc_events / core_events
-- Each gets the same two policies: member access (isolation) + a RESTRICTIVE
-- active-subscription gate. Shown once for core_events; ic/sc/lc are identical
-- with their own table name and a *_events_member_access policy name.
ALTER TABLE public.core_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "core_events_member_access"
  ON public.core_events FOR ALL
  USING (account_id IN (SELECT account_id FROM public.memberships
                        WHERE user_id = auth.uid()))
  WITH CHECK (account_id IN (SELECT account_id FROM public.memberships
                             WHERE user_id = auth.uid()));
CREATE POLICY "require_active_sub"
  ON public.core_events AS RESTRICTIVE FOR ALL
  USING (has_active_subscription(account_id))
  WITH CHECK (has_active_subscription(account_id));
-- Repeat the above pair for public.ic_events (policy ic_events_member_access),
-- public.sc_events (sc_events_member_access), public.lc_events
-- (lc_events_member_access), and the legacy ic_data / lc_data / sc_data
-- (account_members_all_* member policy) — same USING / WITH CHECK, and the
-- require_active_sub policy MUST stay AS RESTRICTIVE on every one.


-- ── bug_reports ─────────────────────────────────────────────────────────────
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can submit bug reports"
  ON public.bug_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own bug reports"
  ON public.bug_reports FOR SELECT
  USING (auth.uid() = user_id);


-- ── demo_visits ─────────────────────────────────────────────────────────────
-- First-party counter for the public live demo. No account, no user, no IP.
-- visitor_id is a random id kept in that browser's localStorage, so
-- DISTINCT visitor_id = individual visitors, and the row count = demo views.
-- Written only by the server (service role) via /api/demo-visit. RLS is ON with
-- NO policies on purpose, so nothing client-side can read or write it.
CREATE TABLE IF NOT EXISTS public.demo_visits (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id  text NOT NULL,
  referrer    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS demo_visits_visitor_idx ON public.demo_visits (visitor_id);
CREATE INDEX IF NOT EXISTS demo_visits_created_idx ON public.demo_visits (created_at);
ALTER TABLE public.demo_visits ENABLE ROW LEVEL SECURITY;

-- Count them (run in the Supabase SQL editor):
--   All time:
--     SELECT COUNT(DISTINCT visitor_id) AS visitors, COUNT(*) AS views
--     FROM public.demo_visits;
--   Last 30 days:
--     SELECT COUNT(DISTINCT visitor_id) AS visitors, COUNT(*) AS views
--     FROM public.demo_visits WHERE created_at > now() - interval '30 days';
--   Where they came from:
--     SELECT COALESCE(NULLIF(referrer,''),'(direct)') AS source,
--            COUNT(DISTINCT visitor_id) AS visitors
--     FROM public.demo_visits GROUP BY 1 ORDER BY visitors DESC;

-- ============================================================
-- Audit note (2026-07-12): confirmed RLS enabled on every public table
-- (SELECT tablename FROM pg_tables WHERE schemaname='public' AND
--  rowsecurity = false returned zero rows) and every require_active_sub
-- policy is RESTRICTIVE. Cross-account isolation verified.
-- ============================================================


-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLE / PER-AREA PERMISSION ENFORCEMENT (2026-07-19)
-- ═══════════════════════════════════════════════════════════════════════════════
-- WRITE-ONLY enforcement: a Staff or Admin can't bypass the UI (browser console) to
-- INSERT / UPDATE / DELETE data in sections their permission map does not grant. This
-- stops an invited member from damaging/erasing records outside their areas — the real
-- threat. READS stay at account-member level ON PURPOSE: the app cross-computes across
-- sections (Prime Cost = labor + inventory + sales; the recipe screen reads the menu),
-- so withholding reads would produce wrong/empty numbers. Per-section read-hiding stays
-- the UI's job (the "you don't have access to this section" screen). Model:
--   • OWNER (accounts.owner_user_id) = full write access to everything.
--   • ADMIN + STAFF: memberships.permissions ->> '<area>' must be present to WRITE that
--     area. Full Access is stored as 'edit'; No Access omits the key. (Owner sets an
--     Admin's map too, so a restricted Admin is write-blocked just like Staff.)
--   • 9 areas: inventory, labor, shift, profit, revenue, cash, events, books, audit.
--   • The 3 Control tables map 1:1 to an area. core_events maps per-record by KIND; a
--     shared record (a weekly close, the fix feed) can be written from several sections
--     and the member needs ANY one of them. user_data (settings/targets/progress) is left
--     member-writable (low-sensitivity config; the UI limits target/profile edits to
--     Admin/Owner; the total-wipe backstop guards it).
--
-- ⚠ PRE-DEPLOY: RLS now DENIES any non-owner member whose permissions map is empty/
--    NULL. Before running this, as the OWNER open Team Members → Edit Access for every
--    existing Admin/Staff and set the areas they should have (Full Access), and save.
--    Verify current maps first:
--      SELECT m.user_id, u.email, m.role, m.permissions
--      FROM public.memberships m JOIN auth.users u ON u.id = m.user_id
--      WHERE m.account_id = '<your-account-id>';

CREATE OR REPLACE FUNCTION public.bc_member_area(acct uuid, area text)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT
    EXISTS (SELECT 1 FROM public.accounts a
            WHERE a.id = acct AND a.owner_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.memberships m
               WHERE m.account_id = acct AND m.user_id = auth.uid()
                 AND COALESCE(m.permissions ->> area, '') <> '');
$function$;

CREATE OR REPLACE FUNCTION public.bc_core_kind_areas(kind text)
  RETURNS text[] LANGUAGE sql IMMUTABLE
AS $function$
  SELECT CASE kind
    WHEN 'week'                   THEN ARRAY['profit','revenue','books','audit']
    WHEN 'revenue_week'           THEN ARRAY['revenue','books','audit']
    WHEN 'audit'                  THEN ARRAY['profit','audit']
    WHEN 'revenue_audit'          THEN ARRAY['revenue','audit']
    WHEN 'cash_audit'             THEN ARRAY['cash','books','audit']
    WHEN 'bar_cop_audit'          THEN ARRAY['audit']
    WHEN 'variance_investigation' THEN ARRAY['profit']
    WHEN 'sales_review'           THEN ARRAY['profit']
    -- 'inventory' is required, not generous: Receive Delivery (an INVENTORY screen) files the
    -- short-shipment record (ic-receive-delivery.js:825,843). Profit-only would deny the write
    -- for the inventory-only Staff who actually receives deliveries.
    WHEN 'vendor_discrepancy'     THEN ARRAY['profit','inventory']
    WHEN 'profit_initiative'      THEN ARRAY['profit']
    WHEN 'revenue_server_check'   THEN ARRAY['revenue']
    WHEN 'menu_dog_test'          THEN ARRAY['revenue']
    WHEN 'revenue_price_log'      THEN ARRAY['revenue']
    -- 'shift' is required: Pre-Shift (a SHIFT screen) writes server_pitch onto the menu item
    -- (sc-preshift.js:349). Revenue-only would deny it for shift-only Staff.
    WHEN 'menu_item'              THEN ARRAY['revenue','shift']
    WHEN 'revenue_initiative'     THEN ARRAY['revenue']
    WHEN 'cash_outflow'           THEN ARRAY['cash']
    WHEN 'cash_initiative'        THEN ARRAY['cash']
    WHEN 'booking'                THEN ARRAY['events']
    WHEN 'event_rate_card'        THEN ARRAY['events']
    WHEN 'event_regular'          THEN ARRAY['events']
    WHEN 'event_calendar_entry'   THEN ARRAY['events']
    WHEN 'permit'                 THEN ARRAY['books']
    WHEN 'operating_expense'      THEN ARRAY['books']
    WHEN 'fix_log'                THEN ARRAY['profit','revenue','cash']
    WHEN 'fix_activity'           THEN ARRAY['profit','revenue','cash']
    ELSE ARRAY['profit']   -- unknown/new kind: default to profit (never wide open)
  END;
$function$;

CREATE OR REPLACE FUNCTION public.bc_can_core(acct uuid, kind text)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT
    EXISTS (SELECT 1 FROM public.accounts a
            WHERE a.id = acct AND a.owner_user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.account_id = acct AND m.user_id = auth.uid()
        AND EXISTS (SELECT 1 FROM unnest(public.bc_core_kind_areas(kind)) ar
                    WHERE COALESCE(m.permissions ->> ar, '') <> ''));
$function$;

-- RESTRICTIVE write policies (INSERT/UPDATE/DELETE only — SELECT is left to the existing
-- member-access policy so reads stay complete). AND-ed with member-access + require_active_sub.
-- Helper to (re)create the three write policies for a fixed-area control table:
--   inv: bc_member_area(account_id,'<area>')
-- ic_data / ic_events → inventory
DROP POLICY IF EXISTS "area_w_ins" ON public.ic_data;   DROP POLICY IF EXISTS "area_w_upd" ON public.ic_data;   DROP POLICY IF EXISTS "area_w_del" ON public.ic_data;
CREATE POLICY "area_w_ins" ON public.ic_data   AS RESTRICTIVE FOR INSERT WITH CHECK (bc_member_area(account_id,'inventory'));
CREATE POLICY "area_w_upd" ON public.ic_data   AS RESTRICTIVE FOR UPDATE USING (bc_member_area(account_id,'inventory')) WITH CHECK (bc_member_area(account_id,'inventory'));
CREATE POLICY "area_w_del" ON public.ic_data   AS RESTRICTIVE FOR DELETE USING (bc_member_area(account_id,'inventory'));
DROP POLICY IF EXISTS "area_w_ins" ON public.ic_events; DROP POLICY IF EXISTS "area_w_upd" ON public.ic_events; DROP POLICY IF EXISTS "area_w_del" ON public.ic_events;
CREATE POLICY "area_w_ins" ON public.ic_events AS RESTRICTIVE FOR INSERT WITH CHECK (bc_member_area(account_id,'inventory'));
CREATE POLICY "area_w_upd" ON public.ic_events AS RESTRICTIVE FOR UPDATE USING (bc_member_area(account_id,'inventory')) WITH CHECK (bc_member_area(account_id,'inventory'));
CREATE POLICY "area_w_del" ON public.ic_events AS RESTRICTIVE FOR DELETE USING (bc_member_area(account_id,'inventory'));
-- lc_data / lc_events → labor
DROP POLICY IF EXISTS "area_w_ins" ON public.lc_data;   DROP POLICY IF EXISTS "area_w_upd" ON public.lc_data;   DROP POLICY IF EXISTS "area_w_del" ON public.lc_data;
CREATE POLICY "area_w_ins" ON public.lc_data   AS RESTRICTIVE FOR INSERT WITH CHECK (bc_member_area(account_id,'labor'));
CREATE POLICY "area_w_upd" ON public.lc_data   AS RESTRICTIVE FOR UPDATE USING (bc_member_area(account_id,'labor')) WITH CHECK (bc_member_area(account_id,'labor'));
CREATE POLICY "area_w_del" ON public.lc_data   AS RESTRICTIVE FOR DELETE USING (bc_member_area(account_id,'labor'));
DROP POLICY IF EXISTS "area_w_ins" ON public.lc_events; DROP POLICY IF EXISTS "area_w_upd" ON public.lc_events; DROP POLICY IF EXISTS "area_w_del" ON public.lc_events;
CREATE POLICY "area_w_ins" ON public.lc_events AS RESTRICTIVE FOR INSERT WITH CHECK (bc_member_area(account_id,'labor'));
CREATE POLICY "area_w_upd" ON public.lc_events AS RESTRICTIVE FOR UPDATE USING (bc_member_area(account_id,'labor')) WITH CHECK (bc_member_area(account_id,'labor'));
CREATE POLICY "area_w_del" ON public.lc_events AS RESTRICTIVE FOR DELETE USING (bc_member_area(account_id,'labor'));
-- sc_data / sc_events → shift
DROP POLICY IF EXISTS "area_w_ins" ON public.sc_data;   DROP POLICY IF EXISTS "area_w_upd" ON public.sc_data;   DROP POLICY IF EXISTS "area_w_del" ON public.sc_data;
CREATE POLICY "area_w_ins" ON public.sc_data   AS RESTRICTIVE FOR INSERT WITH CHECK (bc_member_area(account_id,'shift'));
CREATE POLICY "area_w_upd" ON public.sc_data   AS RESTRICTIVE FOR UPDATE USING (bc_member_area(account_id,'shift')) WITH CHECK (bc_member_area(account_id,'shift'));
CREATE POLICY "area_w_del" ON public.sc_data   AS RESTRICTIVE FOR DELETE USING (bc_member_area(account_id,'shift'));
DROP POLICY IF EXISTS "area_w_ins" ON public.sc_events; DROP POLICY IF EXISTS "area_w_upd" ON public.sc_events; DROP POLICY IF EXISTS "area_w_del" ON public.sc_events;
CREATE POLICY "area_w_ins" ON public.sc_events AS RESTRICTIVE FOR INSERT WITH CHECK (bc_member_area(account_id,'shift'));
CREATE POLICY "area_w_upd" ON public.sc_events AS RESTRICTIVE FOR UPDATE USING (bc_member_area(account_id,'shift')) WITH CHECK (bc_member_area(account_id,'shift'));
CREATE POLICY "area_w_del" ON public.sc_events AS RESTRICTIVE FOR DELETE USING (bc_member_area(account_id,'shift'));
-- core_events → per-record by KIND
DROP POLICY IF EXISTS "area_w_ins" ON public.core_events; DROP POLICY IF EXISTS "area_w_upd" ON public.core_events; DROP POLICY IF EXISTS "area_w_del" ON public.core_events;
CREATE POLICY "area_w_ins" ON public.core_events AS RESTRICTIVE FOR INSERT WITH CHECK (bc_can_core(account_id, kind));
CREATE POLICY "area_w_upd" ON public.core_events AS RESTRICTIVE FOR UPDATE USING (bc_can_core(account_id, kind)) WITH CHECK (bc_can_core(account_id, kind));
CREATE POLICY "area_w_del" ON public.core_events AS RESTRICTIVE FOR DELETE USING (bc_can_core(account_id, kind));
-- user_data: intentionally NO write policy (see note above) — stays member-writable.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════════
-- CLIENT ERROR REPORTING (observability)  — added 2026-07-19
-- ═══════════════════════════════════════════════════════════════════════════════
-- Why: until now the ONLY way an operator's problem reached Kyle was the manual
-- "Report a Bug" form. A crash, a rejected promise, a blocked write or a denied
-- RLS insert produced console output on THEIR machine and nothing else, so every
-- failure was invisible unless a customer bothered to fill in a form.
--
-- DESIGN NOTES, both load-bearing:
--  1. INSERT is deliberately WIDE (any authenticated user, own account or null).
--     The single most important error to receive is "this customer's writes are
--     being denied" — gating this table on membership or on require_active_sub
--     would silence exactly the customer who most needs to be heard. There is no
--     require_active_sub policy here ON PURPOSE.
--  2. SELECT is owner-scoped, so an operator can only ever read their own bar's
--     errors. Kyle reads ACROSS accounts from the server with the service-role
--     key (the daily digest), which bypasses RLS.
CREATE TABLE IF NOT EXISTS public.client_errors (
  id           bigserial PRIMARY KEY,
  created_at   timestamptz NOT NULL DEFAULT now(),
  account_id   uuid        REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id      uuid,
  user_email   text,
  kind         text NOT NULL,     -- 'session_expired' | 'js_error' | 'unhandled_rejection' | 'wipe_blocked' | 'storage_full' | 'rls_denied' | 'backfill_failed' | 'restore_aborted'
  message      text,
  detail       text,              -- stack / context, truncated client-side
  screen       text,
  app_version  text,
  user_agent   text
);

CREATE INDEX IF NOT EXISTS client_errors_created_idx ON public.client_errors (created_at DESC);
CREATE INDEX IF NOT EXISTS client_errors_kind_idx    ON public.client_errors (kind, created_at DESC);

ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;

-- ⚠ created_at and account_id MUST be constrained, not just user_id. These rows are written by
-- the BROWSER, so every column in them is attacker-controlled. With only a user_id check:
--   (1) one row stamped created_at = '2099-01-01' becomes the newest row, the digest's
--       high-water mark jumps to 2099, and EVERY future digest reports nothing — permanently,
--       while looking exactly like a healthy quiet system;
--   (2) a user could write rows carrying ANOTHER bar's account_id, which that bar's owner then
--       sees through the owner-read policy below.
-- Keeping INSERT open to any authenticated user is deliberate (a locked-out customer must still
-- be able to report). Letting them choose the timestamp or the account is not.
DROP POLICY IF EXISTS "client_errors_insert" ON public.client_errors;
CREATE POLICY "client_errors_insert" ON public.client_errors
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    -- 'digest_sent' is the SERVER's high-water mark, not a client error kind. Leaving `kind`
    -- unconstrained meant any authenticated customer could insert a marker row dated a few
    -- minutes ahead, which becomes the newest mark and makes the next digest skip every
    -- unreported event older than it — permanent silence, and the rows then age out unreported.
    -- Locking created_at was not enough on its own: the field that decides what a marker IS
    -- has to be locked too. The server writes markers with the service role, which bypasses RLS.
    AND kind <> 'digest_sent'
    AND created_at > now() - interval '1 hour'
    AND created_at < now() + interval '5 minutes'
    AND (
      account_id IS NULL
      OR account_id IN (SELECT account_id FROM public.memberships WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "client_errors_owner_read" ON public.client_errors;
CREATE POLICY "client_errors_owner_read" ON public.client_errors
  FOR SELECT TO authenticated
  USING (
    account_id IN (SELECT id FROM public.accounts WHERE owner_user_id = auth.uid())
  );
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- ACCOUNT BACKUPS + PRIVILEGE HARDENING  (added 2026-07-20)
-- Safe to re-run. Every statement is idempotent and is a NO-OP against the live
-- database, where the table and its policy already exist and were verified airtight.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── account_backups (the recovery net) ──────────────────────────────────────
-- ⚠ THIS WAS LIVE IN THE DATABASE AND ABSENT FROM THIS FILE ENTIRELY. The table, its
-- RLS and its owner-only policy existed only in the running system, so rebuilding from
-- this file would have silently produced an app whose whole backup system either did not
-- exist or came back UNPROTECTED. Filed here so the file matches reality.
-- Owner-only is load-bearing: a row is a COMPLETE snapshot of a bar's account (all four
-- blobs plus cash config), and db.js getBackup selects by id with NO account filter of its
-- own — this policy is the entire boundary. Every other table in this file is
-- member-scoped; this one deliberately is not.
CREATE TABLE IF NOT EXISTS public.account_backups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  reason      text NOT NULL DEFAULT 'manual',
  snapshot    jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS account_backups_acct_created_idx
  ON public.account_backups (account_id, created_at DESC);
ALTER TABLE public.account_backups ENABLE ROW LEVEL SECURITY;

-- Created only if absent. The live policy is verified good, so this must not DROP and
-- recreate it — a rewrite risks a subtly different predicate on the one table whose
-- policy is the sole boundary around a full-account export.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
    WHERE c.relname = 'account_backups' AND p.polname = 'owner_backups'
  ) THEN
    CREATE POLICY "owner_backups" ON public.account_backups
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.accounts a
                     WHERE a.id = account_backups.account_id AND a.owner_user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.accounts a
                          WHERE a.id = account_backups.account_id AND a.owner_user_id = auth.uid()));
  END IF;
END $$;
-- NOTE: deliberately NO require_active_sub clause here. A lapsed subscription must never
-- lock an owner out of their own backups on the one day they need them.

-- ── Revoke privileges nobody uses ───────────────────────────────────────────
-- ⚠ TRUNCATE IGNORES ROW LEVEL SECURITY. Supabase grants anon and authenticated full table
-- privileges by default and relies on RLS to constrain them — but RLS only filters
-- SELECT/INSERT/UPDATE/DELETE. A TRUNCATE would empty a table for EVERY BAR AT ONCE, with
-- every policy in this file looking on. It is not reachable through the exposed surface
-- (PostgREST has no TRUNCATE verb and nobody holds a direct database connection), so this
-- is defence in depth rather than a live hole — but it is a privilege with no legitimate
-- use here and no reason to keep. REFERENCES and TRIGGER go the same way.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.%I FROM anon, authenticated', t.tablename);
  END LOOP;
END $$;
