-- Safe updated_at trigger to avoid runtime error: record "new" has no field "updated_at"
-- Creates a generic function that only sets NEW.updated_at if the column exists.

create or replace function public.set_updated_at_safe()
returns trigger language plpgsql as $$
declare
  has_col boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = TG_TABLE_SCHEMA
      and table_name = TG_TABLE_NAME
      and column_name = 'updated_at'
  ) into has_col;
  if has_col then
    NEW.updated_at = now();
  end if;
  return NEW;
end;
$$;

-- Rewire existing triggers (offers, tasks) to safe function if they exist
do $$
begin
  if exists (select 1 from pg_trigger where tgname = 'set_offers_updated_at') then
    drop trigger if exists set_offers_updated_at on public.offers;
    create trigger set_offers_updated_at
      before update on public.offers
      for each row execute function public.set_updated_at_safe();
  end if;
  if exists (select 1 from pg_trigger where tgname = 'trg_tasks_updated_at') then
    drop trigger if exists trg_tasks_updated_at on public.tasks;
    create trigger trg_tasks_updated_at
      before update on public.tasks
      for each row execute function public.set_updated_at_safe();
  end if;
end$$;

-- Add a generic trigger for shipments table (if not already present)
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_shipments_updated_at') then
    create trigger trg_shipments_updated_at
      before update on public.shipments
      for each row execute function public.set_updated_at_safe();
  end if;
end$$;

-- NOTE: If another table (e.g., requests, negotiations) had a trigger using the old set_updated_at
-- but lacks an updated_at column, either add the column or re-point its trigger to set_updated_at_safe.
-- To add the column (idempotent):
--   alter table public.requests add column if not exists updated_at timestamptz default now();
--   create trigger trg_requests_updated_at before update on public.requests for each row execute function public.set_updated_at_safe();
