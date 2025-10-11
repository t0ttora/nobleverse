-- Add visibility to files table
-- Visibility: 'public' or 'private' (default 'private')
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'files' AND column_name = 'visibility'
  ) THEN
    ALTER TABLE public.files
      ADD COLUMN visibility text NOT NULL DEFAULT 'private',
      ADD CONSTRAINT files_visibility_check CHECK (visibility IN ('public','private'));
    -- Backfill any existing NULLs just in case (shouldn't happen due to NOT NULL)
    UPDATE public.files SET visibility = 'private' WHERE visibility IS NULL;
  END IF;
END $$;

-- Helpful index if you query by visibility often
CREATE INDEX IF NOT EXISTS files_visibility_idx ON public.files (visibility);
