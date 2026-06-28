-- Existing venues (the Shy Lounge pilot) predate the billing/onboarding
-- columns. Middleware now treats `onboarding_completed_at IS NULL` or a
-- missing subscriptions row as "needs onboarding" and forces a redirect,
-- which would brick the existing pilot owner. Backfill both so they keep
-- working until they're moved onto a real Stripe customer manually
-- (see docs/PILOT_SETUP.md).

update public.venues
   set onboarding_completed_at = coalesce(onboarding_completed_at, now())
 where onboarding_completed_at is null;

insert into public.subscriptions (
  venue_id,
  stripe_customer_id,
  status,
  trial_ends_at,
  current_period_end,
  cancel_at_period_end,
  updated_at
)
select v.id,
       'cus_pilot_' || v.id::text,
       'active',
       null,
       null,
       false,
       now()
  from public.venues v
  left join public.subscriptions s on s.venue_id = v.id
 where s.id is null;
