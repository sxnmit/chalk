# JWT Hook Test Plan

Verify both legacy and onboarding-signup users get valid JWT claims after the
`20260627160000` migration is applied.

## Prerequisites

- Migration applied: `supabase db push`
- Hook still configured in Supabase Dashboard → Authentication → Hooks →
  Custom Access Token Hook → `public.custom_access_token_hook`

## Test 1 — Legacy user (Vish, Shy Lounge)

1. Log in as Vish.
2. Open browser DevTools → Application → Local Storage → find the Supabase
   access token (key `sb-*-auth-token`).
3. Copy the `access_token` value and paste it into [jwt.io](https://jwt.io).
4. In the decoded payload verify:
   - `app_metadata.venue_id` is present and matches Shy Lounge's venue UUID.
   - `app_metadata.role` is `"owner"`.
5. Navigate to `/dashboard` — it should load with tables and revenue stats.
6. Start and end a session — both server actions should succeed without errors.

## Test 2 — New venue user (fresh signup via /onboarding)

1. Sign up with a new email address and complete onboarding.
2. Decode the JWT as in Test 1.
3. Verify:
   - `app_metadata.venue_id` is present and matches the newly created venue UUID.
   - `app_metadata.role` is `"owner"`.
4. Navigate to `/dashboard` — it should load (empty, no tables yet).
5. Go to `/admin/rates` and create a rate, then `/admin/tables` and create a
   table. The dashboard should now show the table.
6. Start a session — the server action should succeed.

## Test 3 — Backfill + re-verify Vish

1. Run `supabase/scripts/backfill_venue_members.sql` via the Supabase SQL editor.
2. Log out and back in as Vish to get a fresh token.
3. Decode and verify claims are still present (now served via `venue_members`
   rather than the `users` fallback).
4. Dashboard should still work end-to-end.

## Failure modes

| Symptom | Likely cause |
|---|---|
| `app_metadata` missing both claims | Hook not registered or replaced with wrong function name |
| `venue_id` present but `role` missing | Fallback hit `users` row with null role — check `coalesce(u.role, 'owner')` in hook |
| Dashboard shows "User has no venue" | User exists in neither `venue_members` nor `users` — check onboarding completed |
| New venue user fails but Vish works | `venue_members` not populated — confirm onboarding inserts into `venue_members` |
