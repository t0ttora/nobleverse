-- Fix infinite recursion between files <-> file_permissions policies.
-- Simplify to owner-only access for files; basic self-only for file_permissions.

-- Drop existing policies if they exist
do $$ begin
  if exists (select 1 from pg_policies where policyname='files_select' and tablename='files') then
    drop policy files_select on public.files; end if;
  if exists (select 1 from pg_policies where policyname='files_insert' and tablename='files') then
    drop policy files_insert on public.files; end if;
  if exists (select 1 from pg_policies where policyname='files_update' and tablename='files') then
    drop policy files_update on public.files; end if;
  if exists (select 1 from pg_policies where policyname='files_delete' and tablename='files') then
    drop policy files_delete on public.files; end if;
  if exists (select 1 from pg_policies where policyname='file_permissions_select' and tablename='file_permissions') then
    drop policy file_permissions_select on public.file_permissions; end if;
  if exists (select 1 from pg_policies where policyname='file_permissions_insert' and tablename='file_permissions') then
    drop policy file_permissions_insert on public.file_permissions; end if;
  if exists (select 1 from pg_policies where policyname='file_permissions_delete' and tablename='file_permissions') then
    drop policy file_permissions_delete on public.file_permissions; end if;
end $$;

-- Recreate simplified policies (no cross-table lookups to avoid recursion)
create policy files_select on public.files for select using (auth.uid() = owner_id);
create policy files_insert on public.files for insert with check (auth.uid() = owner_id);
create policy files_update on public.files for update using (auth.uid() = owner_id);
create policy files_delete on public.files for delete using (auth.uid() = owner_id);

-- file_permissions not yet in use for sharing; restrict to a user's own rows
create policy file_permissions_select on public.file_permissions for select using (auth.uid() = user_id);
create policy file_permissions_insert on public.file_permissions for insert with check (auth.uid() = user_id);
create policy file_permissions_delete on public.file_permissions for delete using (auth.uid() = user_id);

-- NOTE: When introducing sharing, replace files_select with a SECURITY DEFINER function
-- that checks file_permissions to avoid recursive RLS evaluation.
