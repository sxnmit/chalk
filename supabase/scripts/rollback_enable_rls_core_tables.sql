-- ROLLBACK for migration 20260724000000_enable_rls_core_tables.sql
--
-- Run this manually (Supabase SQL editor or `supabase db execute`) to undo the
-- RLS change on the five original core tables and return them to the
-- development posture (RLS OFF, application-level venue scoping only).
--
-- This is intentionally NOT a timestamped migration: dropping it in the
-- migrations directory would auto-apply in sequence and immediately revert the
-- security fix. It follows the same "manual script" convention as
-- supabase/scripts/backfill_venue_members.sql.
--
-- Disabling RLS makes the policies inert; we also drop them so a later re-enable
-- starts from a clean slate.

-- ── sessions ────────────────────────────────────────────────────────────────
alter table public.sessions disable row level security;
drop policy if exists "venue scope - sessions" on public.sessions;

-- ── rates ───────────────────────────────────────────────────────────────────
alter table public.rates disable row level security;
drop policy if exists "venue scope - rates" on public.rates;

-- ── tables ──────────────────────────────────────────────────────────────────
alter table public.tables disable row level security;
drop policy if exists "venue scope - tables" on public.tables;

-- ── users ───────────────────────────────────────────────────────────────────
alter table public.users disable row level security;
drop policy if exists "venue scope read - users" on public.users;
drop policy if exists "auth admin reads users" on public.users;

-- ── venues ──────────────────────────────────────────────────────────────────
alter table public.venues disable row level security;
drop policy if exists "venue scope - venues" on public.venues;
