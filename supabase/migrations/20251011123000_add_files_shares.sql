-- Files sharing model
-- Basic ACL: user_id granted access to file_id (folders) with role
CREATE TABLE IF NOT EXISTS public.files_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'viewer', -- 'viewer' | 'editor'
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS files_shares_file_idx ON public.files_shares(file_id);
CREATE INDEX IF NOT EXISTS files_shares_user_idx ON public.files_shares(user_id);

-- Optional uniqueness to avoid duplicates
CREATE UNIQUE INDEX IF NOT EXISTS files_shares_unique ON public.files_shares(file_id, user_id);
