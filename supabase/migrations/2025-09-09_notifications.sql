-- Notifications table
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null,
  title text,
  body text,
  data jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select using ( auth.uid() = user_id );

drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications for insert with check ( auth.uid() = user_id or auth.uid() = actor_id );

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update using ( auth.uid() = user_id );

create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);
