import { cookies } from 'next/headers';
import { createClient as createSupabaseServerClient } from '@/../utils/supabase/server';

export type ProfileVisibility = 'public' | 'private';

type ProfileDetails =
  | { visibility?: ProfileVisibility }
  | Record<string, unknown>
  | null
  | undefined;

export async function getProfileVisibility(userId: string) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const { data } = await supabase
    .from('profiles')
    .select('details')
    .eq('id', userId)
    .maybeSingle();

  const details: ProfileDetails = data?.details as ProfileDetails;
  const vis =
    details && typeof details === 'object' && 'visibility' in details
      ? (details as { visibility?: ProfileVisibility }).visibility
      : undefined;
  return vis ?? 'public';
}

export async function updateProfileVisibility(
  userId: string,
  visibility: ProfileVisibility
) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  // Merge visibility into details JSON
  const { data: current } = await supabase
    .from('profiles')
    .select('details')
    .eq('id', userId)
    .maybeSingle();
  const currentDetails =
    current?.details && typeof current.details === 'object'
      ? (current.details as Record<string, unknown>)
      : {};
  const details = { ...currentDetails, visibility };
  const { error } = await supabase
    .from('profiles')
    .update({ details, updated_at: new Date().toISOString() })
    .eq('id', userId);
  return { error };
}
