import { cookies } from 'next/headers';
import { createClient as createSupabaseServerClient } from '@/../utils/supabase/server';

export type Role = 'shipper' | 'forwarder' | 'carrier' | 'broker' | 'other';

export interface DbProfile {
  id: string;
  username: string;
  display_name: string | null;
  role: Role;
  onboarding_completed: boolean;
  created_at: string | null;
  updated_at: string | null;
  company_name: string | null;
  website: string | null;
  location: string | null;
  phone: string | null;
  email: string | null;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  noble_score: number | null;
  completed_requests: number | null;
  completed_shipments: number | null;
  average_rating: number | null;
  details: Record<string, any> | null;
  last_active_at: string | null;
}

function slugifyUsername(raw: string) {
  return (
    raw
      .toLowerCase()
      // allow a-z, 0-9, underscore, dot and hyphen; replace others with '-'
      .replace(/[^a-z0-9_.-]/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$|\.$/g, '')
  );
}

export async function ensureProfileServer() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return null;

  const baseUsername = slugifyUsername(user.email?.split('@')[0] || user.id);
  const authDisplayName =
    (user.user_metadata as any)?.display_name ||
    (user.user_metadata as any)?.name ||
    (user.user_metadata as any)?.full_name ||
    baseUsername;

  // Check if profile exists
  const { data: existing, error: getErr } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .eq('id', user.id)
    .maybeSingle();
  if (getErr) {
    // best-effort: continue to attempt upsert
  }
  if (existing) {
    // Backfill display_name if missing
    if (!existing.display_name && authDisplayName) {
      await supabase
        .from('profiles')
        .update({
          display_name: authDisplayName,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
    }
    // Preserve any user-chosen username; do not override with email local-part
    return existing as Pick<DbProfile, 'id' | 'username'>;
  }

  // Ensure unique username by probing for conflicts
  let username = baseUsername;
  for (let i = 0; i < 5; i++) {
    const { data: conflict } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username)
      .maybeSingle();
    if (!conflict) break;
    username = `${baseUsername}-${Math.floor(Math.random() * 1000)}`;
  }

  const payload = {
    id: user.id,
    username,
    display_name: authDisplayName,
    role: 'other' as Role,
    onboarding_completed: false,
    first_time: true,
    email: user.email,
    avatar_url: (user.user_metadata as any)?.avatar_url || null,
    banner_url: null,
    bio: null,
    company_name: null,
    website: null,
    location: null,
    phone: null,
    noble_score: null,
    completed_requests: 0,
    completed_shipments: 0,
    average_rating: null,
    details: {},
    last_active_at: new Date().toISOString()
  };

  const { data: inserted } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select('id, username')
    .single();
  return inserted as Pick<DbProfile, 'id' | 'username'> | null;
}

export async function getProfileByNobleId(nobleId: string) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('display_name', nobleId)
    .maybeSingle();
  return (data as DbProfile | null) ?? null;
}

export async function getOwnProfile() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return null;
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  return (data as DbProfile | null) ?? null;
}

export type ProfileUpdate = Partial<
  Pick<
    DbProfile,
    | 'username'
    | 'display_name'
    | 'role'
    | 'company_name'
    | 'website'
    | 'location'
    | 'phone'
    | 'email'
    | 'bio'
    | 'avatar_url'
    | 'banner_url'
    | 'details'
  >
>;

export async function updateOwnProfile(update: ProfileUpdate) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return { error: 'UNAUTHENTICATED' as const };
  const { error } = await supabase
    .from('profiles')
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq('id', user.id);
  return { error };
}
