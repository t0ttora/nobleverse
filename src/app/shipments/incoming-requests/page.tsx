'use client';
import React from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getIncomingRequestsForForwarder } from '../../../../utils/supabase/offers';
import { Button } from '@/components/ui/button';
import { ForwarderOfferForm } from '@/components/offers/forwarder-offer-form';

export default function IncomingRequestsPage() {
  const [requests, setRequests] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [me, setMe] = React.useState<string>('');
  const [selected, setSelected] = React.useState<any | null>(null);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const {
          data: { user }
        } = await supabase.auth.getUser();
        const uid = user?.id || '';
        setMe(uid);
        const rows = await getIncomingRequestsForForwarder(
          supabase as any,
          uid
        );
        setRequests(rows || []);
      } catch (e: any) {
        setError(e?.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className='p-6'>
      <h1 className='mb-2 text-2xl font-bold'>Incoming Requests</h1>
      {loading ? (
        <p className='text-muted-foreground text-sm'>Loading...</p>
      ) : error ? (
        <p className='text-destructive text-sm'>{error}</p>
      ) : (
        <div className='grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3'>
          {requests.map((r) => (
            <div
              key={r.id}
              className='bg-card flex flex-col gap-2 rounded-lg border p-4'
            >
              <div className='flex items-center justify-between'>
                <div className='font-bold'>{r.code}</div>
                <div className='text-xs capitalize opacity-70'>{r.status}</div>
              </div>
              <div className='text-xs opacity-80'>{r.freight_type}</div>
              <div className='flex justify-end'>
                <Button
                  size='sm'
                  onClick={() => {
                    setSelected(r);
                    setOpen(true);
                  }}
                >
                  Create Offer
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <ForwarderOfferForm
          open={open}
          onClose={() => setOpen(false)}
          requestId={selected.id}
          forwarderId={me}
          onSubmitted={() => {
            // refresh if needed
          }}
        />
      )}
    </div>
  );
}
