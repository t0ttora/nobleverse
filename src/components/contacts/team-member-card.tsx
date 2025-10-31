'use client';
import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ContactListItem, Presence } from '@/lib/contacts';
import {
  MessageCircle,
  CheckSquare,
  Calendar,
  Package,
  FilePlus,
  Clock3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';

export interface TeamMemberCardProps {
  person: ContactListItem;
  onOpen?: (p: ContactListItem) => void;
  onMessage?: (userId: string) => void;
  selected?: boolean;
  onToggleSelect?: (userId: string) => void;
  onAssignTask?: (userId: string) => void;
  onAssignEvent?: (userId: string) => void;
  onAssignShipment?: (userId: string) => void;
  onAssignRequest?: (userId: string) => void;
  onChangeRole?: (userId: string, role: 'Admin' | 'Member' | 'Viewer') => void;
  onAddTag?: (userId: string) => void;
  onAddDepartment?: (userId: string) => void;
  onStartThread?: (userId: string) => void;
  onShareDoc?: (userId: string) => void;
  onMention?: (userId: string) => void;
  onMentionInInbox?: (userId: string) => void;
  labels?: { tags?: string[]; departments?: string[] };
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

export function TeamMemberCard({
  person,
  onOpen,
  onMessage,
  selected,
  onToggleSelect,
  onAssignTask,
  onAssignEvent,
  onAssignShipment,
  onAssignRequest,
  onChangeRole,
  onAddTag,
  onAddDepartment,
  onStartThread,
  onShareDoc,
  onMention,
  onMentionInInbox,
  labels
}: TeamMemberCardProps) {
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
    person.username ||
    (person.email ?? '');
  const initials = name?.slice(0, 2)?.toUpperCase() || 'NV';
  const roleLabel = person.role
    ? person.role[0].toUpperCase() + person.role.slice(1)
    : 'Member';
  const location = person.location?.trim() || undefined;
  const lastActive = person.last_active_at
    ? new Date(person.last_active_at)
    : null;
  const lastActiveLabel = React.useMemo(() => {
    if (!lastActive) return null;
    const diff = Date.now() - lastActive.getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'now';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    return `${d}d`;
  }, [lastActive]);

  return (
    <div className='group bg-card focus-visible:ring-ring/50 hover:bg-muted/20 relative flex h-full w-full flex-col rounded-xl border p-3 text-left shadow-sm transition-colors duration-150 focus-visible:outline-none'>
      {/* Hover select checkbox (top-left, circular) */}
      <button
        type='button'
        aria-label='Select member'
        onClick={() => onToggleSelect?.(person.id)}
        className={cn(
          'bg-background/80 absolute top-2 left-2 z-10 size-6 rounded-full border text-xs opacity-0 shadow-sm transition-opacity group-hover:opacity-100',
          selected && 'border-orange-500 bg-orange-500 text-white opacity-100'
        )}
      >
        {selected ? '✓' : ''}
      </button>
      {/* More menu (top-right on hover) */}
      <div className='absolute top-2 right-2 z-10 opacity-0 transition-opacity group-hover:opacity-100'>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' size='icon' className='h-7 w-7'>
              <MoreHorizontal className='size-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuItem onClick={() => onStartThread?.(person.id)}>
              Start thread
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onShareDoc?.(person.id)}>
              Share doc
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMention?.(person.id)}>
              Mention
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMentionInInbox?.(person.id)}>
              Mention in Inbox
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {/* Header (avatar + name) */}
      <div className='flex flex-1 flex-col items-center text-center'>
        <div className='relative'>
          <Avatar className='size-14'>
            <AvatarImage
              src={person.avatar_url?.trim() ? person.avatar_url : undefined}
              alt={name}
            />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <span className='absolute -right-0.5 -bottom-0.5'>
            <PresenceDot status={person.presence} />
          </span>
        </div>
        <div className='mt-2 w-full'>
          <div className='truncate text-sm font-medium'>{name}</div>
          <div className='text-muted-foreground mt-0.5 truncate text-xs'>
            @{person.username}
          </div>
        </div>
        {/* Role badge (display-only) */}
        {roleLabel && (
          <div className='bg-muted text-muted-foreground mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] tracking-wide uppercase'>
            {roleLabel}
          </div>
        )}
        {/* Meta */}
        <div className='text-muted-foreground mt-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-xs'>
          {location && <span>{location}</span>}
          {lastActive && (
            <span
              className='inline-flex items-center gap-1'
              title={lastActive.toLocaleString()}
            >
              <Clock3 className='size-3.5 opacity-80' />
              <span>{lastActiveLabel}</span>
            </span>
          )}
        </div>
        {person.bio && (
          <div className='text-muted-foreground mt-2 line-clamp-2 text-[12px] leading-5'>
            {person.bio}
          </div>
        )}
        {/* Labels chips */}
        {labels?.tags?.length || labels?.departments?.length ? (
          <div className='mt-2 flex flex-wrap items-center justify-center gap-1'>
            {(labels?.tags || []).slice(0, 3).map((t) => (
              <span
                key={t}
                className='bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-[10px]'
              >
                {t}
              </span>
            ))}
            {(labels?.departments || []).slice(0, 2).map((d) => (
              <span
                key={d}
                className='bg-muted rounded-full px-2 py-0.5 text-[10px]'
              >
                {d}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      {/* Footer */}
      <div className='mt-3 grid grid-cols-2 items-center gap-2 sm:flex sm:justify-between'>
        <div className='flex items-center gap-3'>
          <button
            type='button'
            className='text-muted-foreground text-xs hover:underline'
            onClick={() => onAddTag?.(person.id)}
          >
            + Tags
          </button>
          <button
            type='button'
            className='text-muted-foreground text-xs hover:underline'
            onClick={() => onAddDepartment?.(person.id)}
          >
            + Dept
          </button>
        </div>
        <div className='flex items-center justify-end gap-2 sm:justify-start'>
          <Button
            variant='outline'
            size='sm'
            className='h-8 gap-1'
            onClick={() => onMessage?.(person.id)}
            aria-label='Message'
          >
            <MessageCircle className='size-4' /> Message
          </Button>
          <AssignMenu
            onTask={() => onAssignTask?.(person.id)}
            onEvent={() => onAssignEvent?.(person.id)}
            onShipment={() => onAssignShipment?.(person.id)}
            onRequest={() => onAssignRequest?.(person.id)}
          />
          <Button
            variant='ghost'
            size='sm'
            className='h-8'
            onClick={() => onOpen?.(person)}
            aria-label='View profile'
          >
            View
          </Button>
        </div>
      </div>
    </div>
  );
}

function AssignMenu({
  onTask,
  onEvent,
  onShipment,
  onRequest
}: {
  onTask?: () => void;
  onEvent?: () => void;
  onShipment?: () => void;
  onRequest?: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          size='sm'
          className='h-8 gap-1'
          aria-label='Assign'
        >
          <CheckSquare className='size-4' /> Assign
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <DropdownMenuItem onClick={onTask} className='gap-2'>
          <CheckSquare className='size-4' /> Task
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onEvent} className='gap-2'>
          <Calendar className='size-4' /> Event
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onShipment} className='gap-2'>
          <Package className='size-4' /> Shipment
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onRequest} className='gap-2'>
          <FilePlus className='size-4' /> Request
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
