-- The `owners manage members` and `owners manage invites` policies query
-- public.venue_members from inside the USING clause. Because the policy is
-- `for all` (covers SELECT), evaluating the subquery re-applies RLS on
-- venue_members, which re-evaluates the same policy, which re-runs the
-- subquery -> Postgres throws "infinite recursion detected in policy".
--
-- GET /api/team uses the SSR client (not the admin client) and goes through
-- RLS, so the team page failed with "Internal server error". Mutation
-- endpoints already use the admin client and were unaffected.
--
-- Fix: move the owner check into a SECURITY DEFINER helper that runs as the
-- function owner (bypassing RLS on its inner query) and call that from the
-- policy in place of the inline EXISTS.

create or replace function public.user_is_venue_owner(p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.venue_members
     where venue_id = p_venue_id
       and user_id = auth.uid()
       and role = 'owner'
  );
$$;

grant execute on function public.user_is_venue_owner(uuid) to authenticated;
revoke execute on function public.user_is_venue_owner(uuid) from anon, public;

drop policy if exists "owners manage members" on public.venue_members;
create policy "owners manage members"
  on public.venue_members for all
  using (
    venue_id = public.current_user_venue_id()
    and public.user_is_venue_owner(venue_id)
  )
  with check (venue_id = public.current_user_venue_id());

drop policy if exists "owners manage invites" on public.venue_invites;
create policy "owners manage invites"
  on public.venue_invites for all
  using (
    venue_id = public.current_user_venue_id()
    and public.user_is_venue_owner(venue_id)
  )
  with check (venue_id = public.current_user_venue_id());
