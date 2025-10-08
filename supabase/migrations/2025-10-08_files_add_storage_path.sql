-- Add storage_path column to files for direct retrieval of object path
alter table public.files add column if not exists storage_path text;

-- Backfill existing binary rows if missing
update public.files
set storage_path = owner_id::text || '/' || id::text || '/' || name
where type = 'binary' and (storage_path is null or storage_path = '');

create index if not exists files_storage_path_idx on public.files(storage_path);