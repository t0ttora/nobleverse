'use client';
import * as React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FiltersBar } from './filters-bar';
import { ContactsGrid } from './contacts-grid';
import type { ContactListItem } from '@/lib/contacts';
import type { Role } from '@/types/profile';
import { supabase } from '@/../utils/supabase/client';
import { toast } from 'sonner';
import { PresenceSwitcher } from './presence-switcher';
import { TeamInviteMenu } from '@/components/contacts/team-invite';
import { connectRequest } from '@/lib/connect';
import { NewMessageDialog } from '@/components/new-message-dialog';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createTask } from '@/lib/tasks';
import { createEvent, notifyUsersAboutEvent } from '@/lib/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QuickShareDialog } from '@/components/contacts/quick-share-dialog';
import { LabelsDialog } from '@/components/contacts/labels-dialog';
import { Calendar as DayCalendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import {
  AssignTaskDialog,
  AssignEventDialog,
  AssignShipmentDialog,
  AssignRequestDialog
} from '@/components/contacts/assign-dialogs';

async function fetchData(
  tab: 'team' | 'contacts' | 'community',
  filters: { search: string; roles: Role[] }
): Promise<ContactListItem[]> {
  // We call edge functions via RLS-friendly reads directly from the browser.
  // The queries mirror the server helpers but run client-side for responsiveness.
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;
  let ids: string[] = [];

  const roles = filters.roles.length ? filters.roles : undefined;
  const search = filters.search.trim();

  if (tab === 'contacts') {
    if (!userId) return [];
    const [{ data: pairs }, { data: outReqs }, { data: inReqs }] =
      await Promise.all([
        supabase.from('contacts').select('contact_id').eq('user_id', userId),
        supabase
          .from('contact_requests')
          .select('receiver_id')
          .eq('requester_id', userId)
          .eq('status', 'pending'),
        supabase
          .from('contact_requests')
          .select('requester_id')
          .eq('receiver_id', userId)
          .eq('status', 'pending')
      ]);
    const acceptedIds = (pairs ?? []).map((p: any) => p.contact_id);
    const pendingOutIds = (outReqs ?? []).map((r: any) => r.receiver_id);
    const pendingInIds = (inReqs ?? []).map((r: any) => r.requester_id);
    ids = Array.from(
      new Set([...acceptedIds, ...pendingOutIds, ...pendingInIds])
    );
  }

  let query = supabase.from('profiles').select('*');

  if (tab === 'team') {
    if (!userId) return [];
    const { data: me } = await supabase
      .from('profiles')
      .select('company_name')
      .eq('id', userId)
      .maybeSingle();
    const company = (me?.company_name ?? '').trim();
    if (!company) return [];
    query = query.eq('company_name', company).neq('id', userId);
  } else if (tab === 'contacts') {
    if (!ids.length) return [];
    query = query.in('id', ids);
  } else if (tab === 'community') {
    // show all profiles except self; if details.visibility is set and private, filter it out
    if (userId) query = query.neq('id', userId);
    // Prefer public visibility when present; allow missing details (treat as public)
    query = query.or(
      'details->>visibility.is.null,details->>visibility.eq.public'
    );
  }

  if (roles && roles.length) {
    query = query.in('role', roles as any);
  }
  if (search.length > 1) {
    const s = `%${search}%`;
    query = query.or(
      `username.ilike.${s},display_name.ilike.${s},company_name.ilike.${s},email.ilike.${s}`
    );
  }

  const { data } = await query.limit(200);
  return (data ?? []).map((p: any) => ({
    ...p,
    display_name: p.display_name ?? null,
    presence: (p.details as any)?.status ?? 'offline',
    visibility: (p.details as any)?.visibility ?? 'public'
  }));
}

export function ContactsClient() {
  const router = useRouter();
  const [tab, setTab] = React.useState<'team' | 'contacts' | 'community'>(
    'contacts'
  );
  const [filters, setFilters] = React.useState<{
    search: string;
    roles: Role[];
    presences?: ('online' | 'offline' | 'dnd')[];
    sort?: 'name' | 'last_active';
    tag?: string;
    department?: string;
  }>({ search: '', roles: [], sort: 'name' });
  const [people, setPeople] = React.useState<ContactListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [msgOpen, setMsgOpen] = React.useState(false);
  const [presetRecipient, setPresetRecipient] = React.useState<{
    id: string;
    username?: string | null;
    email?: string | null;
    avatar_url?: string | null;
  } | null>(null);
  const [me, setMe] = React.useState<{
    id: string;
    email: string | null;
  } | null>(null);
  // Local team metadata (labels/roles) from settings for filtering and UI
  const [teamMeta, setTeamMeta] = React.useState<{
    roles: Record<string, 'Admin' | 'Member' | 'Viewer'>;
    labels: Record<string, { departments?: string[]; tags?: string[] }>;
  }>({ roles: {}, labels: {} });
  const [selected, setSelected] = React.useState<string[]>([]);
  const selectedSet = React.useMemo(() => new Set(selected), [selected]);
  // Share dialog state
  const [shareOpen, setShareOpen] = React.useState(false);
  const [shareTargets, setShareTargets] = React.useState<string[]>([]);
  // Labels dialog state (single or bulk)
  const [labelsOpen, setLabelsOpen] = React.useState(false);
  const [labelsTargets, setLabelsTargets] = React.useState<string[]>([]);
  const [labelsInit, setLabelsInit] = React.useState<{
    tags: string[];
    departments: string[];
  }>({ tags: [], departments: [] });
  // Assign dialogs state
  const [assignTarget, setAssignTarget] = React.useState<string | null>(null);
  const [taskOpen, setTaskOpen] = React.useState(false);
  const [eventOpen, setEventOpen] = React.useState(false);
  const [shipmentOpen, setShipmentOpen] = React.useState(false);
  const [requestOpen, setRequestOpen] = React.useState(false);

  async function load() {
    setLoading(true);
    const res = await fetchData(tab, filters);
    setPeople(res);
    setLoading(false);
  }

  React.useEffect(() => {
    let alive = true;
    async function auth() {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      const email = auth.user?.email ?? null;
      if (!alive) return;
      setMe(uid ? { id: uid, email } : null);
      if (uid) {
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
        const roles = (
          team.roles && typeof team.roles === 'object' ? team.roles : {}
        ) as Record<string, any>;
        const labels = (
          team.labels && typeof team.labels === 'object' ? team.labels : {}
        ) as Record<string, any>;
        setTeamMeta({
          roles: Object.fromEntries(
            Object.entries(roles).map(([k, v]) => [k, (v as any) || 'Member'])
          ),
          labels: Object.fromEntries(
            Object.entries(labels).map(([k, v]) => [
              k,
              (v as any) || { departments: [], tags: [] }
            ])
          )
        });
      }
    }
    void auth();
    return () => {
      alive = false;
    };
  }, []);

  const rolesKey = React.useMemo(
    () => filters.roles.join(','),
    [filters.roles]
  );
  React.useEffect(() => {
    void load();
    // We intentionally depend on rolesKey string to avoid deep compare
  }, [tab, filters.search, rolesKey]);

  // Client-side filtering for presence, tag, department and sorting
  const filteredPeople = React.useMemo(() => {
    let list = people.slice();
    if (filters.presences && filters.presences.length) {
      const set = new Set(filters.presences);
      list = list.filter((p) => (p.presence ? set.has(p.presence) : false));
    }
    // Tag/department filter against local labels map
    if (
      (filters.tag && filters.tag.trim()) ||
      (filters.department && filters.department.trim())
    ) {
      const tag = (filters.tag || '').trim().toLowerCase();
      const dep = (filters.department || '').trim().toLowerCase();
      list = list.filter((p) => {
        const meta = teamMeta.labels[p.id] || {};
        const tags = (meta.tags || []).map((x: string) => x.toLowerCase());
        const deps = (meta.departments || []).map((x: string) =>
          x.toLowerCase()
        );
        const okTag = tag ? tags.includes(tag) : true;
        const okDep = dep ? deps.includes(dep) : true;
        return okTag && okDep;
      });
    }
    if (filters.sort === 'last_active') {
      list.sort((a, b) => {
        const ta = a.last_active_at ? new Date(a.last_active_at).getTime() : 0;
        const tb = b.last_active_at ? new Date(b.last_active_at).getTime() : 0;
        return tb - ta;
      });
    } else {
      list.sort((a, b) => {
        const an = (a.display_name || a.username || '').toLowerCase();
        const bn = (b.display_name || b.username || '').toLowerCase();
        return an.localeCompare(bn);
      });
    }
    return list;
  }, [
    people,
    filters.presences,
    filters.tag,
    filters.department,
    filters.sort,
    teamMeta.labels
  ]);

  function BulkAssignTaskButton({ ids }: { ids: string[] }) {
    const [open, setOpen] = React.useState(false);
    const [title, setTitle] = React.useState('');
    const [date, setDate] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button size='sm' variant='outline'>
            Assign tasks
          </Button>
        </PopoverTrigger>
        <PopoverContent align='end' className='w-[320px] space-y-2'>
          <div>
            <Label className='text-xs'>Title</Label>
            <Input
              className='h-8'
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <Label className='text-xs'>Due date</Label>
            <Input
              className='h-8'
              type='date'
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className='flex justify-end gap-2'>
            <Button size='sm' variant='ghost' onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size='sm'
              disabled={!title.trim() || loading}
              onClick={async () => {
                setLoading(true);
                const deadline = date ? new Date(date).toISOString() : null;
                for (const uid of ids) {
                  const res = await createTask({
                    title: title.trim(),
                    assigned_to: uid,
                    deadline
                  });
                  if (!res.ok) {
                    toast.error(res.error || 'Failed for one assignee');
                  }
                }
                setLoading(false);
                setOpen(false);
                toast.success('Tasks created');
              }}
            >
              Create
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  function BulkScheduleButton({ ids }: { ids: string[] }) {
    const [open, setOpen] = React.useState(false);
    const [title, setTitle] = React.useState('');
    const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
      new Date()
    );
    const [time, setTime] = React.useState('09:00');
    const [note, setNote] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button size='sm' variant='outline'>
            Schedule meeting
          </Button>
        </PopoverTrigger>
        <PopoverContent align='end' className='w-[360px] space-y-3'>
          <div>
            <Label className='text-xs'>Title</Label>
            <Input
              className='h-8'
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <Label className='text-xs'>Pick date</Label>
            <div className='rounded border p-2'>
              <DayCalendar
                mode='single'
                selected={selectedDate}
                onSelect={(d: any) => d && setSelectedDate(new Date(d))}
                showOutsideDays
              />
            </div>
          </div>
          <div>
            <Label className='text-xs'>Time</Label>
            <Input
              className='h-8'
              type='time'
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
          <div>
            <Label className='text-xs'>Invite message</Label>
            <Textarea
              className='min-h-[72px]'
              placeholder='Add a short note (optional)…'
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className='flex justify-end gap-2'>
            <Button size='sm' variant='ghost' onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size='sm'
              disabled={!title.trim() || !selectedDate || loading}
              onClick={async () => {
                setLoading(true);
                const [hh, mm] = time.split(':').map((x) => parseInt(x, 10));
                const starts = new Date(selectedDate!);
                starts.setHours(hh || 9, mm || 0, 0, 0);
                const evt = {
                  title: title.trim(),
                  starts_at: starts.toISOString(),
                  notes: note.trim() || null
                } as any;
                const res = await createEvent(evt);
                if (!res.ok) {
                  toast.error(res.error || 'Failed to create event');
                } else {
                  await notifyUsersAboutEvent(ids, evt);
                  toast.success('Event created and invites sent');
                }
                setLoading(false);
                setOpen(false);
              }}
            >
              Create
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Single-card helpers
  async function quickAssignTask(userId: string) {
    const title = window.prompt('Task title');
    if (!title) return;
    const due = window.prompt('Due date (YYYY-MM-DD) optional');
    const deadline =
      due && due.trim() ? new Date(due.trim()).toISOString() : null;
    const res = await createTask({
      title: title.trim(),
      assigned_to: userId,
      deadline
    });
    if (res.ok) toast.success('Task created');
    else toast.error(res.error || 'Failed to create task');
  }
  async function changeMemberRole(
    userId: string,
    role: 'Admin' | 'Member' | 'Viewer'
  ) {
    if (!me?.id) return toast.error('Please sign in');
    const { data: st } = await supabase
      .from('settings')
      .select('org')
      .eq('user_id', me.id)
      .maybeSingle();
    const org =
      (st?.org && typeof st.org === 'object' ? (st.org as any) : {}) || {};
    const team =
      (org.team && typeof org.team === 'object' ? (org.team as any) : {}) || {};
    const roles = (
      team.roles && typeof team.roles === 'object' ? team.roles : {}
    ) as Record<string, any>;
    const next = { ...roles, [userId]: role };
    const nextOrg = { ...org, team: { ...team, roles: next } };
    const { error } = await supabase
      .from('settings')
      .upsert({ user_id: me.id, org: nextOrg });
    if (error) return toast.error(error.message);
    setTeamMeta((m) => ({ ...m, roles: { ...m.roles, [userId]: role } }));
    toast.success('Role updated');
  }

  async function startThread(userId: string) {
    if (!me?.id) return toast.error('Please sign in');
    const target = people.find((p) => p.id === userId);
    const defaultTitle = `Thread with ${target?.display_name || target?.username || 'user'}`;
    const title = window.prompt('Thread title', defaultTitle) || defaultTitle;
    const topic = window.prompt('Topic (optional)') || '';
    const { data: rid, error } = await supabase.rpc('create_group_room', {
      p_title: title,
      p_member_ids: Array.from(new Set([me.id, userId]))
    });
    if (error || !rid)
      return toast.error(error?.message || 'Could not start thread');
    if (topic.trim()) {
      await supabase
        .from('chat_messages')
        .insert({
          room_id: rid as string,
          sender_id: me.id,
          content: `Topic: ${topic.trim()}`
        });
    }
    router.push(`/inbox?room=${rid as string}`);
  }

  const EmptyState = ({ title, desc }: { title: string; desc: string }) => (
    <div className='text-muted-foreground rounded-xl border p-8 text-center text-sm'>
      <div className='bg-muted mx-auto mb-2 flex size-12 items-center justify-center rounded-full'>
        🙂
      </div>
      <div className='text-foreground font-medium'>{title}</div>
      <div className='mt-1'>{desc}</div>
    </div>
  );

  return (
    <div className='space-y-4'>
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as any)}
        className='mb-4'
      >
        <TabsList>
          <TabsTrigger value='team'>My Team</TabsTrigger>
          <TabsTrigger value='contacts'>Contacts</TabsTrigger>
          <TabsTrigger value='community'>Community</TabsTrigger>
        </TabsList>
        {/* no extra spacer; Shipments uses margin on Tabs */}
      </Tabs>
      <FiltersBar
        value={filters}
        onChange={setFilters as any}
        rightSlot={
          tab === 'team' ? (
            <div className='flex items-center gap-2'>
              <PresenceSwitcher />
              <TeamInviteMenu />
            </div>
          ) : (
            <PresenceSwitcher />
          )
        }
      />
      {loading ? (
        <div className='text-muted-foreground text-sm'>Loading…</div>
      ) : filteredPeople.length === 0 ? (
        tab === 'contacts' ? (
          <EmptyState
            title='No contacts yet'
            desc='When you connect with others, they’ll appear here.'
          />
        ) : tab === 'team' ? (
          <EmptyState
            title='No teammates yet'
            desc='Invite your teammates to collaborate here.'
          />
        ) : (
          <EmptyState
            title='No community profiles'
            desc='Try adjusting filters or check back later.'
          />
        )
      ) : (
        <ContactsGrid
          people={filteredPeople}
          variant={tab === 'team' ? 'team' : 'default'}
          selectedIds={tab === 'team' ? selected : undefined}
          labelsMap={tab === 'team' ? (teamMeta.labels as any) : undefined}
          onToggleSelect={
            tab === 'team'
              ? (id: string) =>
                  setSelected((cur) =>
                    cur.includes(id)
                      ? cur.filter((x) => x !== id)
                      : [...cur, id]
                  )
              : undefined
          }
          onContact={async (id) => {
            const { data: auth } = await supabase.auth.getUser();
            if (!auth.user) {
              toast.error('Please sign in to send contact requests');
              return;
            }
            const res = await connectRequest(id);
            if (!res.ok) {
              toast.error('Failed to send request');
              return;
            }
            if (res.status === 'connected') {
              toast.success('Connected');
            } else if (
              res.status === 'pending' ||
              res.status === 'already_pending'
            ) {
              toast.info('Waiting for reply');
            }
            // Refresh list so pending appears immediately in Contacts tab
            await load();
          }}
          onMessage={async (id) => {
            const target = people.find((p) => p.id === id) || null;
            if (!target) return;
            setPresetRecipient({
              id: target.id,
              username: target.username ?? target.display_name ?? null,
              email: target.email ?? null,
              avatar_url: target.avatar_url ?? null
            });
            setMsgOpen(true);
          }}
          // Card-level extras
          // @ts-ignore Team variant only
          onAssignTask={(uid: string) => {
            setAssignTarget(uid);
            setTaskOpen(true);
          }}
          onAssignEvent={(uid: string) => {
            setAssignTarget(uid);
            setEventOpen(true);
          }}
          onAssignShipment={(uid: string) => {
            setAssignTarget(uid);
            setShipmentOpen(true);
          }}
          onAssignRequest={(uid: string) => {
            setAssignTarget(uid);
            setRequestOpen(true);
          }}
          // @ts-ignore Team variant only
          onChangeRole={changeMemberRole as any}
          // @ts-ignore Team variant only
          onAddTag={async (userId: string) => {
            const cur = teamMeta.labels[userId] || {
              tags: [],
              departments: []
            };
            setLabelsTargets([userId]);
            setLabelsInit({
              tags: cur.tags || [],
              departments: cur.departments || []
            });
            setLabelsOpen(true);
          }}
          // @ts-ignore Team variant only
          onStartThread={startThread as any}
          // @ts-ignore Team variant only
          onShareDoc={(userId: string) => {
            setShareTargets([userId]);
            setShareOpen(true);
          }}
          // @ts-ignore Team variant only
          onMention={async (userId: string) => {
            const p = people.find((x) => x.id === userId);
            if (!p) return;
            const label = p.display_name || p.username || 'user';
            setPresetRecipient({
              id: p.id,
              username: label,
              email: p.email ?? null,
              avatar_url: p.avatar_url ?? null
            });
            setMsgOpen(true);
            // Pre-fill mention block in message composer
            // NewMessageDialog now supports presetText
          }}
          // @ts-ignore Team variant only
          onMentionInInbox={async (userId: string) => {
            if (!me?.id) return toast.error('Please sign in');
            const { data, error } = await supabase.rpc(
              'get_or_create_dm_room',
              { p_user1: me.id, p_user2: userId }
            );
            if (error || !data)
              return toast.error(error?.message || 'Could not open inbox');
            router.push(`/inbox?room=${data as string}`);
          }}
        />
      )}
      {/* Bulk action bar for team selection */}
      {tab === 'team' && selected.length > 0 && (
        <div className='bg-muted/30 sticky bottom-2 z-10 mx-1 mt-2 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 shadow-sm'>
          <div className='text-sm'>Selected: {selected.length}</div>
          <div className='flex items-center gap-2'>
            <Button
              size='sm'
              onClick={async () => {
                if (!me?.id) return toast.error('Please sign in');
                const ids = Array.from(new Set([me.id, ...selected]));
                const { data: rid, error } = await supabase.rpc(
                  'create_group_room',
                  { p_title: null, p_member_ids: ids }
                );
                if (error || !rid)
                  return toast.error(
                    error?.message || 'Could not create group'
                  );
                toast.success('Group created');
                router.push(`/inbox?room=${rid as string}`);
              }}
            >
              Start group chat
            </Button>
            <Button
              size='sm'
              variant='outline'
              onClick={() => {
                // Open message dialog with selected
                const rec = selected
                  .map((id) => people.find((p) => p.id === id))
                  .filter(Boolean) as ContactListItem[];
                if (rec.length) {
                  // Use presetRecipient array through NewMessageDialog below via state
                  // For simplicity, reuse dialog with first user but pass all through presetRecipients prop
                  setPresetRecipient({
                    id: rec[0].id,
                    username: rec[0].username ?? rec[0].display_name ?? null,
                    email: rec[0].email ?? null,
                    avatar_url: rec[0].avatar_url ?? null
                  });
                  setMsgOpen(true);
                }
              }}
            >
              Send message
            </Button>
            <BulkAssignTaskButton ids={selected} />
            <BulkScheduleButton ids={selected} />
            <Button
              size='sm'
              variant='outline'
              onClick={() => {
                const ids = selected.slice();
                setLabelsTargets(ids);
                // For bulk, start with empty arrays to avoid clobbering until user adds
                setLabelsInit({ tags: [], departments: [] });
                setLabelsOpen(true);
              }}
            >
              Edit labels
            </Button>
            <Button size='sm' variant='ghost' onClick={() => setSelected([])}>
              Clear
            </Button>
          </div>
        </div>
      )}
      {/* New Message Dialog (prefilled when opened via contact panel) */}
      <NewMessageDialog
        open={msgOpen}
        onOpenChange={(o) => {
          setMsgOpen(o);
          if (!o) setPresetRecipient(null);
        }}
        fromEmail={me?.email ?? null}
        presetRecipients={(() => {
          if (selected.length > 1) {
            return selected
              .map((id) => people.find((p) => p.id === id))
              .filter(Boolean)
              .map((p) => ({
                id: (p as any).id,
                email: (p as any).email || null,
                username:
                  (p as any).username || (p as any).display_name || null,
                avatar_url: (p as any).avatar_url || null
              }));
          }
          return presetRecipient
            ? [
                {
                  id: presetRecipient.id,
                  email: presetRecipient.email || null,
                  username: presetRecipient.username || null,
                  avatar_url: presetRecipient.avatar_url || null
                }
              ]
            : [];
        })()}
        presetText={(() => {
          if (presetRecipient) {
            const label =
              presetRecipient.username || presetRecipient.email || 'user';
            const uid = presetRecipient.id;
            return `@${label} 

Mentions:
- ${uid}|${label}`;
          }
          return undefined;
        })()}
        onSubmit={async ({ recipientIds, text }) => {
          if (!me?.id) {
            toast.error('You must be signed in.');
            return;
          }
          const ids = recipientIds.length
            ? recipientIds
            : presetRecipient
              ? [presetRecipient.id]
              : [];
          if (!ids.length) return;
          if (ids.length === 1) {
            const { data, error } = await supabase.rpc(
              'get_or_create_dm_room',
              { p_user1: me.id, p_user2: ids[0] }
            );
            if (error || !data) {
              toast.error(error?.message || 'Could not start conversation');
              return;
            }
            // Insert the message server-side so it appears in inbox and realtime
            const rid = data as string;
            const content = text.trim();
            if (content) {
              const ins = await supabase
                .from('chat_messages')
                .insert({ room_id: rid, sender_id: me.id, content });
              if (ins.error) {
                toast.error(ins.error.message);
                return;
              }
            }
            setMsgOpen(false);
            toast.success('Message sent');
            // Optionally navigate to inbox to continue the conversation
            router.push(`/inbox?room=${rid}`);
          } else {
            const all = Array.from(new Set([me.id, ...ids]));
            const { data: rid, error } = await supabase.rpc(
              'create_group_room',
              { p_title: null, p_member_ids: all }
            );
            if (error || !rid) {
              toast.error(error?.message || 'Could not create group');
              return;
            }
            const content = text.trim();
            if (content) {
              const ins = await supabase
                .from('chat_messages')
                .insert({ room_id: rid as string, sender_id: me.id, content });
              if (ins.error) {
                toast.error(ins.error.message);
                return;
              }
            }
            setMsgOpen(false);
            toast.success('Group created');
            router.push(`/inbox?room=${rid}`);
          }
        }}
        // @ts-ignore Team variant only
        onAddDepartment={async (userId: string) => {
          const cur = teamMeta.labels[userId] || { tags: [], departments: [] };
          setLabelsTargets([userId]);
          setLabelsInit({
            tags: cur.tags || [],
            departments: cur.departments || []
          });
          setLabelsOpen(true);
        }}
      />
      {/* Labels dialog */}
      <LabelsDialog
        open={labelsOpen}
        onOpenChange={setLabelsOpen}
        mode={labelsTargets.length > 1 ? 'bulk' : 'single'}
        title={
          labelsTargets.length > 1
            ? `Edit labels for ${labelsTargets.length} members`
            : undefined
        }
        initialTags={labelsInit.tags}
        initialDepartments={labelsInit.departments}
        tagSuggestions={React.useMemo(() => {
          const set = new Set<string>();
          Object.values(teamMeta.labels).forEach((v: any) =>
            (v.tags || []).forEach((t: string) => set.add(t))
          );
          return Array.from(set).sort((a, b) => a.localeCompare(b));
        }, [teamMeta.labels])}
        departmentSuggestions={React.useMemo(() => {
          const set = new Set<string>();
          Object.values(teamMeta.labels).forEach((v: any) =>
            (v.departments || []).forEach((d: string) => set.add(d))
          );
          return Array.from(set).sort((a, b) => a.localeCompare(b));
        }, [teamMeta.labels])}
        onSave={async ({ tags, departments }) => {
          if (!me?.id) {
            toast.error('Please sign in');
            return;
          }
          const { data: st } = await supabase
            .from('settings')
            .select('org')
            .eq('user_id', me.id)
            .maybeSingle();
          const org =
            (st?.org && typeof st.org === 'object' ? (st?.org as any) : {}) ||
            {};
          const team =
            (org.team && typeof org.team === 'object'
              ? (org.team as any)
              : {}) || {};
          const labels = (
            team.labels && typeof team.labels === 'object' ? team.labels : {}
          ) as Record<string, any>;
          const next = { ...labels } as Record<
            string,
            { tags?: string[]; departments?: string[] }
          >;
          for (const uid of labelsTargets) {
            const cur = next[uid] || { tags: [], departments: [] };
            const isBulk = labelsTargets.length > 1;
            if (isBulk) {
              next[uid] = {
                tags: Array.from(new Set([...(cur.tags || []), ...tags])),
                departments: Array.from(
                  new Set([...(cur.departments || []), ...departments])
                )
              };
            } else {
              next[uid] = {
                tags: tags.length ? Array.from(new Set(tags)) : cur.tags || [],
                departments: departments.length
                  ? Array.from(new Set(departments))
                  : cur.departments || []
              };
            }
          }
          const nextOrg = { ...org, team: { ...team, labels: next } };
          const { error } = await supabase
            .from('settings')
            .upsert({ user_id: me.id, org: nextOrg });
          if (error) {
            toast.error(error.message);
            return;
          }
          setTeamMeta((m) => ({ ...m, labels: next as any }));
          toast.success('Labels updated');
        }}
      />
      {/* Quick Share Dialog */}
      <QuickShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        targetIds={shareTargets}
      />
      {/* Assign dialogs */}
      <AssignTaskDialog
        open={taskOpen}
        onOpenChange={setTaskOpen}
        userId={assignTarget}
      />
      <AssignEventDialog
        open={eventOpen}
        onOpenChange={setEventOpen}
        userId={assignTarget}
      />
      <AssignShipmentDialog
        open={shipmentOpen}
        onOpenChange={setShipmentOpen}
        onGo={() => {
          setShipmentOpen(false);
          router.push('/shipments');
        }}
      />
      <AssignRequestDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        onGo={() => {
          setRequestOpen(false);
          router.push('/shipments');
        }}
      />
    </div>
  );
}
