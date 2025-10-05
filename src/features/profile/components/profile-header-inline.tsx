'use client';

import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EditableText } from './editable';
import { Role } from '@/types/profile';
import { Settings } from 'lucide-react';
import Link from 'next/link';
import { openSettingsDialog } from '@/lib/settings-dialog-events';

type Props = {
  profile: any;
  displayName: string;
  username: string;
};

export default function ProfileHeaderInline({
  profile,
  displayName,
  username
}: Props) {
  const [state, setState] = useState(profile);

  async function save(patch: any) {
    const res = await fetch('/api/profile/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
    if (!res.ok) return;
    const data = await res.json();
    setState((prev: any) => ({ ...prev, ...data.profile }));
  }

  const first = state.details?.first_name || state.first_name || '';
  const last = state.details?.last_name || state.last_name || '';

  return (
    <div className='p-4 pb-0 sm:p-6'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
        <div className='flex items-center gap-4'>
          <div className='-mt-12'>
            <Avatar className='border-background h-20 w-20 border-4 shadow-md'>
              <AvatarImage
                src={state.avatar_url || undefined}
                alt={displayName}
              />
              <AvatarFallback>
                {(displayName?.[0] || username?.[0] || 'U').toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
          <div>
            <div className='flex flex-wrap items-center gap-2'>
              <h1 className='text-2xl leading-tight font-semibold'>
                <EditableText
                  value={`${first} ${last}`.trim()}
                  placeholder='Full name'
                  className='text-2xl font-semibold'
                  onSave={async (v) => {
                    const [f, ...rest] = v.split(' ');
                    const l = rest.join(' ');
                    await save({
                      first_name: f,
                      last_name: l,
                      details: {
                        ...(state.details || {}),
                        first_name: f,
                        last_name: l
                      }
                    });
                  }}
                />
              </h1>
              {state.details?.verified && (
                <span className='inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700'>
                  ✔ Verified
                </span>
              )}
            </div>
            <div className='text-muted-foreground flex flex-wrap items-center gap-2 text-sm'>
              <span>@{username}</span>
              <span className='hidden sm:inline'>•</span>
              <EditableText
                value={state.location || ''}
                placeholder='Location'
                onSave={(v) => save({ location: v })}
              />
            </div>
            <div className='mt-2 flex flex-wrap items-center gap-2'>
              <span className='text-muted-foreground text-xs'>
                Current role
              </span>
              <EditableText
                value={state.role || ''}
                placeholder='role'
                onSave={(v) => save({ role: v as Role })}
                className='bg-muted/50 rounded-full border px-2 py-0.5 text-xs'
              />
            </div>
          </div>
        </div>

        <div className='flex items-center gap-2'>
          <Button size='sm' className='gap-2' asChild>
            <Link href={`/profile/${username}`}>View public</Link>
          </Button>
          <Button
            size='sm'
            variant='outline'
            className='gap-2'
            onClick={() => openSettingsDialog('profile')}
          >
            <Settings className='h-4 w-4' /> Settings
          </Button>
        </div>
      </div>

      {/* Skills chips editable placeholder in future */}
    </div>
  );
}
