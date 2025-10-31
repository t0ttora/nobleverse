'use client';
import * as React from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Copy, Mail, Plus, X, MessagesSquare } from 'lucide-react';
import { supabase } from '@/../utils/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useRouter } from 'next/navigation';

type Person = {
  id: string;
  username: string;
  display_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
};

export function TeamInviteMenu() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [shareUrl, setShareUrl] = React.useState<string>('');
  const [email, setEmail] = React.useState('');
  const [inviteRole, setInviteRole] = React.useState<
    'Admin' | 'Member' | 'Viewer'
  >('Member');
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<Person[]>([]);
  const [members, setMembers] = React.useState<Person[]>([]);
  const [searchFocused, setSearchFocused] = React.useState(false);
  const [me, setMe] = React.useState<{
    id: string;
    email?: string | null;
  } | null>(null);
  const [showQR, setShowQR] = React.useState(false);

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
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      const uid = data.user?.id ?? null;
      const em = data.user?.email ?? null;
      setMe(uid ? { id: uid, email: em } : null);
    });
    return () => {
      alive = false;
    };
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

  async function createGroupChat() {
    try {
      if (!me?.id) {
        toast.error('Please sign in');
        return;
      }
      const ids = Array.from(new Set([me.id, ...members.map((m) => m.id)]));
      if (ids.length < 2) {
        toast.error('Select at least one teammate');
        return;
      }
      const { data: rid, error } = await supabase.rpc('create_group_room', {
        p_title: null,
        p_member_ids: ids
      });
      if (error || !rid) {
        toast.error(error?.message || 'Could not create group');
        return;
      }
      toast.success('Group created');
      setOpen(false);
      router.push(`/inbox?room=${rid as string}`);
    } catch (e: any) {
      toast.error('Action failed', { description: e?.message });
    }
  }

  async function persistEmailInvite() {
    const e = email.trim();
    if (!e) return;
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
    if (!emailOk) {
      toast.error('Enter a valid email');
      return;
    }
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) {
        toast.error('Please sign in');
        return;
      }
      // Load current settings to append invite inside org.team.invites
      const { data: st } = await supabase
        .from('settings')
        .select('org')
        .eq('user_id', uid)
        .maybeSingle();
      const org =
        (st?.org && typeof st.org === 'object' ? (st.org as any) : {}) || {};
      const team =
        (org.team && typeof org.team === 'object' ? (org.team as any) : {}) ||
        {};
      const invites = Array.isArray(team.invites) ? team.invites : [];
      const already = invites.some(
        (iv: any) =>
          String(iv.email || '').toLowerCase() === e.toLowerCase() &&
          iv.status === 'pending'
      );
      if (already) {
        toast.error('Already invited');
        return;
      }
      const newInvites = [
        ...invites,
        {
          email: e,
          role: inviteRole,
          invited_at: new Date().toISOString(),
          status: 'pending'
        }
      ];
      const nextOrg = {
        ...org,
        team: { ...(team || {}), invites: newInvites }
      };
      await supabase.from('settings').upsert({ user_id: uid, org: nextOrg });
      toast.success('Invite added');
      setEmail('');
    } catch (err: any) {
      toast.error('Failed to save invite', { description: err?.message });
    }
  }

  async function importCsv(file: File) {
    try {
      const text = await file.text();
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      let added = 0;
      for (const line of lines) {
        const [emailRaw, roleRaw] = line
          .split(',')
          .map((x) => (x || '').trim());
        if (!emailRaw) continue;
        setEmail(emailRaw);
        setInviteRole((roleRaw as any) || 'Member');
        // eslint-disable-next-line no-await-in-loop
        await persistEmailInvite();
        added++;
      }
      toast.success(`Imported ${added} invites`);
    } catch (e: any) {
      toast.error('CSV import failed', { description: e?.message });
    }
  }

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
      <PopoverContent align='end' className='w-[520px] p-0'>
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
            <div className='flex flex-wrap items-center gap-2'>
              <div className='relative flex-1'>
                <Mail className='text-muted-foreground absolute top-1/2 left-2 size-4 -translate-y-1/2' />
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder='johndoe@gmail.com'
                  className='h-9 pl-8'
                />
              </div>
              <Select
                value={inviteRole}
                onValueChange={(v) => setInviteRole(v as any)}
              >
                <SelectTrigger className='h-9 w-[120px]'>
                  <SelectValue placeholder='Role' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='Admin'>Admin</SelectItem>
                  <SelectItem value='Member'>Member</SelectItem>
                  <SelectItem value='Viewer'>Viewer</SelectItem>
                </SelectContent>
              </Select>
              <Button size='sm' onClick={persistEmailInvite}>
                Add Invite
              </Button>
              <input
                type='file'
                accept='.csv,text/csv'
                className='hidden'
                id='invite-csv-input'
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importCsv(f);
                  // reset
                  (e.target as any).value = '';
                }}
              />
              <Button
                size='sm'
                variant='outline'
                onClick={() =>
                  document.getElementById('invite-csv-input')?.click()
                }
              >
                Import CSV
              </Button>
              <Button
                size='sm'
                variant='outline'
                onClick={() => setShowQR((s) => !s)}
              >
                {showQR ? 'Hide QR' : 'Show QR'}
              </Button>
            </div>
            {showQR && (
              <div className='mt-2 flex items-center justify-center'>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(shareUrl)}`}
                  alt='Invite QR'
                  className='rounded-md border'
                />
              </div>
            )}
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
                    <div className='flex items-center gap-2'>
                      <Select defaultValue='Viewer'>
                        <SelectTrigger className='h-8 w-[110px] text-xs'>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='Admin'>Admin</SelectItem>
                          <SelectItem value='Member'>Member</SelectItem>
                          <SelectItem value='Viewer'>Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Actions */}
          <div className='flex items-center justify-between gap-2 pt-1'>
            <div className='text-muted-foreground text-xs'>
              Tip: Select teammates above to start a group chat.
            </div>
            <Button size='sm' className='gap-2' onClick={createGroupChat}>
              <MessagesSquare className='size-4' /> Create group chat
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
