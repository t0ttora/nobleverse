'use client';
import * as React from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Copy, Mail, Plus, X } from 'lucide-react';
import { supabase } from '@/../utils/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';

type Person = {
  id: string;
  username: string;
  display_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
};

export function TeamInviteMenu() {
  const [open, setOpen] = React.useState(false);
  const [shareUrl, setShareUrl] = React.useState<string>('');
  const [email, setEmail] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<Person[]>([]);
  const [members, setMembers] = React.useState<Person[]>([]);
  const [searchFocused, setSearchFocused] = React.useState(false);

  // Build a share URL from current origin
  React.useEffect(() => {
    try {
      const base = window.location.origin;
      setShareUrl(`${base}/invite/team`);
    } catch {
      // ignore SSR errors
    }
  }, []);

  React.useEffect(() => {
    let active = true;
    const run = async () => {
      const s = query.trim();
      if (s.length < 1) {
        setResults([]);
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('id,username,display_name,email,avatar_url')
        .or(
          `username.ilike.%${s}%,display_name.ilike.%${s}%,email.ilike.%${s}%`
        )
        .limit(10);
      if (active) setResults((data as any) ?? []);
    };
    void run();
    return () => {
      active = false;
    };
  }, [query]);

  const addMember = (p: Person) => {
    setMembers((prev) =>
      prev.find((x) => x.id === p.id) ? prev : [...prev, p]
    );
    toast.success(`${p.display_name || p.username} added`);
  };
  const removeMember = (id: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied');
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='default'
          className='inline-flex items-center justify-center gap-2'
        >
          <Users className='size-4' />
          <span>Invite your Team</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-[420px] p-0'>
        <div className='space-y-4 p-4'>
          {/* Link to share */}
          <div className='space-y-2'>
            <div className='text-muted-foreground text-xs'>Link to Share</div>
            <div className='flex items-center gap-2'>
              <Input value={shareUrl} readOnly className='h-9' />
              <Button size='sm' variant='outline' onClick={copy}>
                <Copy className='size-4' />
              </Button>
            </div>
          </div>

          {/* Email */}
          <div className='space-y-2'>
            <div className='text-muted-foreground text-xs'>Email</div>
            <div className='flex items-center gap-2'>
              <div className='relative flex-1'>
                <Mail className='text-muted-foreground absolute top-1/2 left-2 size-4 -translate-y-1/2' />
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder='johndoe@gmail.com'
                  className='h-9 pl-8'
                />
              </div>
              <Button
                size='sm'
                onClick={() => {
                  if (email.trim()) {
                    toast.success('Invite sent');
                    setEmail('');
                  }
                }}
              >
                Send Invite
              </Button>
            </div>
          </div>

          {/* Search and pick people (chips + dropdown) */}
          <div className='space-y-2'>
            <div className='text-muted-foreground text-xs'>Find teammates</div>
            <div className='relative'>
              <div
                className='bg-background focus-within:ring-ring flex min-h-10 flex-wrap items-center gap-2 rounded-md border px-2 py-1 focus-within:ring-2'
                onClick={() => {
                  const el = document.getElementById('team-invite-input');
                  el?.focus();
                }}
              >
                {members.map((m) => (
                  <span
                    key={m.id}
                    className='bg-muted inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs'
                  >
                    <span className='max-w-[160px] truncate'>
                      {m.display_name || m.username}
                    </span>
                    <button
                      type='button'
                      className='hover:bg-muted-foreground/10 rounded-full p-0.5'
                      onClick={(e) => {
                        e.stopPropagation();
                        removeMember(m.id);
                      }}
                      aria-label={`Remove ${m.display_name || m.username}`}
                    >
                      <X className='size-3.5' />
                    </button>
                  </span>
                ))}
                <input
                  id='team-invite-input'
                  placeholder='Search profiles...'
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 100)}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !query && members.length) {
                      removeMember(members[members.length - 1].id);
                    }
                  }}
                  className='placeholder:text-muted-foreground/70 h-8 min-w-[140px] flex-1 bg-transparent text-sm outline-none'
                />
              </div>
              {searchFocused && query.trim().length > 0 && (
                <div className='bg-popover absolute z-50 mt-2 w-full rounded-md border shadow-md'>
                  <div className='max-h-60 overflow-auto py-1'>
                    {results
                      .filter((p) => !members.some((m) => m.id === p.id))
                      .map((p) => (
                        <button
                          type='button'
                          key={p.id}
                          className='hover:bg-accent flex w-full items-center gap-2 px-2 py-2 text-left'
                          onMouseDown={(e) => {
                            e.preventDefault();
                            addMember(p);
                            setQuery('');
                          }}
                        >
                          <Avatar className='size-6'>
                            <AvatarImage src={p.avatar_url || undefined} />
                            <AvatarFallback>
                              {(p.display_name || p.username)
                                .slice(0, 2)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className='min-w-0 flex-1'>
                            <div className='truncate text-sm'>
                              {p.display_name || p.username}
                            </div>
                            <div className='text-muted-foreground truncate text-xs'>
                              @{p.username}
                            </div>
                          </div>
                          <Plus className='size-4 opacity-70' />
                        </button>
                      ))}
                    {query.trim().length > 0 &&
                      results.filter((p) => !members.some((m) => m.id === p.id))
                        .length === 0 && (
                        <div className='text-muted-foreground px-3 py-2 text-sm'>
                          No results.
                        </div>
                      )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Member List */}
          <div className='space-y-2'>
            <div className='text-muted-foreground text-xs'>Member List</div>
            <div className='max-h-52 divide-y overflow-auto rounded-md border'>
              {members.length === 0 ? (
                <div className='text-muted-foreground p-4 text-sm'>
                  No members yet.
                </div>
              ) : (
                members.map((m) => (
                  <div key={m.id} className='flex items-center gap-3 p-3'>
                    <Avatar className='size-8'>
                      <AvatarImage src={m.avatar_url || undefined} />
                      <AvatarFallback>
                        {(m.display_name || m.username)
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className='min-w-0 flex-1'>
                      <div className='truncate text-sm'>
                        {m.display_name || m.username}
                      </div>
                      <div className='text-muted-foreground truncate text-xs'>
                        {m.email || ''}
                      </div>
                    </div>
                    <div className='text-muted-foreground text-xs'>
                      Can View
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
