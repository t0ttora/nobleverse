'use client';
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { OfferDetailsDialog } from '@/components/offers/offer-details-dialog';

type OfferLike = { id: string; status?: string; details: any };

function readDetails(d: any) {
  const obj =
    typeof d === 'string'
      ? (() => {
          try {
            return JSON.parse(d);
          } catch {
            return {};
          }
        })()
      : d || {};
  return obj as Record<string, any>;
}

export function CompareOffersPanel({
  open,
  onClose,
  offers,
  isOwner,
  onAccepted
}: {
  open: boolean;
  onClose: () => void;
  offers: OfferLike[];
  isOwner?: boolean;
  onAccepted?: (o: any) => void;
}) {
  const parsed = React.useMemo(
    () => offers.map((o) => ({ ...o, details: readDetails(o.details) })),
    [offers]
  );
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<OfferLike | null>(null);
  const fields: { key: string; label: string }[] = [
    { key: 'total_price', label: 'Total Price' },
    { key: 'total_price_currency', label: 'Currency' },
    { key: 'currency', label: 'Currency (alt)' },
    { key: 'transit_time', label: 'Transit Time (days)' },
    { key: 'transit_time_guarantee', label: 'Transit Time Guaranteed' },
    { key: 'price_includes', label: 'Price Includes' },
    { key: 'service_scope', label: 'Scope of Service' },
    { key: 'payment_terms', label: 'Payment Terms' },
    { key: 'offer_validity', label: 'Offer Validity (days)' },
    { key: 'taxes_duties', label: 'Taxes/Duties Included' },
    { key: 'tracking_available', label: 'Tracking Available' },
    { key: 'carrier_info', label: 'Carrier / Line' },
    { key: 'free_time', label: 'Free Time (days)' },
    { key: 'value_added_services', label: 'Value-Added Services' },
    { key: 'company_name', label: 'Company' },
    { key: 'contact_person', label: 'Contact' }
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent
        overlayClassName='z-[100]'
        className='z-[100] w-[95vw] sm:max-w-4xl'
      >
        <DialogHeader>
          <DialogTitle>Compare Offers</DialogTitle>
        </DialogHeader>
        <div className='flex flex-col gap-3'>
          <div className='overflow-x-auto'>
            <table className='min-w-full border-collapse text-sm'>
              <thead>
                <tr>
                  <th className='border-border bg-background sticky left-0 z-10 border-b p-2 text-left'>
                    Field
                  </th>
                  {parsed.map((o, i) => (
                    <th
                      key={o.id}
                      className='border-border border-b p-2 text-left'
                    >
                      Offer {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fields.map((f) => (
                  <tr key={f.key} className='align-top'>
                    <td className='border-border bg-background sticky left-0 z-10 border-b p-2 font-medium'>
                      {f.label}
                    </td>
                    {parsed.map((o) => {
                      const v = (o.details as any)[f.key];
                      let display: string = '';
                      if (Array.isArray(v)) display = v.join(', ');
                      else if (typeof v === 'boolean')
                        display = v ? 'Yes' : 'No';
                      else if (v === undefined || v === null || v === '')
                        display = '—';
                      else display = String(v);
                      return (
                        <td
                          key={o.id + f.key}
                          className='border-border border-b p-2'
                        >
                          {display}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {/* Bottom action row for details per offer */}
                <tr>
                  <td className='border-border bg-background sticky left-0 z-10 border-b p-2 font-medium'>
                    Actions
                  </td>
                  {parsed.map((o) => (
                    <td
                      key={o.id + '-action'}
                      className='border-border border-b p-2'
                    >
                      <Button
                        size='sm'
                        variant='secondary'
                        onClick={() => {
                          setSelected(o);
                          setDetailsOpen(true);
                        }}
                      >
                        View details
                      </Button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        {/* Details dialog for a specific offer */}
        {detailsOpen && selected && (
          <OfferDetailsDialog
            open={detailsOpen}
            onClose={() => setDetailsOpen(false)}
            offer={selected as any}
            isOwner={isOwner}
            onAccepted={onAccepted}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
