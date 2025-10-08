'use client';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail
} from '@/components/ui/sidebar';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Icons } from '../icons';
import { OrgSwitcher } from '../navigation/org-switcher';
import { SettingsDialogRoot } from '@/components/settings/settings-dialog';
import { openSettingsDialog } from '@/lib/settings-dialog-events';
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer';
import { ThemeSelector } from '../navigation/theme-selector';
import * as React from 'react';
import {
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem
} from '@/components/ui/sidebar';
import { useProfileRole } from '@/hooks/use-profile-role';

export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { role } = useProfileRole();

  return (
    <Sidebar collapsible='icon'>
      <SidebarHeader>
        <OrgSwitcher />
      </SidebarHeader>
      <SidebarContent className='overflow-x-hidden'>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip='Home'
                isActive={pathname === '/'}
              >
                <Link href='/'>
                  <Icons.dashboard />
                  <span>Home</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip='Shipments'
                isActive={pathname.startsWith('/shipments')}
              >
                <Link href='/shipments'>
                  <Icons.ship />
                  <span>Shipments</span>
                </Link>
              </SidebarMenuButton>
              {role && (
                <SidebarMenuSub>
                  {role === 'shipper' && (
                    <>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          asChild
                          isActive={pathname === '/shipments/requests'}
                        >
                          <Link href='/shipments/requests'>My Requests</Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          asChild
                          isActive={pathname === '/shipments/invoices'}
                        >
                          <Link href='/shipments/invoices'>Invoices</Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          asChild
                          isActive={pathname === '/shipments/history'}
                        >
                          <Link href='/shipments/history'>History</Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </>
                  )}
                  {role === 'forwarder' && (
                    <>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          asChild
                          isActive={pathname === '/shipments/incoming-requests'}
                        >
                          <Link href='/shipments/incoming-requests'>
                            Incoming Requests
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          asChild
                          isActive={pathname === '/shipments/active-operations'}
                        >
                          <Link href='/shipments/active-operations'>
                            Active Operations
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          asChild
                          isActive={pathname === '/shipments/fleet-utilization'}
                        >
                          <Link href='/shipments/fleet-utilization'>
                            Fleet Utilization
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </>
                  )}
                  {role === 'carrier' && (
                    <>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          asChild
                          isActive={pathname === '/shipments/active-operations'}
                        >
                          <Link href='/shipments/active-operations'>
                            Active Operations
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          asChild
                          isActive={pathname === '/shipments/fleet-utilization'}
                        >
                          <Link href='/shipments/fleet-utilization'>
                            Fleet Utilization
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </>
                  )}
                  {role === 'broker' && (
                    <>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          asChild
                          isActive={pathname === '/shipments/incoming-requests'}
                        >
                          <Link href='/shipments/incoming-requests'>
                            Incoming Requests
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </>
                  )}
                  {role === 'other' && (
                    <>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          asChild
                          isActive={pathname === '/shipments'}
                        >
                          <Link href='/shipments'>All</Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </>
                  )}
                  {/* Customs Officer and Receiver are not in DB enum; map via 'other' for now if used */}
                </SidebarMenuSub>
              )}
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip='Inbox'
                isActive={pathname === '/inbox'}
              >
                <Link href='/inbox'>
                  <Icons.mail />
                  <span>Inbox</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip='Contacts'
                isActive={pathname === '/contacts'}
              >
                <Link href='/contacts'>
                  <Icons.addressBook />
                  <span>Contacts</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip='NobleSuite'
                isActive={pathname.startsWith('/noblesuite')}
              >
                <Link href='/noblesuite'>
                  <Icons.grid />
                  <span>NobleSuite</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        {/* NobleAutomate restored as separate feature (legacy placement) */}
        <SidebarGroup>
          <SidebarGroupLabel>Automation</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip='NobleAutomate'
                isActive={pathname.startsWith('/nobleautomate')}
              >
                <Link href='/nobleautomate'>
                  <Icons.robot />
                  <span>NobleAutomate</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {/* Mount settings dialog at app level */}
        <SettingsDialogRoot />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip='Feedback'
              isActive={pathname === '/feedback'}
            >
              <Link href='/feedback'>
                <Icons.chat />
                <span>Feedback</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip='settings'
              onClick={() => openSettingsDialog('profile')}
            >
              <Icons.settings />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
