'use client';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
// import { ShipmentsTable } from '@/components/ui/shipments-table';
import { SidePanel } from '@/components/ui/side-panel';
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent
} from '@/components/ui/tooltip';
import { supabase } from '@/lib/supabaseClient';
import React from 'react';
// Removed SidebarTrigger & Breadcrumbs in favor of Notion-like history nav
import { SidebarTrigger } from '../ui/sidebar';
// import { Breadcrumbs } from '../navigation/breadcrumbs';
import SearchInput from '../navigation/search-input';
import { UserNav } from './user-nav';
import { ModeToggle } from './ThemeToggle/theme-toggle';
import { CreateRequestDropdown } from '@/components/requests/create-request-dropdown';
import { MultiStepFreightForm } from '@/components/ui/multi-step-freight-form';
// SidePanel already imported above
import { RequestBrowser } from '@/components/requests/request-browser';
import { RequestDetailsPanel } from '@/components/requests/request-details-panel';
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
import type { FreightFormType } from '@/lib/freight-form-schema';
import { HistoryNavButtons } from './history-nav-buttons';
import TabsBar, { ColoredIcon } from './tabs-bar';
import { useTabs } from './tabs-context';

function HeaderContent() {
  const { activateNone, activeTabId, openTab } = useTabs();
  const [search, setSearch] = React.useState('');
  const [viewMode, setViewMode] = React.useState<'table' | 'grid'>('grid');
  const [currentUserId, setCurrentUserId] = React.useState<string>('');

  const { role } = useProfileRole();
  // Unified create flow panel
  const [createPanelOpen, setCreatePanelOpen] = React.useState(false);
  const [createMode, setCreateMode] = React.useState<'browse' | 'booking'>(
    'browse'
  );
  const [selectedRequest, setSelectedRequest] = React.useState<any | null>(
    null
  );
  const [bookingType, setBookingType] = React.useState<FreightFormType | null>(
    null
  );

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data?.user?.id || '');
    });
  }, []);

  return (
    <header className='bg-sidebar text-sidebar-foreground sticky top-0 z-40 flex w-full flex-col'>
      <div className='flex h-16 shrink-0 items-center justify-between gap-2 px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12'>
        <div className='flex items-center gap-1'>
          {/* Mobile: sidebar trigger */}
          <div className='md:hidden'>
            <SidebarTrigger />
          </div>
          {/* Desktop: history navigation */}
          <div className='hidden items-center gap-2 md:flex'>
            <HistoryNavButtons />
            {/* Home button to exit tab view */}
            <div className='relative -mr-2 flex items-center gap-1'>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                aria-label='Home'
                onClick={() => activateNone()}
                className='text-muted-foreground hover:text-foreground data-[active=true]:bg-muted/60 data-[active=true]:ring-border data-[active=true]:text-foreground h-7 w-7 rounded-sm data-[active=true]:ring-1'
                data-active={String(activeTabId === null)}
              >
                <Icons.home size={16} />
              </Button>
            </div>
            <div className='bg-border/80 mx-2 h-5 w-px' />
            {/* Tabs + New grouped for tighter inner spacing */}
            <div className='-ml-2 flex items-center gap-1'>
              <TabsBar className='ml-0' />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    aria-label='New'
                    className='text-muted-foreground hover:text-foreground h-7 w-7 rounded-sm'
                  >
                    <Icons.add size={16} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align='start'
                  side='bottom'
                  className='w-52'
                >
                  <DropdownMenuItem
                    onSelect={() => {
                      openTab({
                        kind: 'cells',
                        title: 'Untitled Cells',
                        icon: Icons.sheet
                      });
                    }}
                    className='flex items-center gap-2'
                  >
                    <ColoredIcon
                      icon={Icons.sheet}
                      kind='cells'
                      className='size-4'
                    />
                    <span>New Cells</span>
                    <span className='text-muted-foreground ml-auto text-xs'>
                      C
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      openTab({
                        kind: 'docs',
                        title: 'Untitled Doc',
                        icon: Icons.doc
                      });
                    }}
                    className='flex items-center gap-2'
                  >
                    <ColoredIcon
                      icon={Icons.doc}
                      kind='docs'
                      className='size-4'
                    />
                    <span>New Document</span>
                    <span className='text-muted-foreground ml-auto text-xs'>
                      D
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className='text-muted-foreground text-xs font-medium'>
                    More
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    disabled
                    className='flex items-center gap-2'
                  >
                    <Icons.apps className='text-foreground/80 size-4' />
                    <span>Browse Templates</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled
                    className='flex items-center gap-2'
                  >
                    <Icons.folder className='text-foreground/80 size-4' />
                    <span>New Folder</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled
                    className='flex items-center gap-2'
                  >
                    <Icons.download className='text-foreground/80 size-4' />
                    <span>Import…</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
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
                  setCreatePanelOpen(true);
                  setCreateMode('browse');
                  setBookingType(null);
                }}
              >
                <span className='flex items-center gap-2'>
                  <Icons.addCircleFilled size={18} className='mr-1' />
                  Create offer
                </span>
              </Button>
              <SidePanel
                open={createPanelOpen}
                onClose={() => setCreatePanelOpen(false)}
                title={
                  <div className='flex items-center gap-2'>
                    <span className='flex items-center gap-2 text-xl font-bold'>
                      <Icons.fileDescription size={20} />
                      Create offer
                    </span>
                    <div className='text-muted-foreground ml-2 flex items-center gap-1 text-sm'>
                      <span>or</span>
                      <TooltipProvider delayDuration={150}>
                        <Tooltip>
                          <DropdownMenu>
                            <TooltipTrigger asChild>
                              <DropdownMenuTrigger asChild>
                                <button
                                  className='text-foreground font-medium underline-offset-4 hover:underline'
                                  onClick={(e) => e.preventDefault()}
                                >
                                  New booking
                                </button>
                              </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent>
                              Bring your existing request.
                            </TooltipContent>
                            <DropdownMenuContent align='end'>
                              <DropdownMenuLabel>
                                Freight type
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  setBookingType('road');
                                  setCreateMode('booking');
                                  setCreatePanelOpen(true);
                                }}
                              >
                                <Icons.road className='mr-2 h-4 w-4' /> Road
                                Freight
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setBookingType('sea');
                                  setCreateMode('booking');
                                  setCreatePanelOpen(true);
                                }}
                              >
                                <Icons.sea className='mr-2 h-4 w-4' /> Sea
                                Freight
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setBookingType('air');
                                  setCreateMode('booking');
                                  setCreatePanelOpen(true);
                                }}
                              >
                                <Icons.air className='mr-2 h-4 w-4' /> Air
                                Freight
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setBookingType('rail');
                                  setCreateMode('booking');
                                  setCreatePanelOpen(true);
                                }}
                              >
                                <Icons.rail className='mr-2 h-4 w-4' /> Rail
                                Freight
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setBookingType('multimodal');
                                  setCreateMode('booking');
                                  setCreatePanelOpen(true);
                                }}
                              >
                                <Icons.multimodal className='mr-2 h-4 w-4' />{' '}
                                Multimodal Freight
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setBookingType('courier');
                                  setCreateMode('booking');
                                  setCreatePanelOpen(true);
                                }}
                              >
                                <Icons.courier className='mr-2 h-4 w-4' />{' '}
                                Courier / Express
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                }
              >
                <div className='px-1 pt-2 pb-4'>
                  {createMode === 'browse' ? (
                    <RequestBrowser
                      forwarderId={currentUserId}
                      onSelect={(row) => setSelectedRequest(row)}
                    />
                  ) : (
                    <MultiStepFreightForm
                      allowTypeSelection={!bookingType}
                      type={bookingType || undefined}
                      userId={currentUserId}
                      mode='booking'
                      onSuccess={() => setCreatePanelOpen(false)}
                    />
                  )}
                </div>
              </SidePanel>
              {/* Nested details panel for picked request */}
              <RequestDetailsPanel
                open={!!selectedRequest}
                onClose={() => setSelectedRequest(null)}
                request={selectedRequest}
              />
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
