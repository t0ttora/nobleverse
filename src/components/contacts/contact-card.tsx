'use client';
import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ContactListItem, Presence } from '@/lib/contacts';

export interface ContactCardProps {
  person: ContactListItem;
  onOpen?: (p: ContactListItem) => void;
}

function PresenceDot({ status }: { status?: Presence }) {
  const color =
    status === 'online'
      ? 'bg-green-500'
      : status === 'dnd'
        ? 'bg-red-500'
        : 'bg-gray-400';
  return (
    <span
      className={cn(
        'ring-background absolute -right-0.5 -bottom-0.5 size-2 rounded-full ring-2',
        color
      )}
    />
  );
}

export function ContactCard({ person, onOpen }: ContactCardProps) {
  // Build display name similar to user-nav (prefer first/last if present)
  const details =
    person.details && typeof person.details === 'object'
      ? (person.details as Record<string, any>)
      : {};
  const firstName: string = details.first_name ?? details.given_name ?? '';
  const lastName: string = details.last_name ?? details.family_name ?? '';
  const nameFromParts = `${firstName || ''} ${lastName || ''}`.trim();
  const name =
    nameFromParts ||
    person.display_name?.trim() ||
    '' ||
    person.username ||
    (person.email ?? '');
  const initials = name?.slice(0, 2)?.toUpperCase() || 'NV';
  const roleLabel = person.role
    ? person.role[0].toUpperCase() + person.role.slice(1)
    : 'Other';
  return (
    <button
      type='button'
      onClick={() => onOpen?.(person)}
      className='group bg-card hover:border-muted-foreground/20 focus-visible:ring-ring/50 relative flex w-full cursor-pointer items-center rounded-xl border p-3 text-left shadow-sm transition-transform duration-200 hover:-translate-y-[1px] hover:shadow-md focus-visible:ring-2 focus-visible:outline-none'
    >
      <div className='relative mr-3'>
        <Avatar className='size-12'>
          <AvatarImage
            src={person.avatar_url?.trim() ? person.avatar_url : undefined}
            alt={name}
          />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <PresenceDot status={person.presence} />
      </div>
      <div className='min-w-0 flex-1'>
        <span className='block truncate text-sm font-medium'>{name}</span>
        <div className='text-muted-foreground mt-0.5 truncate text-xs'>
          @{person.username}
        </div>
      </div>
      {person.role && (
        <Badge variant='secondary' className='ml-2 shrink-0'>
          {roleLabel}
        </Badge>
      )}
    </button>
  );
}
