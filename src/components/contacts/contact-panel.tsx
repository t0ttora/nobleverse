'use client';
import * as React from 'react';
import { SidePanel } from '@/components/ui/side-panel';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Mail,
  Phone as PhoneIcon,
  Globe,
  Clock,
  MessageCircle
} from 'lucide-react';
import type { ContactListItem } from '@/lib/contacts';

export interface ContactPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person?: ContactListItem | null;
  onContact?: (userId: string) => void;
  onMessage?: (userId: string) => void;
  relationship?: 'connected' | 'pending_out' | 'pending_in' | 'none';
  onAccept?: (requesterId: string) => void;
}

export function ContactPanel({
  open,
  onOpenChange,
  person,
  onContact,
  onMessage,
  relationship = 'none',
  onAccept
}: ContactPanelProps) {
  const name = person?.display_name || person?.username || '';
  const initials = (name || 'NV').slice(0, 2).toUpperCase();
  const details =
    person?.details && typeof person.details === 'object'
      ? (person.details as Record<string, unknown>)
      : {};
  const languages = Array.isArray((details as any).languages)
    ? ((details as any).languages as unknown[])
        .filter((x) => typeof x === 'string')
        .join(', ')
    : typeof (details as any).languages === 'string'
      ? ((details as any).languages as string)
      : '';
  const websiteRaw = person?.website?.trim() ?? '';
  const websiteHref = websiteRaw
    ? websiteRaw.startsWith('http')
      ? websiteRaw
      : `https://${websiteRaw}`
    : '';
  const lastActive = person?.last_active_at
    ? new Date(person.last_active_at).toLocaleString()
    : '-';

  return (
    <SidePanel open={open} onClose={() => onOpenChange(false)} title={name}>
      {person && (
        <>
          {/* Scaled profile header card */}
          <div className='bg-background relative overflow-hidden rounded-2xl border shadow-sm'>
            <div className='relative h-32 w-full'>
              {person.banner_url?.trim() ? (
                <img
                  src={person.banner_url}
                  alt='Banner'
                  className='h-full w-full object-cover'
                />
              ) : (
                <div className='h-full w-full bg-gradient-to-r from-[#ff3c00] via-orange-400 to-amber-300' />
              )}
            </div>

            <div className='px-4 pt-0 pb-5 sm:px-5'>
              <div className='-mt-12 flex flex-col items-center text-center'>
                <Avatar className='border-background h-20 w-20 border-4 shadow-md'>
                  <AvatarImage
                    src={
                      person.avatar_url?.trim() ? person.avatar_url : undefined
                    }
                    alt={name}
                  />
                  <AvatarFallback className='text-sm'>
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <h2 className='mt-3 text-xl leading-tight font-semibold'>
                  {name}
                </h2>
                <div className='text-muted-foreground text-sm'>
                  @{person.username}
                </div>
                <div className='text-foreground/80 mt-3 max-w-prose text-sm whitespace-pre-line'>
                  {person.bio || 'No bio provided.'}
                </div>
                {(person.location || languages) && (
                  <div className='text-muted-foreground mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm'>
                    {person.location && (
                      <span className='inline-flex items-center gap-1'>
                        <svg
                          xmlns='http://www.w3.org/2000/svg'
                          viewBox='0 0 24 24'
                          className='size-4'
                          fill='currentColor'
                        >
                          <path d='M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z' />
                        </svg>
                        {person.location}
                      </span>
                    )}
                    {person.location && languages ? (
                      <span className='opacity-60'>•</span>
                    ) : null}
                    {languages && (
                      <span className='inline-flex items-center gap-1'>
                        <svg
                          xmlns='http://www.w3.org/2000/svg'
                          viewBox='0 0 24 24'
                          className='size-4'
                          fill='currentColor'
                        >
                          <path d='M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm1 17.93V4.07A8.006 8.006 0 0 1 19.93 11H13v8.93ZM11 19.93V13H4.07A8.006 8.006 0 0 1 11 4.07v15.86Z' />
                        </svg>
                        {languages}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className='mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2'>
            <div className='bg-muted/30 rounded-lg border p-3'>
              <div className='text-muted-foreground flex items-center gap-2 text-xs'>
                <Mail className='size-3.5' />
                Email
              </div>
              <div className='mt-1 truncate text-sm'>
                {person.email ? (
                  <a
                    href={`mailto:${person.email}`}
                    className='hover:underline'
                  >
                    {person.email}
                  </a>
                ) : (
                  '-'
                )}
              </div>
            </div>
            <div className='bg-muted/30 rounded-lg border p-3'>
              <div className='text-muted-foreground flex items-center gap-2 text-xs'>
                <PhoneIcon className='size-3.5' />
                Phone
              </div>
              <div className='mt-1 truncate text-sm'>
                {person.phone ? (
                  <a href={`tel:${person.phone}`} className='hover:underline'>
                    {person.phone}
                  </a>
                ) : (
                  '-'
                )}
              </div>
            </div>
            <div className='bg-muted/30 rounded-lg border p-3'>
              <div className='text-muted-foreground flex items-center gap-2 text-xs'>
                <Globe className='size-3.5' />
                Website
              </div>
              <div className='mt-1 truncate text-sm'>
                {websiteRaw ? (
                  <a
                    href={websiteHref}
                    target='_blank'
                    rel='noreferrer noopener'
                    className='hover:underline'
                  >
                    {websiteRaw}
                  </a>
                ) : (
                  '-'
                )}
              </div>
            </div>
            <div className='bg-muted/30 rounded-lg border p-3'>
              <div className='text-muted-foreground flex items-center gap-2 text-xs'>
                <Clock className='size-3.5' />
                Last Active
              </div>
              <div className='mt-1 truncate text-sm'>{lastActive}</div>
            </div>
          </div>

          {/* Floating footer actions (bottom-right) */}
          <div className='fixed right-6 bottom-6 z-50 flex items-center gap-2'>
            <Button
              variant='outline'
              size='icon'
              className='shadow-lg'
              aria-label='Message'
              onClick={() => person && onMessage?.(person.id)}
            >
              <MessageCircle className='size-5' />
            </Button>
            {relationship === 'connected' ? (
              <Button
                size='lg'
                variant='outline'
                disabled
                className='shadow-lg'
              >
                Connected
              </Button>
            ) : relationship === 'pending_out' ? (
              <Button
                size='lg'
                variant='outline'
                disabled
                className='shadow-lg'
              >
                Waiting for Reply
              </Button>
            ) : relationship === 'pending_in' ? (
              <Button
                size='lg'
                className='shadow-lg'
                onClick={() => person && onAccept?.(person.id)}
              >
                Accept
              </Button>
            ) : (
              <Button
                size='lg'
                className='bg-orange-500 text-white shadow-lg hover:bg-orange-600'
                onClick={() => person && onContact?.(person.id)}
              >
                Connect
              </Button>
            )}
          </div>
        </>
      )}
    </SidePanel>
  );
}
