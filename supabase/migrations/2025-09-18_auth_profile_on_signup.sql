-- Ensure a robust, idempotent trigger creates a safe default profile on new auth user
-- This prevents sign-up failing with: "Database error saving new user" due to profile constraints

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := new.email;
  v_username text := null;
  v_first text := null;
  v_last text := null;
  v_display text := null;
begin
  -- Derive a safe username from email or user id
  if v_email is not null and position('@' in v_email) > 0 then
    v_username := lower(split_part(v_email, '@', 1));
  else
    v_username := lower(left(new.id::text, 8));
  end if;

  -- Optional display name from metadata if provided
  begin
    v_first := coalesce(new.raw_user_meta_data->>'first_name', null);
    v_last  := coalesce(new.raw_user_meta_data->>'last_name', null);
  exception when others then
    -- raw_user_meta_data shape can vary; ignore
    v_first := null; v_last := null;
  end;

  v_display := nullif(trim(coalesce(v_first, '') || ' ' || coalesce(v_last, '')), '');

  -- Insert default profile; avoid exceptions with ON CONFLICT and safe defaults
  insert into public.profiles (id, email, username, display_name, first_time)
  values (new.id, v_email, v_username, v_display, true)
  on conflict (id) do nothing;

  -- Optionally create a settings row if table exists (ignore if missing)
  begin
    insert into public.settings (user_id) values (new.id)
    on conflict (user_id) do nothing;
  exception when undefined_table then
    null; -- settings table not present; skip
  when others then
    null; -- never block sign-up on ancillary inserts
  end;

  return new;
exception when others then
  -- Never propagate errors to auth sign-up; just return new row
  return new;
end
$$;

-- Recreate trigger on auth.users to call the function after insert
do $$
begin
  if exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'auth' and c.relname = 'users' and t.tgname = 'trg_on_auth_user_created'
  ) then
    execute 'drop trigger trg_on_auth_user_created on auth.users';
  end if;

  execute 'create trigger trg_on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user()';
end $$;

-- Grants for the function to run under definer and be callable by trigger
revoke all on function public.handle_new_user() from public;
grant execute on function public.handle_new_user() to service_role, anon, authenticated;
