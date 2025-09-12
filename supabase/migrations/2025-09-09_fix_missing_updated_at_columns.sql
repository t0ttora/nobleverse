-- Redefine public.set_updated_at to be safe (conditional) so legacy triggers stop failing
create or replace function public.set_updated_at()
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

-- Add updated_at to common domain tables if they exist and lack it (idempotent)
do $$
declare
  t text;
  tables text[] := array['requests','negotiations','chat_rooms','chat_messages'];
begin
  foreach t in array tables loop
    perform 1 from information_schema.tables where table_schema='public' and table_name=t;
    if found then
      perform 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='updated_at';
      if not found then
        execute format('alter table public.%I add column if not exists updated_at timestamptz not null default now();', t);
      end if;
    end if;
  end loop;
end$$;

-- (Optional) Attach safe triggers if table exists and trigger missing
do $$
declare
  t text;
begin
  for t in select unnest(array['requests','negotiations']) loop
    perform 1 from information_schema.tables where table_schema='public' and table_name=t;
    if found then
      -- create trigger only if absent
      perform 1 from pg_trigger where tgname = 'trg_'||t||'_updated_at';
      if not found then
        execute format('create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at();', t, t);
      end if;
    end if;
  end loop;
end$$;
