-- Fix: hook was returning jsonb_build_object('claims', claims) which omits
-- top-level event fields (user_id etc.) that Supabase auth requires.
-- Must return the full event object with claims modified in-place.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  uid        uuid;
  v_venue_id uuid;
  v_role     text;
begin
  uid := (event->>'user_id')::uuid;

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
    event := jsonb_set(event, '{claims,app_metadata,venue_id}', to_jsonb(v_venue_id::text));
    event := jsonb_set(event, '{claims,app_metadata,role}', to_jsonb(coalesce(v_role, 'staff')));
  end if;

  return event;
end;
$$;

grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
