-- Properly named migration for Supabase CLI pattern YYYYMMDDHHMMSS_description.sql would be ideal,
-- but keeping date-based prefix consistent with existing scheme.
-- Add storage_path column if missing and backfill for existing binary rows
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='files' AND column_name='storage_path'
  ) THEN
    ALTER TABLE public.files ADD COLUMN storage_path text;
  END IF;
END $$;

UPDATE public.files
SET storage_path = owner_id::text || '/' || id::text || '/' || name
WHERE type='binary' AND (storage_path IS NULL OR storage_path='');

CREATE INDEX IF NOT EXISTS files_storage_path_idx ON public.files(storage_path);
