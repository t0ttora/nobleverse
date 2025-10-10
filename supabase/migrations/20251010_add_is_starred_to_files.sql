-- Add a favorites flag to files
alter table if exists public.files
  add column if not exists is_starred boolean not null default false;

create index if not exists files_is_starred_idx on public.files (is_starred);
