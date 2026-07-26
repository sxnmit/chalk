-- Migration: add_refunds
-- Adds refunds/voids/comps on top of the existing `payments` table.
--
-- `payments.session_id` is UNIQUE (one payment row per session), so a reversal
-- can't be a second payments row. `refunds` is an append-only child of
-- `payments` that supports PARTIAL refunds: the amount already refunded for a
-- payment is SUM(refunds.amount_cents), and `payments.status` flips to
-- 'refunded' only once that sum reaches grand_total_cents (partials keep
-- 'succeeded'). A 'void' is a full reversal (kind='void'); a manager comp is
-- kind='comp' -- both travel the same append path, distinguished only by kind.
--
-- Money is cents, matching payments/order_items/menu_items.
-- RLS ON with a current_venue_id() policy, matching payments (its parent).

create table public.refunds (
  id           uuid primary key default extensions.uuid_generate_v4(),
  venue_id     uuid not null references public.venues(id) on delete cascade,
  payment_id   uuid not null references public.payments(id) on delete cascade,
  amount_cents integer not null check (amount_cents >= 1),
  reason       text not null check (length(reason) between 1 and 500),
  kind         text not null default 'refund' check (kind in ('refund', 'void', 'comp')),
  -- Snapshotted from payments.method at refund time. Cash-only today; a future
  -- card refund would additionally carry a Stripe refund id (add a column then).
  method       text not null check (method in ('card', 'cash', 'terminal')),
  refunded_by  uuid references auth.users(id),
  created_at   timestamptz not null default now()
);

create index refunds_payment_idx on public.refunds(payment_id);
create index refunds_venue_idx on public.refunds(venue_id);
create index refunds_venue_created_at_idx on public.refunds(venue_id, created_at desc);

alter table public.refunds enable row level security;

create policy "venue scope - refunds" on public.refunds for all
  using (venue_id = public.current_venue_id())
  with check (venue_id = public.current_venue_id());

-- Append-only: refunds are never edited or erased once written. Inserts still
-- flow through the app role (via process_refund, security invoker), but update
-- and delete are revoked so a refund can't be silently rewritten.
revoke update, delete on public.refunds from authenticated, anon;

-- Audit the refund itself (and its downstream payments.status flip) via the
-- generic log_audit() trigger. The reason/kind land in audit_log.context,
-- which process_refund sets inside its own transaction (see below).
create trigger audit_refunds
  after insert or update or delete on public.refunds
  for each row execute function public.log_audit();

-- ── Atomic, race-safe refund ────────────────────────────────────────────────
--
-- Two concurrent refunds on the same payment must never over-refund. We lock
-- the payment row FOR UPDATE, re-sum existing refunds inside the lock, enforce
-- the cap, then insert -- the same locking pattern as add_order_item_with_stock
-- in 20260627180000_atomic_order_item_stock.sql. security invoker so the
-- caller's RLS (venue scoping) applies to every statement.
create or replace function public.process_refund(
  p_venue_id       uuid,
  p_payment_id     uuid,
  p_amount_cents   integer,
  p_reason         text,
  p_kind           text,
  p_actor          uuid,
  p_audit_context  jsonb
)
returns public.refunds
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_payment   public.payments%rowtype;
  v_already   integer;
  v_remaining integer;
  v_refund    public.refunds%rowtype;
begin
  if p_kind not in ('refund', 'void', 'comp') then
    raise exception 'INVALID_KIND';
  end if;
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'REASON_REQUIRED';
  end if;
  if p_amount_cents is null or p_amount_cents < 1 then
    raise exception 'INVALID_AMOUNT';
  end if;

  -- Lock the payment row; serializes concurrent refunds on the same payment.
  select *
    into v_payment
    from public.payments
   where id = p_payment_id
     and venue_id = p_venue_id
   for update;

  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;

  -- Only a collected sale can be reversed. Partial refunds keep the payment at
  -- 'succeeded', so multiple partials are permitted while any balance remains;
  -- a payment only flips to 'refunded' once fully refunded (nothing left).
  -- This guard therefore rejects pending/failed and already-fully-refunded.
  if v_payment.status <> 'succeeded' then
    raise exception 'PAYMENT_NOT_REFUNDABLE';
  end if;

  select coalesce(sum(amount_cents), 0)
    into v_already
    from public.refunds
   where payment_id = p_payment_id
     and venue_id = p_venue_id;

  v_remaining := v_payment.grand_total_cents - v_already;

  -- A void reverses the entire remaining balance -- it can't be partial.
  if p_kind = 'void' and p_amount_cents <> v_remaining then
    raise exception 'VOID_MUST_BE_FULL:%', v_remaining;
  end if;

  if p_amount_cents > v_remaining then
    raise exception 'REFUND_EXCEEDS_REMAINING:%', v_remaining;
  end if;

  -- Attach the reason/kind to the audit_log rows this transaction produces.
  -- set_config(..., true) is transaction-local; because this runs in the same
  -- transaction as the insert/update below, the audit triggers read it back.
  perform public.set_audit_context(p_audit_context);

  insert into public.refunds (
    venue_id, payment_id, amount_cents, reason, kind, method, refunded_by
  ) values (
    p_venue_id, p_payment_id, p_amount_cents, btrim(p_reason), p_kind,
    v_payment.method, p_actor
  )
  returning * into v_refund;

  -- Flip to 'refunded' only when the whole sale has been returned.
  if v_already + p_amount_cents >= v_payment.grand_total_cents then
    update public.payments
       set status = 'refunded'
     where id = p_payment_id
       and venue_id = p_venue_id;
  end if;

  return v_refund;
end;
$$;

-- auto_expose_new_tables is off, so migration-created functions aren't callable
-- through PostgREST until granted (same as the stock RPCs).
grant execute on function public.process_refund(uuid, uuid, integer, text, text, uuid, jsonb)
  to authenticated, service_role;
