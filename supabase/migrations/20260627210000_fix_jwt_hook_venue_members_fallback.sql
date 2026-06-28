-- Fix custom_access_token_hook to fall back to venue_members when the user
-- is not found in the legacy users table (e.g. users created via onboarding).

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  user_venue_id uuid;
  user_role     text;
begin
  -- First, try the legacy users table.
  select venue_id, role
    into user_venue_id, user_role
    from public.users
   where id = (event->>'user_id')::uuid;

  -- If not found there (onboarding path), fall back to venue_members.
  if user_venue_id is null then
    select venue_id, role
      into user_venue_id, user_role
      from public.venue_members
     where user_id = (event->>'user_id')::uuid
     limit 1;
  end if;

  if user_venue_id is not null then
    event := jsonb_set(event, '{claims,app_metadata,venue_id}', to_jsonb(user_venue_id::text));
  end if;
  if user_role is not null then
    event := jsonb_set(event, '{claims,app_metadata,role}', to_jsonb(user_role));
  end if;

  return event;
end;
$$;

grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
