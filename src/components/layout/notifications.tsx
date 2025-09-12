'use client';
import * as React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent
} from '@/components/ui/tooltip';
import { Bell, Check, X, Trash2, Eye } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/../utils/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import {
  acceptRequestFromNotification,
  declineRequestFromNotification
} from '@/lib/connect';

type DbNotification = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: string;
  title: string | null;
  body: string | null;
  data: Record<string, any> | null;
  category: string | null;
  read_at: string | null;
  archived_at: string | null;
  created_at: string;
};

type Actor = {
  id: string;
  display_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
};

export function Notifications() {
  const [items, setItems] = React.useState<DbNotification[]>([]);
  const [archived, setArchived] = React.useState<DbNotification[]>([]);
  const [actors, setActors] = React.useState<Record<string, Actor>>({});
  const actorsRef = React.useRef<Record<string, Actor>>({});
  React.useEffect(() => {
    actorsRef.current = actors;
  }, [actors]);
  const [activeTab, setActiveTab] = React.useState<
    'inbox' | 'general' | 'archived'
  >('inbox');
  const meRef = React.useRef<string | null>(null);

  const load = React.useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id ?? null;
    meRef.current = uid;
    if (!uid) {
      setItems([]);
      setActors({});
      return;
    }
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', uid)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(50);
    const list = (data ?? []) as DbNotification[];
    setItems(list);
    // Load archived separately
    const { data: arch } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', uid)
      .not('archived_at', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);
    setArchived((arch ?? []) as DbNotification[]);
    const uniqueActorIds = Array.from(
      new Set(list.map((n) => n.actor_id).filter((x): x is string => !!x))
    );
    if (uniqueActorIds.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id,display_name,username,avatar_url')
        .in('id', uniqueActorIds);
      const map: Record<string, Actor> = {};
      for (const p of profs || []) map[p.id as string] = p as Actor;
      setActors(map);
    } else {
      setActors({});
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Realtime subscribe to notifications changes for current user
  React.useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let stopped = false;
    const start = async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;
      // Create channel filtered by user_id
      channel = supabase
        .channel(`notifications:${uid}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${uid}`
          },
          async (payload: any) => {
            if (stopped) return;
            if (payload.eventType === 'INSERT') {
              const row = payload.new as DbNotification;
              if (row.archived_at) {
                setArchived((prev) =>
                  prev.some((x) => x.id === row.id)
                    ? prev
                    : [row, ...prev].slice(0, 100)
                );
              } else {
                setItems((prev) =>
                  prev.some((x) => x.id === row.id)
                    ? prev
                    : [row, ...prev].slice(0, 100)
                );
              }
              if (row.actor_id && !actorsRef.current[row.actor_id]) {
                const { data: prof } = await supabase
                  .from('profiles')
                  .select('id,display_name,username,avatar_url')
                  .eq('id', row.actor_id)
                  .maybeSingle();
                if (prof)
                  setActors((m) => ({
                    ...m,
                    [prof.id as string]: prof as any
                  }));
              }
            } else if (payload.eventType === 'UPDATE') {
              const row = payload.new as DbNotification;
              if (row.archived_at) {
                // Move from active to archived
                setItems((prev) => prev.filter((x) => x.id !== row.id));
                setArchived((prev) => {
                  const idx = prev.findIndex((x) => x.id === row.id);
                  if (idx !== -1) {
                    const next = prev.slice();
                    next[idx] = row;
                    return next;
                  }
                  return [row, ...prev].slice(0, 100);
                });
              } else {
                // Move from archived to active or update active
                setArchived((prev) => prev.filter((x) => x.id !== row.id));
                setItems((prev) => {
                  const idx = prev.findIndex((x) => x.id === row.id);
                  if (idx === -1) return [row, ...prev].slice(0, 100);
                  const next = prev.slice();
                  next[idx] = row;
                  return next;
                });
              }
            } else if (payload.eventType === 'DELETE') {
              const row = payload.old as DbNotification;
              setItems((prev) => prev.filter((x) => x.id !== row.id));
              setArchived((prev) => prev.filter((x) => x.id !== row.id));
            }
          }
        )
        .subscribe();
    };
    void start();
    return () => {
      stopped = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  const unreadCount = items.filter((n) => !n.read_at && !n.archived_at).length;
  const inboxItems = items.filter((n) => (n.category ?? 'inbox') === 'inbox');
  const generalItems = items.filter((n) => n.category === 'general');
  const archivedItems: DbNotification[] = archived;

  const inboxUnread = inboxItems.filter((n) => !n.read_at).length;
  const generalUnread = generalItems.filter((n) => !n.read_at).length;
  const archivedUnread = archivedItems.filter((n) => !n.read_at).length;

  const markAllRead = async () => {
    if (!meRef.current) return;
    const ids = [...items, ...archived]
      .filter((n) => !n.read_at)
      .map((n) => n.id);
    if (!ids.length) return;
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', ids);
    setItems((prev) =>
      prev.map((n) =>
        ids.includes(n.id) ? { ...n, read_at: new Date().toISOString() } : n
      )
    );
    setArchived((prev) =>
      prev.map((n) =>
        ids.includes(n.id) ? { ...n, read_at: new Date().toISOString() } : n
      )
    );
  };

  const deleteNotification = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    setItems((prev) => prev.filter((n) => n.id !== id));
    setArchived((prev) => prev.filter((n) => n.id !== id));
  };

  const markRead = async (id: string) => {
    const existing =
      items.find((x) => x.id === id) || archived.find((x) => x.id === id);
    if (!existing || existing.read_at) return;
    const now = new Date().toISOString();
    await supabase.from('notifications').update({ read_at: now }).eq('id', id);
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: now } : n))
    );
    setArchived((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: now } : n))
    );
  };

  function renderContactRequest(n: DbNotification) {
    const actor = (n.actor_id && actors[n.actor_id]) || undefined;
    const title = n.title || 'Connection request';
    const requestId = (n.data as any)?.request_id as string | undefined;
    const onAccept = async () => {
      if (!requestId) return;
      const res = await acceptRequestFromNotification({
        notificationId: n.id,
        requestId
      });
      if (res.ok) {
        setItems((prev) => prev.filter((x) => x.id !== n.id));
        toast.success('Connection accepted', {
          className: 'bg-green-500 text-white'
        });
      } else {
        toast.error(res.error || 'Action failed', {
          className: 'bg-red-500 text-white'
        });
      }
    };
    const onDecline = async () => {
      if (!requestId) return;
      const res = await declineRequestFromNotification({
        notificationId: n.id,
        requestId
      });
      if (res.ok) {
        setItems((prev) => prev.filter((x) => x.id !== n.id));
        toast.error('Connection request declined', {
          className: 'bg-red-500 text-white'
        });
      } else {
        toast.error(res.error || 'Action failed', {
          className: 'bg-red-500 text-white'
        });
      }
    };
    const initials = (
      (actor?.display_name || actor?.username || 'NV').slice(0, 2) || 'NV'
    ).toUpperCase();
    return (
      <div
        key={n.id}
        className='group bg-background relative flex items-center justify-between gap-3 rounded-md border p-3 pr-14'
      >
        <div className='flex items-center gap-3'>
          <Avatar className='size-8'>
            <AvatarImage src={actor?.avatar_url || undefined} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div
            className='cursor-pointer text-sm select-none'
            onClick={() => void markRead(n.id)}
          >
            <div className='font-medium'>{title}</div>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <Button
            size='icon'
            className='size-8 bg-green-500 text-white hover:bg-green-600'
            onClick={onAccept}
            aria-label='Accept'
          >
            <Check className='size-4' />
          </Button>
          <Button
            size='icon'
            variant='outline'
            className='size-8 border-red-500 text-red-600 hover:bg-red-50'
            onClick={onDecline}
            aria-label='Decline'
          >
            <X className='size-4' />
          </Button>
        </div>
        <Button
          size='icon'
          className='absolute top-1/2 right-4 size-7 -translate-y-1/2 bg-red-500 text-white opacity-0 transition duration-150 ease-out group-hover:translate-x-0 group-hover:opacity-100 hover:bg-red-600'
          onClick={() => void deleteNotification(n.id)}
          aria-label='Delete notification'
        >
          <Trash2 className='size-3.5' />
        </Button>
      </div>
    );
  }

  function renderList(list: DbNotification[]) {
    if (list.length === 0) {
      return (
        <div className='text-muted-foreground flex items-center justify-center rounded-md border px-4 py-6 text-sm'>
          No notifications
        </div>
      );
    }
    return (
      <div className='space-y-2'>
        {list.map((n: DbNotification) => {
          if (n.type === 'contact_request') return renderContactRequest(n);
          const isOffer = n.type === 'offer_created';
          const requestId = (n.data as any)?.request_id as string | undefined;
          return (
            <div
              key={n.id}
              className='group bg-background relative rounded-md border p-3 pr-12 text-sm'
            >
              <div
                className='flex cursor-pointer items-center gap-2 font-medium select-none'
                onClick={() => void markRead(n.id)}
              >
                {n.read_at ? null : (
                  <span
                    className='bg-primary inline-block size-1.5 rounded-full'
                    aria-hidden
                  />
                )}
                <span>
                  {n.title || (isOffer ? 'New offer received' : 'Notification')}
                </span>
              </div>
              {n.body ? (
                <div className='text-muted-foreground mt-0.5'>{n.body}</div>
              ) : null}
              {isOffer && requestId ? (
                <div className='mt-2 flex justify-end'>
                  <Button
                    size='sm'
                    variant='secondary'
                    onClick={() => {
                      void markRead(n.id);
                      // Navigate to shipments with request preselected
                      window.location.href = `/shipments?request=${encodeURIComponent(requestId)}`;
                    }}
                  >
                    <Eye className='mr-1 h-3.5 w-3.5' /> Preview Request
                  </Button>
                </div>
              ) : null}
              <Button
                size='icon'
                className='absolute top-1/2 right-4 size-7 -translate-y-1/2 bg-red-500 text-white opacity-0 transition duration-150 ease-out group-hover:opacity-100 hover:bg-red-600'
                onClick={() => void deleteNotification(n.id)}
                aria-label='Delete notification'
              >
                <Trash2 className='size-3.5' />
              </Button>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant='ghost'
              size='icon'
              className='border-border bg-muted text-foreground hover:bg-muted/80 relative h-8 w-8 rounded-full border shadow-none'
              aria-label='Notifications'
            >
              <Bell className='size-4' />
              {unreadCount > 0 ? (
                <span className='bg-primary ring-background absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2' />
              ) : null}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent sideOffset={6}>Notifications</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align='end' className='w-[380px] max-w-[92vw] p-0'>
        <div className='flex items-center justify-between px-4 py-3'>
          <span className='text-sm font-medium'>Notifications</span>
          <button
            type='button'
            onClick={markAllRead}
            className='text-primary text-xs hover:underline'
          >
            Mark all as read
          </button>
        </div>
        <div className='px-3 pb-3'>
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as any)}
            className='w-full'
          >
            <TabsList>
              <TabsTrigger value='inbox'>
                Inbox
                <span className='bg-foreground/10 ml-1 inline-flex min-w-5 items-center justify-center rounded-full px-1 text-[10px]'>
                  {inboxUnread}
                </span>
              </TabsTrigger>
              <TabsTrigger value='general'>
                General
                <span className='bg-foreground/10 ml-1 inline-flex min-w-5 items-center justify-center rounded-full px-1 text-[10px]'>
                  {generalUnread}
                </span>
              </TabsTrigger>
              <TabsTrigger value='archived'>
                Archived
                {archivedUnread > 0 && (
                  <span className='bg-foreground/10 ml-1 inline-flex min-w-5 items-center justify-center rounded-full px-1 text-[10px]'>
                    {archivedUnread}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
            <TabsContent value='inbox' className='mt-3'>
              {renderList(inboxItems)}
            </TabsContent>
            <TabsContent value='general' className='mt-3'>
              {renderList(generalItems)}
            </TabsContent>
            <TabsContent value='archived' className='mt-3'>
              {renderList(archivedItems)}
            </TabsContent>
          </Tabs>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
