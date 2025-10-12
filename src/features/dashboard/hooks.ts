'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { KpiComputed, OfferRow, RequestRow, Shipment } from './compute';
import {
  computeForwarderKpis,
  computeReceiverKpis,
  computeShipperKpis
} from './compute';

type Status<T> = { data: T; loading: boolean; error?: string | null };

type NotificationRow = {
  id: string;
  user_id: string;
  type?: string | null;
  message?: string | null;
  created_at?: string;
  read_at?: string | null;
};

function useRealtimeInvalidate(tables: string[], onInvalidate: () => void) {
  useEffect(() => {
    const channel = (supabase as any).channel(`dashboard-${tables.join('-')}`, {
      config: { broadcast: { self: false } }
    });
    for (const t of tables) {
      channel.on(
        'postgres_changes',
        {
          schema: 'public',
          table: t,
          event: '*'
        },
        () => onInvalidate()
      );
    }
    channel.subscribe();
    return () => {
      try {
        channel.unsubscribe();
      } catch {}
    };
  }, [JSON.stringify(tables)]);
}

export function useShipperDashboard(userId: string) {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      // Shipments where I am owner
      const s1 = await (supabase as any)
        .from('shipments')
        .select(
          'id, code, owner_id, forwarder_id, status, incoterm, cargo, participants, net_amount_cents, created_at, updated_at'
        )
        .eq('owner_id', userId);
      // Requests I created
      const r1 = await (supabase as any)
        .from('requests')
        .select('id, user_id, status, created_at')
        .eq('user_id', userId);
      if (s1.error) throw s1.error;
      if (r1.error) throw r1.error;
      setShipments((s1.data || []) as Shipment[]);
      setRequests((r1.data || []) as RequestRow[]);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [userId]);
  useRealtimeInvalidate(['shipments', 'requests'], load);

  const kpis: KpiComputed[] = useMemo(
    () => computeShipperKpis({ shipments, requests }),
    [shipments, requests]
  );
  return { kpis, shipments, requests, loading, error, reload: load } as const;
}

export function useForwarderDashboard(userId: string) {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const s1 = await (supabase as any)
        .from('shipments')
        .select(
          'id, code, owner_id, forwarder_id, status, incoterm, cargo, participants, net_amount_cents, created_at, updated_at'
        )
        .eq('forwarder_id', userId);
      const o1 = await (supabase as any)
        .from('offers')
        .select('id, request_id, forwarder_id, status, created_at')
        .eq('forwarder_id', userId);
      if (s1.error) throw s1.error;
      if (o1.error) throw o1.error;
      setShipments((s1.data || []) as Shipment[]);
      setOffers((o1.data || []) as OfferRow[]);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [userId]);
  useRealtimeInvalidate(['shipments', 'offers'], load);

  const kpis: KpiComputed[] = useMemo(
    () => computeForwarderKpis({ shipments, offers }),
    [shipments, offers]
  );
  return { kpis, shipments, offers, loading, error, reload: load } as const;
}

export function useReceiverDashboard(userId: string) {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      // Receiver perspective: shipments where I'm listed in participants
      const s2 = await (supabase as any)
        .from('shipments')
        .select(
          'id, code, owner_id, forwarder_id, status, incoterm, cargo, participants, net_amount_cents, created_at, updated_at'
        )
        .contains('participants', [userId]);
      if (s2.error) throw s2.error;
      setShipments((s2.data || []) as Shipment[]);
      const notif = await (supabase as any)
        .from('notifications')
        .select('id, user_id, type, message, created_at, read_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (!notif.error) {
        const rows = (notif.data || []) as any[];
        setNotifications(rows as any);
        setUnread(rows.filter((r) => !r.read_at).length);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [userId]);
  useRealtimeInvalidate(['shipments', 'notifications'], load);

  const kpis: KpiComputed[] = useMemo(
    () => computeReceiverKpis({ shipments, notificationsUnread: unread }),
    [shipments, unread]
  );
  return {
    kpis,
    shipments,
    notifications,
    unread,
    loading,
    error,
    reload: load
  } as const;
}
