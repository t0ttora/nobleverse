'use client';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';

export default function EscrowPanel({ shipment }: { shipment: any }) {
  const [pending, start] = useTransition();
  const net = shipment.net_amount_cents / 100;
  const fee = shipment.platform_fee_cents / 100;
  const total = shipment.total_amount_cents / 100;
  return (
    <div className='space-y-2 p-3 text-xs'>
      <div className='text-[11px] font-semibold tracking-wide uppercase'>
        Escrow
      </div>
      <div className='grid grid-cols-3 gap-2 text-[11px]'>
        <div className='bg-card/40 rounded border p-2'>
          <div className='opacity-60'>Total</div>
          <div className='font-medium'>${total.toFixed(2)}</div>
        </div>
        <div className='bg-card/40 rounded border p-2'>
          <div className='opacity-60'>Fee</div>
          <div className='font-medium'>${fee.toFixed(2)}</div>
        </div>
        <div className='bg-card/40 rounded border p-2'>
          <div className='opacity-60'>Net</div>
          <div className='font-medium'>${net.toFixed(2)}</div>
        </div>
      </div>
      <div className='flex items-center gap-2'>
        <Button
          size='sm'
          disabled={pending || shipment.escrow_status !== 'hold'}
          onClick={() =>
            start(async () => {
              await fetch(`/api/shipments/${shipment.id}/release`, {
                method: 'POST'
              });
            })
          }
        >
          Release Payment
        </Button>
        <Button size='sm' variant='outline' disabled={pending}>
          Refund
        </Button>
      </div>
    </div>
  );
}
