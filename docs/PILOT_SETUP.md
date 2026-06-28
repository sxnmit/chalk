# Pilot Setup

Use this only when moving Vish's existing Shy Lounge venue onto billing.

1. Create a Stripe Customer for the Shy Lounge venue.
2. Create a Stripe Subscription for the `Chalk Monthly` price. For the pilot period, apply a 100% off coupon or another agreed pilot discount in Stripe.
3. Copy the Stripe customer id, subscription id, price id, status, and current period end.
4. Run the commented SQL in `supabase/seed.sql` after replacing every placeholder.

Do not run the pilot SQL automatically in migrations. It is a one-time production data mapping step.
