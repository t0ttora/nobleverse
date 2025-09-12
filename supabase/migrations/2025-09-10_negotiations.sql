-- Negotiations history table (offer-level)
create extension if not exists pgcrypto;

-- Create table with offer_id type matching public.offers(id)
do $$
declare
  v_type text;
  v_coltype text;
begin
  select data_type into v_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'offers' and column_name = 'id';

  -- Map information_schema data_type to usable DDL type
  if v_type is null then
    v_coltype := 'uuid';
  elsif v_type in ('uuid','integer','bigint') then
    v_coltype := v_type;
  else
    -- fallback
    v_coltype := 'uuid';
  end if;

  -- Create table if not exists using dynamic type for offer_id
  execute format($fmt$
    create table if not exists public.negotiations (
      id uuid primary key default gen_random_uuid(),
      offer_id %s not null,
      request_id bigint references public.requests(id) on delete set null,
      forwarder_id uuid references public.profiles(id) on delete set null,
      created_by uuid not null references public.profiles(id) on delete cascade,
      note text,
      prev_terms jsonb not null default '{}'::jsonb,
      counter_terms jsonb not null default '{}'::jsonb,
      status text not null default 'pending' check (status in ('pending','accepted','countered','withdrawn','rejected')),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  $fmt$, v_coltype);

  -- Add FK for offer_id with proper ON DELETE behavior if missing
  if not exists (select 1 from pg_constraint where conname = 'negotiations_offer_id_fkey') then
    execute 'alter table public.negotiations add constraint negotiations_offer_id_fkey foreign key (offer_id) references public.offers(id) on delete cascade';
  end if;
end$$;

alter table public.negotiations enable row level security;

-- Owner of request or forwarder of the offer can see rows; creator can insert
drop policy if exists negotiations_select on public.negotiations;
create policy negotiations_select on public.negotiations
  for select using (
    exists (select 1 from public.offers o join public.requests r on r.id = o.request_id where o.id = negotiations.offer_id and (o.forwarder_id = auth.uid() or r.user_id = auth.uid()))
  );

drop policy if exists negotiations_insert on public.negotiations;
create policy negotiations_insert on public.negotiations
  for insert to authenticated with check (created_by = auth.uid());

drop policy if exists negotiations_update on public.negotiations;
create policy negotiations_update on public.negotiations
  for update to authenticated using (
    created_by = auth.uid()
    or exists (select 1 from public.offers o join public.requests r on r.id = o.request_id where o.id = negotiations.offer_id and (o.forwarder_id = auth.uid() or r.user_id = auth.uid()))
  );

-- Trigger to maintain updated_at
create or replace function public.set_updated_at_negotiations()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_negotiations_updated_at on public.negotiations;
create trigger set_negotiations_updated_at
before update on public.negotiations
for each row execute function public.set_updated_at_negotiations();
