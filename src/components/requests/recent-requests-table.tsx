import React, { useState, useEffect } from 'react';
import { getUserRequests } from '../../../utils/supabase/requests';
import { supabase } from '../../../utils/supabase/client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '../ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';

import { RequestDetailsPanel } from './request-details-panel';

const FREIGHT_TYPE_LABELS: Record<string, string> = {
  RDF: 'Road Freight',
  SEF: 'Sea Freight',
  ARF: 'Air Freight',
  RAF: 'Rail Freight',
  MMF: 'Multimodal Freight',
  CRX: 'Courier / Express Shipping'
};

const FREIGHT_TYPE_MAP: Record<string, string> = {
  'Road Freight': 'RDF',
  'Sea Freight': 'SEF',
  'Air Freight': 'ARF',
  'Rail Freight': 'RAF',
  'Multimodal Freight': 'MMF',
  'Courier / Express Shipping': 'CRX',
  RDF: 'RDF',
  SEF: 'SEF',
  ARF: 'ARF',
  RAF: 'RAF',
  MMF: 'MMF',
  CRX: 'CRX'
};

interface RecentRequestsCardProps {
  userId: string;
}

export function RecentRequestsCard({ userId }: RecentRequestsCardProps) {
  interface RequestRow {
    id: string;
    code: string;
    status?: string;
    freight_type?: string;
    offers_count?: number | null;
    details?: unknown;
  }
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<
    (RequestRow & { details: Record<string, unknown> }) | null
  >(null);
  const [count, setCount] = useState(5);
  const onFullscreen = () => {
    // TODO: implement fullscreen view; intentional no-op for now
    return undefined;
  };

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    getUserRequests({ supabase, userId })
      .then((data) => {
        setRequests((data as RequestRow[] | null) ?? []);
        setLoading(false);
      })
      .catch((e) => {
        setError((e as Error)?.message ?? 'Failed to fetch requests');
        setLoading(false);
      });
  }, [userId]);

  return (
    <>
      <Card className='mt-4 h-[420px] w-full'>
        <CardHeader className='pb-3'>
          <div className='flex items-start justify-between gap-4'>
            <div className='min-w-0'>
              <CardTitle className='relative'>
                <span
                  className='i-lucide-clock pointer-events-none absolute top-0.5 -left-4 text-lg'
                  aria-hidden='true'
                />
                Recent Requests
              </CardTitle>
              <CardDescription className='truncate'>
                View and manage your recent requests.
              </CardDescription>
            </div>
            <div className='flex shrink-0 items-center gap-2'>
              <button
                className='hover:bg-accent text-muted-foreground inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors'
                title='Fullscreen'
                onClick={onFullscreen}
                type='button'
              >
                <span className='i-lucide-maximize-2 text-[18px]' />
              </button>
              <Select
                value={String(count)}
                onValueChange={(v) => setCount(parseInt(v, 10))}
              >
                <SelectTrigger
                  aria-label='Items'
                  className='h-8 min-w-[108px] rounded-md px-2 text-xs'
                >
                  <SelectValue placeholder={`${count} items`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='5'>5 items</SelectItem>
                  <SelectItem value='10'>10 items</SelectItem>
                  <SelectItem value='20'>20 items</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className='min-h-0 flex-1 overflow-hidden'>
          {loading ? (
            <div className='text-muted-foreground py-4 text-xs'>Loading...</div>
          ) : error ? (
            <div className='text-destructive py-4 text-xs'>{error}</div>
          ) : requests.length === 0 ? (
            <div className='text-muted-foreground py-4 text-xs'>
              No requests found.
            </div>
          ) : (
            <ScrollArea className='h-full pr-1'>
              <div className='flex flex-col gap-3'>
                {requests.slice(0, count).map((req) => {
                  const abbr =
                    FREIGHT_TYPE_MAP[req.freight_type ?? ''] ??
                    req.freight_type;
                  let details: Record<string, unknown> = {};
                  try {
                    details =
                      typeof req.details === 'string'
                        ? JSON.parse(req.details)
                        : ((req.details as
                            | Record<string, unknown>
                            | undefined) ?? {});
                  } catch {
                    // ignore malformed JSON in details; keep empty object
                  }
                  const budget = details?.budget
                    ? `$${(details as { budget?: number }).budget}`
                    : '';
                  const rawEtd = (details as { etd?: string | number | Date })
                    .etd;
                  const etd = rawEtd ? new Date(rawEtd) : null;
                  const etdStr = etd
                    ? etd.toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric'
                      })
                    : '';
                  const weight = (details as { weight?: number }).weight
                    ? `${(details as { weight?: number }).weight}kg`
                    : '';
                  const cargoType =
                    (details as { cargo_type?: string }).cargo_type ?? '';
                  const origin =
                    (details as { airport_origin?: string; origin?: string })
                      .airport_origin ??
                    (details as { origin?: string }).origin ??
                    'IST';
                  const destination =
                    (
                      details as {
                        airport_destination?: string;
                        destination?: string;
                      }
                    ).airport_destination ??
                    (details as { destination?: string }).destination ??
                    'JFK';
                  // Offer count mock (replace with real data if available)
                  const offerCount =
                    req.offers_count ?? Math.floor(Math.random() * 13);
                  // Status badge color
                  let statusVariant: 'default' | 'secondary' | 'outline' =
                    'outline';
                  if (req.status === 'pending') statusVariant = 'outline';
                  else if (req.status === 'approved') statusVariant = 'default';
                  else if (req.status === 'delivered')
                    statusVariant = 'secondary';
                  // Icon for ARF (plane), else generic box
                  const icon =
                    abbr === 'ARF' ? (
                      <span className='i-lucide-plane text-primary text-xl' />
                    ) : abbr === 'SEF' ? (
                      <span className='i-lucide-ship text-primary text-xl' />
                    ) : abbr === 'RAF' ? (
                      <span className='i-lucide-train text-primary text-xl' />
                    ) : abbr === 'MMF' ? (
                      <span className='i-lucide-shuffle text-primary text-xl' />
                    ) : abbr === 'CRX' ? (
                      <span className='i-lucide-truck text-primary text-xl' />
                    ) : abbr === 'RDF' ? (
                      <span className='i-lucide-truck text-primary text-xl' />
                    ) : (
                      <span className='i-lucide-package text-primary text-xl' />
                    );
                  return (
                    <Card
                      key={req.id}
                      tabIndex={0}
                      role='button'
                      className='from-primary/5 to-card focus:ring-primary/40 hover:bg-primary/10 flex cursor-pointer flex-row items-center gap-4 rounded-xl bg-gradient-to-t p-0 px-4 py-3 transition-colors focus:ring-2 focus:ring-offset-0 focus:outline-none focus:ring-inset'
                      onClick={() => {
                        setSelectedRequest({ ...req, details });
                        setOpen(true);
                      }}
                    >
                      <div className='flex min-w-0 flex-1 flex-col'>
                        <div className='flex items-center gap-2'>
                          <span className='text-primary text-base font-bold'>
                            {req.code}
                          </span>
                          <Badge variant='outline'>
                            {FREIGHT_TYPE_LABELS[String(abbr)] || abbr}
                          </Badge>
                          <Badge variant='secondary'>{offerCount} offers</Badge>
                        </div>
                        <div className='text-muted-foreground flex items-center gap-2 text-sm font-medium'>
                          <span>
                            {origin} → {destination}
                          </span>
                        </div>
                        <div className='text-muted-foreground flex items-center gap-2 text-xs'>
                          <span>{cargoType || '—'}</span>
                          {weight && <span>· {weight}</span>}
                        </div>
                      </div>
                      <div className='flex min-w-[90px] flex-col items-end gap-2'>
                        <span className='text-primary dark:text-primary-foreground text-xl font-bold'>
                          {budget}
                        </span>
                        <Badge variant={statusVariant} className='capitalize'>
                          {req.status}
                        </Badge>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
      <RequestDetailsPanel
        open={open}
        onClose={() => setOpen(false)}
        request={selectedRequest}
      />
    </>
  );
}
