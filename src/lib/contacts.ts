import { cookies } from 'next/headers';
import { createClient as createSupabaseServerClient } from '@/../utils/supabase/server';
import type { Profile, Role } from '@/types/profile';

export type Presence = 'online' | 'offline' | 'dnd';

export type ContactListItem = Profile & {
  display_name?: string | null;
  presence?: Presence;
  visibility?: 'public' | 'private';
};

function parsePresence(
  details: Record<string, unknown> | null | undefined
): Presence | undefined {
  const status = (details as any)?.status as string | undefined;
  if (status === 'online' || status === 'offline' || status === 'dnd')
    return status;
  return undefined;
}

function parseVisibility(details: Record<string, unknown> | null | undefined) {
  const visibility = (details as any)?.visibility as string | undefined;
  return visibility === 'private' ? 'private' : 'public';
}

export async function getOwnUserId() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function getContactsForUser(
  userId: string,
  opts?: { search?: string; roles?: Role[] }
) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  // contacts table lists connections as pairs { user_id, contact_id }
  const { data: pairs } = await supabase
    .from('contacts')
    .select('contact_id')
    .eq('user_id', userId);

  const contactIds = (pairs ?? []).map((p: any) => p.contact_id);
  if (!contactIds.length) return [] as ContactListItem[];

  let query = supabase.from('profiles').select('*').in('id', contactIds);

  if (opts?.roles?.length) {
    query = query.in('role', opts.roles);
  }
  if (opts?.search && opts.search.trim().length > 1) {
    const s = `%${opts.search.trim()}%`;
    query = query.or(
      `username.ilike.${s},display_name.ilike.${s},company_name.ilike.${s},email.ilike.${s}`
    );
  }

  const { data: profiles } = await query;
  return (profiles ?? []).map((p: any) => ({
    ...(p as Profile),
    presence: parsePresence(p.details),
    visibility: parseVisibility(p.details),
    display_name: p.display_name ?? null
  }));
}

export async function getCommunityProfiles(
  currentUserId: string | null,
  opts?: { search?: string; roles?: Role[] }
) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  let query = supabase.from('profiles').select('*');

  // Only public profiles
  // Filter visibility from JSON details
  query = query.contains('details', { visibility: 'public' } as any);

  if (currentUserId) {
    query = query.neq('id', currentUserId);
  }
  if (opts?.roles?.length) {
    query = query.in('role', opts.roles);
  }
  if (opts?.search && opts.search.trim().length > 1) {
    const s = `%${opts.search.trim()}%`;
    query = query.or(
      `username.ilike.${s},display_name.ilike.${s},company_name.ilike.${s},email.ilike.${s}`
    );
  }
  const { data: profiles } = await query.limit(200);
  return (profiles ?? []).map((p: any) => ({
    ...(p as Profile),
    presence: parsePresence(p.details),
    visibility: parseVisibility(p.details),
    display_name: p.display_name ?? null
  }));
}

export async function getMyTeamProfiles(
  currentUserId: string | null,
  opts?: { search?: string; roles?: Role[] }
) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  if (!currentUserId) return [] as ContactListItem[];
  const { data: me } = await supabase
    .from('profiles')
    .select('company_name')
    .eq('id', currentUserId)
    .maybeSingle();
  const company = (me?.company_name ?? '').trim();
  if (!company) return [] as ContactListItem[];

  let query = supabase
    .from('profiles')
    .select('*')
    .eq('company_name', company)
    .neq('id', currentUserId);

  if (opts?.roles?.length) {
    query = query.in('role', opts.roles);
  }
  if (opts?.search && opts.search.trim().length > 1) {
    const s = `%${opts.search.trim()}%`;
    query = query.or(
      `username.ilike.${s},display_name.ilike.${s},email.ilike.${s}`
    );
  }
  const { data: profiles } = await query.limit(200);
  return (profiles ?? []).map((p: any) => ({
    ...(p as Profile),
    presence: parsePresence(p.details),
    visibility: parseVisibility(p.details),
    display_name: p.display_name ?? null
  }));
}

export async function updatePresence(status: Presence) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return { error: 'UNAUTHENTICATED' as const };

  const { data: current } = await supabase
    .from('profiles')
    .select('details')
    .eq('id', user.id)
    .maybeSingle();
  const currentDetails =
    current?.details && typeof current.details === 'object'
      ? (current.details as Record<string, unknown>)
      : {};
  const details = { ...currentDetails, status };
  const { error } = await supabase
    .from('profiles')
    .update({
      details,
      last_active_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', user.id);
  return { error };
}

export async function sendContactRequest(toUserId: string) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return { error: 'UNAUTHENTICATED' as const };

  // If requests table exists, insert pending; otherwise directly insert to contacts as accepted.
  const { error: reqErr } = await supabase
    .from('contact_requests')
    .insert({ requester_id: user.id, receiver_id: toUserId, status: 'pending' })
    .select('*')
    .maybeSingle();

  if (!reqErr) {
    // Insert both directions so both users appear in Contacts immediately
    await supabase
      .from('contacts')
      .upsert(
        { user_id: user.id, contact_id: toUserId },
        { onConflict: 'user_id,contact_id' }
      );
    await supabase
      .from('contacts')
      .upsert(
        { user_id: toUserId, contact_id: user.id },
        { onConflict: 'user_id,contact_id' }
      );
    return { error: null, pending: true };
  }

  // Fallback to direct connect (insert both directions)
  const a = await supabase
    .from('contacts')
    .upsert(
      { user_id: user.id, contact_id: toUserId },
      { onConflict: 'user_id,contact_id' }
    );
  const b = await supabase
    .from('contacts')
    .upsert(
      { user_id: toUserId, contact_id: user.id },
      { onConflict: 'user_id,contact_id' }
    );
  return { error: a.error || b.error || null, pending: false };
}

export async function acceptContactRequest(requestId: string) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const { data: req, error: getErr } = await supabase
    .from('contact_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle();
  if (getErr || !req) return { error: 'NOT_FOUND' as const };

  const { error: upErr } = await supabase
    .from('contact_requests')
    .update({ status: 'accepted' })
    .eq('id', requestId);
  if (upErr) return { error: upErr.message };

  // Create mutual connections
  await supabase
    .from('contacts')
    .upsert(
      { user_id: req.requester_id, contact_id: req.receiver_id },
      { onConflict: 'user_id,contact_id' }
    );
  await supabase
    .from('contacts')
    .upsert(
      { user_id: req.receiver_id, contact_id: req.requester_id },
      { onConflict: 'user_id,contact_id' }
    );
  return { error: null };
}

export async function removeContact(contactUserId: string) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return { error: 'UNAUTHENTICATED' as const };
  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('user_id', user.id)
    .eq('contact_id', contactUserId);
  return { error };
}
