-- supabase_auth_admin runs the custom_access_token_hook and needs to read
-- venue_members to resolve venue_id/role for onboarding-created users.
grant select on public.venue_members to supabase_auth_admin;
