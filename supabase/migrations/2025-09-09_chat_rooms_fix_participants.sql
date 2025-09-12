-- Fix chat_rooms participants column & policies (idempotent)
-- This script ensures the participants uuid[] column exists and RLS policies referencing it compile.

-- 1. Create chat_rooms table if missing (minimal shape; later alters won't overwrite existing extra columns).
create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'dm',
  shipment_id uuid references public.shipments(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Add participants column if absent, then enforce not null + default '{}'::uuid[]
DO $$
BEGIN
  IF NOT EXISTS (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='chat_rooms' and column_name='participants'
  ) THEN
    ALTER TABLE public.chat_rooms ADD COLUMN participants uuid[];
  END IF;
  -- Ensure default & not null
  ALTER TABLE public.chat_rooms ALTER COLUMN participants SET DEFAULT '{}'::uuid[];
  UPDATE public.chat_rooms SET participants = '{}'::uuid[] WHERE participants IS NULL;
  ALTER TABLE public.chat_rooms ALTER COLUMN participants SET NOT NULL;
END $$;

-- 3. chat_messages table (lightweight) if not exists
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  content text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);

-- 4. Enable RLS (safe to re-run)
alter table public.chat_rooms enable row level security;
alter table public.chat_messages enable row level security;

-- 5. Drop old policies (if any) then recreate referencing participants safely
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname='chat_rooms_select' AND tablename='chat_rooms') THEN
    DROP POLICY chat_rooms_select ON public.chat_rooms;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname='chat_rooms_insert' AND tablename='chat_rooms') THEN
    DROP POLICY chat_rooms_insert ON public.chat_rooms;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname='chat_messages_rw' AND tablename='chat_messages') THEN
    DROP POLICY chat_messages_rw ON public.chat_messages;
  END IF;
END $$;

CREATE POLICY chat_rooms_select ON public.chat_rooms FOR SELECT USING (
  auth.uid() = ANY (participants)
);
CREATE POLICY chat_rooms_insert ON public.chat_rooms FOR INSERT WITH CHECK (
  auth.uid() = ANY (participants)
);
CREATE POLICY chat_messages_rw ON public.chat_messages FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.chat_rooms r
     WHERE r.id = chat_messages.room_id
       AND auth.uid() = ANY (r.participants)
  )
);

-- 6. Helpful index for membership checks (GIN over uuid[])
CREATE INDEX IF NOT EXISTS chat_rooms_participants_gin ON public.chat_rooms USING GIN (participants);

-- 7. (Optional) updated_at trigger reuse if global function exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='set_updated_at_safe') THEN
    DROP TRIGGER IF EXISTS trg_chat_rooms_updated_at ON public.chat_rooms;
    CREATE TRIGGER trg_chat_rooms_updated_at BEFORE UPDATE ON public.chat_rooms
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_safe();
  END IF;
END $$;

-- DONE: participants column guaranteed, policies valid.
