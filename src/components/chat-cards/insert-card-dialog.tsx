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

type CardType =
  | 'shipment_card'
  | 'request_card'
  | 'negotiation_card'
  | 'invoice_card'
  | 'payment_status_card'
  | 'task_card'
  | 'approval_card'
  | 'note_card';

export function InsertCardDialog({
  open,
  onOpenChange,
  onInsert
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onInsert: (jsonText: string) => void;
}) {
  const [type, setType] = React.useState<CardType>('shipment_card');
  const [id, setId] = React.useState('');
  // Title is computed from status or left empty in templates; avoid unused state warnings
  const [title] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [json, setJson] = React.useState('{');

  React.useEffect(() => {
    if (!open) return;
    // Prefill JSON template when opening
    const tpl = buildTemplate(type, { id, title, status });
    setJson(JSON.stringify(tpl, null, 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function rebuild() {
    try {
      const tpl = buildTemplate(type, { id, title, status });
      setJson(JSON.stringify(tpl, null, 2));
    } catch {
      /* ignore */
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='overflow-hidden p-0 sm:max-w-2xl'>
        <DialogHeader className='px-6 pt-5'>
          <DialogTitle>Insert Card</DialogTitle>
        </DialogHeader>
        <div className='space-y-3 px-6 pb-4'>
          <div className='grid gap-2 sm:grid-cols-3'>
            <div className='sm:col-span-1'>
              <div className='text-muted-foreground mb-1 text-xs'>Type</div>
              <Select value={type} onValueChange={(v: any) => setType(v)}>
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='shipment_card'>Shipment</SelectItem>
                  <SelectItem value='request_card'>Request</SelectItem>
                  <SelectItem value='negotiation_card'>Negotiation</SelectItem>
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
            <div className='sm:col-span-1'>
              <div className='text-muted-foreground mb-1 text-xs'>ID</div>
              <Input
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder='e.g., SHIP12345'
              />
            </div>
            <div className='sm:col-span-1'>
              <div className='text-muted-foreground mb-1 text-xs'>
                Status/Title
              </div>
              <Input
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                placeholder='e.g., In Transit / Pending'
              />
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <Button size='sm' variant='outline' onClick={rebuild}>
              Rebuild template
            </Button>
            <div className='text-muted-foreground text-xs'>
              You can freely edit the JSON below before inserting.
            </div>
          </div>
          <Textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            className='min-h-[260px] font-mono text-xs'
          />
        </div>
        <DialogFooter className='px-6 pb-5'>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              const text = json.trim();
              if (!text.startsWith('{')) {
                onOpenChange(false);
                return;
              }
              onInsert(text);
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

function buildTemplate(
  type: CardType,
  { id, title, status }: { id?: string; title?: string; status?: string }
) {
  const base: any = { type, id: id || placeholderId(type) };
  if (type === 'shipment_card') {
    return {
      ...base,
      title: title || 'Shipment title',
      status: status || 'In Transit',
      origin: 'Origin',
      destination: 'Destination',
      eta: new Date().toISOString(),
      actions: [
        {
          label: 'View Details',
          action: 'open_shipment',
          payload: { id: id || placeholderId(type) }
        }
      ]
    };
  }
  if (type === 'request_card') {
    return {
      ...base,
      requester: 'Company',
      status: status || 'Open',
      route: { origin: 'Origin', destination: 'Destination' },
      deadline: new Date().toISOString(),
      actions: [
        {
          label: 'Submit Offer',
          action: 'create_offer',
          payload: { request_id: id || placeholderId(type) }
        }
      ]
    };
  }
  if (type === 'negotiation_card') {
    return {
      ...base,
      related_request: 'REQ',
      forwarder: 'Forwarder',
      status: status || 'Pending',
      offer: {
        price: '1000 USD',
        transit_time: '10 days',
        valid_until: new Date(Date.now() + 86400000).toISOString(),
        conditions: ['Terms']
      },
      actions: [
        {
          label: 'Accept Offer',
          action: 'accept_offer',
          payload: { offer_id: 'OFFER_ID' }
        },
        {
          label: 'Counter Offer',
          action: 'counter_offer',
          payload: { offer_id: 'OFFER_ID' }
        }
      ]
    };
  }
  if (type === 'invoice_card') {
    return {
      ...base,
      amount: '1000 USD',
      due_date: new Date(Date.now() + 7 * 86400000).toISOString(),
      status: status || 'Unpaid',
      actions: [
        {
          label: 'Pay Now',
          action: 'pay_invoice',
          payload: { invoice_id: id || placeholderId(type) }
        }
      ]
    };
  }
  if (type === 'payment_status_card') {
    return {
      ...base,
      invoice_id: 'INV',
      status: status || 'Processing',
      timestamp: new Date().toISOString()
    };
  }
  if (type === 'task_card') {
    return {
      ...base,
      title: title || 'Task title',
      assigned_to: 'User',
      deadline: new Date(Date.now() + 3 * 86400000).toISOString(),
      status: status || 'In Progress',
      actions: [
        {
          label: 'Mark Done',
          action: 'complete_task',
          payload: { task_id: id || placeholderId(type) }
        }
      ]
    };
  }
  if (type === 'approval_card') {
    return {
      ...base,
      subject: title || 'Subject',
      status: status || 'Awaiting Approval',
      actions: [
        {
          label: 'Approve',
          action: 'approve_item',
          payload: { approval_id: id || placeholderId(type) }
        }
      ]
    };
  }
  if (type === 'note_card') {
    return {
      ...base,
      linked_to: 'ENTITY',
      author: 'User',
      content: 'Note body',
      timestamp: new Date().toISOString()
    };
  }
  return base;
}

function placeholderId(type: CardType) {
  const map: Record<CardType, string> = {
    shipment_card: 'SHIP000',
    request_card: 'REQ000',
    negotiation_card: 'NEG000',
    invoice_card: 'INV000',
    payment_status_card: 'PAY000',
    task_card: 'TASK000',
    approval_card: 'APP000',
    note_card: 'NOTE000'
  };
  return map[type];
}

export default InsertCardDialog;
