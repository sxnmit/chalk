-- Migration: add_ordering_and_payments
-- Adds menu_items, order_items, and payments tables with RLS.
--
-- RLS pattern: mirrors sessions table pattern using the existing
-- current_venue_id() helper (reads venue_id from JWT app_metadata).
--
-- PK pattern: extensions.uuid_generate_v4() -- matches existing tables.
-- No updated_at triggers -- existing tables do not use this pattern.

-- menu_items
create table public.menu_items (
  id          uuid primary key default extensions.uuid_generate_v4(),
  venue_id    uuid not null references public.venues(id) on delete cascade,
  name        text not null check (length(name) between 1 and 100),
  category    text not null check (length(category) between 1 and 30),
  price_cents integer not null check (price_cents >= 1 and price_cents <= 99999),
  available   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index menu_items_venue_idx on public.menu_items(venue_id);
create index menu_items_venue_category_idx on public.menu_items(venue_id, category);

alter table public.menu_items enable row level security;

create policy "venue scope - menu_items" on public.menu_items for all
  using (venue_id = public.current_venue_id())
  with check (venue_id = public.current_venue_id());

-- order_items
create table public.order_items (
  id                  uuid primary key default extensions.uuid_generate_v4(),
  venue_id            uuid not null references public.venues(id) on delete cascade,
  session_id          uuid not null references public.sessions(id) on delete cascade,
  menu_item_id        uuid not null references public.menu_items(id),
  quantity            integer not null check (quantity >= 1),
  price_at_time_cents integer not null check (price_at_time_cents >= 0),
  created_at          timestamptz not null default now()
);

create index order_items_session_idx on public.order_items(session_id);
create index order_items_venue_idx on public.order_items(venue_id);

alter table public.order_items enable row level security;

create policy "venue scope - order_items" on public.order_items for all
  using (venue_id = public.current_venue_id())
  with check (venue_id = public.current_venue_id());

-- payments
create table public.payments (
  id                       uuid primary key default extensions.uuid_generate_v4(),
  venue_id                 uuid not null references public.venues(id) on delete cascade,
  session_id               uuid not null unique references public.sessions(id) on delete cascade,
  method                   text not null check (method in ('card', 'cash', 'terminal')),
  table_total_cents        integer not null check (table_total_cents >= 0),
  items_total_cents        integer not null default 0 check (items_total_cents >= 0),
  tax_cents                integer not null default 0 check (tax_cents >= 0),
  tip_cents                integer not null default 0 check (tip_cents >= 0),
  grand_total_cents        integer not null check (grand_total_cents >= 0),
  stripe_payment_intent_id text,
  status                   text not null default 'pending'
                           check (status in ('pending', 'succeeded', 'failed', 'refunded')),
  created_at               timestamptz not null default now()
);

create index payments_venue_idx on public.payments(venue_id);
create unique index payments_stripe_pi_idx on public.payments(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

alter table public.payments enable row level security;

create policy "venue scope - payments" on public.payments for all
  using (venue_id = public.current_venue_id())
  with check (venue_id = public.current_venue_id());
