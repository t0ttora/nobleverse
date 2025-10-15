-- Tracking MVP schema: sources, events, status and ingest RPC
create table if not exists public.tracking_sources (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null,
  mode text check (mode in ('road','air','sea')) not null,
  source_type text not null,
  identifier text,
  provider text,
  meta jsonb default '{}'::jsonb,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.tracking_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null,
  source_id uuid,
  lat double precision not null,
  lon double precision not null,
  speed real,
  heading real,
  accuracy real,
  provider text,
  created_at timestamptz default now(),
  raw jsonb
);

create index if not exists tracking_events_shipment_time_idx on public.tracking_events (shipment_id, created_at desc);

create table if not exists public.tracking_status (
  shipment_id uuid primary key,
  last_lat double precision,
  last_lon double precision,
  last_timestamp timestamptz,
  provider text,
  state text,
  updated_at timestamptz default now()
);

alter table public.tracking_sources enable row level security;
alter table public.tracking_events enable row level security;
alter table public.tracking_status enable row level security;

-- Basic participant check: owner or forwarder can manage; participants can read
-- Assumes shipments table has owner_id and forwarder_id
create or replace function public.is_shipment_participant(p_user uuid, p_shipment uuid)
returns boolean language sql stable as $$
  select exists(
    select 1 from public.shipments s
    where s.id = p_shipment and (s.owner_id = p_user or s.forwarder_id = p_user)
  );
$$;

-- Policies
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='tracking_sources' and policyname='tracking_sources_select'
  ) then
    create policy tracking_sources_select on public.tracking_sources for select using (
      auth.uid() is not null and public.is_shipment_participant(auth.uid(), shipment_id)
    );
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='tracking_sources' and policyname='tracking_sources_ins_upd'
  ) then
    create policy tracking_sources_ins_upd on public.tracking_sources for all using (
      auth.uid() is not null and public.is_shipment_participant(auth.uid(), shipment_id)
    ) with check (
      auth.uid() is not null and public.is_shipment_participant(auth.uid(), shipment_id)
    );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='tracking_events' and policyname='tracking_events_select'
  ) then
    create policy tracking_events_select on public.tracking_events for select using (
      auth.uid() is not null and public.is_shipment_participant(auth.uid(), shipment_id)
    );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='tracking_status' and policyname='tracking_status_select'
  ) then
    create policy tracking_status_select on public.tracking_status for select using (
      auth.uid() is not null and public.is_shipment_participant(auth.uid(), shipment_id)
    );
  end if;
end $$;

-- SECURITY DEFINER ingest RPC to allow token-based inserts without exposing service key
create or replace function public.track_event_ingest(
  p_token text,
  p_shipment uuid,
  p_lat double precision,
  p_lon double precision,
  p_speed real default null,
  p_heading real default null,
  p_accuracy real default null,
  p_provider text default 'driver_app'
) returns void
language plpgsql
security definer
as $$
declare
  v_source_id uuid;
  v_meta jsonb;
  v_token text;
begin
  -- Validate token against an active source on shipment (meta ->> 'token')
  select id, meta into v_source_id, v_meta
  from public.tracking_sources
  where shipment_id = p_shipment and active = true
    and (meta ->> 'token') = p_token
  limit 1;
  if v_source_id is null then
    raise exception 'invalid token or inactive source';
  end if;

  insert into public.tracking_events (shipment_id, source_id, lat, lon, speed, heading, accuracy, provider)
  values (p_shipment, v_source_id, p_lat, p_lon, p_speed, p_heading, p_accuracy, p_provider);

  insert into public.tracking_status as ts (shipment_id, last_lat, last_lon, last_timestamp, provider, state, updated_at)
  values (p_shipment, p_lat, p_lon, now(), p_provider, 'in_transit', now())
  on conflict (shipment_id) do update
    set last_lat = excluded.last_lat,
        last_lon = excluded.last_lon,
        last_timestamp = excluded.last_timestamp,
        provider = excluded.provider,
        state = excluded.state,
        updated_at = now();
end;
$$;

revoke all on function public.track_event_ingest from public;
grant execute on function public.track_event_ingest to anon, authenticated;
