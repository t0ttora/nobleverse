'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/empty-state';

export default function AdminTab({ shipment }: { shipment: any }) {
  const [ledger, setLedger] = useState<any[]>([]);
  useEffect(() => {
    let sub: any;
    async function load() {
      const { data } = await supabase
        .from('escrow_ledger')
        .select('*')
        .eq('shipment_id', shipment.id)
        .order('created_at');
      setLedger(data || []);
      sub = supabase
        .channel(`realtime:escrow_ledger:${shipment.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'escrow_ledger',
            filter: `shipment_id=eq.${shipment.id}`
          },
          (payload) => {
            if (payload.eventType === 'INSERT')
              setLedger((l) => [...l, payload.new]);
          }
        )
        .subscribe();
    }
    load();
    return () => {
      if (sub) supabase.removeChannel(sub);
    };
  }, [shipment.id]);
  return (
    <div className='space-y-4'>
      <div className='flex items-center gap-2'>
        <Button
          size='sm'
          variant='outline'
          onClick={() =>
            fetch(`/api/shipments/${shipment.id}/release`, { method: 'POST' })
          }
        >
          Force Release
        </Button>
        <Button
          size='sm'
          variant='outline'
          onClick={() =>
            fetch(`/api/shipments/${shipment.id}/refund`, { method: 'POST' })
          }
        >
          Refund
        </Button>
      </div>
      <div className='rounded-lg border'>
        <table className='w-full overflow-hidden text-xs'>
          <thead className='bg-muted/50'>
            <tr className='text-left'>
              <th className='p-2'>Type</th>
              <th className='p-2'>Amount</th>
              <th className='p-2'>Meta</th>
              <th className='p-2'>At</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((e) => (
              <tr key={e.id} className='border-t'>
                <td className='p-2 font-medium'>{e.entry_type}</td>
                <td className='p-2'>${(e.amount_cents / 100).toFixed(2)}</td>
                <td className='max-w-[240px] truncate p-2'>
                  {e.meta ? JSON.stringify(e.meta) : ''}
                </td>
                <td className='p-2 opacity-60'>
                  {new Date(e.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
            {ledger.length === 0 && (
              <tr>
                <td colSpan={4} className='p-4'>
                  <EmptyState
                    title='No ledger entries'
                    subtitle='New entries will appear in realtime.'
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
