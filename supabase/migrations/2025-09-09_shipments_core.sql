-- Shipments core schema
-- Use idempotent guards

create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid,
  negotiation_id uuid,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  forwarder_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'created', -- created|in_transit|delivered|disputed|cancelled
  incoterm text,
  insurance jsonb,
  cargo jsonb,
  participants jsonb, -- array of participant descriptors
  total_amount_cents bigint not null default 0,
  platform_fee_cents bigint not null default 0,
  net_amount_cents bigint not null default 0,
  escrow_status text not null default 'hold', -- hold|released|refunded|partial
  label_hmac text, -- HMAC hash of last generated label token
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
  code text not null, -- e.g. BOOKED, PICKED_UP, IN_TRANSIT, CUSTOMS, DELIVERED
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

-- Basic messages table for shipment chat if not reusing existing chat system
create table if not exists public.shipment_messages (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists shipment_messages_shipment_idx on public.shipment_messages(shipment_id);

-- RLS
alter table public.shipments enable row level security;
alter table public.escrow_ledger enable row level security;
alter table public.milestones enable row level security;
alter table public.scans enable row level security;
alter table public.shipment_messages enable row level security;

-- Helper policy using participants jsonb OR direct role (owner/forwarder)
create or replace function public.is_shipment_participant(s public.shipments, uid uuid)
returns boolean language sql stable as $$
  select uid = s.owner_id or uid = s.forwarder_id or exists (
    select 1 from jsonb_array_elements_text(coalesce(s.participants,'[]'::jsonb)) as p where p = uid::text
  );
$$;

-- Policies (drop then recreate for idempotency; CREATE POLICY lacks IF NOT EXISTS)
drop policy if exists "shipments_select" on public.shipments;
create policy "shipments_select" on public.shipments for select using (
  public.is_shipment_participant(shipments, auth.uid())
);

drop policy if exists "shipments_modify" on public.shipments;
create policy "shipments_modify" on public.shipments for all using (
  public.is_shipment_participant(shipments, auth.uid())
);

drop policy if exists "escrow_ledger_select" on public.escrow_ledger;
create policy "escrow_ledger_select" on public.escrow_ledger for select using (
  exists (
    select 1 from public.shipments s
    where s.id = escrow_ledger.shipment_id
      and public.is_shipment_participant(s, auth.uid())
  )
);

drop policy if exists "escrow_ledger_insert" on public.escrow_ledger;
create policy "escrow_ledger_insert" on public.escrow_ledger for insert with check (
  exists (
    select 1 from public.shipments s
    where s.id = escrow_ledger.shipment_id
      and public.is_shipment_participant(s, auth.uid())
  )
);

drop policy if exists "milestones_rw" on public.milestones;
create policy "milestones_rw" on public.milestones for all using (
  exists (
    select 1 from public.shipments s
    where s.id = milestones.shipment_id
      and public.is_shipment_participant(s, auth.uid())
  )
);

drop policy if exists "scans_rw" on public.scans;
create policy "scans_rw" on public.scans for all using (
  exists (
    select 1 from public.shipments s
    where s.id = scans.shipment_id
      and public.is_shipment_participant(s, auth.uid())
  )
);

drop policy if exists "shipment_messages_rw" on public.shipment_messages;
create policy "shipment_messages_rw" on public.shipment_messages for all using (
  exists (
    select 1 from public.shipments s
    where s.id = shipment_messages.shipment_id
      and public.is_shipment_participant(s, auth.uid())
  )
);

-- Trigger to auto release escrow when DELIVERED milestone inserted
create or replace function public.auto_release_on_delivered()
returns trigger language plpgsql as $$
begin
  if NEW.code = 'DELIVERED' then
    update public.shipments set escrow_status = 'released', status = 'delivered', updated_at = now() where id = NEW.shipment_id and escrow_status = 'hold';
    insert into public.escrow_ledger(shipment_id, entry_type, amount_cents, meta)
      select id, 'RELEASE', net_amount_cents, jsonb_build_object('reason','auto_release_on_delivered') from public.shipments where id = NEW.shipment_id;
  end if;
  return NEW;
end;
$$;

create trigger if not exists trg_auto_release_on_delivered
  after insert on public.milestones
  for each row execute function public.auto_release_on_delivered();
