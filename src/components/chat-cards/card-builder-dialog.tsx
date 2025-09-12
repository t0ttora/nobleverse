'use client';
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  CardRenderer,
  type NobleCard,
  type UserRole
} from '@/components/chat-cards/card-renderer';
import { supabase } from '@/lib/supabaseClient';

type CardType = NobleCard['type'];

export function CardBuilderDialog({
  open,
  onOpenChange,
  type,
  onInsert,
  members,
  userRole
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  type: CardType | null;
  onInsert: (card: NobleCard) => void;
  members?: Array<{
    id: string;
    username?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
  }>;
  userRole?: UserRole;
}) {
  const [cardType, setCardType] = React.useState<CardType>(
    type || 'shipment_card'
  );
  const [state, setState] = React.useState<Record<string, any>>(() =>
    buildDefaults(cardType)
  );
  const [requests, setRequests] = React.useState<any[]>([]);
  const [onlyMyOffers, setOnlyMyOffers] = React.useState(false);
  const [selectedReqId, setSelectedReqId] = React.useState<
    string | number | null
  >(null);
  const [selectedReqCode, setSelectedReqCode] = React.useState<string | null>(
    null
  );
  const [loadingReqs, setLoadingReqs] = React.useState(false);
  const [offers, setOffers] = React.useState<any[]>([]);
  const [loadingOffers, setLoadingOffers] = React.useState(false);
  const [selectedOfferId, setSelectedOfferId] = React.useState<string | null>(
    null
  );

  React.useEffect(() => {
    if (type) {
      setCardType(type);
      setState(buildDefaults(type));
      setSelectedReqId(null);
      setSelectedReqCode(null);
      setOffers([]);
      setSelectedOfferId(null);
    }
  }, [type, open]);

  // Load active requests
  React.useEffect(() => {
    let alive = true;
    async function load() {
      if (!open) return;
      try {
        setLoadingReqs(true);
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) {
          setRequests([]);
          return;
        }
        // Owner sees own requests; Forwarder can toggle to see requests they've offered on
        let data: any[] | null = null;
        if (userRole === 'forwarder' && onlyMyOffers) {
          const { data: off } = await supabase
            .from('offers')
            .select('request_id')
            .eq('forwarder_id', uid)
            .limit(100);
          const reqIds = Array.from(
            new Set((off || []).map((o: any) => o.request_id))
          );
          if (reqIds.length) {
            const { data: reqs } = await supabase
              .from('requests')
              .select('*')
              .in('id', reqIds)
              .order('created_at', { ascending: false })
              .limit(50);
            data = reqs || [];
          } else {
            data = [];
          }
        } else {
          const res = await supabase
            .from('requests')
            .select('*')
            .eq('user_id', uid)
            .in('status', ['pending', 'open', 'in_progress'] as any)
            .order('created_at', { ascending: false })
            .limit(25);
          data = res.data || [];
        }
        if (!alive) return;
        setRequests(data || []);
      } catch {
        if (alive) setRequests([]);
      } finally {
        if (alive) setLoadingReqs(false);
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, [open, userRole, onlyMyOffers]);

  // Load offers for negotiation when a request is selected
  React.useEffect(() => {
    let alive = true;
    async function loadOffers() {
      if (!open) return;
      if (cardType !== 'negotiation_card' || !selectedReqId) {
        setOffers([]);
        setSelectedOfferId(null);
        return;
      }
      try {
        setLoadingOffers(true);
        const { data, error } = await supabase
          .from('offers')
          .select('*')
          .eq('request_id', selectedReqId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        if (!alive) return;
        setOffers(data || []);
      } catch {
        if (alive) setOffers([]);
      } finally {
        if (alive) setLoadingOffers(false);
      }
    }
    void loadOffers();
    return () => {
      alive = false;
    };
  }, [open, cardType, selectedReqId]);

  function field<K extends string>(key: K, val: any) {
    setState((s) => ({ ...s, [key]: val }));
  }

  function buildCard(): NobleCard {
    const t = cardType;
    const s = state;
    if (t === 'shipment_card') {
      return {
        type: t,
        id: s.id || autoId('SHIP'),
        title: s.title || 'Shipment',
        status: s.status || 'In Transit',
        origin: s.origin || '',
        destination: s.destination || '',
        eta: s.eta || new Date().toISOString(),
        last_update: s.last_update || '',
        documents: s.documents || [],
        actions: [
          {
            label: 'View Details',
            action: 'open_shipment',
            payload: { id: s.id || undefined }
          },
          {
            label: 'Track Live',
            action: 'open_tracking',
            payload: { id: s.id || undefined }
          }
        ]
      };
    }
    if (t === 'request_card') {
      return {
        type: t,
        id: s.id || autoId('REQ'),
        requester: s.requester || '',
        cargo: s.cargo || {},
        route: { origin: s.origin || '', destination: s.destination || '' },
        deadline: s.deadline || new Date().toISOString(),
        special_requirements: s.special_requirements || [],
        status: s.status || 'Open',
        actions: [
          {
            label: 'Submit Offer',
            action: 'create_offer',
            payload: { request_id: s.id || undefined }
          },
          {
            label: 'Ask Question',
            action: 'open_chat_thread',
            payload: { request_id: s.id || undefined }
          }
        ]
      };
    }
    if (t === 'negotiation_card') {
      const prev = {
        price: s.prev_price || '',
        transit_time: s.prev_transit_time || '',
        valid_until: s.prev_valid_until || new Date().toISOString(),
        conditions: s.prev_conditions || []
      };
      const next = {
        price: s.counter_price || prev.price,
        transit_time: s.counter_transit_time || prev.transit_time,
        valid_until: s.counter_valid_until || prev.valid_until,
        conditions:
          (s.counter_conditions && s.counter_conditions.length
            ? s.counter_conditions
            : prev.conditions) || []
      };
      return {
        type: t,
        id: s.id || autoId('NEG'),
        related_request: selectedReqId
          ? String(selectedReqId)
          : s.related_request || '',
        request_code: selectedReqCode || s.request_code || '',
        forwarder: s.forwarder || '',
        offer: next,
        status: s.status || 'Pending',
        actions: [
          {
            label: 'Accept Offer',
            action: 'accept_offer',
            payload: { offer_id: selectedOfferId || s.offer_id || '' }
          },
          {
            label: 'Counter Offer',
            action: 'counter_offer',
            payload: { offer_id: selectedOfferId || s.offer_id || '' }
          }
        ]
      };
    }
    if (t === 'invoice_card') {
      return {
        type: t,
        id: s.id || autoId('INV'),
        amount: s.amount || '',
        due_date: s.due_date || new Date().toISOString(),
        status: s.status || 'Unpaid',
        actions: [
          {
            label: 'Pay Now',
            action: 'pay_invoice',
            payload: { invoice_id: s.id || undefined }
          }
        ]
      };
    }
    if (t === 'payment_status_card') {
      return {
        type: t,
        id: s.id || autoId('PAY'),
        invoice_id: s.invoice_id || '',
        status: s.status || 'Processing',
        timestamp: s.timestamp || new Date().toISOString()
      };
    }
    if (t === 'task_card') {
      return {
        type: t,
        id: s.id || autoId('TASK'),
        title: s.title || '',
        assigned_to: s.assigned_to || '',
        deadline: s.deadline || new Date().toISOString(),
        status: s.status || 'In Progress',
        actions: [
          {
            label: 'Mark Done',
            action: 'complete_task',
            payload: { task_id: s.id || undefined }
          }
        ]
      };
    }
    if (t === 'approval_card') {
      return {
        type: t,
        id: s.id || autoId('APP'),
        subject: s.subject || '',
        status: s.status || 'Awaiting Approval',
        actions: [
          {
            label: 'Approve',
            action: 'approve_item',
            payload: { approval_id: s.id || undefined }
          }
        ]
      };
    }
    return {
      type: 'note_card',
      id: s.id || autoId('NOTE'),
      linked_to: s.linked_to || '',
      author: s.author || '',
      content: s.content || '',
      timestamp: s.timestamp || new Date().toISOString()
    };
  }

  const card = buildCard();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-4xl'>
        <DialogHeader>
          <DialogTitle>Create Card</DialogTitle>
        </DialogHeader>
        <div className='grid min-h-[420px] grid-cols-1 gap-4 md:grid-cols-2'>
          {/* Left: Minimal form */}
          <div className='bg-muted/20 order-2 rounded-lg border p-3 md:order-none'>
            <div className='grid grid-cols-2 gap-2'>
              <div className='col-span-2'>
                <div className='text-muted-foreground mb-1 text-xs'>Type</div>
                <Select
                  value={cardType}
                  onValueChange={(v: any) => {
                    setCardType(v);
                    setState(buildDefaults(v));
                    setSelectedReqId(null);
                    setOffers([]);
                    setSelectedOfferId(null);
                  }}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='shipment_card'>Shipment</SelectItem>
                    <SelectItem value='request_card'>Request</SelectItem>
                    <SelectItem value='negotiation_card'>
                      Negotiation
                    </SelectItem>
                    <SelectItem value='invoice_card'>Invoice</SelectItem>
                    <SelectItem value='payment_status_card'>
                      Payment Status
                    </SelectItem>
                    <SelectItem value='task_card'>Task</SelectItem>
                    <SelectItem value='approval_card'>Approval</SelectItem>
                    <SelectItem value='note_card'>Note</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(cardType === 'shipment_card' ||
                cardType === 'request_card' ||
                cardType === 'negotiation_card') && (
                <div className='col-span-2'>
                  <div className='mb-1 flex items-center justify-between'>
                    <div className='text-muted-foreground text-xs'>
                      Existing request
                    </div>
                    {userRole === 'forwarder' && (
                      <label className='text-muted-foreground flex items-center gap-2 text-xs'>
                        <input
                          type='checkbox'
                          checked={onlyMyOffers}
                          onChange={(e) => setOnlyMyOffers(e.target.checked)}
                        />
                        Show requests I offered on
                      </label>
                    )}
                  </div>
                  <Select
                    value={selectedReqId ? String(selectedReqId) : undefined}
                    onValueChange={(v) => {
                      setSelectedReqId(v);
                      const req = (requests || []).find(
                        (r) => String(r.id) === String(v)
                      );
                      if (req) {
                        const mapped = hydrateFromRequest(req);
                        setSelectedReqCode(req.code as string);
                        setState((s) => ({
                          ...s,
                          ...mapped,
                          request_code: req.code
                        }));
                      } else {
                        setSelectedReqCode(null);
                      }
                    }}
                  >
                    <SelectTrigger className='w-full'>
                      <SelectValue
                        placeholder={
                          loadingReqs
                            ? 'Loading...'
                            : requests.length
                              ? 'Choose an item'
                              : 'No active items found'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {requests.map((r) => (
                        <SelectItem key={r.id} value={String(r.id)}>
                          {r.code || r.id} • {r.freight_type || ''} • {r.status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {cardType === 'negotiation_card' && (
                <div className='col-span-2'>
                  <div className='text-muted-foreground mb-1 text-xs'>
                    Offer
                  </div>
                  <Select
                    value={selectedOfferId || undefined}
                    onValueChange={(v) => {
                      setSelectedOfferId(v);
                      const offer = (offers || []).find(
                        (o) => String(o.id) === String(v)
                      );
                      if (offer) {
                        const d = offer.details || {};
                        setState((s) => ({
                          ...s,
                          prev_price: d.price || '',
                          prev_transit_time: d.transit_time || '',
                          prev_valid_until:
                            d.valid_until || new Date().toISOString(),
                          prev_conditions: Array.isArray(d.conditions)
                            ? d.conditions
                            : [],
                          offer_id: offer.id,
                          forwarder: offer.forwarder_id,
                          related_request: selectedReqId
                            ? String(selectedReqId)
                            : '',
                          request_code: selectedReqCode || s.request_code || ''
                        }));
                      }
                    }}
                  >
                    <SelectTrigger className='w-full'>
                      <SelectValue
                        placeholder={
                          loadingOffers
                            ? 'Loading offers...'
                            : offers.length
                              ? 'Choose an offer'
                              : 'No offers for this request'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {offers.map((o) => (
                        <SelectItem key={o.id} value={String(o.id)}>
                          {String(o.id).slice(0, 8)} • {o.status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Keep other card types simple inputs as before */}
              {cardType === 'invoice_card' && (
                <>
                  <div>
                    <div className='text-muted-foreground mb-1 text-xs'>
                      Amount
                    </div>
                    <Input
                      value={state.amount || ''}
                      onChange={(e) => field('amount', e.target.value)}
                      placeholder='e.g., 7500 USD'
                    />
                  </div>
                  <div>
                    <div className='text-muted-foreground mb-1 text-xs'>
                      Due Date
                    </div>
                    <Input
                      type='datetime-local'
                      value={toLocal(state.due_date)}
                      onChange={(e) =>
                        field('due_date', fromLocal(e.target.value))
                      }
                    />
                  </div>
                </>
              )}
              {cardType === 'task_card' && (
                <>
                  <div className='col-span-2'>
                    <div className='text-muted-foreground mb-1 text-xs'>
                      Title
                    </div>
                    <Input
                      value={state.title || ''}
                      onChange={(e) => field('title', e.target.value)}
                      placeholder='Task title'
                    />
                  </div>
                  {Array.isArray(members) && members.length > 0 ? (
                    <div>
                      <div className='text-muted-foreground mb-1 text-xs'>
                        Assigned To
                      </div>
                      <Select
                        value={state.assigned_to || undefined}
                        onValueChange={(v) => field('assigned_to', v)}
                      >
                        <SelectTrigger className='w-full'>
                          <SelectValue placeholder='Choose a member' />
                        </SelectTrigger>
                        <SelectContent>
                          {members.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {
                                (m.display_name ||
                                  m.username ||
                                  'user') as string
                              }
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div>
                      <div className='text-muted-foreground mb-1 text-xs'>
                        Assigned To
                      </div>
                      <Input
                        value={state.assigned_to || ''}
                        onChange={(e) => field('assigned_to', e.target.value)}
                        placeholder='User'
                      />
                    </div>
                  )}
                  <div>
                    <div className='text-muted-foreground mb-1 text-xs'>
                      Deadline
                    </div>
                    <Input
                      type='datetime-local'
                      value={toLocal(state.deadline)}
                      onChange={(e) =>
                        field('deadline', fromLocal(e.target.value))
                      }
                    />
                  </div>
                </>
              )}
              {cardType === 'approval_card' && (
                <div className='col-span-2'>
                  <div className='text-muted-foreground mb-1 text-xs'>
                    Subject
                  </div>
                  <Input
                    value={state.subject || ''}
                    onChange={(e) => field('subject', e.target.value)}
                    placeholder='Subject'
                  />
                </div>
              )}
              {cardType === 'note_card' && (
                <div className='col-span-2'>
                  <div className='text-muted-foreground mb-1 text-xs'>
                    Content
                  </div>
                  <Textarea
                    value={state.content || ''}
                    onChange={(e) => field('content', e.target.value)}
                    placeholder='Note content'
                  />
                </div>
              )}
            </div>
          </div>

          {/* Right: Preview */}
          <div className='bg-muted/10 order-1 rounded-lg border p-3 md:order-none'>
            <div className='text-muted-foreground mb-2 text-xs'>Preview</div>
            <CardRenderer card={card} userRole={userRole} />
            {cardType === 'negotiation_card' && selectedOfferId && (
              <div className='mt-3 grid grid-cols-1 gap-3'>
                <div className='bg-background/60 rounded-md border p-3'>
                  <div className='mb-2 text-xs font-semibold'>
                    Previous Terms
                  </div>
                  <div className='grid grid-cols-3 gap-2 text-xs'>
                    {state.prev_price && (
                      <div>
                        <div className='text-muted-foreground text-[11px]'>
                          Original Budget
                        </div>
                        <div className='font-medium'>{state.prev_price}</div>
                      </div>
                    )}
                    {state.prev_transit_time && (
                      <div>
                        <div className='text-muted-foreground text-[11px]'>
                          Transit
                        </div>
                        <div className='font-medium'>
                          {state.prev_transit_time}
                        </div>
                      </div>
                    )}
                    {state.prev_valid_until && (
                      <div>
                        <div className='text-muted-foreground text-[11px]'>
                          Valid Until
                        </div>
                        <div className='font-medium'>
                          {toLocal(state.prev_valid_until)}
                        </div>
                      </div>
                    )}
                    {Array.isArray(state.prev_conditions) &&
                      state.prev_conditions.length > 0 && (
                        <div className='col-span-3'>
                          <div className='text-muted-foreground text-[11px]'>
                            Conditions
                          </div>
                          <div className='font-medium'>
                            {state.prev_conditions.join(', ')}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
                <div className='bg-background/60 rounded-md border p-3'>
                  <div className='mb-2 text-xs font-semibold'>
                    New Negotiation
                  </div>
                  <div className='grid grid-cols-3 gap-2'>
                    <div>
                      <div className='text-muted-foreground mb-1 text-[11px]'>
                        Counter Budget
                      </div>
                      <Input
                        value={state.counter_price || ''}
                        onChange={(e) => field('counter_price', e.target.value)}
                        placeholder='e.g., 2400 USD'
                      />
                    </div>
                    <div>
                      <div className='text-muted-foreground mb-1 text-[11px]'>
                        Transit Time
                      </div>
                      <Input
                        value={state.counter_transit_time || ''}
                        onChange={(e) =>
                          field('counter_transit_time', e.target.value)
                        }
                        placeholder='e.g., 17 days'
                      />
                    </div>
                    <div>
                      <div className='text-muted-foreground mb-1 text-[11px]'>
                        Valid Until
                      </div>
                      <Input
                        type='datetime-local'
                        value={toLocal(state.counter_valid_until)}
                        onChange={(e) =>
                          field(
                            'counter_valid_until',
                            fromLocal(e.target.value)
                          )
                        }
                      />
                    </div>
                    <div className='col-span-3'>
                      <div className='text-muted-foreground mb-1 text-[11px]'>
                        Conditions (comma separated)
                      </div>
                      <Input
                        value={(state.counter_conditions || []).join(', ')}
                        onChange={(e) =>
                          field(
                            'counter_conditions',
                            e.target.value
                              .split(',')
                              .map((x: string) => x.trim())
                              .filter(Boolean)
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={
              cardType === 'negotiation_card' &&
              (!selectedReqId || !selectedOfferId)
            }
            onClick={() => {
              onInsert(card);
              onOpenChange(false);
            }}
          >
            Insert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function buildDefaults(type: CardType): Record<string, any> {
  const now = new Date().toISOString();
  switch (type) {
    case 'shipment_card':
      return {
        id: 'SHIP000',
        title: 'Shipment',
        status: 'In Transit',
        origin: '',
        destination: '',
        eta: now,
        last_update: ''
      };
    case 'request_card':
      return {
        id: 'REQ000',
        requester: '',
        status: 'Open',
        origin: '',
        destination: '',
        deadline: now,
        cargo: {},
        special_requirements: []
      };
    case 'negotiation_card':
      return { id: '', related_request: '', forwarder: '', status: 'Pending' };
    case 'invoice_card':
      return { id: '', amount: '', due_date: now, status: 'Unpaid' };
    case 'payment_status_card':
      return { id: '', invoice_id: '', status: 'Processing', timestamp: now };
    case 'task_card':
      return {
        id: '',
        title: '',
        assigned_to: '',
        deadline: now,
        status: 'In Progress'
      };
    case 'approval_card':
      return { id: '', subject: '', status: 'Awaiting Approval' };
    default:
      return { id: '', content: '', timestamp: now };
  }
}

function mapRequestToCardState(req: any) {
  const d = req?.details || {};
  const origin = d.origin_city || d.origin || d.airport_origin || '';
  const destination =
    d.destination_city || d.destination || d.airport_destination || '';
  const eta = d.eta || d.etd || new Date().toISOString();
  return {
    id: req?.code || String(req?.id || ''),
    request_code: req?.code || undefined,
    status: req?.status || 'Open',
    origin,
    destination,
    deadline: d.deadline || req?.created_at || '',
    eta,
    title: `Shipment ${req?.code || req?.id || ''}`
  };
}

function hydrateFromRequest(req: any) {
  return mapRequestToCardState(req);
}

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

function autoId(prefix: string) {
  return `${prefix}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

export default CardBuilderDialog;
