-- Add missing display_name column to public.profiles if absent
alter table public.profiles
  add column if not exists display_name text;

-- Backfill display_name with coalesce of existing user_metadata names if null
update public.profiles p
set display_name = coalesce(p.display_name, p.username, split_part(p.email,'@',1))
where p.display_name is null;

-- Ensure pg_trgm extension exists before creating trigram index (Supabase allows this)
create extension if not exists pg_trgm;

-- Optional: trigram index to speed ILIKE / similarity searches over display_name
do $$
begin
  execute 'create index if not exists profiles_display_name_trgm_idx on public.profiles using gin (display_name gin_trgm_ops)';
exception when others then
  -- If extension/operator class still unavailable, skip without failing the migration
  raise notice 'Skipping trigram index for display_name (%).', SQLERRM;
end $$;
