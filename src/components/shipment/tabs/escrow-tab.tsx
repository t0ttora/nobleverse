'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function EscrowTab({ shipment }: { shipment: any }) {
  const [state, setState] = useState<any>(shipment);
  const [ledger, setLedger] = useState<any[]>([]);
  useEffect(() => {
    let ch1: any;
    let ch2: any;
    async function load() {
      const { data: led } = await supabase
        .from('escrow_ledger')
        .select('*')
        .eq('shipment_id', shipment.id)
        .order('created_at');
      setLedger(led || []);
      // subscribe ledger
      ch1 = supabase
        .channel(`escrow_ledger:${shipment.id}`)
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
      // subscribe shipment row
      ch2 = supabase
        .channel(`shipments:${shipment.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'shipments',
            filter: `id=eq.${shipment.id}`
          },
          (p) => {
            setState((s: any) => ({ ...s, ...p.new }));
          }
        )
        .subscribe();
    }
    load();
    return () => {
      if (ch1) supabase.removeChannel(ch1);
      if (ch2) supabase.removeChannel(ch2);
    };
  }, [shipment.id]);

  const released = ledger
    .filter((l) => l.entry_type === 'RELEASE')
    .reduce((a, b) => a + Number(b.amount_cents || 0), 0);
  const refunded = ledger
    .filter((l) => l.entry_type === 'REFUND')
    .reduce((a, b) => a + Number(b.amount_cents || 0), 0);
  const fees = ledger
    .filter((l) => l.entry_type === 'FEE')
    .reduce((a, b) => a + Number(b.amount_cents || 0), 0);

  return (
    <div className='space-y-4'>
      <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
        <Stat label='Total' val={state.total_amount_cents} />
        <Stat label='Net' val={state.net_amount_cents} />
        <Stat label='Released' val={released} />
        <Stat label='Refunded' val={refunded} />
        <Stat label='Fees' val={fees} />
        <div className='text-muted-foreground col-span-full text-xs'>
          Status: {state.escrow_status} / Shipment: {state.status}
        </div>
      </div>
      <div className='text-sm font-semibold'>Ledger</div>
      <div className='max-h-64 overflow-auto rounded border'>
        <table className='w-full text-xs'>
          <thead className='bg-muted/40'>
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
                <td className='max-w-[200px] truncate p-2'>
                  {e.meta ? JSON.stringify(e.meta) : ''}
                </td>
                <td className='p-2 opacity-60'>
                  {new Date(e.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
            {ledger.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className='text-muted-foreground p-4 text-center'
                >
                  No entries
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, val }: { label: string; val: number }) {
  return (
    <div className='bg-card/50 rounded border p-3'>
      <div className='text-muted-foreground text-[11px] tracking-wide uppercase'>
        {label}
      </div>
      <div className='font-bold'>${(Number(val || 0) / 100).toFixed(2)}</div>
    </div>
  );
}
