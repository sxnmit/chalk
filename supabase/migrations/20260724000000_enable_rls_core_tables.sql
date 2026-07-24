-- Enable Row Level Security on the five original core tables that still had it
-- OFF for development: venues, users, tables, rates, sessions. These hold every
-- venue's revenue history, pricing, staff roles, and player PII, and until now
-- the ONLY tenant isolation was a hand-written .eq("venue_id", ...) on each app
-- query over the public anon key. A single missed filter (or a direct PostgREST
-- call) meant full cross-venue read AND write. This migration adds RLS as a
-- second, database-level guard, mirroring the pattern already used by the newer
-- tables (menu_items / order_items / payments — see 20260627141823).
--
-- SCOPING HELPER: public.current_venue_id() reads the venue_id baked into the
-- caller's JWT app_metadata (via custom_access_token_hook). It reads the CLAIM,
-- never a table, so these policies CANNOT recurse — unlike the earlier
-- venue_members policies that sub-selected the same table and caused
-- "infinite recursion detected in policy" (fixed in 20260628000200). We reuse
-- current_venue_id() (venue_id claim only) for exact consistency with the
-- menu_items/order_items/payments policies, which are the data-plane siblings of
-- sessions/tables/rates.
--
-- WHY THIS DOESN'T BREAK THE APP:
--   * SERVICE-ROLE (admin) client bypasses RLS entirely (BYPASSRLS). Onboarding
--     venue creation (/api/onboarding/venue), the Stripe webhook, accept-invite,
--     and loadSubscriptionSummary all use createAdminClient() and are unaffected.
--   * The JWT hook (custom_access_token_hook) is SECURITY DEFINER, runs as
--     postgres (BYPASSRLS), and reads users/venue_members to MINT the claim —
--     so enabling RLS on `users` cannot break login (verified: 20260627260000).
--     As belt-and-suspenders we also grant supabase_auth_admin an explicit read
--     policy on `users` (mirrors the venue_members bypass policy from
--     20260627250000) in case the hook is ever reverted to SECURITY INVOKER.
--   * STALE-CLAIM RACE: right after signup the JWT lacks venue_id. The app fixes
--     this by calling auth.refreshSession() immediately after venue creation
--     (see onboarding/page.tsx::createVenue), so the claim IS present before any
--     venue-scoped user-client query runs. RLS policies can't fall back to a
--     live table lookup the way the app helpers do, so for `users` — the one
--     table whose own-row read bootstraps the app-layer claim fallback — we add
--     an `id = auth.uid()` escape so a user can always read THEIR OWN row even
--     when the claim is momentarily missing (e.g. a legacy token minted before
--     the hook). auth.uid() reads the JWT sub claim, not a table → no recursion.
--
-- ROLLBACK: supabase/scripts/rollback_enable_rls_core_tables.sql

-- ── venues ──────────────────────────────────────────────────────────────────
-- A venue IS the tenant, so the tenant key is its own id (not a venue_id column).
alter table public.venues enable row level security;

drop policy if exists "venue scope - venues" on public.venues;
create policy "venue scope - venues" on public.venues for all
  using (id = public.current_venue_id())
  with check (id = public.current_venue_id());

-- ── users (legacy: Shy Lounge / pre-onboarding accounts) ────────────────────
-- SELECT-only for the app role: there are NO user-client writes to `users`
-- (onboarding + accept-invite write it via the admin client). Keeping writes
-- off the anon key also blocks a user from escalating their own `role` via a
-- direct PostgREST call. A user may read same-venue user rows, plus always
-- their own row (bootstraps the claim fallback — see header).
alter table public.users enable row level security;

drop policy if exists "auth admin reads users" on public.users;
create policy "auth admin reads users"
  on public.users for select
  to supabase_auth_admin
  using (true);

drop policy if exists "venue scope read - users" on public.users;
create policy "venue scope read - users"
  on public.users for select
  using (
    venue_id = public.current_venue_id()
    or id = auth.uid()
  );

-- ── tables ──────────────────────────────────────────────────────────────────
alter table public.tables enable row level security;

drop policy if exists "venue scope - tables" on public.tables;
create policy "venue scope - tables" on public.tables for all
  using (venue_id = public.current_venue_id())
  with check (venue_id = public.current_venue_id());

-- ── rates ───────────────────────────────────────────────────────────────────
alter table public.rates enable row level security;

drop policy if exists "venue scope - rates" on public.rates;
create policy "venue scope - rates" on public.rates for all
  using (venue_id = public.current_venue_id())
  with check (venue_id = public.current_venue_id());

-- ── sessions (player_name is PII) ───────────────────────────────────────────
alter table public.sessions enable row level security;

drop policy if exists "venue scope - sessions" on public.sessions;
create policy "venue scope - sessions" on public.sessions for all
  using (venue_id = public.current_venue_id())
  with check (venue_id = public.current_venue_id());
