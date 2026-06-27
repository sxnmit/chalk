-- Adds billing, onboarding, and team-management primitives.
-- Existing core app tables keep their current RLS posture for development.

alter table public.venues
  add column if not exists stripe_customer_id text unique,
  add column if not exists onboarding_completed_at timestamptz;

create or replace function public.current_user_venue_id()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'active_venue_id', '')::uuid,
    nullif(auth.jwt() -> 'app_metadata' ->> 'venue_id', '')::uuid
  );
$$;

create table if not exists public.venue_members (
  id         uuid primary key default extensions.uuid_generate_v4(),
  venue_id   uuid not null references public.venues(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'staff' check (role in ('owner', 'manager', 'staff')),
  created_at timestamptz not null default now(),
  unique (venue_id, user_id)
);

alter table public.venue_members
  add column if not exists role text not null default 'staff'
    check (role in ('owner', 'manager', 'staff'));

alter table public.venue_members enable row level security;

drop policy if exists "members can read their venue's members" on public.venue_members;
create policy "members can read their venue's members"
  on public.venue_members for select
  using (venue_id = public.current_user_venue_id());

drop policy if exists "owners manage members" on public.venue_members;
create policy "owners manage members"
  on public.venue_members for all
  using (
    venue_id = public.current_user_venue_id()
    and exists (
      select 1 from public.venue_members vm
      where vm.venue_id = venue_members.venue_id
        and vm.user_id = auth.uid()
        and vm.role = 'owner'
    )
  )
  with check (venue_id = public.current_user_venue_id());

create table if not exists public.venue_invites (
  id          uuid primary key default extensions.uuid_generate_v4(),
  venue_id    uuid not null references public.venues(id) on delete cascade,
  email       text not null,
  role        text not null default 'staff' check (role in ('owner', 'manager', 'staff')),
  token       text not null unique,
  invited_by  uuid not null references auth.users(id),
  accepted_at timestamptz,
  expires_at  timestamptz not null default (now() + interval '7 days'),
  created_at  timestamptz not null default now()
);

create index if not exists venue_invites_venue_idx on public.venue_invites(venue_id);
create index if not exists venue_invites_email_idx
  on public.venue_invites(email) where accepted_at is null;

alter table public.venue_invites enable row level security;

drop policy if exists "members read their venue's invites" on public.venue_invites;
create policy "members read their venue's invites"
  on public.venue_invites for select
  using (venue_id = public.current_user_venue_id());

drop policy if exists "owners manage invites" on public.venue_invites;
create policy "owners manage invites"
  on public.venue_invites for all
  using (
    venue_id = public.current_user_venue_id()
    and exists (
      select 1 from public.venue_members
      where venue_id = venue_invites.venue_id
        and user_id = auth.uid()
        and role = 'owner'
    )
  )
  with check (venue_id = public.current_user_venue_id());

create table if not exists public.subscriptions (
  id                     uuid primary key default extensions.uuid_generate_v4(),
  venue_id               uuid not null unique references public.venues(id) on delete cascade,
  stripe_customer_id     text not null,
  stripe_subscription_id text unique,
  stripe_price_id        text,
  status                 text not null
                         check (status in ('trialing', 'active', 'past_due', 'unpaid',
                                           'canceled', 'incomplete', 'incomplete_expired',
                                           'paused')),
  trial_ends_at          timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz
);

create index if not exists subscriptions_venue_idx on public.subscriptions(venue_id);
create index if not exists subscriptions_customer_idx on public.subscriptions(stripe_customer_id);

alter table public.subscriptions enable row level security;

drop policy if exists "members read their subscription" on public.subscriptions;
create policy "members read their subscription"
  on public.subscriptions for select
  using (venue_id = public.current_user_venue_id());

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.touch_updated_at();

create table if not exists public.processed_stripe_billing_events (
  stripe_event_id text primary key,
  created_at timestamptz not null default now()
);

alter table public.processed_stripe_billing_events enable row level security;
