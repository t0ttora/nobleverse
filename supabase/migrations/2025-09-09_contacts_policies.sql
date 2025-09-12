-- Contacts & related RLS policies (idempotent-ish)
-- Enable RLS
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Policy: allow a user to read rows where they are either side
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'contacts_select' AND tablename = 'contacts'
  ) THEN
    CREATE POLICY contacts_select ON contacts FOR SELECT USING ( auth.uid() = user_id OR auth.uid() = contact_id );
  END IF;
END $$;

-- Policy: allow a user to insert rows only as themselves (user_id must match auth.uid())
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'contacts_insert' AND tablename = 'contacts'
  ) THEN
    CREATE POLICY contacts_insert ON contacts FOR INSERT WITH CHECK ( auth.uid() = user_id );
  END IF;
END $$;

-- (Optional) allow deletes only by owner of the relationship (either side)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'contacts_delete' AND tablename = 'contacts'
  ) THEN
    CREATE POLICY contacts_delete ON contacts FOR DELETE USING ( auth.uid() = user_id OR auth.uid() = contact_id );
  END IF;
END $$;

-- Contact requests (if table exists)
DO $$ BEGIN
  IF to_regclass('public.contact_requests') IS NOT NULL THEN
    ALTER TABLE contact_requests ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE policyname = 'contact_requests_select' AND tablename = 'contact_requests'
    ) THEN
      CREATE POLICY contact_requests_select ON contact_requests FOR SELECT USING ( auth.uid() = requester_id OR auth.uid() = receiver_id );
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE policyname = 'contact_requests_insert' AND tablename = 'contact_requests'
    ) THEN
      CREATE POLICY contact_requests_insert ON contact_requests FOR INSERT WITH CHECK ( auth.uid() = requester_id );
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE policyname = 'contact_requests_update' AND tablename = 'contact_requests'
    ) THEN
      CREATE POLICY contact_requests_update ON contact_requests FOR UPDATE USING ( auth.uid() = requester_id OR auth.uid() = receiver_id );
    END IF;
  END IF;
END $$;

-- Simple visibility for profiles (read-only) if not already existing; adjust to your needs
-- Uncomment if needed:
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- DO $$ BEGIN
--   IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'profiles_select_public' AND tablename = 'profiles') THEN
--     CREATE POLICY profiles_select_public ON profiles FOR SELECT USING ( true );
--   END IF;
-- END $$;
