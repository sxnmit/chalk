-- One-time backfill: copies existing users-table rows into venue_members
-- so the updated JWT hook can find them via the new primary path.
-- Run once via the Supabase SQL editor after applying migration 20260627160000.

insert into public.venue_members (venue_id, user_id, role)
select u.venue_id, u.id, coalesce(u.role, 'owner')
from public.users u
where u.venue_id is not null
  and not exists (
    select 1
    from public.venue_members vm
    where vm.user_id = u.id
      and vm.venue_id = u.venue_id
  )
on conflict (venue_id, user_id) do nothing;
