-- Rename display_name to nobleid only if source column exists and target not exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
            WHERE table_name='profiles' AND column_name='display_name'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
            WHERE table_name='profiles' AND column_name='nobleid'
    ) THEN
        ALTER TABLE public.profiles RENAME COLUMN display_name TO nobleid;
    END IF;
END $$;
-- Update indexes if any reference display_name
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT indexname FROM pg_indexes WHERE tablename = 'profiles' AND indexdef ILIKE '%display_name%'
    LOOP
        EXECUTE 'DROP INDEX IF EXISTS ' || r.indexname;
    END LOOP;
END $$;
-- Recreate indexes for nobleid
-- Recreate indexes for nobleid (safe even if column already had those indexes)
CREATE INDEX IF NOT EXISTS profiles_nobleid_idx ON public.profiles USING btree (nobleid);
-- Extension pg_trgm must exist for this to succeed; ignore if missing.
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_trgm') THEN
        CREATE INDEX IF NOT EXISTS profiles_nobleid_trgm_idx ON public.profiles USING gin (nobleid gin_trgm_ops);
    END IF;
END $$;
