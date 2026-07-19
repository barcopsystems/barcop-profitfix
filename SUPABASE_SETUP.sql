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
--                     active_modules, current_period_end, stripe_customer_id,
--                     stripe_subscription_id
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
-- from THIS table (matched by the new user's verified email), NOT from signup
-- metadata. Because a user can set raw_user_meta_data via the public signUp call, a
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
  -- Honor every server-issued invite for this VERIFIED signup email. Signup metadata
  -- (raw_user_meta_data) is intentionally ignored — it is user-settable and forgeable.
  FOR inv IN
    SELECT account_id, role, permissions, invited_by
    FROM public.account_invites
    WHERE lower(email) = lower(NEW.email)
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
