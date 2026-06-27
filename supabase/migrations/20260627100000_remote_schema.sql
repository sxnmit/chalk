-- Baseline migration: captures existing schema as of 2026-06-27
-- Written manually (supabase db pull requires Docker).
-- Schema confirmed via Supabase REST API introspection.

-- venues
create table if not exists public.venues (
  id          uuid primary key default extensions.uuid_generate_v4(),
  name        text not null,
  timezone    text not null default 'America/Toronto',
  created_at  timestamptz not null default now()
);

-- users (maps to auth.users)
create table if not exists public.users (
  id          uuid primary key references auth.users(id),
  venue_id    uuid not null references public.venues(id),
  name        text not null,
  role        text not null,
  created_at  timestamptz not null default now()
);

-- tables
create table if not exists public.tables (
  id            uuid primary key default extensions.uuid_generate_v4(),
  venue_id      uuid not null references public.venues(id),
  name          text not null,
  size          text not null,
  status        text not null default 'free',
  display_order integer not null default 0
);

-- rates
create table if not exists public.rates (
  id          uuid primary key default extensions.uuid_generate_v4(),
  venue_id    uuid not null references public.venues(id),
  label       text not null,
  hourly_rate numeric not null,
  is_default  boolean not null default false
);

-- sessions
create table if not exists public.sessions (
  id                   uuid primary key default extensions.uuid_generate_v4(),
  venue_id             uuid not null references public.venues(id),
  table_id             uuid not null references public.tables(id),
  rate_id              uuid not null references public.rates(id),
  staff_id             uuid not null references public.users(id),
  started_at           timestamptz not null default now(),
  ended_at             timestamptz,
  actual_rate_charged  numeric not null,
  notes                text,
  player_name          text
);

-- JWT helper: returns the venue_id baked into the access token via custom_access_token_hook.
-- RLS on existing tables is disabled for development.
create or replace function public.current_venue_id()
returns uuid
language sql
stable
as $$
  select (auth.jwt() -> 'app_metadata' ->> 'venue_id')::uuid;
$$;

-- Alias used in some policies
create or replace function public.get_my_venue_id()
returns uuid
language sql
stable
as $$
  select (auth.jwt() -> 'app_metadata' ->> 'venue_id')::uuid;
$$;
