'use client';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu';
import { SidePanel } from '@/components/ui/side-panel';
import { ShipmentsTable } from '@/components/ui/shipments-table';
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent
} from '@/components/ui/tooltip';
import { supabase } from '@/lib/supabaseClient';
import React from 'react';
import { SidebarTrigger } from '../ui/sidebar';
import { Breadcrumbs } from '../navigation/breadcrumbs';
import SearchInput from '../navigation/search-input';
import { UserNav } from './user-nav';
import { ModeToggle } from './ThemeToggle/theme-toggle';
import { CreateRequestDropdown } from '@/components/requests/create-request-dropdown';
import { useProfileRole } from '@/hooks/use-profile-role';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import Link from 'next/link';
import { Notifications } from './notifications';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '@/components/ui/select';

function HeaderContent() {
  const [search, setSearch] = React.useState('');
  const [viewMode, setViewMode] = React.useState<'table' | 'grid'>('grid');

  const { role } = useProfileRole();
  const [offerPanelOpen, setOfferPanelOpen] = React.useState(false);
  const [requests, setRequests] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedRequest, setSelectedRequest] = React.useState<any | null>(
    null
  );
  // Offer counts and offeredMap for ShipmentsTable
  const [offerCounts, setOfferCounts] = React.useState<Record<string, number>>(
    {}
  );
  const [offeredMap, setOfferedMap] = React.useState<Record<string, boolean>>(
    {}
  );

  // Fetch and enrich requests for the sidepanel (like shipments/page.tsx)
  const fetchRequests = React.useCallback(async (query = '') => {
    setLoading(true);
    try {
      let q = supabase.from('requests').select('*').eq('status', 'pending');
      if (query) {
        q = q.ilike('code', `%${query}%`);
      }
      const { data, error } = await q
        .order('created_at', { ascending: false })
        .limit(20);
      if (!error && data) {
        // Enrich with owner profile
        const uids = Array.from(
          new Set((data || []).map((r: any) => r.user_id).filter(Boolean))
        );
        let profMap: Record<string, any> = {};
        if (uids.length) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, username, company_name, avatar_url')
            .in('id', uids);
          for (const p of profs || []) profMap[String(p.id)] = p;
        }
        const enriched = (data || []).map((r: any) => {
          const p = r.user_id ? profMap[String(r.user_id)] : null;
          return {
            ...r,
            owner_company_name: p?.company_name ?? null,
            owner_username: p?.username ?? null,
            owner_avatar_url: p?.avatar_url ?? null
          };
        });
        setRequests(enriched);
        // Fetch offer counts
        try {
          const ids = enriched.map((r: any) => r.id);
          // getOfferCountsByRequest is imported from utils/supabase/offers in shipments/page.tsx
          // We'll use a local fetch for now (TODO: refactor to shared util)
          const { data: offers } = await supabase
            .from('offers')
            .select('request_id')
            .in('request_id', ids);
          const counts: Record<string, number> = {};
          const offered: Record<string, boolean> = {};
          for (const o of offers || []) {
            const rid = String(o.request_id);
            counts[rid] = (counts[rid] || 0) + 1;
            // TODO: mark as offered if current user is forwarder (future)
          }
          setOfferCounts(counts);
          setOfferedMap(offered);
        } catch {
          setOfferCounts({});
          setOfferedMap({});
        }
      } else {
        setRequests([]);
        setOfferCounts({});
        setOfferedMap({});
      }
    } catch {
      setRequests([]);
      setOfferCounts({});
      setOfferedMap({});
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <header className='bg-sidebar text-sidebar-foreground border-sidebar-border sticky top-0 z-40 flex w-full flex-col border-b'>
      <div className='flex h-16 shrink-0 items-center justify-between gap-2 px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12'>
        <div className='flex items-center gap-2'>
          <SidebarTrigger />
          <Breadcrumbs />
        </div>
        <div className='flex items-center gap-2'>
          <div className='hidden md:flex'>
            <SearchInput />
          </div>
          <Notifications />
          <UserNav />
          <ModeToggle />
          {role === 'forwarder' ? (
            <React.Fragment>
              <Button
                className='border-border focus:ring-ring flex items-center justify-center rounded-md border bg-black px-3 py-2 font-semibold text-white transition-colors hover:bg-gray-900 hover:text-white hover:opacity-90 focus:ring-2 focus:ring-offset-2 focus:outline-none dark:bg-white dark:text-black dark:hover:bg-gray-100 dark:hover:text-black'
                onClick={() => {
                  setOfferPanelOpen(true);
                  fetchRequests();
                }}
              >
                <span className='flex items-center gap-2'>
                  <Icons.addCircleFilled size={18} className='mr-1' />
                  Create Offer
                </span>
              </Button>
              <SidePanel
                open={offerPanelOpen}
                onClose={() => setOfferPanelOpen(false)}
                title={
                  <span className='flex items-center gap-2 text-xl font-bold'>
                    <Icons.fileDescription size={20} />
                    Create Offer
                  </span>
                }
              >
                <div className='px-2 pt-2 pb-4'>
                  <div className='mb-1 flex items-center justify-between'>
                    <div>
                      <div className='text-lg font-semibold'>Requests</div>
                      <div className='text-muted-foreground text-xs'>
                        Select a request to create a new offer
                      </div>
                    </div>
                    <Button className='flex items-center gap-1 rounded-md bg-black px-3 py-1 text-sm font-semibold text-white dark:bg-white dark:text-black'>
                      <Icons.addCircleFilled size={16} />
                      New Booking
                    </Button>
                  </div>
                  {/* Canonical ShipmentsTable for requests */}
                  <ShipmentsTable
                    data={requests}
                    loading={loading}
                    search={search}
                    onSearchChange={setSearch}
                    variant='requests'
                    offerCounts={offerCounts}
                    offeredMap={offeredMap}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    onRowClick={setSelectedRequest}
                    // TODO: Pass sortOptions to ShipmentsTable for custom sorting
                  />
                </div>
              </SidePanel>
            </React.Fragment>
          ) : role === 'shipper' || !role ? (
            <CreateRequestDropdown />
          ) : role === 'other' ? (
            <Button
              asChild
              className='border-border focus:ring-ring flex items-center justify-center rounded-md border bg-black px-3 py-2 font-semibold text-white transition-colors hover:bg-gray-900 hover:text-white hover:opacity-90 focus:ring-2 focus:ring-offset-2 focus:outline-none dark:bg-white dark:text-black dark:hover:bg-gray-100 dark:hover:text-black'
            >
              <Link href='/shipments'>
                <span className='flex items-center gap-2'>
                  <span className='flex items-center justify-center'>
                    <Icons.grid size={15} />
                  </span>
                  <span className='bg-black text-[13px] font-medium text-white dark:bg-white dark:text-black'>
                    Track Shipment
                  </span>
                </span>
              </Link>
            </Button>
          ) : role === 'carrier' ? (
            <Button
              asChild
              className='border-border focus:ring-ring flex items-center justify-center rounded-md border bg-black px-3 py-2 font-semibold text-white transition-colors hover:bg-gray-900 hover:text-white hover:opacity-90 focus:ring-2 focus:ring-offset-2 focus:outline-none dark:bg-white dark:text-black dark:hover:bg-gray-100 dark:hover:text-black'
            >
              <Link href='/shipments/active-operations'>
                <span className='flex items-center gap-2'>
                  <span className='flex items-center justify-center'>
                    <Icons.addCircleFilled size={15} />
                  </span>
                  <span className='bg-black text-[13px] font-medium text-white dark:bg-white dark:text-black'>
                    New Booking
                  </span>
                </span>
              </Link>
            </Button>
          ) : role === 'broker' ? (
            <Button
              asChild
              className='border-border focus:ring-ring flex items-center justify-center rounded-md border bg-black px-3 py-2 font-semibold text-white transition-colors hover:bg-gray-900 hover:text-white hover:opacity-90 focus:ring-2 focus:ring-offset-2 focus:outline-none dark:bg-white dark:text-black dark:hover:bg-gray-100 dark:hover:text-black'
            >
              <Link href='/shipments/incoming-requests'>
                <span className='flex items-center gap-2'>
                  <span className='flex items-center justify-center'>
                    <Icons.addCircleFilled size={15} />
                  </span>
                  <span className='bg-black text-[13px] font-medium text-white dark:bg-white dark:text-black'>
                    Create Quote
                  </span>
                </span>
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export default function Header() {
  return <HeaderContent />;
}
