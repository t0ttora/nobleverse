-- Create storage buckets for Shipments Docs and Chat uploads with simple policies (idempotent)
-- This keeps the UI working with getPublicUrl() links. If you prefer private buckets,
-- set public=false and replace 'select to anon' with signed URLs in the app code.

do $$ begin
  -- Shipments bucket
  if not exists (select 1 from storage.buckets where name = 'shipments') then
    insert into storage.buckets (id, name, public) values ('shipments','shipments', true);
  end if;

  -- Public read (view/list) for shipments
  if not exists (select 1 from pg_policies where policyname='shipments_public_read') then
    create policy shipments_public_read on storage.objects for select to anon
      using (bucket_id = 'shipments');
  end if;

  -- Authenticated read/list for shipments
  if not exists (select 1 from pg_policies where policyname='shipments_auth_select') then
    create policy shipments_auth_select on storage.objects for select to authenticated
      using (bucket_id = 'shipments');
  end if;

  -- Authenticated users can upload into shipments
  if not exists (select 1 from pg_policies where policyname='shipments_auth_insert') then
    create policy shipments_auth_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'shipments');
  end if;

  -- Authenticated users can delete from shipments (simple bucket-scoped policy)
  if not exists (select 1 from pg_policies where policyname='shipments_auth_delete') then
    create policy shipments_auth_delete on storage.objects for delete to authenticated
      using (bucket_id = 'shipments');
  end if;

  -- Chat uploads bucket
  if not exists (select 1 from storage.buckets where name = 'chat-uploads') then
    insert into storage.buckets (id, name, public) values ('chat-uploads','chat-uploads', true);
  end if;

  -- Public read (view/list) for chat-uploads
  if not exists (select 1 from pg_policies where policyname='chat_uploads_public_read') then
    create policy chat_uploads_public_read on storage.objects for select to anon
      using (bucket_id = 'chat-uploads');
  end if;

  -- Authenticated read/list for chat-uploads
  if not exists (select 1 from pg_policies where policyname='chat_uploads_auth_select') then
    create policy chat_uploads_auth_select on storage.objects for select to authenticated
      using (bucket_id = 'chat-uploads');
  end if;

  -- Authenticated users can upload into chat-uploads
  if not exists (select 1 from pg_policies where policyname='chat_uploads_auth_insert') then
    create policy chat_uploads_auth_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'chat-uploads');
  end if;
end $$;

-- Note: We intentionally skip update/delete policies here. Add them later if needed.
