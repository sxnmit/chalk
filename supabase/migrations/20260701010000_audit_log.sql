-- Migration: audit_log
--
-- Recovered migration. This was applied directly against the remote
-- database (version 20260701010000 in supabase_migrations.schema_migrations)
-- from a workspace whose commit never made it into git, so this file did
-- not exist anywhere in history even though the objects were already live.
-- Reconstructed from the live schema (REST introspection: columns, types,
-- FKs, RLS-on-with-no-anon-access) to bring git back in sync with reality.
-- Written with IF NOT EXISTS / OR REPLACE so it is a no-op against the
-- database it was recovered from, and reproduces the same shape elsewhere
-- (e.g. `supabase db reset`).
--
-- RLS pattern: mirrors other post-core tables (venue scope via current_venue_id()).

create table if not exists public.audit_log (
  id         uuid primary key default extensions.uuid_generate_v4(),
  venue_id   uuid not null references public.venues(id) on delete cascade,
  actor_id   uuid,
  actor_role text,
  entity_type text not null,
  entity_id   uuid not null,
  operation   text not null,
  before      jsonb,
  after       jsonb,
  context     jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists audit_log_venue_idx on public.audit_log(venue_id);
create index if not exists audit_log_entity_idx on public.audit_log(entity_type, entity_id);

alter table public.audit_log enable row level security;

drop policy if exists "venue scope - audit_log" on public.audit_log;
create policy "venue scope - audit_log" on public.audit_log for all
  using (venue_id = public.current_venue_id())
  with check (venue_id = public.current_venue_id());

-- Sets a transaction-local GUC so trigger functions (not present in this
-- recovered file -- none were found on venue-scoped tables at introspection
-- time) can attribute writes to the acting user/role/context.
create or replace function public.set_audit_context(ctx jsonb)
returns void
language sql
as $$
  select set_config('audit.context', ctx::text, true);
$$;
