-- Create or update shipments table and related triggers/indexes (idempotent)

create extension if not exists pgcrypto;

-- Table
create table if not exists public.shipments (
  id uuid not null default gen_random_uuid(),
  code text null,
  offer_id uuid null,
  negotiation_id uuid null,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  forwarder_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'created'::text,
  incoterm text null,
  insurance jsonb null,
  cargo jsonb null,
  participants jsonb null,
  total_amount_cents bigint not null default 0,
  platform_fee_cents bigint not null default 0,
  net_amount_cents bigint not null default 0,
  escrow_status text not null default 'hold'::text,
  label_hmac text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shipments_pkey primary key (id)
);

-- Ensure FKs (in case table existed without them)
alter table public.shipments
  drop constraint if exists shipments_forwarder_id_fkey,
  drop constraint if exists shipments_owner_id_fkey;

alter table public.shipments
  add constraint shipments_forwarder_id_fkey foreign key (forwarder_id) references public.profiles(id) on delete cascade,
  add constraint shipments_owner_id_fkey foreign key (owner_id) references public.profiles(id) on delete cascade;

-- Unique code index
create unique index if not exists shipments_code_unique on public.shipments(code);

-- Code generator function (if missing)
create sequence if not exists public.shipment_code_seq;

create or replace function public.gen_shipment_code()
returns text language sql as $$
  select 'RDF-' || to_char(now(),'YYMM') || '-' || lpad(nextval('public.shipment_code_seq')::text,4,'0');
$$;

create or replace function public.set_shipment_code()
returns trigger language plpgsql as $$
begin
  if new.code is null or new.code = '' then
    new.code := public.gen_shipment_code();
  end if;
  return new;
end; $$;

-- Triggers
drop trigger if exists trg_set_shipment_code on public.shipments;
create trigger trg_set_shipment_code before insert on public.shipments
  for each row execute function public.set_shipment_code();

-- Safe updated_at helper
create or replace function public.set_updated_at_safe()
returns trigger language plpgsql as $$
declare has_col boolean; begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = tg_table_schema
      and table_name = tg_table_name
      and column_name = 'updated_at'
  ) into has_col;
  if has_col then new.updated_at = now(); end if; return new; end; $$;

drop trigger if exists trg_shipments_updated_at on public.shipments;
create trigger trg_shipments_updated_at before update on public.shipments
  for each row execute function public.set_updated_at_safe();

-- Enable RLS (idempotent)
alter table public.shipments enable row level security;

-- Participant helper
create or replace function public.is_shipment_participant(s public.shipments, uid uuid)
returns boolean language sql stable as $$
  select uid = s.owner_id
      or uid = s.forwarder_id
      or exists (
        select 1 from jsonb_array_elements_text(coalesce(s.participants,'[]'::jsonb)) p
        where p = uid::text
      );
$$;

-- Policies (drop & recreate to ensure correct definitions)
do $$ begin
  if exists (select 1 from pg_policies where policyname='shipments_select' and tablename='shipments') then
    drop policy shipments_select on public.shipments;
  end if;
  if exists (select 1 from pg_policies where policyname='shipments_modify' and tablename='shipments') then
    drop policy shipments_modify on public.shipments;
  end if;
end $$;

create policy shipments_select on public.shipments for select using (
  public.is_shipment_participant(shipments, auth.uid())
);

create policy shipments_modify on public.shipments for all using (
  public.is_shipment_participant(shipments, auth.uid())
);
