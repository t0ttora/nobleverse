'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';

export default function MilestonesPanel({
  shipmentId
}: {
  shipmentId: string;
}) {
  const [milestones, setMilestones] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let sub: any;
    async function load() {
      const { data } = await supabase
        .from('milestones')
        .select('*')
        .eq('shipment_id', shipmentId)
        .order('created_at');
      setMilestones(data || []);
      sub = supabase
        .channel(`realtime:milestones:${shipmentId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'milestones',
            filter: `shipment_id=eq.${shipmentId}`
          },
          (payload) => {
            if (payload.eventType === 'INSERT')
              setMilestones((m) => [...m, payload.new]);
          }
        )
        .subscribe();
    }
    load();
    return () => {
      if (sub) supabase.removeChannel(sub);
    };
  }, [shipmentId]);

  async function add(code: string) {
    setAdding(true);
    try {
      await supabase
        .from('milestones')
        .insert({ shipment_id: shipmentId, code });
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className='flex flex-1 flex-col overflow-hidden'>
      <div className='bg-background/50 flex items-center justify-between border-b px-3 py-2'>
        <div className='text-xs font-medium'>Milestones</div>
        <div className='flex gap-1'>
          {['PICKED_UP', 'IN_TRANSIT', 'DELIVERED'].map((c) => (
            <Button
              key={c}
              size='sm'
              variant='outline'
              disabled={adding}
              onClick={() => add(c)}
            >
              {c.split('_').join(' ')}
            </Button>
          ))}
        </div>
      </div>
      <div className='flex-1 space-y-2 overflow-auto p-2 text-[11px]'>
        {milestones.map((m) => (
          <div key={m.id} className='bg-card/40 rounded border p-2'>
            <div className='font-semibold'>{m.code}</div>
            <div className='text-[10px] opacity-60'>
              {new Date(m.created_at).toLocaleString()}
            </div>
          </div>
        ))}
        {milestones.length === 0 && (
          <div className='text-muted-foreground py-4 text-center'>
            No milestones yet.
          </div>
        )}
      </div>
    </div>
  );
}
