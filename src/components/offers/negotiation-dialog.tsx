'use client';
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { formatCurrency } from '@/lib/format';

type OfferLike = {
  id: string;
  request_id?: string | null;
  forwarder_id?: string | null;
  details: any;
};

function toLocal(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (!isFinite(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocal(local: string) {
  if (!local) return '';
  const d = new Date(local);
  return d.toISOString();
}

function safeDetails(d: any) {
  try {
    return typeof d === 'string' ? JSON.parse(d) : d || {};
  } catch {
    return {};
  }
}

export function NegotiationDialog({
  open,
  onOpenChange,
  offer,
  forwarderLabel
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  offer: OfferLike;
  forwarderLabel: string;
}) {
  const details = React.useMemo(
    () => safeDetails(offer?.details),
    [offer?.details]
  );

  // Prefill previous terms from offer details with best-effort mapping
  const prevPrice = React.useMemo(() => {
    if (details.price) return String(details.price);
    if (details.total_price)
      return formatCurrency(
        details.total_price,
        details.total_price_currency || details.currency
      );
    return '';
  }, [details]);
  const prevTransit = React.useMemo(() => {
    return details.transit_time || details.transitTime || details.transit || '';
  }, [details]);
  const prevValid = React.useMemo(() => {
    if (details.valid_until) return details.valid_until;
    const days =
      Number(details.offer_validity || details.validity_days || 1) || 1;
    const d = new Date(Date.now() + days * 86400000);
    return d.toISOString();
  }, [details]);
  const prevConds = React.useMemo(() => {
    const arr: string[] = [];
    if (Array.isArray(details.conditions))
      arr.push(...details.conditions.map((x: any) => String(x)));
    if (details.payment_terms) arr.push(String(details.payment_terms));
    if (details.price_includes && Array.isArray(details.price_includes))
      arr.push(`Includes: ${details.price_includes.join(', ')}`);
    if (details.additional_charges)
      arr.push(`Additional: ${details.additional_charges}`);
    if (details.service_scope && Array.isArray(details.service_scope))
      arr.push(`Scope: ${details.service_scope.join(', ')}`);
    if (details.free_time) arr.push(`Free time: ${details.free_time} days`);
    return arr;
  }, [details]);

  const [price, setPrice] = React.useState<string>(prevPrice || '');
  const [transit, setTransit] = React.useState<string>(prevTransit || '');
  const [validUntil, setValidUntil] = React.useState<string>(
    toLocal(prevValid)
  );
  const [conditions, setConditions] = React.useState<string>(
    prevConds.join(', ')
  );
  const [note, setNote] = React.useState<string>('');
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setPrice(prevPrice || '');
    setTransit(prevTransit || '');
    setValidUntil(toLocal(prevValid));
    setConditions(prevConds.join(', '));
    setNote('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function submit() {
    if (!offer?.forwarder_id) return;
    setSubmitting(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const myId = auth.user?.id;
      if (!myId) throw new Error('Not authenticated');
      const { data: rid, error } = await supabase.rpc('get_or_create_dm_room', {
        p_user1: myId,
        p_user2: offer.forwarder_id
      });
      if (error || !rid)
        throw new Error(error?.message || 'Could not start conversation');
      const roomId = rid as string;

      const card = {
        type: 'negotiation_card',
        id: `NEG${String(offer.id || '')
          .slice(0, 6)
          .toUpperCase()}`,
        related_request: offer.request_id
          ? String(offer.request_id)
          : undefined,
        forwarder: forwarderLabel,
        offer: {
          price: price || undefined,
          transit_time: transit || undefined,
          valid_until: fromLocal(validUntil) || undefined,
          conditions: conditions
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean)
        },
        status: 'Pending',
        actions: [
          {
            label: 'Accept Offer',
            action: 'accept_offer',
            payload: { offer_id: offer.id }
          },
          {
            label: 'Counter Offer',
            action: 'counter_offer',
            payload: { offer_id: offer.id }
          }
        ]
      } as const;

      const parts: string[] = [];
      if (note.trim()) parts.push(note.trim());
      parts.push('```nvcard\n' + JSON.stringify(card, null, 2) + '\n```');
      const content = parts.join('\n\n');

      // Store negotiation history row (if table exists; ignore errors)
      try {
        await supabase.from('negotiations').insert({
          offer_id: offer.id,
          request_id: offer.request_id || null,
          forwarder_id: offer.forwarder_id || null,
          created_by: myId,
          note: note || null,
          prev_terms: details || {},
          counter_terms: card.offer,
          status: 'pending'
        });
      } catch {
        /* ignore if table not present */
      }

      // Try user_id column first, fallback to sender_id
      const ins = await supabase
        .from('chat_messages')
        .insert({ room_id: roomId, user_id: myId, content })
        .select('id')
        .single();
      if (ins.error) {
        const alt = await supabase
          .from('chat_messages')
          .insert({ room_id: roomId, sender_id: myId, content })
          .select('id')
          .single();
        if (alt.error) throw new Error(alt.error.message);
      }
      toast.success('Negotiation sent');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to send negotiation');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!submitting) onOpenChange(v);
      }}
    >
      <DialogContent
        overlayClassName='z-[130]'
        className='z-[140] w-[95vw] sm:max-w-2xl'
      >
        <DialogHeader>
          <DialogTitle>Negotiate Offer</DialogTitle>
        </DialogHeader>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <div className='bg-muted/20 rounded-md border p-3'>
            <div className='text-muted-foreground mb-2 text-xs font-semibold'>
              Previous Terms
            </div>
            <div className='grid grid-cols-2 gap-2 text-xs'>
              {prevPrice && (
                <div>
                  <div className='text-muted-foreground text-[11px]'>
                    Budget
                  </div>
                  <div className='font-medium'>{prevPrice}</div>
                </div>
              )}
              {prevTransit && (
                <div>
                  <div className='text-muted-foreground text-[11px]'>
                    Transit
                  </div>
                  <div className='font-medium'>{prevTransit}</div>
                </div>
              )}
              {prevValid && (
                <div className='col-span-2'>
                  <div className='text-muted-foreground text-[11px]'>
                    Valid Until
                  </div>
                  <div className='font-medium'>{toLocal(prevValid)}</div>
                </div>
              )}
              {prevConds.length > 0 && (
                <div className='col-span-2'>
                  <div className='text-muted-foreground text-[11px]'>
                    Conditions
                  </div>
                  <div className='font-medium'>{prevConds.join(', ')}</div>
                </div>
              )}
            </div>
          </div>
          <div className='bg-muted/10 rounded-md border p-3'>
            <div className='text-muted-foreground mb-2 text-xs font-semibold'>
              Your Counter
            </div>
            <div className='grid grid-cols-2 items-start gap-2'>
              <div className='col-span-2'>
                <div className='text-muted-foreground mb-1 text-[11px]'>
                  Budget
                </div>
                <Input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder='e.g., 2,350 USD'
                />
              </div>
              <div>
                <div className='text-muted-foreground mb-1 text-[11px]'>
                  Transit
                </div>
                <Input
                  value={transit}
                  onChange={(e) => setTransit(e.target.value)}
                  placeholder='e.g., 12 days'
                />
              </div>
              <div>
                <div className='text-muted-foreground mb-1 text-[11px]'>
                  Valid Until
                </div>
                <Input
                  type='datetime-local'
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </div>
              <div className='col-span-2'>
                <div className='text-muted-foreground mb-1 text-[11px]'>
                  Conditions (comma separated)
                </div>
                <Input
                  value={conditions}
                  onChange={(e) => setConditions(e.target.value)}
                  placeholder='e.g., 30% upfront, CIF terms'
                />
              </div>
              <div className='col-span-2'>
                <div className='text-muted-foreground mb-1 text-[11px]'>
                  Note
                </div>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder='Optional message to forwarder'
                  className='min-h-20'
                />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={submitting || !offer?.forwarder_id}
          >
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default NegotiationDialog;
