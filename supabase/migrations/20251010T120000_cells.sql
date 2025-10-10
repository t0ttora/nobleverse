-- Noble Cells schema (workbooks, sheets, cells) with RLS
-- Ensure required extensions exist (gen_random_uuid)
create extension if not exists pgcrypto;
create table if not exists workbooks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists sheets (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references workbooks(id) on delete cascade,
  name text not null,
  idx int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists cells (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references sheets(id) on delete cascade,
  row int not null,
  col int not null,
  type text check (type in ('number','string','bool','date','formula')),
  value text,
  formula text,
  updated_at timestamptz not null default now(),
  unique (sheet_id, row, col)
);
-- Realtime publication (so postgres_changes works for this table)
do $$
begin
  perform 1 from pg_publication where pubname = 'supabase_realtime';
  if not found then
    create publication supabase_realtime;
  end if;
  begin
    execute 'alter publication supabase_realtime add table public.cells';
  exception when others then
    -- ignore if already added
    null;
  end;
end $$;
-- RLS
alter table workbooks enable row level security;
alter table sheets enable row level security;
alter table cells enable row level security;
-- Policies (idempotent: drop if exists, then create)
drop policy if exists "workbooks_owner_select" on workbooks;
drop policy if exists "workbooks_owner_ins" on workbooks;
drop policy if exists "workbooks_owner_upd" on workbooks;
drop policy if exists "workbooks_owner_del" on workbooks;
drop policy if exists "sheets_select" on sheets;
drop policy if exists "sheets_ins" on sheets;
drop policy if exists "sheets_upd" on sheets;
drop policy if exists "sheets_del" on sheets;
drop policy if exists "cells_select" on cells;
drop policy if exists "cells_ins" on cells;
drop policy if exists "cells_upd" on cells;
drop policy if exists "cells_del" on cells;

create policy "workbooks_owner_select" on workbooks for select using (owner_id = auth.uid());
create policy "workbooks_owner_ins" on workbooks for insert with check (owner_id = auth.uid());
create policy "workbooks_owner_upd" on workbooks for update using (owner_id = auth.uid());
create policy "workbooks_owner_del" on workbooks for delete using (owner_id = auth.uid());

create policy "sheets_select" on sheets for select using (
  exists(select 1 from workbooks w where w.id = sheets.workbook_id and w.owner_id = auth.uid())
);
create policy "sheets_ins" on sheets for insert with check (
  exists(select 1 from workbooks w where w.id = sheets.workbook_id and w.owner_id = auth.uid())
);
create policy "sheets_upd" on sheets for update using (
  exists(select 1 from workbooks w where w.id = sheets.workbook_id and w.owner_id = auth.uid())
);
create policy "sheets_del" on sheets for delete using (
  exists(select 1 from workbooks w where w.id = sheets.workbook_id and w.owner_id = auth.uid())
);

create policy "cells_select" on cells for select using (
  exists(select 1 from sheets s join workbooks w on w.id = s.workbook_id where s.id = cells.sheet_id and w.owner_id = auth.uid())
);
create policy "cells_ins" on cells for insert with check (
  exists(select 1 from sheets s join workbooks w on w.id = s.workbook_id where s.id = cells.sheet_id and w.owner_id = auth.uid())
);
create policy "cells_upd" on cells for update using (
  exists(select 1 from sheets s join workbooks w on w.id = s.workbook_id where s.id = cells.sheet_id and w.owner_id = auth.uid())
);
create policy "cells_del" on cells for delete using (
  exists(select 1 from sheets s join workbooks w on w.id = s.workbook_id where s.id = cells.sheet_id and w.owner_id = auth.uid())
);
-- Triggers to keep updated_at fresh
create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end; $$ language plpgsql;
-- Make triggers idempotent
drop trigger if exists workbooks_touch on workbooks;
drop trigger if exists sheets_touch on sheets;
drop trigger if exists cells_touch on cells;
create trigger workbooks_touch before update on workbooks for each row execute function touch_updated_at();
create trigger sheets_touch before update on sheets for each row execute function touch_updated_at();
create trigger cells_touch before update on cells for each row execute function touch_updated_at();
