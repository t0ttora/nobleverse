'use client';
import { useEffect, useState } from 'react';
import EmptyState from '@/components/ui/empty-state';
import { supabase } from '@/lib/supabaseClient';

export default function ScansTab({ shipmentId }: { shipmentId: string }) {
  const [scans, setScans] = useState<any[]>([]);
  useEffect(() => {
    let sub: any;
    async function load() {
      const { data } = await supabase
        .from('scans')
        .select('*')
        .eq('shipment_id', shipmentId)
        .order('scanned_at');
      setScans(data || []);
      sub = supabase
        .channel(`realtime:scans:${shipmentId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'scans',
            filter: `shipment_id=eq.${shipmentId}`
          },
          (payload) => {
            if (payload.eventType === 'INSERT')
              setScans((s) => [...s, payload.new]);
          }
        )
        .subscribe();
    }
    load();
    return () => {
      if (sub) supabase.removeChannel(sub);
    };
  }, [shipmentId]);
  return (
    <div className='space-y-3 text-xs'>
      {scans.map((s) => (
        <div
          key={s.id}
          className='flex items-center justify-between rounded-md border p-2'
        >
          <div>{new Date(s.scanned_at).toLocaleString()}</div>
          <div className='text-[10px] opacity-60'>{s.location || '—'}</div>
        </div>
      ))}
      {scans.length === 0 && (
        <EmptyState
          title='No scans yet'
          subtitle='Scan events will appear here as they come in.'
        />
      )}
    </div>
  );
}
