import { SupabaseClient } from '@supabase/supabase-js';

export type OfferRow = {
  id: string;
  request_id: string;
  forwarder_id: string;
  status: 'sent' | 'withdrawn' | 'accepted' | 'rejected';
  details: any;
  created_at?: string;
  updated_at?: string;
};

export async function getOffersByRequest(
  supabase: SupabaseClient,
  requestId: string
) {
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .eq('request_id', requestId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as OfferRow[];
}

export async function createOffer(
  supabase: SupabaseClient,
  {
    requestId,
    forwarderId,
    details
  }: { requestId: string; forwarderId: string; details: any }
) {
  const { data, error } = await supabase
    .from('offers')
    .insert([{ request_id: requestId, forwarder_id: forwarderId, details }])
    .select()
    .single();
  if (error) throw error;
  return data as OfferRow;
}

export async function getOwnOfferForRequest(
  supabase: SupabaseClient,
  { requestId, forwarderId }: { requestId: string; forwarderId: string }
) {
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .eq('request_id', requestId)
    .eq('forwarder_id', forwarderId)
    .maybeSingle();
  if (error) throw error;
  return data as OfferRow | null;
}

export async function updateOffer(
  supabase: SupabaseClient,
  { offerId, details }: { offerId: string; details: any }
) {
  const { data, error } = await supabase
    .from('offers')
    .update({ details })
    .eq('id', offerId)
    .select()
    .single();
  if (error) throw error;
  return data as OfferRow;
}

export async function deleteOffer(
  supabase: SupabaseClient,
  { offerId }: { offerId: string }
) {
  const { error } = await supabase.from('offers').delete().eq('id', offerId);
  if (error) throw error;
  return { ok: true };
}

export async function updateOfferStatus(
  supabase: SupabaseClient,
  { offerId, status }: { offerId: string; status: OfferRow['status'] }
) {
  const { data, error } = await supabase
    .from('offers')
    .update({ status })
    .eq('id', offerId)
    .select('*')
    .single();
  if (error) throw error;
  return data as OfferRow;
}

export async function getRecentOffersForForwarder(
  supabase: SupabaseClient,
  forwarderId: string,
  limit = 6
) {
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .eq('forwarder_id', forwarderId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as OfferRow[];
}

// Incoming requests list for a forwarder: naive example
export async function getIncomingRequestsForForwarder(
  supabase: SupabaseClient,
  forwarderId: string
) {
  // Placeholder: pull latest requests; in real usage, filter by route/eligibility or invitations
  const { data, error } = await supabase
    .from('requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return data as any[];
}

export async function getOfferCountsByRequest(
  supabase: SupabaseClient,
  requestIds: (string | number)[]
) {
  if (!requestIds.length) return {} as Record<string, number>;
  // Prefer secure RPC that respects ownership to avoid RLS gaps
  try {
    const { data, error } = await (supabase as any).rpc(
      'get_offer_counts_by_request',
      { request_ids: requestIds.map((id) => Number(id)) }
    );
    if (error) throw error;
    const map: Record<string, number> = {};
    for (const row of (data as any[]) || []) {
      map[String(row.request_id)] = Number(row.offer_count) || 0;
    }
    return map;
  } catch {
    // Fallback to client-side aggregation (may be limited by RLS)
    const { data, error } = await supabase
      .from('offers')
      .select('request_id')
      .in('request_id', requestIds as any);
    if (error) return {} as Record<string, number>;
    const map: Record<string, number> = {};
    for (const r of (data as any[]) || []) {
      const key = String(r.request_id);
      map[key] = (map[key] ?? 0) + 1;
    }
    return map;
  }
}

export async function getOffersForForwarder(
  supabase: SupabaseClient,
  forwarderId: string
) {
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .eq('forwarder_id', forwarderId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as OfferRow[];
}

export async function getOffersForOwner(
  supabase: SupabaseClient,
  ownerId: string
) {
  const { data: reqs, error: rerr } = await supabase
    .from('requests')
    .select('id')
    .eq('user_id', ownerId);
  if (rerr) throw rerr;
  const ids = (reqs || []).map((r: any) => r.id);
  if (!ids.length) return [] as OfferRow[];
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .in('request_id', ids as any)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as OfferRow[];
}

// Fetch up to N avatars (forwarders) per request for the given request IDs
export async function getOfferAvatarsByRequest(
  supabase: SupabaseClient,
  requestIds: (string | number)[],
  limitPerRequest = 3
) {
  if (!requestIds.length) return {} as Record<string, string[]>;
  // Join offers -> profiles to obtain avatar_url; limited by RLS (owner sees all; forwarder sees own)
  const { data, error } = await (supabase as any)
    .from('offers')
    .select('request_id, forwarder_id, created_at, profiles!inner(avatar_url)')
    .in('request_id', requestIds as any);
  if (error) return {} as Record<string, string[]>;
  const byReq: Record<
    string,
    { avatar: string | null; forwarder_id: string; created_at?: string }[]
  > = {};
  for (const row of (data as any[]) || []) {
    const rid = String(row.request_id);
    const avatar = row.profiles?.avatar_url ?? null;
    if (!byReq[rid]) byReq[rid] = [];
    // de-duplicate forwarder_id
    if (!byReq[rid].some((x) => x.forwarder_id === row.forwarder_id)) {
      byReq[rid].push({
        avatar,
        forwarder_id: row.forwarder_id,
        created_at: row.created_at
      });
    }
  }
  const result: Record<string, string[]> = {};
  for (const [rid, list] of Object.entries(byReq)) {
    const sorted = list.sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
    );
    result[rid] = sorted.slice(0, limitPerRequest).map((x) => x.avatar || '');
  }
  return result;
}

// Fetch forwarder actors (avatar_url + display name) per request
export async function getOfferActorsByRequest(
  supabase: SupabaseClient,
  requestIds: (string | number)[],
  limitPerRequest = 5
) {
  if (!requestIds.length)
    return {} as Record<string, { avatar_url: string | null; name: string }[]>;
  const { data, error } = await (supabase as any)
    .from('offers')
    .select(
      'request_id, forwarder_id, created_at, profiles!inner(username, company_name, avatar_url)'
    )
    .in('request_id', requestIds as any);
  if (error)
    return {} as Record<string, { avatar_url: string | null; name: string }[]>;
  const byReq: Record<
    string,
    {
      forwarder_id: string;
      created_at?: string;
      avatar_url: string | null;
      name: string;
    }[]
  > = {};
  for (const row of (data as any[]) || []) {
    const rid = String(row.request_id);
    const prof = row.profiles || {};
    const name = prof.company_name || prof.username || '';
    const avatar_url = prof.avatar_url || null;
    if (!byReq[rid]) byReq[rid] = [];
    if (!byReq[rid].some((x) => x.forwarder_id === row.forwarder_id)) {
      byReq[rid].push({
        forwarder_id: row.forwarder_id,
        created_at: row.created_at,
        avatar_url,
        name
      });
    }
  }
  const result: Record<string, { avatar_url: string | null; name: string }[]> =
    {};
  for (const [rid, list] of Object.entries(byReq)) {
    const sorted = list.sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
    );
    result[rid] = sorted
      .slice(0, limitPerRequest)
      .map((x) => ({ avatar_url: x.avatar_url, name: x.name }));
  }
  return result;
}
