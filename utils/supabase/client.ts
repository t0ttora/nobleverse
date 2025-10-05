import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Single global browser client. Multiple instances can cause parallel refresh
// attempts, leading to cascading AuthApiError: refresh_token_not_found logs.
export const supabase = createBrowserClient(supabaseUrl, supabaseKey);

// Defensive handler: if refresh token becomes invalid (revoked / cleared),
// Supabase may repeatedly attempt to refresh. We intercept auth state changes
// and force a clean sign-out then reload, clearing stale localStorage/cookies.
try {
  // onAuthStateChange fires for TOKEN_REFRESHED, SIGNED_OUT, etc.
  supabase.auth.onAuthStateChange((event, _session) => {
    if (event === 'TOKEN_REFRESHED') return; // normal path
    // If session is null while we previously had one, allow UI redirect logic.
  });

  // Additionally, wrap the internal refresh call by making a benign request
  // and catching specific error codes. There's no direct listener for a failed
  // refresh besides surfaced errors on calls; centralize a light probe.
  // We keep it lightweight: schedule after hydration.
  if (typeof window !== 'undefined') {
    queueMicrotask(async () => {
      const { error } = await supabase.auth.getSession();
      if (error && (error as any).code === 'refresh_token_not_found') {
        // Clear auth locally and reload to send user to sign-in gate.
        await supabase.auth.signOut();
        // Use replace to avoid back button returning to broken state.
        window.location.replace('/auth/sign-in');
      }
    });
  }
} catch {
  // Ignore – failures here shouldn't break the app.
}
