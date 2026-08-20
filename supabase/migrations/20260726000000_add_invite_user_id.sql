-- inviteUserByEmail pre-creates a passwordless auth user when an invite is sent.
-- Record that user's id on the invite so the claim flow (/api/auth/claim-invite)
-- can attach the invitee's chosen password to the correct account without having
-- to look users up by email (the auth schema isn't reachable via PostgREST).
ALTER TABLE public.venue_invites
  ADD COLUMN invited_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
