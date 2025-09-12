-- Chat rooms & messages (idempotent)
create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'dm', -- dm|group|shipment
  shipment_id uuid references public.shipments(id) on delete cascade,
  participants uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  content text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);

alter table public.chat_rooms enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists chat_rooms_select on public.chat_rooms;
create policy chat_rooms_select on public.chat_rooms for select using (
  auth.uid() = any(participants)
);

drop policy if exists chat_rooms_insert on public.chat_rooms;
create policy chat_rooms_insert on public.chat_rooms for insert with check (
  auth.uid() = any(participants)
);

drop policy if exists chat_messages_rw on public.chat_messages;
create policy chat_messages_rw on public.chat_messages for all using (
  exists (select 1 from public.chat_rooms r where r.id = chat_messages.room_id and auth.uid() = any(r.participants))
);

-- Negotiation status constraint (assumes table exists with column status)
-- Allowed statuses: pending, counter, accepted, rejected
do $$ begin
  begin
    alter table public.negotiations
      add constraint negotiations_status_check
      check (status in ('pending','counter','accepted','rejected'));
  exception when duplicate_object then null; end;
end $$;

-- Requests status extended: pending|converted|cancelled|archived
do $$ begin
  begin
    alter table public.requests
      add constraint requests_status_check
      check (status in ('pending','converted','cancelled','archived'));
  exception when duplicate_object then null; end;
end $$;

-- Optional partial refund support: add refunded_amount_cents
alter table public.shipments
  add column if not exists refunded_amount_cents bigint not null default 0;

-- Index to query active (non-converted) requests quickly
create index if not exists requests_active_idx on public.requests(status) where status <> 'converted';
