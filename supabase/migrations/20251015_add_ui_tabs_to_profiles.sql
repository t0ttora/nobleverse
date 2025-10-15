-- Add ui_tabs column to profiles if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'ui_tabs'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN ui_tabs jsonb;
    END IF;
END
$$;

-- Optional: add a NOT VALID check constraint for shape (tabs array optional, active string optional)
-- This keeps it flexible while documenting intent
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_ui_tabs_check'
    ) THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_ui_tabs_check CHECK (
            jsonb_typeof(ui_tabs) IS NULL OR jsonb_typeof(ui_tabs) = 'object'
        ) NOT VALID;
    END IF;
END
$$;
