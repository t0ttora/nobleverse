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
  }>({ search: '', roles: [] });
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
      ) : people.length === 0 ? (
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
          people={people}
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
        />
      )}
      {/* New Message Dialog (prefilled when opened via contact panel) */}
      <NewMessageDialog
        open={msgOpen}
        onOpenChange={(o) => {
          setMsgOpen(o);
          if (!o) setPresetRecipient(null);
        }}
        fromEmail={me?.email ?? null}
        presetRecipients={
          presetRecipient
            ? [
                {
                  id: presetRecipient.id,
                  email: presetRecipient.email || null,
                  username: presetRecipient.username || null,
                  avatar_url: presetRecipient.avatar_url || null
                }
              ]
            : []
        }
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
      />
    </div>
  );
}
