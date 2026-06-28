-- Run as the function owner (postgres) instead of the calling role
-- (supabase_auth_admin), so table permissions are never an issue.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_venue_id uuid;
  v_role     text;
begin
  select venue_id, coalesce(role, 'owner')
    into v_venue_id, v_role
  from public.users
  where id = (event->>'user_id')::uuid;

  if v_venue_id is null then
    select venue_id, role
      into v_venue_id, v_role
    from public.venue_members
    where user_id = (event->>'user_id')::uuid
    order by created_at desc
    limit 1;
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
