'use client';

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

function HeaderContent() {
  const { role } = useProfileRole();
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
                    Create Quote / New Booking
                  </span>
                </span>
              </Link>
            </Button>
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
