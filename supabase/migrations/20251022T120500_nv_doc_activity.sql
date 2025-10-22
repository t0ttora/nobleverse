-- NobleDocs activity & versioning tables
-- Tracks timeline of edits and allows restoring historical versions.

create extension if not exists pgcrypto;

create table if not exists public.nv_doc_versions (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references public.nv_docs(id) on delete cascade,
  version_number integer,
  title text not null,
  content_html text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(doc_id, version_number)
);

create table if not exists public.nv_doc_events (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references public.nv_docs(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in ('content_saved','title_updated','version_restored','version_created','starred','unstarred')),
  detail jsonb not null default '{}'::jsonb,
  version_id uuid references public.nv_doc_versions(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists nv_doc_versions_doc_idx on public.nv_doc_versions(doc_id, version_number desc);
create index if not exists nv_doc_events_doc_idx on public.nv_doc_events(doc_id, created_at desc);

-- Auto-assign sequential version numbers per doc if not provided
create or replace function public.nv_doc_versions_assign_number()
returns trigger as $$
begin
  if new.version_number is null then
    select coalesce(max(version_number), 0) + 1
      into new.version_number
      from public.nv_doc_versions
     where doc_id = new.doc_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_nv_doc_versions_number on public.nv_doc_versions;
create trigger trg_nv_doc_versions_number
  before insert on public.nv_doc_versions
  for each row execute function public.nv_doc_versions_assign_number();

alter table public.nv_doc_versions enable row level security;
alter table public.nv_doc_events enable row level security;

-- Policies: doc owner (or actor) can insert/select; restoring handled on server.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'nv_doc_versions'
      and policyname = 'nv_doc_versions_select_owner'
  ) then
    create policy nv_doc_versions_select_owner on public.nv_doc_versions
      for select using (
        exists (
          select 1 from public.nv_docs d
          where d.id = nv_doc_versions.doc_id
            and (d.owner_id = auth.uid())
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'nv_doc_versions'
      and policyname = 'nv_doc_versions_insert_owner'
  ) then
    create policy nv_doc_versions_insert_owner on public.nv_doc_versions
      for insert with check (
        exists (
          select 1 from public.nv_docs d
          where d.id = nv_doc_versions.doc_id
            and d.owner_id = auth.uid()
        )
      );
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'nv_doc_events'
      and policyname = 'nv_doc_events_select_owner'
  ) then
    create policy nv_doc_events_select_owner on public.nv_doc_events
      for select using (
        exists (
          select 1 from public.nv_docs d
          where d.id = nv_doc_events.doc_id
            and (d.owner_id = auth.uid())
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'nv_doc_events'
      and policyname = 'nv_doc_events_insert_owner_or_actor'
  ) then
    create policy nv_doc_events_insert_owner_or_actor on public.nv_doc_events
      for insert with check (
        exists (
          select 1 from public.nv_docs d
          where d.id = nv_doc_events.doc_id
            and (d.owner_id = auth.uid())
        )
        or actor_id = auth.uid()
      );
  end if;
end$$;

-- Ensure authenticated users can interact via RLS-approved policies
grant usage on schema public to authenticated;
grant select, insert on public.nv_doc_versions to authenticated;
grant select, insert on public.nv_doc_events to authenticated;

-- Guarantee collaborator profile columns exist for the view below
alter table public.profiles
  add column if not exists display_name text;
alter table public.profiles
  add column if not exists avatar_url text;

-- Convenience view for joined events (owner filtered by RLS)
create or replace view public.nv_doc_event_entries as
  select
    e.id,
    e.doc_id,
    e.actor_id,
    e.event_type,
    e.detail,
    e.version_id,
    e.created_at,
    v.version_number,
    v.title as version_title,
    v.content_html as version_content_html,
    v.created_by as version_created_by,
    v.created_at as version_created_at,
    p.display_name,
    p.avatar_url
  from public.nv_doc_events e
  left join public.nv_doc_versions v on v.id = e.version_id
  left join public.profiles p on p.id = e.actor_id;

alter view public.nv_doc_event_entries owner to postgres;

-- Allow select on view (underlying RLS still enforced)
grant select on public.nv_doc_event_entries to authenticated;
