-- Create docs_data table for Docs (TipTap) HTML persistence
-- id: document id (uuid), owner_id: profiles.id, doc_html: HTML content, updated_at: timestamp

create table if not exists public.docs_data (
  id uuid primary key,
  owner_id uuid references public.profiles(id) on delete set null,
  doc_html text not null default '',
  updated_at timestamptz not null default now()
);

-- Row Level Security
alter table public.docs_data enable row level security;


-- Policies: owners can select/insert/update; nobody deletes via API by default
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'docs_data' AND policyname = 'docs_data_select_own'
  ) THEN
    DROP POLICY docs_data_select_own ON public.docs_data;
  END IF;
  CREATE POLICY docs_data_select_own
    ON public.docs_data FOR SELECT
    USING (auth.uid() IS NOT NULL AND owner_id = auth.uid());
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'docs_data' AND policyname = 'docs_data_insert_own'
  ) THEN
    DROP POLICY docs_data_insert_own ON public.docs_data;
  END IF;
  CREATE POLICY docs_data_insert_own
    ON public.docs_data FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL AND owner_id = auth.uid());
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'docs_data' AND policyname = 'docs_data_update_own'
  ) THEN
    DROP POLICY docs_data_update_own ON public.docs_data;
  END IF;
  CREATE POLICY docs_data_update_own
    ON public.docs_data FOR UPDATE
    USING (auth.uid() IS NOT NULL AND owner_id = auth.uid())
    WITH CHECK (auth.uid() IS NOT NULL AND owner_id = auth.uid());
END$$;

-- Helpful index
create index if not exists idx_docs_data_owner on public.docs_data(owner_id);

-- Optional: safe updated_at trigger (only if function exists)
-- This assumes public.set_updated_at_safe() from prior migration
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'set_updated_at_safe' AND n.nspname = 'public'
  ) THEN
    DROP TRIGGER IF EXISTS trg_docs_data_updated_at ON public.docs_data;
    CREATE TRIGGER trg_docs_data_updated_at
      BEFORE UPDATE ON public.docs_data
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_safe();
  END IF;
END$$;
