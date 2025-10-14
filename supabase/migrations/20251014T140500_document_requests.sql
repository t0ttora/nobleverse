-- Document requests table for importer/forwarder workflows
-- Ensure pgcrypto for gen_random_uuid()
create extension if not exists pgcrypto;
create table if not exists public.document_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid references public.profiles(id) on delete set null,
  shipment_id uuid references public.shipments(id) on delete set null,
  type text not null check (type in (
    'commercial_invoice','packing_list','bill_of_lading','certificate_of_origin','insurance','import_license','custom'
  )),
  note text,
  status text not null default 'pending' check (status in ('pending','fulfilled','rejected')),
  file_path text,
  created_at timestamptz not null default now()
);

alter table public.document_requests enable row level security;

-- Policies: requester or receiver can view/insert/update their rows (idempotent)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'document_requests' and policyname = 'document_requests_select'
  ) then
    create policy document_requests_select on public.document_requests
      for select using (
        auth.uid() = requester_id or auth.uid() = receiver_id
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'document_requests' and policyname = 'document_requests_insert'
  ) then
    create policy document_requests_insert on public.document_requests
      for insert with check (
        auth.uid() = requester_id
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'document_requests' and policyname = 'document_requests_update'
  ) then
    create policy document_requests_update on public.document_requests
      for update using (
        auth.uid() = requester_id or auth.uid() = receiver_id
      );
  end if;

  -- Optional: allow delete by requester
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'document_requests' and policyname = 'document_requests_delete'
  ) then
    create policy document_requests_delete on public.document_requests
      for delete using (auth.uid() = requester_id);
  end if;
end $$;
