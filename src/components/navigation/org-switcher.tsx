'use client';

import {
  Check,
  ChevronsUpDown,
  User,
  Truck,
  Shield,
  Inbox,
  Warehouse,
  DollarSign,
  Package
} from 'lucide-react';
import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from '@/components/ui/sidebar';

interface UserRole {
  key: string;
  name: string;
  icon: React.ReactNode;
}

// Map visible role keys to DB enum values
const roleKeyToDb: Record<
  string,
  'shipper' | 'forwarder' | 'carrier' | 'broker' | 'other'
> = {
  owner: 'shipper',
  forwarder: 'forwarder',
  customs: 'other', // not in enum yet
  receiver: 'other', // maps to receiver UX
  warehouse: 'other',
  finance: 'other',
  '3pl': 'other'
};

async function setCurrentUserRole(dbRole: string) {
  const { supabase } = await import('@/lib/supabaseClient');
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: 'NO_USER' } as const;
  const { error } = await supabase
    .from('profiles')
    .update({ role: dbRole, updated_at: new Date().toISOString() })
    .eq('id', user.id);
  if (!error) {
    // Notify listeners to refetch role-dependent UI
    window.dispatchEvent(new CustomEvent('profile-role-changed'));
  }
  return { error } as const;
}

export function OrgSwitcher() {
  const router = useRouter();
  const roles: UserRole[] = [
    { key: 'owner', name: 'Owner', icon: <User className='size-4' /> },
    { key: 'forwarder', name: 'Forwarder', icon: <Truck className='size-4' /> },
    {
      key: 'customs',
      name: 'Customs Officer',
      icon: <Shield className='size-4' />
    },
    { key: 'receiver', name: 'Receiver', icon: <Inbox className='size-4' /> },
    {
      key: 'warehouse',
      name: 'Warehouse Manager',
      icon: <Warehouse className='size-4' />
    },
    {
      key: 'finance',
      name: 'Finance Teams',
      icon: <DollarSign className='size-4' />
    },
    { key: '3pl', name: '3PL Providers', icon: <Package className='size-4' /> }
  ];

  const [selectedRole, setSelectedRole] = React.useState<UserRole>(roles[0]);

  const handleRoleSwitch = async (role: UserRole) => {
    setSelectedRole(role);
    const dbRole = roleKeyToDb[role.key] || 'other';
    const { error } = await setCurrentUserRole(dbRole);
    if (!error) {
      // Soft refresh app router to re-render RSC and client boundaries
      try {
        router.refresh();
      } catch {
        /* no-op */
      }
      // Optional: fallback hard reload if needed for client-only state
      // setTimeout(() => { if (typeof window !== 'undefined') window.location.reload(); }, 0);
    }
  };
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size='lg'
              className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
            >
              <div className='bg-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg'>
                {selectedRole.icon}
              </div>
              <div className='flex flex-col gap-0.5 leading-none'>
                <span className='font-semibold'>NobleVerse</span>
                <span className=''>{selectedRole.name}</span>
              </div>
              <ChevronsUpDown className='ml-auto' />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className='w-[--radix-dropdown-menu-trigger-width]'
            align='start'
          >
            {roles.map((role) => (
              <DropdownMenuItem
                key={role.key}
                onSelect={() => {
                  void handleRoleSwitch(role);
                }}
              >
                <span className='flex items-center gap-2'>
                  {role.icon}
                  {role.name}
                </span>
                {role.key === selectedRole.key && <Check className='ml-auto' />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
