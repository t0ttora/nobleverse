'use client';
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';
import { getRecentOffersForForwarder } from '@/../utils/supabase/offers';

type OfferRow = {
  id: string;
  request_id: string | number;
  details: any;
  status: string;
  created_at?: string;
};

export function RecentOffersCard({
  forwarderId,
  onOpenRequest
}: {
  forwarderId: string;
  onOpenRequest?: (request: any) => void;
}) {
  const [rows, setRows] = React.useState<OfferRow[]>([]);
  const [reqMap, setReqMap] = React.useState<Record<string, any>>({});

  React.useEffect(() => {
    (async () => {
      if (!forwarderId) return;
      try {
        const data = await getRecentOffersForForwarder(
          supabase as any,
          forwarderId,
          6
        );
        setRows(data as any);
        const ids = Array.from(
          new Set((data || []).map((o: any) => o.request_id))
        );
        if (ids.length) {
          const { data: reqs } = await (supabase as any)
            .from('requests')
            .select('id,code,details,status,freight_type,updated_at')
            .in('id', ids);
          const map: Record<string, any> = {};
          for (const r of reqs || []) map[String(r.id)] = r;
          setReqMap(map);
        }
      } catch {
        setRows([]);
      }
    })();
  }, [forwarderId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>Recent Offers</CardTitle>
      </CardHeader>
      <CardContent className='pt-0'>
        {rows.length === 0 ? (
          <div className='text-muted-foreground text-sm'>No recent offers.</div>
        ) : (
          <div className='space-y-2'>
            {rows.map((o) => {
              const d =
                typeof o.details === 'string'
                  ? (() => {
                      try {
                        return JSON.parse(o.details as any);
                      } catch {
                        return {};
                      }
                    })()
                  : o.details || {};
              const price = d.total_price;
              const req = reqMap[String(o.request_id)];
              return (
                <div
                  key={o.id}
                  className='bg-muted/30 flex items-center justify-between rounded-md border p-2'
                >
                  <div className='flex flex-col'>
                    <div className='text-sm font-medium'>
                      {req?.code || `Request #${o.request_id}`}
                    </div>
                    <div className='text-xs opacity-70'>
                      {price ? `$${price}` : '—'} •{' '}
                      <span className='capitalize'>{o.status}</span>
                    </div>
                  </div>
                  <Button
                    size='sm'
                    variant='secondary'
                    onClick={async () => {
                      if (onOpenRequest) {
                        if (req) onOpenRequest(req);
                        else {
                          const { data: r } = await (supabase as any)
                            .from('requests')
                            .select('*')
                            .eq('id', o.request_id)
                            .maybeSingle();
                          if (r) onOpenRequest(r);
                        }
                      }
                    }}
                  >
                    Preview
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
