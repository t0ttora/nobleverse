-- Enable required extension for UUID generation
create extension if not exists pgcrypto;

-- Create table for NobleDocs documents
create table if not exists public.nv_docs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  title text not null default 'Untitled Doc',
  content_html text not null default '<p></p>',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Row Level Security
alter table public.nv_docs enable row level security;

-- Policies: owners can do everything
drop policy if exists "nv_docs_owner_all" on public.nv_docs;
create policy "nv_docs_owner_all"
on public.nv_docs as permissive
for all
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

-- Optional: read policy for all authenticated users (comment out if not desired)
drop policy if exists "nv_docs_read_all_auth" on public.nv_docs;
create policy "nv_docs_read_all_auth"
on public.nv_docs as permissive
for select
to authenticated
using (true);

-- Trigger to update updated_at
create or replace function public.set_current_timestamp_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_timestamp on public.nv_docs;
create trigger set_timestamp
before update on public.nv_docs
for each row
execute function public.set_current_timestamp_updated_at();
