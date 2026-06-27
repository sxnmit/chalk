-- Adds venue_members table (for onboarding-based signups) and updates the
-- custom_access_token_hook to check it first, falling back to the legacy users table.

create table if not exists public.venue_members (
  id          uuid primary key default extensions.uuid_generate_v4(),
  venue_id    uuid not null references public.venues(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'staff',
  created_at  timestamptz not null default now(),
  constraint venue_members_venue_user_unique unique (venue_id, user_id)
);

-- Updated hook: checks venue_members first (onboarding signups),
-- falls back to legacy users table (Shy Lounge and any pre-onboarding accounts).
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims      jsonb;
  uid         uuid;
  v_venue_id  uuid;
  v_role      text;
  v_app_meta  jsonb;
begin
  claims := event->'claims';
  uid    := (event->>'user_id')::uuid;

  select vm.venue_id, vm.role
    into v_venue_id, v_role
  from public.venue_members vm
  where vm.user_id = uid
  order by vm.created_at desc
  limit 1;

  if v_venue_id is null then
    select u.venue_id, coalesce(u.role, 'owner')
      into v_venue_id, v_role
    from public.users u
    where u.id = uid;
  end if;

  if v_venue_id is not null then
    v_app_meta := coalesce(claims->'app_metadata', '{}'::jsonb)
      || jsonb_build_object(
           'venue_id', v_venue_id::text,
           'role',     coalesce(v_role, 'staff')
         );
    claims := jsonb_set(claims, '{app_metadata}', v_app_meta);
  end if;

  return jsonb_build_object('claims', claims);
end;
$$;

grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
