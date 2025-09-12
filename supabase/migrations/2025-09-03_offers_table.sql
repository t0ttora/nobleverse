-- Offers table for forwarder quotes per request
-- required for gen_random_uuid
create extension if not exists pgcrypto;

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  request_id bigint not null references public.requests(id) on delete cascade,
  forwarder_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'sent' check (status in ('sent','withdrawn','accepted','rejected')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- In case the table existed already without these columns/constraints, ensure they exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'offers' and column_name = 'request_id'
  ) then
    alter table public.offers add column request_id bigint;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'offers' and column_name = 'forwarder_id'
  ) then
    alter table public.offers add column forwarder_id uuid;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'offers' and column_name = 'details'
  ) then
    alter table public.offers add column details jsonb not null default '{}'::jsonb;
  end if;
end$$;

-- Ensure FKs exist
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'offers_request_id_fkey') then
    alter table public.offers add constraint offers_request_id_fkey foreign key (request_id) references public.requests(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'offers_forwarder_id_fkey') then
    alter table public.offers add constraint offers_forwarder_id_fkey foreign key (forwarder_id) references public.profiles(id) on delete cascade;
  end if;
end$$;

create index if not exists offers_request_id_idx on public.offers(request_id);
create index if not exists offers_forwarder_id_idx on public.offers(forwarder_id);
-- Uniqueness: a forwarder can create only one offer per request
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'offers_request_forwarder_unique') then
    alter table public.offers add constraint offers_request_forwarder_unique unique (request_id, forwarder_id);
  end if;
end$$;

-- RLS
alter table public.offers enable row level security;

-- Ensure status column and constraint are compatible with app
do $$
begin
  -- force text type and default if needed (no-op if already text)
  begin
    alter table public.offers alter column status type text using status::text;
  exception when others then
    -- ignore if type already text or cast is unnecessary
    null;
  end;
  alter table public.offers alter column status set default 'sent';
  alter table public.offers alter column status set not null;
  -- replace check constraint to include valid states used by the app
  if exists (select 1 from pg_constraint where conname = 'offers_status_check') then
    alter table public.offers drop constraint offers_status_check;
  end if;
  alter table public.offers add constraint offers_status_check check (status in ('sent','withdrawn','accepted','rejected'));
end$$;

-- Forwarders can insert their own offers
drop policy if exists offers_forwarder_insert on public.offers;
create policy offers_forwarder_insert on public.offers
  for insert to authenticated
  with check (auth.uid() = forwarder_id);

-- Forwarder can see their own offers; request owner can see offers on their request
drop policy if exists offers_select_own_or_owner on public.offers;
create policy offers_select_own_or_owner on public.offers
  for select using (
    auth.uid() = forwarder_id
    or exists (
      select 1 from public.requests r where r.id = offers.request_id and r.user_id = auth.uid()
    )
  );

-- Forwarder can update their offer until accepted
drop policy if exists offers_update_forwarder on public.offers;
create policy offers_update_forwarder on public.offers
  for update to authenticated using (
    auth.uid() = forwarder_id and status in ('sent','withdrawn')
  ) with check (
    auth.uid() = forwarder_id
  );

-- Request owner can update statuses (e.g., accept/reject)
drop policy if exists offers_update_owner on public.offers;
create policy offers_update_owner on public.offers
  for update to authenticated using (
    exists (
      select 1 from public.requests r where r.id = offers.request_id and r.user_id = auth.uid()
    )
  );

-- Forwarder can delete own offers (e.g., withdraw)
drop policy if exists offers_delete_forwarder on public.offers;
create policy offers_delete_forwarder on public.offers
  for delete to authenticated using (
    auth.uid() = forwarder_id and status in ('sent','withdrawn')
  );

-- Trigger to auto-update updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_offers_updated_at on public.offers;
create trigger set_offers_updated_at
before update on public.offers
for each row execute function public.set_updated_at();
