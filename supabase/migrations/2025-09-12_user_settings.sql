-- NobleVerse user settings table
-- Stores per-user preferences in one row and enables realtime sync

create table if not exists public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile jsonb not null default '{}',
  notifications jsonb not null default '{}',
  email_prefs jsonb not null default '{}',
  plan text not null default 'Pro',
  api_keys jsonb not null default '[]',
  payment_methods jsonb not null default '[]',
  integrations jsonb not null default '{}',
  security jsonb not null default '{}',
  webhooks jsonb not null default '{}',
  dev_mode boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

-- Policies: a user can manage only their own row
create policy "settings_select_own"
  on public.settings
  for select using (auth.uid() = user_id);

create policy "settings_insert_own"
  on public.settings
  for insert with check (auth.uid() = user_id);

create policy "settings_update_own"
  on public.settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Updated_at trigger (safe)
create trigger trg_settings_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at_safe();

-- Realtime publication
alter publication supabase_realtime add table public.settings;
