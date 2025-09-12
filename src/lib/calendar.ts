'use client';
import { supabase } from '@/lib/supabaseClient';

export type CalendarEvent = {
  id?: string;
  title: string;
  starts_at: string; // ISO
  ends_at?: string | null;
  location?: string | null;
  notes?: string | null;
  source?: 'user' | 'shipment' | 'task' | 'other';
  external_id?: string | null;
  room_id?: string | null;
};

export async function getMyId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function listEvents(month: Date): Promise<CalendarEvent[]> {
  // Fetch events for visible month (first to last day inclusive)
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );
  const { data, error } = await supabase
    .from('calendar_events')
    .select(
      'id,title,starts_at,ends_at,location,notes,source,external_id,room_id'
    )
    .gte('starts_at', start.toISOString())
    .lte('starts_at', end.toISOString())
    .order('starts_at', { ascending: true });
  if (error) {
    console.warn('listEvents error', error);
    return [];
  }
  return (data ?? []) as unknown as CalendarEvent[];
}

export async function createEvent(
  evt: CalendarEvent
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const payload: any = {
      title: evt.title,
      starts_at: evt.starts_at,
      ends_at: evt.ends_at ?? null,
      location: evt.location ?? null,
      notes: evt.notes ?? null,
      source: evt.source ?? 'user',
      external_id: evt.external_id ?? null,
      room_id: evt.room_id ?? null
    };
    const { data, error } = await supabase
      .from('calendar_events')
      .insert(payload)
      .select('id')
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: (data?.id as string) || '' };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Unknown error' };
  }
}

export function subscribeEvents(onChange: () => void) {
  const ch = supabase
    .channel('calendar_events:self')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'calendar_events' },
      () => onChange()
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(ch);
  };
}

export async function notifyUsersAboutEvent(
  userIds: string[],
  evt: CalendarEvent
) {
  const me = await getMyId();
  if (!userIds || userIds.length === 0 || !me) return;
  const rows = userIds
    .filter((id) => id && id !== me)
    .map((uid) => ({
      user_id: uid,
      actor_id: me,
      type: 'calendar_event_invite',
      title: evt.title || 'Calendar Event',
      body: buildBody(evt),
      category: 'calendar',
      data: {
        title: evt.title,
        starts_at: evt.starts_at,
        ends_at: evt.ends_at ?? null,
        location: evt.location ?? null,
        notes: evt.notes ?? null
      }
    }));
  if (rows.length) {
    await supabase.from('notifications').insert(rows as any);
  }
}

function buildBody(evt: CalendarEvent) {
  const start = safeFormat(evt.starts_at);
  const end = evt.ends_at ? safeFormat(evt.ends_at) : null;
  const time = end ? `${start} – ${end}` : start;
  return [time, evt.location].filter(Boolean).join(' • ');
}

export function safeFormat(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (!isFinite(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(d);
}
