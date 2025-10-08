-- 20251008203000_create_files_bucket.sql
-- Ensures the 'files' storage bucket exists (private). Root cause of 404 Bucket not found is usually that no bucket named 'files' was created.
-- Idempotent: only creates bucket if it is missing.
-- NOTE: Must run with service role (normal for migrations). Existing policies in 20251008193110_storage_files_policies.sql assume this bucket name.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'files') THEN
    -- Using direct insert (same effect as select storage.create_bucket('files', false))
    INSERT INTO storage.buckets (id, name, public) VALUES ('files','files', false);
  END IF;
END $$;

-- Optional: sanity check (commented; enable locally if needed)
-- select id, name, public from storage.buckets where name='files';
