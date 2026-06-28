-- Tighten custom_access_token_hook: the previous version used
-- `coalesce(role, 'owner')` when reading from public.users, so any row with a
-- non-null venue_id but a null role silently received owner-level claims.
-- Drop the default and prefer venue_members (the canonical multi-tenant
-- membership table) — fall back to the legacy users row only when no
-- membership exists, and never invent a role.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_user_id  uuid := (event->>'user_id')::uuid;
  v_venue_id uuid;
  v_role     text;
begin
  select venue_id, role
    into v_venue_id, v_role
    from public.venue_members
   where user_id = v_user_id
   order by created_at desc
   limit 1;

  if v_venue_id is null then
    select venue_id, role
      into v_venue_id, v_role
      from public.users
     where id = v_user_id;
  end if;

  if v_venue_id is not null and v_role is not null then
    event := jsonb_set(event, '{claims,app_metadata,venue_id}', to_jsonb(v_venue_id::text));
    event := jsonb_set(event, '{claims,app_metadata,role}', to_jsonb(v_role));
  end if;

  return event;
end;
$$;

grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
