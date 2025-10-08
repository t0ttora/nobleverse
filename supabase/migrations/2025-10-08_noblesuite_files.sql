-- NobleFiles core schema (files, file_versions, file_permissions)
-- Idempotent-ish: uses IF NOT EXISTS patterns where possible.

create extension if not exists pgcrypto;

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.files(id) on delete cascade,
  name text not null,
  type text not null check (type in ('folder','binary','note','sheet','link')),
  mime_type text,
  ext text,
  size_bytes int4,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  shipment_id uuid references public.shipments(id) on delete set null,
  tags text[] not null default '{}'::text[],
  version int4 not null default 1,
  latest_version_id uuid,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Uniqueness: prevent duplicate name under same parent (excluding soft-deleted handled via partial unique index)
create unique index if not exists files_parent_name_unique on public.files(parent_id, lower(name)) where is_deleted = false;
create index if not exists files_owner_idx on public.files(owner_id);
create index if not exists files_parent_idx on public.files(parent_id) where is_deleted = false;
create index if not exists files_shipment_idx on public.files(shipment_id) where shipment_id is not null;

-- Versions table (future use)
create table if not exists public.file_versions (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.files(id) on delete cascade,
  version_number int not null,
  storage_path text not null,
  size_bytes int4,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(file_id, version_number)
);

-- Permissions table (future sharing model)
create table if not exists public.file_permissions (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.files(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner','editor','viewer')),
  created_at timestamptz not null default now(),
  unique(file_id, user_id)
);

-- Ensure updated_at trigger present
do $$
begin
  if exists (select 1 from pg_proc where proname='set_updated_at_safe') then
    drop trigger if exists trg_files_updated_at on public.files;
    create trigger trg_files_updated_at before update on public.files
      for each row execute function public.set_updated_at_safe();
  end if;
end$$;

alter table public.files enable row level security;
alter table public.file_versions enable row level security;
alter table public.file_permissions enable row level security;

-- Policies (owner only baseline) - use DO blocks because CREATE POLICY lacks IF NOT EXISTS
do $$ begin
  if not exists (select 1 from pg_policies where policyname='files_select' and schemaname='public' and tablename='files') then
    create policy files_select on public.files for select using (
      auth.uid() = owner_id or exists (
        select 1 from public.file_permissions fp where fp.file_id = files.id and fp.user_id = auth.uid()
      )
    );
  end if;
  if not exists (select 1 from pg_policies where policyname='files_insert' and schemaname='public' and tablename='files') then
    create policy files_insert on public.files for insert with check (auth.uid() = owner_id);
  end if;
  if not exists (select 1 from pg_policies where policyname='files_update' and schemaname='public' and tablename='files') then
    create policy files_update on public.files for update using (auth.uid() = owner_id);
  end if;
  if not exists (select 1 from pg_policies where policyname='files_delete' and schemaname='public' and tablename='files') then
    create policy files_delete on public.files for delete using (auth.uid() = owner_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname='file_versions_select' and schemaname='public' and tablename='file_versions') then
    create policy file_versions_select on public.file_versions for select using (
      exists (select 1 from public.files f where f.id = file_versions.file_id and f.owner_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where policyname='file_versions_insert' and schemaname='public' and tablename='file_versions') then
    create policy file_versions_insert on public.file_versions for insert with check (
      exists (select 1 from public.files f where f.id = file_versions.file_id and f.owner_id = auth.uid())
    );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname='file_permissions_select' and schemaname='public' and tablename='file_permissions') then
    create policy file_permissions_select on public.file_permissions for select using (
      auth.uid() = user_id or exists (select 1 from public.files f where f.id = file_permissions.file_id and f.owner_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where policyname='file_permissions_insert' and schemaname='public' and tablename='file_permissions') then
    create policy file_permissions_insert on public.file_permissions for insert with check (
      exists (select 1 from public.files f where f.id = file_permissions.file_id and f.owner_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where policyname='file_permissions_delete' and schemaname='public' and tablename='file_permissions') then
    create policy file_permissions_delete on public.file_permissions for delete using (
      exists (select 1 from public.files f where f.id = file_permissions.file_id and f.owner_id = auth.uid())
    );
  end if;
end $$;

-- Helpful root folder (optional) skipped: root represented by parent_id is null.

-- TODO (later): triggers to auto-create owner permission row.
