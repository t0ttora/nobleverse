-- Rename display_name to nobleid in profiles table
ALTER TABLE public.profiles RENAME COLUMN display_name TO nobleid;
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
CREATE INDEX IF NOT EXISTS profiles_nobleid_idx ON public.profiles USING btree (nobleid);
CREATE INDEX IF NOT EXISTS profiles_nobleid_trgm_idx ON public.profiles USING gin (nobleid gin_trgm_ops);
