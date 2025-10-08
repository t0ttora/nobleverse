-- 20251008193110_storage_files_policies.sql
-- Storage 'files' bucket owner-only policies (idempotent). Version timestamp must be 14 digits.

do $$ begin
  if not exists (select 1 from pg_policies where policyname='files_upload_own') then
    create policy files_upload_own on storage.objects for insert to authenticated
      with check (
        bucket_id = 'files'
        and split_part(name,'/',1) = auth.uid()::text
      );
  end if;
  if not exists (select 1 from pg_policies where policyname='files_select_own') then
    create policy files_select_own on storage.objects for select to authenticated
      using (
        bucket_id = 'files'
        and split_part(name,'/',1) = auth.uid()::text
      );
  end if;
  if not exists (select 1 from pg_policies where policyname='files_delete_own') then
    create policy files_delete_own on storage.objects for delete to authenticated
      using (
        bucket_id = 'files'
        and split_part(name,'/',1) = auth.uid()::text
      );
  end if;
end $$;

-- Optional public read (commented). Uncomment if you want everyone to view objects.
-- do $$ begin
--   if not exists (select 1 from pg_policies where policyname='files_public_read') then
--     create policy files_public_read on storage.objects for select to anon
--       using (bucket_id='files');
--   end if;
-- end $$;
