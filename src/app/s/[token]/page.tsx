import { notFound } from 'next/navigation';
import { createClient } from '@/lib/server';

export default async function PublicShipmentPage(props: any) {
  const { params } = props || {};
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('fetch_public_shipment', {
    p_token: params.token
  });
  if (error || !data || !data.length) return notFound();
  const shipment = data[0];
  return (
    <div className='mx-auto max-w-5xl space-y-6 p-6'>
      <div className='flex items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-semibold tracking-tight'>
            Shipment {shipment.code}
          </h1>
          <p className='text-muted-foreground text-sm'>
            Status: {shipment.status} · Escrow: {shipment.escrow_status}
          </p>
        </div>
      </div>
      <section className='space-y-3'>
        <h2 className='text-muted-foreground text-sm font-medium tracking-wide uppercase'>
          Milestones
        </h2>
        <div className='space-y-2 text-sm'>
          {shipment.milestones.map((m: any) => (
            <div
              key={m.id}
              className='bg-card/30 flex items-center justify-between rounded-md border p-3'
            >
              <span className='font-medium'>{m.code}</span>
              <span className='text-muted-foreground text-xs'>
                {new Date(m.created_at).toLocaleString()}
              </span>
            </div>
          ))}
          {shipment.milestones.length === 0 && (
            <div className='text-muted-foreground text-xs'>No milestones.</div>
          )}
        </div>
      </section>
      <section className='space-y-3'>
        <h2 className='text-muted-foreground text-sm font-medium tracking-wide uppercase'>
          Scans
        </h2>
        <div className='space-y-2 text-sm'>
          {shipment.scans.map((sc: any) => (
            <div
              key={sc.id}
              className='bg-card/30 flex items-center justify-between rounded-md border p-3'
            >
              <span className='font-medium'>{sc.location || 'Scan'}</span>
              <span className='text-muted-foreground text-xs'>
                {new Date(sc.scanned_at).toLocaleString()}
              </span>
            </div>
          ))}
          {shipment.scans.length === 0 && (
            <div className='text-muted-foreground text-xs'>No scans.</div>
          )}
        </div>
      </section>
    </div>
  );
}
