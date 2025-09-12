-- Tasks and Calendar Events persistence
create extension if not exists pgcrypto;

-- Updated at trigger helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Tasks table
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open','in_progress','accepted','expense_approved','done','archived')),
  deadline timestamptz,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  room_id uuid references public.chat_rooms(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_assigned_to_idx on public.tasks(assigned_to);
create index if not exists tasks_created_by_idx on public.tasks(created_by);
create index if not exists tasks_deadline_idx on public.tasks(deadline);

-- trigger
drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at before update on public.tasks
for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;

-- Auto-populate created_by from auth.uid() if not provided
create or replace function public.set_task_created_by()
returns trigger language plpgsql as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end $$;

drop trigger if exists trg_tasks_set_created_by on public.tasks;
create trigger trg_tasks_set_created_by before insert on public.tasks
for each row execute function public.set_task_created_by();

-- Policies: user can see tasks they created or are assigned to; insert/update/delete similarly scoped
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select using (
    created_by = auth.uid() or assigned_to = auth.uid()
  );

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks
  for insert with check (
    created_by = auth.uid()
  );

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update using (
    created_by = auth.uid() or assigned_to = auth.uid()
  );

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks
  for delete using (
    created_by = auth.uid() or assigned_to = auth.uid()
  );

-- Calendar events
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  notes text,
  source text not null default 'user' check (source in ('user','shipment','task','other')),
  external_id uuid,
  room_id uuid references public.chat_rooms(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists calendar_events_user_idx on public.calendar_events(user_id, starts_at);
create index if not exists calendar_events_source_idx on public.calendar_events(source);

alter table public.calendar_events enable row level security;

-- Auto-populate user_id from auth.uid() if not provided
create or replace function public.set_calendar_user_id()
returns trigger language plpgsql as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  return new;
end $$;

drop trigger if exists trg_calendar_set_user_id on public.calendar_events;
create trigger trg_calendar_set_user_id before insert on public.calendar_events
for each row execute function public.set_calendar_user_id();

drop policy if exists calendar_events_select on public.calendar_events;
create policy calendar_events_select on public.calendar_events
  for select using (user_id = auth.uid());

drop policy if exists calendar_events_insert on public.calendar_events;
create policy calendar_events_insert on public.calendar_events
  for insert with check (user_id = auth.uid());

drop policy if exists calendar_events_update on public.calendar_events;
create policy calendar_events_update on public.calendar_events
  for update using (user_id = auth.uid());

drop policy if exists calendar_events_delete on public.calendar_events;
create policy calendar_events_delete on public.calendar_events
  for delete using (user_id = auth.uid());
