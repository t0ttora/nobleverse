'use client';
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabaseClient';
import { getOfferConfig } from '@/lib/forwarder-offer-schema';
import { Button } from '@/components/ui/button';
// import { NewMessageDialog } from '@/components/new-message-dialog';
import NegotiationDialog from '@/components/offers/negotiation-dialog';
import { toast } from 'sonner';
import { updateOfferStatus } from '../../../utils/supabase/offers';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

type OfferLike = {
  id: string;
  request_id?: string;
  forwarder_id?: string;
  status?: string | null;
  created_at?: string | null;
  details: any;
};

function readDetails(d: any) {
  try {
    return typeof d === 'string' ? JSON.parse(d) : d || {};
  } catch {
    return {} as Record<string, any>;
  }
}

function fmt(val: any, key?: string) {
  if (Array.isArray(val)) return val.join(', ');
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (val === null || val === undefined || val === '') return '—';
  if (key === 'offer_validity') return `${val} days`;
  return String(val);
}

export function OfferDetailsDialog({
  open,
  onClose,
  offer,
  actor,
  isOwner,
  onAccepted,
  canEdit,
  onEdit
}: {
  open: boolean;
  onClose: () => void;
  offer: OfferLike | null;
  actor?: {
    company_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
  } | null;
  isOwner?: boolean;
  onAccepted?: (updated: any) => void;
  canEdit?: boolean;
  onEdit?: () => void;
}) {
  const [profile, setProfile] = React.useState<{
    company_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
  } | null>(actor || null);
  const d = React.useMemo(() => readDetails(offer?.details), [offer?.details]);
  const [negOpen, setNegOpen] = React.useState(false);
  const [meEmail, setMeEmail] = React.useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [accepting, setAccepting] = React.useState(false);
  const forwarderId = offer?.forwarder_id || null;

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!open) return;
      // Fetch forwarder profile if not provided
      if (!actor && offer?.forwarder_id) {
        try {
          const { data } = await (supabase as any)
            .from('profiles')
            .select('company_name,username,avatar_url')
            .eq('id', offer.forwarder_id)
            .maybeSingle();
          if (!cancelled) setProfile(data || null);
        } catch {}
      } else {
        setProfile(actor || null);
      }
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!cancelled) setMeEmail(auth?.user?.email ?? null);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [open, actor, offer?.forwarder_id]);

  const config = getOfferConfig();
  const sections = config.sections;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent
        overlayClassName='z-[110]'
        className={cn(
          'z-[120] flex max-h-[85vh] w-[95vw] flex-col overflow-hidden transition-opacity sm:max-w-3xl',
          confirmOpen && 'pointer-events-none opacity-40'
        )}
      >
        <DialogHeader>
          <DialogTitle>Offer Details</DialogTitle>
        </DialogHeader>
        {offer && (
          <>
            <div className='flex-1 overflow-y-auto pr-1'>
              <div className='flex flex-col gap-4'>
                <div className='flex items-center justify-between gap-3'>
                  <div className='min-w-0'>
                    <div className='text-muted-foreground text-sm'>
                      Forwarder
                    </div>
                    <div className='truncate text-base font-semibold'>
                      {profile?.company_name ||
                        profile?.username ||
                        'Forwarder'}
                    </div>
                  </div>
                  <div className='flex items-center gap-2'>
                    {offer.status ? (
                      <Badge className='capitalize' variant='secondary'>
                        {offer.status}
                      </Badge>
                    ) : null}
                    {offer.created_at ? (
                      <span className='text-muted-foreground text-xs'>
                        {new Date(offer.created_at).toLocaleString()}
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Derived quick summary if available */}
                <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
                  <div className='bg-muted/40 rounded p-2'>
                    <div className='text-muted-foreground text-[11px]'>
                      Total Price
                    </div>
                    <div className='font-semibold'>
                      {fmt(d.total_price)}{' '}
                      {d.total_price_currency || d.currency || ''}
                    </div>
                  </div>
                  <div className='bg-muted/40 rounded p-2'>
                    <div className='text-muted-foreground text-[11px]'>
                      Transit Time
                    </div>
                    <div className='font-semibold'>
                      {fmt(d.transit_time)} {d.transit_time ? 'days' : ''}
                    </div>
                  </div>
                  <div className='bg-muted/40 rounded p-2'>
                    <div className='text-muted-foreground text-[11px]'>
                      Payment Terms
                    </div>
                    <div className='truncate font-semibold'>
                      {fmt(d.payment_terms)}
                    </div>
                  </div>
                  <div className='bg-muted/40 rounded p-2'>
                    <div className='text-muted-foreground text-[11px]'>
                      Offer Validity
                    </div>
                    <div className='font-semibold'>
                      {fmt(d.offer_validity, 'offer_validity')}
                    </div>
                  </div>
                </div>

                {/* All sections and fields present in details */}
                <div className='space-y-4'>
                  {sections.map((section) => {
                    const visible = section.fields.filter(
                      (f: any) =>
                        d[f.id] !== undefined &&
                        d[f.id] !== null &&
                        d[f.id] !== ''
                    );
                    if (visible.length === 0) return null;
                    return (
                      <div
                        key={section.title}
                        className='bg-background/80 rounded-xl border p-4'
                      >
                        <div className='mb-3 font-semibold'>
                          {section.title}
                        </div>
                        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                          {visible.map((f: any) => (
                            <div key={f.id} className='flex flex-col gap-1'>
                              <div className='text-muted-foreground text-xs'>
                                {f.label}
                              </div>
                              <div className='text-sm font-medium break-words'>
                                {fmt(d[f.id], f.id)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <DialogFooter>
              <div className='flex w-full items-center justify-between gap-2'>
                <div className='text-muted-foreground text-xs'>
                  {offer.status === 'accepted'
                    ? 'This offer has been accepted.'
                    : ''}
                </div>
                <div className='flex items-center gap-2'>
                  <Button
                    variant='outline'
                    onClick={() => setNegOpen(true)}
                    disabled={!forwarderId}
                  >
                    Negotiate
                  </Button>
                  {canEdit ? (
                    <Button
                      variant='secondary'
                      onClick={() => {
                        onEdit?.();
                      }}
                    >
                      Edit Offer
                    </Button>
                  ) : null}
                  {isOwner ? (
                    <Button
                      onClick={() => setConfirmOpen(true)}
                      disabled={offer?.status === 'accepted' || accepting}
                    >
                      {offer?.status === 'accepted'
                        ? 'Accepted'
                        : 'Accept offer'}
                    </Button>
                  ) : null}
                </div>
              </div>
            </DialogFooter>
          </>
        )}
        {/* Negotiate via negotiation card */}
        {negOpen && forwarderId && offer && (
          <NegotiationDialog
            open={negOpen}
            onOpenChange={setNegOpen}
            offer={offer as any}
            forwarderLabel={
              profile?.company_name || profile?.username || 'Forwarder'
            }
          />
        )}
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent className='z-[200]'>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm acceptance</AlertDialogTitle>
              <AlertDialogDescription>
                Accepting this offer will create a shipment and reject all other
                offers for this request. Are you sure?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button
                onClick={async () => {
                  if (!offer?.id || accepting) return;
                  setAccepting(true);
                  try {
                    const res = await fetch(`/api/offers/${offer.id}/accept`, {
                      method: 'POST'
                    });
                    let payload: any = null;
                    let raw: string | null = null;
                    const ct = res.headers.get('content-type') || '';
                    if (ct.includes('application/json')) {
                      try {
                        payload = await res.json();
                      } catch {}
                    } else {
                      try {
                        raw = await res.text();
                      } catch {}
                    }
                    if (!res.ok) {
                      const msg =
                        (payload && (payload.error || payload.message)) ||
                        raw ||
                        `Accept failed (${res.status})`;
                      throw new Error(msg);
                    }
                    toast.success('Offer accepted');
                    onAccepted?.(payload || {});
                    setConfirmOpen(false);
                    onClose();
                    if (payload?.redirect) {
                      window.location.href = payload.redirect;
                    }
                  } catch (e: any) {
                    toast.error(e?.message || 'Failed to accept offer');
                  } finally {
                    setAccepting(false);
                  }
                }}
                disabled={accepting}
              >
                {accepting ? 'Accepting...' : 'Yes, accept'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

export default OfferDetailsDialog;
