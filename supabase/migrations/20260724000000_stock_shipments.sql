-- Stock shipments: recurring auto-restock schedules bundling multiple menu
-- items. A shipment fires on either a weekly cadence (selected days of week)
-- or a fixed interval (every N days), applying each attached item's quantity
-- to menu_items.stock_quantity via `add` (delivery) or `set` (par level).
--
-- Fires from /api/cron/stock-shipments via Vercel Cron using the service-role
-- client. Cadence math (next_run_at) is computed in application code and
-- persisted here so the cron scan is a single indexed query.

create table public.stock_shipments (
  id             uuid primary key default extensions.uuid_generate_v4(),
  venue_id       uuid not null references public.venues(id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 80),
  action         text not null check (action in ('add', 'set')),
  cadence_type   text not null check (cadence_type in ('weekly', 'interval')),
  weekly_days    integer[],
  interval_days  integer,
  run_hour       integer not null default 6 check (run_hour between 0 and 23),
  active         boolean not null default true,
  next_run_at    timestamptz not null,
  last_run_at    timestamptz,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- Enforce that cadence fields match the chosen cadence_type. Weekly needs
  -- at least one selected day (0..6); interval needs a positive integer.
  constraint stock_shipments_cadence_fields_check check (
    (cadence_type = 'weekly'
      and weekly_days is not null
      and array_length(weekly_days, 1) between 1 and 7
      and weekly_days <@ array[0,1,2,3,4,5,6]
      and interval_days is null)
    or
    (cadence_type = 'interval'
      and interval_days is not null
      and interval_days between 1 and 365
      and weekly_days is null)
  )
);

create index stock_shipments_due_idx
  on public.stock_shipments (next_run_at)
  where active = true;

create index stock_shipments_venue_idx
  on public.stock_shipments (venue_id, created_at desc);

create table public.stock_shipment_items (
  id            uuid primary key default extensions.uuid_generate_v4(),
  shipment_id   uuid not null references public.stock_shipments(id) on delete cascade,
  menu_item_id  uuid not null references public.menu_items(id) on delete cascade,
  quantity      integer not null check (quantity between 0 and 100000),
  created_at    timestamptz not null default now(),
  unique (shipment_id, menu_item_id)
);

create index stock_shipment_items_menu_item_idx
  on public.stock_shipment_items (menu_item_id);

alter table public.stock_shipments      enable row level security;
alter table public.stock_shipment_items enable row level security;

-- Venue-scoped access for authenticated users. API routes gate to owner/manager
-- in application code (matches /api/menu, /api/admin/*); the RLS layer here is
-- the tenancy backstop.
create policy "venue scope - stock_shipments" on public.stock_shipments
  for all
  using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy "venue scope - stock_shipment_items" on public.stock_shipment_items
  for all
  using (
    exists (
      select 1 from public.stock_shipments s
       where s.id = stock_shipment_items.shipment_id
         and s.venue_id = public.current_user_venue_id()
    )
  )
  with check (
    exists (
      select 1 from public.stock_shipments s
       where s.id = stock_shipment_items.shipment_id
         and s.venue_id = public.current_user_venue_id()
    )
  );

-- Audit triggers using the existing log_audit() function.
create trigger audit_stock_shipments
  after insert or update or delete on public.stock_shipments
  for each row execute function public.log_audit();

-- stock_shipment_items has no venue_id column; log_audit() expects one. Route
-- these through a small wrapper that resolves venue via the parent shipment.
create or replace function public.log_audit_shipment_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role  text := auth.jwt() -> 'app_metadata' ->> 'role';
  v_ctx   jsonb := nullif(current_setting('audit.context', true), '')::jsonb;
  v_venue uuid;
begin
  select venue_id into v_venue
    from public.stock_shipments
   where id = coalesce(new.shipment_id, old.shipment_id);

  if v_venue is null then
    return coalesce(new, old);
  end if;

  insert into public.audit_log (
    venue_id, actor_id, actor_role, entity_type, entity_id,
    operation, before, after, context
  )
  values (
    v_venue, v_actor, v_role, TG_TABLE_NAME, coalesce(new.id, old.id),
    lower(TG_OP), to_jsonb(old), to_jsonb(new), v_ctx
  );

  return coalesce(new, old);
end;
$$;

create trigger audit_stock_shipment_items
  after insert or update or delete on public.stock_shipment_items
  for each row execute function public.log_audit_shipment_item();

-- Atomic stock application for a single shipment. Locks the shipment row and
-- each menu_item row while updating stock so a concurrent order can't produce
-- a lost-update race. Untracked items (stock_quantity is null) are silently
-- skipped rather than converted -- turning off tracking is a deliberate menu
-- choice we should never override from a shipment.
create or replace function public.apply_shipment_stock(
  p_shipment_id uuid
)
returns table (menu_item_id uuid, applied_quantity integer, skipped boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shipment public.stock_shipments%rowtype;
  v_item record;
  v_current integer;
begin
  select * into v_shipment
    from public.stock_shipments
   where id = p_shipment_id
   for update;

  if not found then
    raise exception 'SHIPMENT_NOT_FOUND';
  end if;

  for v_item in
    select si.menu_item_id as mid, si.quantity as qty
      from public.stock_shipment_items si
     where si.shipment_id = p_shipment_id
  loop
    select stock_quantity into v_current
      from public.menu_items
     where id = v_item.mid
       and venue_id = v_shipment.venue_id
     for update;

    if not found or v_current is null then
      menu_item_id     := v_item.mid;
      applied_quantity := 0;
      skipped          := true;
      return next;
      continue;
    end if;

    if v_shipment.action = 'add' then
      update public.menu_items
         set stock_quantity = stock_quantity + v_item.qty
       where id = v_item.mid;
    else
      update public.menu_items
         set stock_quantity = v_item.qty
       where id = v_item.mid;
    end if;

    menu_item_id     := v_item.mid;
    applied_quantity := v_item.qty;
    skipped          := false;
    return next;
  end loop;

  return;
end;
$$;

grant execute on function public.apply_shipment_stock(uuid) to authenticated, service_role;

-- Keep updated_at fresh so the admin UI can show a sensible "last edited".
create or replace function public.touch_stock_shipments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger touch_stock_shipments_updated_at
  before update on public.stock_shipments
  for each row execute function public.touch_stock_shipments_updated_at();
