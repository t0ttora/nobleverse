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
import { SidePanel } from '@/components/ui/side-panel';
// import { ShipmentsTable } from '@/components/ui/shipments-table';
import { RequestBrowser } from '@/components/requests/request-browser';
import {
  useForwarderDashboard,
  useReceiverDashboard,
  useShipperDashboard
} from '@/features/dashboard/hooks';
import type { KpiComputed } from '@/features/dashboard/compute';
import { KpiDetailsPanel } from './kpi-details-panel';

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
  const { kpis, loading } = useShipperDashboard(userId);
  const [kpiOpen, setKpiOpen] = React.useState(false);
  const [activeKpi, setActiveKpi] = React.useState<KpiComputed | null>(null);
  return (
    <>
      <KPICards
        loading={loading}
        items={kpis.map((k) => ({
          label: k.label,
          value: k.key === 'delivery_rate' ? `${k.value}%` : k.value,
          trend: k.trend,
          note: k.note,
          deltaPct: k.deltaPct,
          onClick: () => {
            setActiveKpi(k);
            setKpiOpen(true);
          }
        }))}
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
      <KpiDetailsPanel
        open={kpiOpen}
        onClose={() => setKpiOpen(false)}
        kpi={activeKpi}
      />
    </>
  );
}

export function ForwarderDashboard() {
  const [me, setMe] = React.useState('');
  const { kpis, loading } = useForwarderDashboard(me);
  const [kpiOpen, setKpiOpen] = React.useState(false);
  const [activeKpi, setActiveKpi] = React.useState<KpiComputed | null>(null);
  const [open, setOpen] = React.useState(false);
  const [req, setReq] = React.useState<any | null>(null);
  // Restore state for requests modal (for incoming requests section)
  const [offerModalOpen, setOfferModalOpen] = React.useState(false);
  // const [requests, setRequests] = React.useState<any[]>([]);
  // const [search, setSearch] = React.useState('');
  // const [loadingRequests, setLoadingRequests] = React.useState(false);
  const [selectedRequest, setSelectedRequest] = React.useState<any | null>(
    null
  );
  const [offerFormOpen, setOfferFormOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id || ''));
  }, []);
  // Legacy fetching replaced by RequestBrowser

  return (
    <>
      <KPICards
        loading={loading}
        items={kpis.map((k) => ({
          label: k.label,
          value: k.key === 'acceptance_rate' ? `${k.value}%` : k.value,
          trend: k.trend,
          note: k.note,
          deltaPct: k.deltaPct,
          onClick: () => {
            setActiveKpi(k);
            setKpiOpen(true);
          }
        }))}
      />
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
        <Section title='Incoming Requests'>
          <div className='mb-2 flex items-center justify-between gap-2'>
            <div className='text-muted-foreground text-xs'>
              Browse new requests to make offers.
            </div>
            <Button
              size='sm'
              onClick={() => setCreateOpen(true)}
              className='bg-black text-white hover:bg-gray-900 dark:bg-white dark:text-black dark:hover:bg-gray-100'
            >
              Create Request
            </Button>
          </div>
          <RequestBrowser
            forwarderId={me}
            onSelect={(row) => {
              setReq(row);
              setOpen(true);
            }}
          />
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
      {/* Create Request flow sidepanel for forwarder */}
      <SidePanel
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={<span className='font-bold'>Create Request</span>}
      >
        <RequestBrowser
          forwarderId={me}
          onSelect={(row) => {
            setReq(row);
            setOpen(true);
          }}
        />
      </SidePanel>
      <KpiDetailsPanel
        open={kpiOpen}
        onClose={() => setKpiOpen(false)}
        kpi={activeKpi}
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
  const [me, setMe] = React.useState('');
  const { kpis, loading } = useReceiverDashboard(me);
  const [kpiOpen, setKpiOpen] = React.useState(false);
  const [activeKpi, setActiveKpi] = React.useState<KpiComputed | null>(null);
  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id || ''));
  }, []);
  return (
    <>
      <KPICards
        loading={loading}
        items={kpis.map((k) => ({
          label: k.label,
          value: k.key?.includes('accuracy') ? `${k.value}%` : k.value,
          trend: k.trend,
          note: k.note,
          deltaPct: k.deltaPct,
          onClick: () => {
            setActiveKpi(k);
            setKpiOpen(true);
          }
        }))}
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
      <KpiDetailsPanel
        open={kpiOpen}
        onClose={() => setKpiOpen(false)}
        kpi={activeKpi}
      />
    </>
  );
}
