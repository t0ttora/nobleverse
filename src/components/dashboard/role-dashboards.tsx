'use client';

import React from 'react';
import { KPICards } from './kpi-cards';
import { RecentRequestsCard } from '@/components/requests/recent-requests-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabaseClient';
import { RecentOffersCard } from '@/components/offers/recent-offers-card';
import { RequestDetailsPanel } from '@/components/requests/request-details-panel';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ForwarderOfferForm } from '@/components/offers/forwarder-offer-form';

function Section({
  title,
  children
}: React.PropsWithChildren<{ title: string }>) {
  return (
    <Card className='mt-4'>
      <CardHeader>
        <CardTitle className='text-base'>{title}</CardTitle>
      </CardHeader>
      <CardContent className='pt-0'>{children}</CardContent>
    </Card>
  );
}

export function ShipperDashboard({ userId }: { userId: string }) {
  return (
    <>
      <KPICards
        items={[
          {
            label: 'Total Spend',
            value: '$12,450',
            trend: 'up',
            note: 'This month vs last'
          },
          { label: 'Shipments in Transit', value: '8', trend: 'flat' },
          { label: 'On-Time Delivery Rate', value: '96%', trend: 'up' },
          { label: 'Claims / Issues', value: '2', trend: 'down' }
        ]}
      />
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
        {/* Left column: Recent Requests card */}
        <div className='flex flex-col gap-2'>
          <RecentRequestsCard userId={userId} />
        </div>
        {/* Right column: Invoices & Favorites */}
        <div className='flex flex-col gap-4'>
          <Section title='Invoices & Payments'>
            <div className='text-muted-foreground text-sm'>Coming soon</div>
          </Section>
          <Section title='Favorite Forwarders / Routes'>
            <div className='text-muted-foreground text-sm'>Coming soon</div>
          </Section>
        </div>
      </div>
    </>
  );
}

export function ForwarderDashboard() {
  const [me, setMe] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [req, setReq] = React.useState<any | null>(null);
  // Restore state for requests modal (for incoming requests section)
  const [offerModalOpen, setOfferModalOpen] = React.useState(false);
  const [requests, setRequests] = React.useState<any[]>([]);
  const [search, setSearch] = React.useState('');
  const [loadingRequests, setLoadingRequests] = React.useState(false);
  const [selectedRequest, setSelectedRequest] = React.useState<any | null>(
    null
  );
  const [offerFormOpen, setOfferFormOpen] = React.useState(false);

  return (
    <>
      <KPICards
        items={[
          { label: 'Active Shipments', value: '23', trend: 'up' },
          {
            label: 'Quotes Sent vs. Accepted',
            value: '58% acceptance',
            trend: 'up'
          },
          {
            label: 'Fleet / Container Utilization',
            value: '74%',
            trend: 'flat'
          },
          { label: 'Revenue per Shipment', value: '$1,240', trend: 'up' }
        ]}
      />
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
        <Section title='Incoming Requests'>
          {/* Only remove the New Offer button from here, keep the rest */}
          {/* ...existing code for listing requests, if any, remains here... */}
        </Section>
        <div className='flex flex-col gap-4'>
          <Section title='Recent Offers'>
            <RecentOffersCard
              forwarderId={me}
              onOpenRequest={(r) => {
                setReq(r);
                setOpen(true);
              }}
            />
          </Section>
          <Section title='Driver / Partner Assignment'>
            <div className='text-muted-foreground text-sm'>Coming soon</div>
          </Section>
        </div>
      </div>
      <RequestDetailsPanel
        open={open}
        onClose={() => setOpen(false)}
        request={req}
      />
      {/* Restore modal logic for incoming requests if needed */}
      {/* ...existing code for modal and offer form, if any, can be restored here... */}
    </>
  );
}

export function CustomsOfficerDashboard() {
  return (
    <>
      <KPICards
        items={[
          { label: 'Pending Clearances', value: '12', trend: 'flat' },
          { label: 'Avg. Processing Time', value: '6h 20m', trend: 'down' },
          { label: 'Compliance Issues', value: '3', trend: 'down' },
          { label: 'Cleared Shipments', value: '58', trend: 'up' }
        ]}
      />
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
        <Section title='Document Verification Queue'>
          <div className='text-muted-foreground text-sm'>Coming soon</div>
        </Section>
        <div className='flex flex-col gap-4'>
          <Section title='Alerts / Suspicious Items'>
            <div className='text-muted-foreground text-sm'>Coming soon</div>
          </Section>
          <Section title='Tariff Rules & Communication'>
            <div className='text-muted-foreground text-sm'>Coming soon</div>
          </Section>
        </div>
      </div>
    </>
  );
}

export function ReceiverDashboard() {
  return (
    <>
      <KPICards
        items={[
          { label: 'Incoming Shipments', value: '6', trend: 'flat' },
          {
            label: 'Estimated Arrival Time',
            value: 'Avg. 3d 4h',
            trend: 'down'
          },
          { label: 'Delivery Accuracy Rate', value: '98%', trend: 'up' },
          { label: 'Claims Filed / Resolved', value: '1 / 1', trend: 'up' }
        ]}
      />
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
        <Section title='Shipment Tracking Timeline'>
          <div className='text-muted-foreground text-sm'>Coming soon</div>
        </Section>
        <div className='flex flex-col gap-4'>
          <Section title='Delivery Instructions / Address Mgmt'>
            <div className='text-muted-foreground text-sm'>Coming soon</div>
          </Section>
          <Section title='Support Requests & Past Deliveries'>
            <div className='text-muted-foreground text-sm'>Coming soon</div>
          </Section>
        </div>
      </div>
    </>
  );
}
