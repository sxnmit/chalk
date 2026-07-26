-- Rollback (down) for 20260701030000_add_refunds.sql
--
-- NOT auto-applied: the Supabase CLI only picks up `<timestamp>_name.sql` files
-- in the top level of supabase/migrations, not this rollbacks/ subdirectory.
-- Run manually (psql / SQL editor) to reverse the refunds feature.
--
-- WARNING: dropping `refunds` destroys refund history. Any payments left in
-- status 'refunded' are reset to 'succeeded' first so the data is consistent
-- with a pre-refunds world (payments never reached 'refunded' before this
-- feature, so this only touches rows this feature created).

update public.payments set status = 'succeeded' where status = 'refunded';

drop function if exists public.process_refund(uuid, uuid, integer, text, text, uuid, jsonb);

drop trigger if exists audit_refunds on public.refunds;

drop table if exists public.refunds;
