// Unified export: prefer using the single browser Supabase client defined in
// `utils/supabase/client`. Having multiple independently created browser
// clients causes each instance to try refreshing the session which can flood
// the console with repeated "Invalid Refresh Token" errors when a token is
// expired or revoked. Importing the shared instance ensures only one auto-
// refresh loop runs in the app bundle.
export { supabase } from '@/../utils/supabase/client';

// NOTE: If you previously imported from 'src/lib/supabaseClient', you can keep
// doing so. This file now simply re-exports the canonical client.
