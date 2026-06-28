-- venue_members has RLS enabled (from migration 160300) with policies that
-- depend on a JWT existing — but the JWT doesn't exist yet during hook execution.
-- Add a permissive read policy for supabase_auth_admin and make the function
-- bulletproof so a single bad row can never break login.

drop policy if exists "auth admin reads venue_members" on public.venue_members;
create policy "auth admin reads venue_members"
  on public.venue_members
  for select
  to supabase_auth_admin
  using (true);

grant select on public.venue_members to supabase_auth_admin;
grant select on public.users to supabase_auth_admin;

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  v_venue_id uuid;
  v_role     text;
begin
  begin
    select venue_id, coalesce(role, 'owner')
      into v_venue_id, v_role
    from public.users
    where id = (event->>'user_id')::uuid;
  exception when others then
    v_venue_id := null;
  end;

  if v_venue_id is null then
    begin
      select venue_id, role
        into v_venue_id, v_role
      from public.venue_members
      where user_id = (event->>'user_id')::uuid
      order by created_at desc
      limit 1;
    exception when others then
      v_venue_id := null;
    end;
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
