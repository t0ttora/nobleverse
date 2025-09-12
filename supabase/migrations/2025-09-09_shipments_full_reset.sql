-- ============================================================================
-- SHIPMENTS / ESCROW / LABELING FULL SETUP (Idempotent)
-- Run this if previous attempts failed. Safe to re-run; uses guards & drops.
-- ============================================================================

-- Extensions
create extension if not exists pgcrypto;

-- ----------------------------------------
-- Safe updated_at helper (generic)
-- ----------------------------------------
create or replace function public.set_updated_at_safe()
returns trigger language plpgsql as $$
declare has_col boolean; begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = tg_table_schema
      and table_name = tg_table_name
      and column_name = 'updated_at'
  ) into has_col;
  if has_col then NEW.updated_at = now(); end if; return NEW; end; $$;

-- Backwards compatibility alias
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin return public.set_updated_at_safe(); end; $$;

-- ----------------------------------------
-- Core Tables
-- ----------------------------------------
create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  code text,
  offer_id uuid,
  negotiation_id uuid,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  forwarder_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'created', -- created|in_transit|delivered|disputed|cancelled
  incoterm text,
  insurance jsonb,
  cargo jsonb,
  participants jsonb,
  total_amount_cents bigint not null default 0,
  platform_fee_cents bigint not null default 0,
  net_amount_cents bigint not null default 0,
  escrow_status text not null default 'hold', -- hold|released|refunded|partial
  label_hmac text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.escrow_ledger (
  id bigserial primary key,
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  entry_type text not null, -- HOLD|RELEASE|FEE|REFUND|ADJUST
  amount_cents bigint not null,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists escrow_ledger_shipment_idx on public.escrow_ledger(shipment_id);

create table if not exists public.milestones (
  id bigserial primary key,
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  code text not null,
  label text,
  details jsonb,
  created_at timestamptz not null default now()
);
create index if not exists milestones_shipment_idx on public.milestones(shipment_id);

create table if not exists public.scans (
  id bigserial primary key,
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  scanned_at timestamptz not null default now(),
  location text,
  meta jsonb
);
create index if not exists scans_shipment_idx on public.scans(shipment_id);

create table if not exists public.shipment_messages (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists shipment_messages_shipment_idx on public.shipment_messages(shipment_id);

-- ----------------------------------------
-- RLS Enable
-- ----------------------------------------
alter table public.shipments enable row level security;
alter table public.escrow_ledger enable row level security;
alter table public.milestones enable row level security;
alter table public.scans enable row level security;
alter table public.shipment_messages enable row level security;

-- ----------------------------------------
-- Participant helper
-- ----------------------------------------
create or replace function public.is_shipment_participant(s public.shipments, uid uuid)
returns boolean language sql stable as $$
  select uid = s.owner_id
      or uid = s.forwarder_id
      or exists (
        select 1 from jsonb_array_elements_text(coalesce(s.participants,'[]'::jsonb)) p
        where p = uid::text
      );
$$;

-- ----------------------------------------
-- Policies (drop & recreate)
-- ----------------------------------------
drop policy if exists shipments_select on public.shipments;
create policy shipments_select on public.shipments for select using (
  public.is_shipment_participant(shipments, auth.uid())
);

drop policy if exists shipments_modify on public.shipments;
create policy shipments_modify on public.shipments for all using (
  public.is_shipment_participant(shipments, auth.uid())
);

drop policy if exists escrow_ledger_select on public.escrow_ledger;
create policy escrow_ledger_select on public.escrow_ledger for select using (
  exists (select 1 from public.shipments s where s.id = escrow_ledger.shipment_id and public.is_shipment_participant(s, auth.uid()))
);

drop policy if exists escrow_ledger_insert on public.escrow_ledger;
create policy escrow_ledger_insert on public.escrow_ledger for insert with check (
  exists (select 1 from public.shipments s where s.id = escrow_ledger.shipment_id and public.is_shipment_participant(s, auth.uid()))
);

drop policy if exists milestones_rw on public.milestones;
create policy milestones_rw on public.milestones for all using (
  exists (select 1 from public.shipments s where s.id = milestones.shipment_id and public.is_shipment_participant(s, auth.uid()))
);

drop policy if exists scans_rw on public.scans;
create policy scans_rw on public.scans for all using (
  exists (select 1 from public.shipments s where s.id = scans.shipment_id and public.is_shipment_participant(s, auth.uid()))
);

drop policy if exists shipment_messages_rw on public.shipment_messages;
create policy shipment_messages_rw on public.shipment_messages for all using (
  exists (select 1 from public.shipments s where s.id = shipment_messages.shipment_id and public.is_shipment_participant(s, auth.uid()))
);

-- ----------------------------------------
-- Auto release trigger on DELIVERED milestone
-- ----------------------------------------
create or replace function public.auto_release_on_delivered()
returns trigger language plpgsql as $$
begin
  if NEW.code = 'DELIVERED' then
    update public.shipments
      set escrow_status = 'released', status = 'delivered', updated_at = now()
      where id = NEW.shipment_id and escrow_status = 'hold';
    insert into public.escrow_ledger(shipment_id, entry_type, amount_cents, meta)
      select id, 'RELEASE', net_amount_cents, jsonb_build_object('reason','auto_release_on_delivered')
      from public.shipments where id = NEW.shipment_id;
  end if;
  return NEW;
end; $$;

drop trigger if exists trg_auto_release_on_delivered on public.milestones;
create trigger trg_auto_release_on_delivered
  after insert on public.milestones
  for each row execute function public.auto_release_on_delivered();

-- ----------------------------------------
-- Human-readable code generation
-- ----------------------------------------
create sequence if not exists public.shipment_code_seq;

create or replace function public.gen_shipment_code()
returns text language sql as $$
  select 'RDF-' || to_char(now(),'YYMM') || '-' || lpad(nextval('public.shipment_code_seq')::text,4,'0');
$$;

create or replace function public.set_shipment_code()
returns trigger language plpgsql as $$
begin
  if NEW.code is null or NEW.code = '' then
    NEW.code := public.gen_shipment_code();
  end if; return NEW; end; $$;

drop trigger if exists trg_set_shipment_code on public.shipments;
create trigger trg_set_shipment_code
  before insert on public.shipments
  for each row execute function public.set_shipment_code();

-- Backfill empty codes
update public.shipments set code = public.gen_shipment_code() where code is null;

create unique index if not exists shipments_code_unique on public.shipments(code);

-- ----------------------------------------
-- updated_at triggers attach / rewire
-- ----------------------------------------
drop trigger if exists trg_shipments_updated_at on public.shipments;
create trigger trg_shipments_updated_at before update on public.shipments
  for each row execute function public.set_updated_at_safe();

do $$ begin
  if exists (select 1 from pg_class where relname='offers') then
    drop trigger if exists set_offers_updated_at on public.offers;
    create trigger set_offers_updated_at before update on public.offers
      for each row execute function public.set_updated_at_safe();
  end if;
  if exists (select 1 from pg_class where relname='tasks') then
    drop trigger if exists trg_tasks_updated_at on public.tasks;
    create trigger trg_tasks_updated_at before update on public.tasks
      for each row execute function public.set_updated_at_safe();
  end if;
end $$;

-- Add updated_at to domain tables if missing

do $$
declare
  t text;
  tables text[] := array['requests','negotiations','chat_rooms','chat_messages'];
begin
  foreach t in array tables loop
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) then
      if not exists (
        select 1 from information_schema.columns
        where table_schema='public' and table_name=t and column_name='updated_at'
      ) then
        execute format('alter table public.%I add column updated_at timestamptz not null default now();', t);
      end if;
      if not exists (select 1 from pg_trigger where tgname = 'trg_'||t||'_updated_at') then
        execute format('create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at_safe();', t, t);
      end if;
    end if;
  end loop;
end $$;

-- Optional storage buckets (uncomment first run)
-- select storage.create_bucket('shipments', false);
-- select storage.create_bucket('chat-uploads', false);

-- Sanity (commented)
-- select * from public.shipments limit 1;
-- select polname, tablename from pg_policies where tablename in ('shipments','escrow_ledger');

-- DONE
