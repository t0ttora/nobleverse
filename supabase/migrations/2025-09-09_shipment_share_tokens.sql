-- Share link support for shipments
create table if not exists public.shipment_share_tokens (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  token_hash text not null,
  key_id text not null default 'v1',
  expires_at timestamptz not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists shipment_share_tokens_shipment_idx on public.shipment_share_tokens(shipment_id);
create index if not exists shipment_share_tokens_expiry_idx on public.shipment_share_tokens(expires_at);

alter table public.shipment_share_tokens enable row level security;

-- Allow participants to manage share tokens
drop policy if exists shipment_share_tokens_rw on public.shipment_share_tokens;
create policy shipment_share_tokens_rw on public.shipment_share_tokens for all using (
  exists(
    select 1 from public.shipments s
    where s.id = shipment_share_tokens.shipment_id
      and public.is_shipment_participant(s, auth.uid())
  )
) with check (
  exists(
    select 1 from public.shipments s
    where s.id = shipment_share_tokens.shipment_id
      and public.is_shipment_participant(s, auth.uid())
  )
);

-- Hash helper (pure SQL using digest from pgcrypto)
create or replace function public.hash_share_token(p_token text, p_key_id text default 'v1')
returns text language sql immutable as $$
  select encode(digest(p_token || ':' || coalesce(p_key_id,'v1'), 'sha256'),'hex');
$$;

-- SECURITY DEFINER function to fetch limited public shipment view by raw token
create or replace function public.fetch_public_shipment(p_token text)
returns table(
  id uuid,
  code text,
  status text,
  escrow_status text,
  milestones jsonb,
  scans jsonb
) language plpgsql security definer set search_path = public as $$
declare v_hash text; begin
  if p_token is null or length(p_token) < 8 then return; end if;
  v_hash := public.hash_share_token(p_token,'v1');
  return query
    select s.id, s.code, s.status, s.escrow_status,
      coalesce((select jsonb_agg(m order by m.created_at)
                from (
                  select id, code, label, created_at
                  from public.milestones m2 where m2.shipment_id = s.id
                ) m), '[]'::jsonb) as milestones,
      coalesce((select jsonb_agg(sc order by sc.scanned_at)
                from (
                  select id, scanned_at, location, meta from public.scans sc2 where sc2.shipment_id = s.id
                ) sc), '[]'::jsonb) as scans
    from public.shipments s
    where exists(select 1 from public.shipment_share_tokens t
                 where t.shipment_id = s.id
                   and t.token_hash = v_hash
                   and t.expires_at > now());
end; $$;

grant execute on function public.fetch_public_shipment(text) to anon;