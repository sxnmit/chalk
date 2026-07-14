-- Append-only audit log covering every user-facing mutation, via a single
-- generic trigger rather than app-level wrappers -- can't be bypassed by a
-- missed call site, and none of the 21 existing mutation entry points need
-- to change. Single JSONB before/after table; typed-per-entity tables would
-- be premature for v1.
--
-- Skipped: subscriptions, processed_stripe_billing_events (Stripe/webhook
-- infra, not user-facing mutations), users (legacy, superseded by
-- venue_members).

create table public.audit_log (
  id          uuid primary key default extensions.uuid_generate_v4(),
  venue_id    uuid not null references public.venues(id) on delete cascade,
  actor_id    uuid,                  -- null = system/service-role mutation, no JWT
  actor_role  text,                  -- snapshot of the JWT role at the time of the action
  entity_type text not null,         -- TG_TABLE_NAME, e.g. 'sessions', 'rates' (plural)
  entity_id   uuid not null,
  operation   text not null check (operation in ('insert', 'update', 'delete')),
  before      jsonb,                 -- null on insert
  after       jsonb,                 -- null on delete
  context     jsonb,                 -- optional app-provided extras, set via set_audit_context()
  created_at  timestamptz not null default now()
);

create index audit_log_venue_created_at_idx on public.audit_log(venue_id, created_at desc);
create index audit_log_entity_idx on public.audit_log(entity_type, entity_id);
create index audit_log_actor_idx on public.audit_log(actor_id);

alter table public.audit_log enable row level security;

create policy "venue scope - audit_log" on public.audit_log for select
  using (venue_id = public.current_user_venue_id());

-- Append-only: rows are written exclusively by the security-definer trigger
-- function below (which runs as the function owner and so isn't subject to
-- these grants). Revoking write access from the app role means it can only
-- ever read audit_log, never insert a forged entry or edit/erase one.
revoke insert, update, delete on public.audit_log from authenticated, anon;

-- One generic function, reused by every audited table. `venues` is special-
-- cased because it has no `venue_id` column -- it *is* the venue, so its own
-- `id` is the tenant key there. Every other audited table has a `venue_id`
-- column (checked against each table's definition).
create or replace function public.log_audit()
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
  if TG_TABLE_NAME = 'venues' then
    v_venue := coalesce(new.id, old.id);
  else
    v_venue := coalesce(new.venue_id, old.venue_id);
  end if;

  insert into public.audit_log (
    venue_id, actor_id, actor_role, entity_type, entity_id, operation, before, after, context
  )
  values (
    v_venue, v_actor, v_role, TG_TABLE_NAME, coalesce(new.id, old.id),
    lower(TG_OP), to_jsonb(old), to_jsonb(new), v_ctx
  );

  return coalesce(new, old);
end;
$$;

create trigger audit_sessions      after insert or update or delete on public.sessions      for each row execute function public.log_audit();
create trigger audit_tables        after insert or update or delete on public.tables        for each row execute function public.log_audit();
create trigger audit_rates         after insert or update or delete on public.rates         for each row execute function public.log_audit();
create trigger audit_menu_items    after insert or update or delete on public.menu_items    for each row execute function public.log_audit();
create trigger audit_order_items   after insert or update or delete on public.order_items   for each row execute function public.log_audit();
create trigger audit_payments      after insert or update or delete on public.payments      for each row execute function public.log_audit();
create trigger audit_venues        after update                     on public.venues        for each row execute function public.log_audit();
create trigger audit_venue_members after insert or update or delete on public.venue_members for each row execute function public.log_audit();
-- insert/update/delete (not just insert/update) -- invites are hard-deleted
-- today, e.g. the cleanup path in /api/team/invite when the invite email
-- fails to send.
create trigger audit_venue_invites after insert or update or delete on public.venue_invites for each row execute function public.log_audit();

-- Tier-2 substrate: lets future refund/void/edit code attach app-side
-- context (reason, related entity id) to the audit rows their mutation
-- produces. No v1 call sites -- see src/lib/audit.ts.
create or replace function public.set_audit_context(ctx jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('audit.context', ctx::text, true);
end;
$$;

grant execute on function public.set_audit_context(jsonb) to authenticated;
