'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
// Card extraction helpers from chat-message
import {
  extractMeta,
  extractAttachments,
  extractCardsFromBody
} from '@/components/chat-message';
import { useSearchParams } from 'next/navigation';
import { RealtimeChat } from '@/components/realtime-chat';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import {
  Plus,
  Search,
  ArrowLeft,
  Star,
  X,
  ChevronRight,
  ChevronDown,
  PanelRight,
  PanelRightOpen,
  MoreHorizontal,
  Pencil,
  Check
} from 'lucide-react';
import { NewMessageDialog } from '../../components/new-message-dialog';
import { supabase } from '@/lib/supabaseClient';
import clsx from 'clsx';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';

type RoomListItem = {
  id: string;
  type: 'dm' | 'group' | 'shipment';
  title: string | null;
  lastMessage?: { content: string; created_at: string } | null;
  members: {
    id: string;
    username?: string | null;
    display_name?: string | null;
    email?: string | null;
    avatar_url?: string | null;
  }[];
  isAdmin?: boolean;
};

// Helper to map RPC rows into RoomListItem[] consistently
function mapRpcRooms(rows: any[] | null | undefined): RoomListItem[] {
  const arr = Array.isArray(rows) ? rows : [];
  return arr.map((r: any) => ({
    id: r.room_id as string,
    type: r.type as any,
    title: r.title as string | null,
    isAdmin: !!r.is_admin,
    lastMessage: r.last_content
      ? {
          content: r.last_content as string,
          created_at: r.last_created_at as string
        }
      : undefined,
    members: (r.members as any[]).map((p: any) => ({
      id: p.id as string,
      username: p.username as string | null,
      display_name: p.display_name as string | null,
      email: null,
      avatar_url: p.avatar_url as string | null
    }))
  }));
}

// Helper to build userId -> display name map for a room
function makeNameMap(room: RoomListItem | undefined) {
  const map = new Map<string, string>();
  room?.members.forEach((m) => {
    const n = (m.display_name || m.username || 'User') as string;
    if (m.id) map.set(m.id, n);
  });
  return map;
}

// Favorites (starred rooms) key used in localStorage
const STAR_KEY = 'nv_starred_rooms';
const MUTE_KEY = 'nv_muted_rooms';

// Tiny relative time formatter for the list view
function formatListTime(iso?: string) {
  if (!iso) return '';
  const now = Date.now();
  const t = new Date(iso).getTime();
  if (!isFinite(t)) return '';
  const diff = Math.max(0, now - t);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric'
  }).format(new Date(t));
}

function ProfileHoverDetails({
  id,
  fallbackName,
  initialAvatar
}: {
  id: string;
  fallbackName: string;
  initialAvatar?: string;
}) {
  const [state, setState] = useState<{
    display_name?: string | null;
    username?: string | null;
    email?: string | null;
    role?: string | null;
    banner_url?: string | null;
    avatar_url?: string | null;
  } | null>(null);
  useEffect(() => {
    let alive = true;
    async function load() {
      if (!id) return;
      const { data } = await supabase
        .from('profiles')
        .select('username,display_name,email,role,avatar_url,banner_url')
        .eq('id', id)
        .single();
      if (!alive) return;
      setState({
        username: (data?.username as string) || null,
        display_name: (data?.display_name as string) || null,
        email: (data?.email as string) || null,
        role: ((data?.role as any) ?? null) as any,
        avatar_url: ((data?.avatar_url as string) || null) as any,
        banner_url: ((data?.banner_url as string) || null) as any
      });
    }
    void load();
    return () => {
      alive = false;
    };
  }, [id]);
  const name = state?.display_name || state?.username || fallbackName;
  const banner = state?.banner_url || null;
  const avatar = state?.avatar_url || initialAvatar || undefined;
  return (
    <div>
      <div
        className='bg-muted h-16 w-full'
        style={
          banner
            ? {
                backgroundImage: `url(${banner})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }
            : undefined
        }
      />
      <div className='-mt-6 flex items-start gap-3 p-3 pt-0'>
        <Avatar className='ring-background size-14 ring-2'>
          <AvatarImage src={avatar} />
          <AvatarFallback>
            {(name || 'U').slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-2'>
            <div className='truncate font-semibold'>{name}</div>
            {state?.role && (
              <span className='bg-muted rounded-full px-2 py-0.5 text-xs capitalize'>
                {state.role}
              </span>
            )}
          </div>
          {state?.email && (
            <div className='text-muted-foreground truncate text-xs'>
              {state.email}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GroupBanner({ ids }: { ids: string[] }) {
  const [banner, setBanner] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        if (!ids || ids.length === 0) return;
        const { data } = await supabase
          .from('profiles')
          .select('id,banner_url')
          .in('id', ids)
          .not('banner_url', 'is', null)
          .limit(1);
        if (!alive) return;
        setBanner((data && data[0]?.banner_url) || null);
      } catch {
        /* ignore */
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, [ids]);
  return (
    <div
      className='bg-muted h-16 w-full'
      style={
        banner
          ? {
              backgroundImage: `url(${banner})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }
          : undefined
      }
    />
  );
}

export default function InboxPage() {
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [me, setMe] = useState<{ id: string; email: string | null } | null>(
    null
  );
  const [initialMessages, setInitialMessages] = useState<
    import('@/hooks/use-realtime-chat').ChatMessage[]
  >([]);
  const [sideOpen, setSideOpen] = useState(false);
  const [chatMount, setChatMount] = useState(0);
  const [detailsQuery, setDetailsQuery] = useState('');
  const [detailsPage, setDetailsPage] = useState(0);
  const pageSize = 100;
  const [detailsRows, setDetailsRows] = useState<
    { id: string; content: string; created_at: string }[]
  >([]);
  const [confirm, setConfirm] = useState<{
    rid: string;
    type: 'leave' | 'deleteAll';
  } | null>(null);
  const [pendingInitial, setPendingInitial] = useState<{
    roomId: string;
    text: string;
  } | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  // Collapsible states for sections
  const [dmsOpen, setDmsOpen] = useState(true);
  const [groupsOpen, setGroupsOpen] = useState(true);
  // Inline edit: group title
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [savingTitle, setSavingTitle] = useState(false);

  const search = useSearchParams();
  // Note: we read the initial `room` from the URL only once on mount
  const [query, setQuery] = useState('');

  const [starred, setStarred] = useState<Set<string>>(new Set());
  const [muted, setMuted] = useState<Set<string>>(new Set());

  // Load details for sidebar with paging
  useEffect(() => {
    let alive = true;
    async function load() {
      if (!activeId || !sideOpen) return;
      const { data } = await supabase.rpc('get_room_messages', {
        p_room: activeId,
        p_page: detailsPage,
        p_size: pageSize
      });
      if (!alive) return;
      setDetailsRows((prev) =>
        detailsPage === 0 ? data || [] : [...prev, ...(data || [])]
      );
    }
    void load();
    return () => {
      alive = false;
    };
  }, [activeId, sideOpen, detailsPage]);

  // Auth + initial rooms
  // touch: keep ts parser fresh
  const didInitActiveRef = useRef(false);
  useEffect(() => {
    let stop = false;
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      const email = auth.user?.email ?? null;
      setMe(uid ? { id: uid, email } : null);
      if (!uid) return;

      const { data: rpc } = await supabase.rpc('get_inbox_rooms');
      const arr: RoomListItem[] = mapRpcRooms(rpc);
      if (!stop) setRooms(arr);

      const qRoom = search.get('room');
      if (!stop && !didInitActiveRef.current) {
        const target = (qRoom as string) || arr[0]?.id || null;
        if (target) setActiveId(target);
        didInitActiveRef.current = true;
      }
      if (!stop) {
        const isSmall =
          typeof window !== 'undefined' && window.innerWidth < 768;
        if (isSmall && qRoom) setMobileView('chat');
      }
    }
    void load();
    return () => {
      stop = true;
    };
  }, [search]);

  // Load starred list once
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STAR_KEY);
      if (raw) setStarred(new Set(JSON.parse(raw)));
    } catch {
      /* ignore */
    }
  }, []);

  // Load muted list once
  useEffect(() => {
    try {
      const raw = localStorage.getItem(MUTE_KEY);
      if (raw) setMuted(new Set(JSON.parse(raw)));
    } catch {
      /* ignore */
    }
  }, []);

  function toggleStar(id: string) {
    setStarred((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(STAR_KEY, JSON.stringify(Array.from(next)));
      } catch {
        void 0; // ignore localStorage write errors
      }
      return next;
    });
  }

  function toggleMute(id: string) {
    setMuted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(MUTE_KEY, JSON.stringify(Array.from(next)));
      } catch {
        void 0;
      }
      return next;
    });
  }

  // Derived
  // Chat preview refresh: update rooms list when active room receives new message
  useEffect(() => {
    if (!activeId || !initialMessages.length) return;
    const last = initialMessages[initialMessages.length - 1];
    if (!last) return;
    setRooms((prev) =>
      prev.map((room) =>
        room.id === activeId
          ? {
              ...room,
              lastMessage: {
                content: last.content,
                created_at: last.createdAt
              }
            }
          : room
      )
    );
  }, [activeId, initialMessages]);
  const active = useMemo(
    () => rooms.find((r) => r.id === activeId) || null,
    [rooms, activeId]
  );
  const nobleId = useMemo(() => me?.email?.split('@')[0] || 'me', [me]);
  const filteredRooms = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter((r) => {
      const title = r.title || '';
      const memberNames = r.members
        .map((m) => m.display_name || m.username || '')
        .join(' ');
      const preview = r.lastMessage?.content || '';
      return [title, memberNames, preview].some((t) =>
        t.toLowerCase().includes(q)
      );
    });
  }, [rooms, query]);
  const sections = useMemo(() => {
    const fav = filteredRooms.filter((r) => starred.has(r.id));
    const dms = filteredRooms.filter(
      (r) => r.type === 'dm' && !starred.has(r.id)
    );
    const groups = filteredRooms.filter(
      (r) => r.type === 'group' && !starred.has(r.id)
    );
    const shipments = filteredRooms.filter(
      (r) => r.type === 'shipment' && !starred.has(r.id)
    );
    return { fav, dms, groups, shipments };
  }, [filteredRooms, starred]);

  const roomDisplayName = useMemo(() => {
    if (!active) return '';
    if (active.type === 'shipment') {
      return active.title || 'Shipment';
    }
    if (active.type === 'group') {
      return (
        active.title ||
        active.members
          .map((m) => m.username || m.display_name || 'user')
          .slice(0, 1)
          .join(', ')
      );
    }
    const other = active.members.find((m) => m.id !== me?.id);
    return other?.display_name || other?.username || '';
  }, [active, me?.id]);

  async function saveGroupTitle(rid: string, title: string | null) {
    setSavingTitle(true);
    try {
      const { error } = await supabase
        .from('chat_rooms')
        .update({ title })
        .eq('id', rid);
      if (error) throw error;
      setRooms((prev) => prev.map((r) => (r.id === rid ? { ...r, title } : r)));
      setEditingTitle(null);
      toast.success('Title updated');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update title');
    } finally {
      setSavingTitle(false);
    }
  }

  // Refresh + focus
  async function refreshRoomsAndFocus(roomId?: string) {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id ?? null;
    if (!uid) return;
    const { data: rpc } = await supabase.rpc('get_inbox_rooms');
    const arr: RoomListItem[] = mapRpcRooms(rpc);
    setRooms(arr);
    if (roomId) setActiveId(roomId);
  }

  // Realtime updates
  useEffect(() => {
    if (!me?.id) return;
    const uid = me.id;
    const channel = supabase
      .channel(`inbox:${uid}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_members',
          filter: `user_id=eq.${uid}`
        },
        async (payload: any) => {
          const rid: string | undefined = payload?.new?.room_id;
          if (!rid) return;
          const { data: room } = await supabase
            .from('chat_rooms')
            .select('id,type,title,created_at')
            .eq('id', rid)
            .single();
          if (!room) return;
          const { data: mems } = await supabase
            .from('chat_members')
            .select(
              'profiles:profiles!inner(id,username,display_name,email,avatar_url)'
            )
            .eq('room_id', rid);
          const members = (mems || []).map((m: any) => m.profiles);
          const { data: lm } = await supabase
            .from('chat_room_last_message')
            .select('room_id,content,created_at')
            .eq('room_id', rid)
            .single();
          const item: RoomListItem = {
            id: room.id,
            type: room.type,
            title: room.title,
            members,
            lastMessage: lm
              ? {
                  content: (lm as any).content as string,
                  created_at: (lm as any).created_at as string
                }
              : undefined,
            isAdmin: true
          };
          setRooms((prev) => [item, ...prev.filter((r) => r.id !== rid)]);
          setActiveId((cur) => cur ?? rid);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'chat_members',
          filter: `user_id=eq.${uid}`
        },
        (payload: any) => {
          const rid: string | undefined = payload?.old?.room_id;
          if (!rid) return;
          setRooms((prev) => prev.filter((r) => r.id !== rid));
          setActiveId((cur) => (cur === rid ? null : cur));
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload: any) => {
          const row = payload?.new as {
            room_id?: string;
            content?: string;
            created_at?: string;
          };
          const rid = row?.room_id;
          if (!rid) return;
          setRooms((prev) => {
            if (!prev.some((r) => r.id === rid)) return prev;
            const target = prev.find((r) => r.id === rid)!;
            const updated = {
              ...target,
              lastMessage: {
                content: row.content || '',
                created_at: row.created_at || new Date().toISOString()
              }
            };
            const rest = prev.filter((r) => r.id !== rid);
            return [updated, ...rest];
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [me?.id]);

  // Load initial messages for the selected room
  useEffect(() => {
    let ignore = false;
    async function loadMessages(rid: string, _type: RoomListItem['type']) {
      const rm = rooms.find((r) => r.id === rid);
      const nameMap = makeNameMap(rm);

      // Try RPC first
      let list: any[] | null = null;
      try {
        const { data: rows } = await supabase.rpc('get_room_messages', {
          p_room: rid,
          p_page: 0,
          p_size: 200
        });
        if (Array.isArray(rows) && rows.length) list = rows as any[];
      } catch {}

      // Fallback to direct select if RPC empty
      if (!list) {
        try {
          const { data: rows2 } = await supabase
            .from('chat_messages')
            .select('id, room_id, sender_id, content, created_at')
            .eq('room_id', rid)
            .order('created_at', { ascending: true })
            .limit(200);
          list = Array.isArray(rows2) ? rows2 : [];
        } catch {
          list = [];
        }
      }

      const im = (list || [])
        .slice()
        .sort(
          (a: any, b: any) =>
            new Date(a.created_at as string).getTime() -
            new Date(b.created_at as string).getTime()
        )
        .map((m: any) => {
          const uid = (m.sender_id as string) || (m.user_id as string) || '';
          return {
            id: m.id as string,
            content: (m.content as string) || '',
            user: { id: uid, name: nameMap.get(uid) || 'User' },
            createdAt: m.created_at as string
          };
        });
      if (!ignore) setInitialMessages(im);
    }
    if (activeId) {
      const t = rooms.find((r) => r.id === activeId)?.type || 'dm';
      void loadMessages(activeId, t);
    } else setInitialMessages([]);
    return () => {
      ignore = true;
    };
  }, [activeId, rooms]);

  // Realtime subscription for unified chat messages (current active room)
  useEffect(() => {
    if (!activeId) return;
    const channel = supabase
      .channel(`inbox:room:${activeId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${activeId}`
        },
        (payload: any) => {
          setInitialMessages((cur) => {
            if (cur.some((m) => m.id === payload.new.id)) return cur;
            const nameMap = makeNameMap(rooms.find((r) => r.id === activeId));
            const uid =
              (payload?.new?.user_id as string) ||
              (payload?.new?.sender_id as string) ||
              '';
            const msg = {
              id: payload.new.id as string,
              content: payload.new.content as string,
              user: { id: uid, name: nameMap.get(uid) || 'User' },
              createdAt: payload.new.created_at as string
            };
            return [...cur, msg];
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeId, rooms]);

  function handleOpenRoom(rid: string) {
    setActiveId(rid);
    const isSmall = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isSmall) setMobileView('chat');
  }

  // List item renderer
  const LeftItem = (r: RoomListItem) => {
    const isActive = activeId === r.id;
    const isShipment = r.type === 'shipment';
    return (
      <li key={r.id}>
        <div
          className={clsx(
            'group hover:bg-accent/50 hover:ring-accent/30 relative flex w-full items-start gap-3 rounded-lg p-3 ring-1 ring-transparent transition-colors before:absolute before:top-0 before:left-0 before:h-full before:w-[3px] before:rounded-r before:bg-transparent',
            isActive && 'bg-accent/40 ring-accent/40 before:bg-primary'
          )}
        >
          {isShipment ? (
            <div className='flex h-10 w-10 items-center justify-center rounded-md border bg-gradient-to-br from-orange-500/20 to-orange-600/10 text-xs font-semibold text-orange-600'>
              S
            </div>
          ) : r.type === 'group' ? (
            <div className='relative h-10 w-10'>
              {r.members.slice(0, 3).map((m, i) => (
                <Avatar
                  key={m.id}
                  className={clsx(
                    'border-background absolute size-6 border',
                    i === 0
                      ? 'top-0 left-0'
                      : i === 1
                        ? 'top-2 left-3'
                        : 'top-4 left-6'
                  )}
                >
                  <AvatarImage src={m.avatar_url || undefined} />
                  <AvatarFallback>
                    {(m.username || m.display_name || 'U')
                      .slice(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
          ) : (
            <Avatar className='size-10'>
              {(() => {
                const other =
                  r.members.find((m) => m.id !== me?.id) || r.members[0];
                return (
                  <>
                    <AvatarImage src={other?.avatar_url || undefined} />
                    <AvatarFallback>
                      {(other?.username || other?.display_name || 'U')
                        .slice(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </>
                );
              })()}
            </Avatar>
          )}
          <button
            className='min-w-0 flex-1 text-left'
            onClick={() => handleOpenRoom(r.id)}
          >
            <div className='flex items-center gap-2'>
              <div className='truncate font-medium'>
                {isShipment
                  ? r.title || 'Shipment'
                  : r.type === 'group'
                    ? r.title ||
                      r.members
                        .map((m) => m.username || m.display_name || 'user')
                        .slice(0, 3)
                        .join(', ') + (r.members.length > 3 ? ' and more' : '')
                    : r.members.find((m) => m.id !== me?.id)?.username ||
                      r.members.find((m) => m.id !== me?.id)?.display_name ||
                      'Direct message'}
              </div>
              {starred.has(r.id) && (
                <Star
                  className='size-3 fill-yellow-500 text-yellow-500'
                  aria-hidden='true'
                />
              )}
              <time className='text-muted-foreground ml-auto shrink-0 text-[10px]'>
                {formatListTime(r.lastMessage?.created_at)}
              </time>
            </div>
            <div className='text-muted-foreground max-w-[240px] truncate text-xs'>
              {(() => {
                const raw = r.lastMessage?.content || '';
                if (!raw) return 'No messages yet';
                // Extract meta, attachments, cards
                const meta = extractMeta(raw);
                const { body } = extractAttachments(meta.body);
                const { text, cards } = extractCardsFromBody(body);
                // If card(s) exist, show a summary for the first card
                if (cards && cards.length > 0) {
                  const card = cards[0];
                  // Show a short label for the card type
                  let label = '';
                  switch (card.type) {
                    case 'shipment_card':
                      label = `📦 Shipment: ${card.title || card.id}`;
                      break;
                    case 'calendar_card':
                      label = `📅 Calendar: ${card.title || card.id}`;
                      break;
                    case 'request_card':
                      label = `📝 Request: ${card.id}`;
                      break;
                    case 'negotiation_card':
                      label = `🤝 Negotiation: ${card.request_code || card.id}`;
                      break;
                    case 'invoice_card':
                      label = `💸 Invoice: ${card.id}`;
                      break;
                    case 'payment_status_card':
                      label = `💰 Payment: ${card.status || card.id}`;
                      break;
                    case 'task_card':
                      label = `✅ Task: ${card.title || card.id}`;
                      break;
                    case 'approval_card':
                      label = `✔️ Approval: ${card.subject || card.id}`;
                      break;
                    case 'note_card':
                      label = `🗒️ Note: ${card.author || card.id}`;
                      break;
                    default:
                      label = 'Card';
                  }
                  return label;
                }
                // Otherwise, render markdown preview (single line, truncated)
                return (
                  <span
                    style={{
                      display: 'inline-block',
                      maxWidth: 220,
                      verticalAlign: 'middle'
                    }}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkBreaks]}
                      components={{
                        p: ({ children }) => <span>{children}</span>,
                        a: (props) => (
                          <a {...props} style={{ color: '#2563eb' }} />
                        ),
                        code: ({ children }) => (
                          <span
                            style={{
                              fontFamily: 'monospace',
                              background: '#f3f3f3',
                              borderRadius: 2,
                              padding: '0 2px'
                            }}
                          >
                            {children}
                          </span>
                        )
                      }}
                    >
                      {text.replace(/\n/g, ' ').slice(0, 80)}
                    </ReactMarkdown>
                  </span>
                );
              })()}
            </div>
          </button>
          <div className='ml-auto flex items-center gap-1'>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant='ghost'
                  size='icon'
                  className='shrink-0'
                  onClick={(e) => e.stopPropagation()}
                  aria-label='Room actions'
                >
                  <MoreHorizontal className='size-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirm({ rid: r.id, type: 'leave' });
                  }}
                >
                  Delete from my inbox
                </DropdownMenuItem>
                {r.isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirm({ rid: r.id, type: 'deleteAll' });
                      }}
                    >
                      Delete for everyone
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </li>
    );
  };

  return (
    <>
      {/* Shell container */}
      <div className='bg-background flex h-full min-h-0 w-full overflow-hidden'>
        {/* Left list */}
        <div
          className={clsx(
            'bg-card/30 w-full flex-col border-r md:max-w-[320px]',
            mobileView === 'chat' ? 'hidden md:flex' : 'flex md:flex'
          )}
        >
          <div className='bg-background/60 supports-[backdrop-filter]:bg-background/50 flex items-center gap-2 border-b p-3 backdrop-blur'>
            <div className='relative flex-1'>
              <Search className='text-muted-foreground absolute top-1/2 left-2 size-4 -translate-y-1/2' />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='Search'
                className='rounded-lg pl-8'
              />
            </div>
            <Button
              size='icon'
              className='rounded-lg'
              onClick={() => setDialogOpen(true)}
              aria-label='New message'
            >
              <Plus className='size-4' />
            </Button>
          </div>
          <div className='nv-scroll-hide flex-1 overflow-y-auto'>
            {rooms.length === 0 ? (
              <div className='text-muted-foreground p-4 text-sm'>
                No conversations. Click + to start one.
              </div>
            ) : (
              <div>
                {sections.fav.length > 0 && (
                  <div>
                    <div className='text-muted-foreground px-3 pt-3 pb-1 text-[11px] font-medium tracking-wide'>
                      FAVORITES
                    </div>
                    <ul className='divide-border/60 divide-y'>
                      {sections.fav.map(LeftItem)}
                    </ul>
                  </div>
                )}
                <div className='px-3 pt-3'>
                  <button
                    className='text-muted-foreground hover:text-foreground flex items-center gap-2 text-[11px] font-medium tracking-wide'
                    onClick={() => setDmsOpen((v) => !v)}
                    aria-label='Toggle DMs'
                  >
                    {dmsOpen ? (
                      <ChevronDown className='size-3' />
                    ) : (
                      <ChevronRight className='size-3' />
                    )}
                    <span>DMS</span>
                    <span className='bg-muted text-muted-foreground ml-1 rounded-full px-1.5 py-0.5 text-[10px]'>
                      {sections.dms.length}
                    </span>
                  </button>
                </div>
                {dmsOpen && (
                  <ul className='divide-border/60 divide-y'>
                    {sections.dms.length ? (
                      sections.dms.map(LeftItem)
                    ) : (
                      <li className='text-muted-foreground px-3 py-6 text-xs'>
                        No direct messages yet.
                      </li>
                    )}
                  </ul>
                )}
                <div className='px-3 pt-3'>
                  <button
                    className='text-muted-foreground hover:text-foreground flex items-center gap-2 text-[11px] font-medium tracking-wide'
                    onClick={() => setGroupsOpen((v) => !v)}
                    aria-label='Toggle groups'
                  >
                    {groupsOpen ? (
                      <ChevronDown className='size-3' />
                    ) : (
                      <ChevronRight className='size-3' />
                    )}
                    <span>GROUPS</span>
                    <span className='bg-muted text-muted-foreground ml-1 rounded-full px-1.5 py-0.5 text-[10px]'>
                      {sections.groups.length}
                    </span>
                  </button>
                </div>
                {groupsOpen && (
                  <ul className='divide-border/60 divide-y'>
                    {sections.groups.length ? (
                      sections.groups.map(LeftItem)
                    ) : (
                      <li className='text-muted-foreground px-3 py-6 text-xs'>
                        No groups yet.
                      </li>
                    )}
                  </ul>
                )}
                <div className='text-muted-foreground px-3 pt-3 pb-1 text-[11px] font-medium tracking-wide'>
                  SHIPMENTS
                </div>
                <ul className='divide-border/60 divide-y'>
                  {sections.shipments.length ? (
                    sections.shipments.map(LeftItem)
                  ) : (
                    <li className='text-muted-foreground px-3 py-6 text-xs'>
                      No shipments yet.
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Main area */}
        <div
          className={clsx(
            'min-h-0 flex-1 flex-col',
            // On mobile, hide main area when listing; show when chatting
            mobileView === 'list' ? 'hidden md:flex' : 'flex'
          )}
        >
          {active ? (
            <>
              {/* Chat header */}
              <div className='bg-background/60 supports-[backdrop-filter]:bg-background/50 flex h-14 items-center gap-3 border-b px-3 shadow-sm backdrop-blur'>
                <Button
                  variant='ghost'
                  size='icon'
                  className='md:hidden'
                  onClick={() => setMobileView('list')}
                  aria-label='Back'
                >
                  <ArrowLeft className='size-4' />
                </Button>
                {/* Chat avatar(s) */}
                {active.type === 'dm' ? (
                  (() => {
                    const other =
                      active.members.find((m) => m.id !== me?.id) ||
                      active.members[0];
                    return (
                      <div className='relative shrink-0'>
                        <Avatar className='size-8 md:size-9'>
                          <AvatarImage src={other?.avatar_url || undefined} />
                          <AvatarFallback>
                            {(other?.display_name || other?.username || 'U')
                              .slice(0, 2)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className='border-background absolute -right-0.5 -bottom-0.5 inline-block size-2.5 rounded-full border-2 bg-emerald-500' />
                      </div>
                    );
                  })()
                ) : active.type === 'group' ? (
                  <div className='relative h-8 w-10 shrink-0'>
                    {active.members.slice(0, 2).map((m, i) => (
                      <Avatar
                        key={m.id}
                        className={clsx(
                          'border-background absolute size-7 border',
                          i === 0 ? 'top-0 left-0 z-10' : 'top-1 left-3'
                        )}
                      >
                        <AvatarImage src={m.avatar_url || undefined} />
                        <AvatarFallback>
                          {(m.display_name || m.username || 'U')
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                ) : (
                  <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-gradient-to-br from-orange-500/20 to-orange-600/10 text-[10px] font-semibold text-orange-600'>
                    S
                  </div>
                )}

                {/* Title */}
                <div className='min-w-0 flex-1'>
                  <div className='truncate text-[15px] font-semibold md:text-base'>
                    {roomDisplayName || 'Conversation'}
                  </div>
                  {active.type === 'group' ? (
                    <div className='text-muted-foreground hidden truncate text-[11px] md:block'>
                      {active.members
                        .map((m) => m.display_name || m.username || 'User')
                        .slice(0, 5)
                        .join(', ')}
                      {active.members.length > 5
                        ? `, +${active.members.length - 5} more`
                        : ''}
                    </div>
                  ) : (
                    <div className='text-muted-foreground hidden truncate text-[11px] md:block'>
                      {active.type === 'shipment'
                        ? 'Shipment'
                        : 'Direct message'}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <TooltipProvider delayDuration={250}>
                  <div className='flex items-center gap-1'>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant='ghost'
                          size='icon'
                          onClick={() => activeId && toggleStar(activeId)}
                          aria-label='Star'
                        >
                          {activeId && starred.has(activeId) ? (
                            <Star className='size-4 fill-current' />
                          ) : (
                            <Star className='size-4' />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Star</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant='ghost'
                          size='icon'
                          onClick={() => setSideOpen((v) => !v)}
                          aria-label='Toggle details'
                        >
                          {sideOpen ? (
                            <PanelRightOpen className='size-4' />
                          ) : (
                            <PanelRight className='size-4' />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Toggle details</TooltipContent>
                    </Tooltip>
                    <DropdownMenu>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant='ghost'
                              size='icon'
                              aria-label='More'
                            >
                              <MoreHorizontal className='size-4' />
                            </Button>
                          </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent>More</TooltipContent>
                      </Tooltip>
                      <DropdownMenuContent align='end'>
                        <DropdownMenuItem
                          onClick={() => {
                            if (!active?.id) return;
                            toggleMute(active.id);
                            toast.success(
                              muted.has(active.id) ? 'Unmuted' : 'Muted'
                            );
                          }}
                        >
                          {active && muted.has(active.id) ? 'Unmute' : 'Mute'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            if (!active?.id) return;
                            try {
                              localStorage.setItem(
                                `nv_last_seen_${active.id}`,
                                '0'
                              );
                            } catch {
                              /* ignore */
                            }
                            setChatMount((k) => k + 1);
                            toast.success('Marked as unread');
                          }}
                        >
                          Mark as unread
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            if (!active?.id) return;
                            setConfirm({ rid: active.id, type: 'leave' });
                          }}
                        >
                          Leave conversation
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TooltipProvider>
              </div>

              {/* Chat + details */}
              <div className='flex min-h-0 flex-1'>
                <div className='min-w-0 flex-1'>
                  <RealtimeChat
                    key={active.id + ':' + chatMount}
                    roomName={active.id}
                    nobleId={nobleId}
                    userId={me?.id}
                    messages={initialMessages}
                    roomTitle={roomDisplayName || undefined}
                    initialToSend={
                      pendingInitial?.roomId === active.id
                        ? pendingInitial.text
                        : undefined
                    }
                    onInitialConsumed={() => setPendingInitial(null)}
                    mode={'chat'}
                  />
                </div>
                {/* Right sidebar */}
                <div
                  className={clsx(
                    'bg-card/30 hidden w-[360px] shrink-0 flex-col border-l md:flex',
                    sideOpen ? 'md:flex' : 'md:hidden'
                  )}
                >
                  <div className='bg-background/60 supports-[backdrop-filter]:bg-background/50 flex h-12 items-center justify-between border-b px-3 backdrop-blur'>
                    <div className='font-medium'>Details</div>
                    <Button
                      variant='ghost'
                      size='icon'
                      onClick={() => setSideOpen(false)}
                      aria-label='Close'
                    >
                      <X className='size-4' />
                    </Button>
                  </div>
                  <div className='flex min-h-0 flex-1 flex-col overflow-hidden p-0'>
                    {(() => {
                      if (!active) return null;
                      const act = active as RoomListItem;
                      const msgs = detailsRows.length
                        ? detailsRows.map((r) => ({ content: r.content }))
                        : initialMessages || [];
                      const links = msgs.flatMap((m: any) =>
                        Array.from(
                          ((m.content || '') as string).matchAll(
                            /https?:\/\/\S+/g
                          )
                        ).map((x) => x[0])
                      );
                      const files = msgs.flatMap((m: any) =>
                        Array.from(
                          ((m.content || '') as string).matchAll(
                            /\[([^\]]+)]\(([^)]+)\)/g
                          )
                        ).map((x) => ({ name: x[1], url: x[2] }))
                      );
                      const mentions = msgs.flatMap((m: any) =>
                        Array.from(
                          ((m.content || '') as string).matchAll(
                            /@([\w._-]{2,32})/g
                          )
                        ).map((x) => x[1])
                      );
                      const q = detailsQuery.trim().toLowerCase();
                      const filter = (s: string) =>
                        !q || s.toLowerCase().includes(q);
                      const linksF = links.filter(filter);
                      const filesF = files.filter(
                        (f) => filter(f.name) || filter(f.url)
                      );
                      const mentionsF = mentions.filter(filter);

                      const mediaCount = linksF.length + filesF.length;
                      return (
                        <Tabs
                          defaultValue='members'
                          className='flex min-h-0 flex-1 flex-col'
                        >
                          {/* Pinned Info at the very top */}
                          <div className='p-3 pb-2'>
                            {act.type === 'dm' ? (
                              (() => {
                                const other =
                                  act.members.find((m) => m.id !== me?.id) ||
                                  act.members[0];
                                if (!other) return null;
                                return (
                                  <div className='overflow-hidden rounded-md border shadow-sm'>
                                    <ProfileHoverDetails
                                      id={other.id}
                                      fallbackName={
                                        other.display_name ||
                                        other.username ||
                                        'User'
                                      }
                                      initialAvatar={
                                        other.avatar_url || undefined
                                      }
                                    />
                                  </div>
                                );
                              })()
                            ) : (
                              <div className='space-y-3'>
                                <div className='overflow-hidden rounded-md border shadow-sm'>
                                  <GroupBanner
                                    ids={act.members.map((m) => m.id)}
                                  />
                                  <div className='p-3'>
                                    {/* Title editor */}
                                    <div className='mb-2 flex items-center gap-2'>
                                      {editingTitle !== null ? (
                                        <div className='flex w-full items-center gap-2'>
                                          <Input
                                            autoFocus
                                            value={editingTitle}
                                            onChange={(e) =>
                                              setEditingTitle(e.target.value)
                                            }
                                            placeholder='Group title'
                                            className='h-8'
                                          />
                                          <Button
                                            size='icon'
                                            variant='ghost'
                                            disabled={savingTitle}
                                            onClick={() =>
                                              saveGroupTitle(
                                                act.id,
                                                editingTitle?.trim()
                                                  ? editingTitle.trim()
                                                  : null
                                              )
                                            }
                                            aria-label='Save title'
                                          >
                                            <Check className='size-4' />
                                          </Button>
                                        </div>
                                      ) : (
                                        <div className='flex min-w-0 items-center gap-2'>
                                          <div className='truncate font-medium'>
                                            {act.title || 'Untitled group'}
                                          </div>
                                          <Button
                                            size='icon'
                                            variant='ghost'
                                            onClick={() =>
                                              setEditingTitle(act.title || '')
                                            }
                                            aria-label='Edit title'
                                          >
                                            <Pencil className='size-4' />
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                    {/* Large avatar stack */}
                                    <div className='mb-2 flex -space-x-3'>
                                      {act.members.slice(0, 6).map((m) => (
                                        <Avatar
                                          key={m.id}
                                          className='ring-background size-10 ring-2'
                                        >
                                          <AvatarImage
                                            src={m.avatar_url || undefined}
                                          />
                                          <AvatarFallback className='text-xs'>
                                            {(
                                              m.display_name ||
                                              m.username ||
                                              'U'
                                            )
                                              .slice(0, 2)
                                              .toUpperCase()}
                                          </AvatarFallback>
                                        </Avatar>
                                      ))}
                                      {act.members.length > 6 && (
                                        <div className='bg-muted text-muted-foreground ring-background flex size-10 items-center justify-center rounded-full text-xs ring-2'>
                                          +{act.members.length - 6}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Sticky Tabs header with filter */}
                          <div className='bg-background/60 supports-[backdrop-filter]:bg-background/50 sticky top-0 z-10 flex items-center gap-2 border-b p-3 pt-2 backdrop-blur'>
                            <TabsList>
                              <TabsTrigger value='members'>
                                Members
                                <span className='bg-muted text-muted-foreground ml-1 rounded-full px-1.5 py-0.5 text-[10px]'>
                                  {act.members.length}
                                </span>
                              </TabsTrigger>
                              <TabsTrigger value='media'>
                                Media
                                <span className='bg-muted text-muted-foreground ml-1 rounded-full px-1.5 py-0.5 text-[10px]'>
                                  {mediaCount}
                                </span>
                              </TabsTrigger>
                              <TabsTrigger value='mentions'>
                                Mentions
                                <span className='bg-muted text-muted-foreground ml-1 rounded-full px-1.5 py-0.5 text-[10px]'>
                                  {mentionsF.length}
                                </span>
                              </TabsTrigger>
                            </TabsList>
                            <div className='ml-auto w-40 md:w-48'>
                              <Input
                                placeholder='Filter…'
                                value={detailsQuery}
                                onChange={(e) =>
                                  setDetailsQuery(e.target.value)
                                }
                              />
                            </div>
                          </div>

                          <TabsContent
                            value='members'
                            className='nv-scroll-hide min-h-0 overflow-y-auto p-3 pr-1'
                          >
                            <ul className='space-y-2'>
                              {act.members
                                .filter((m) => {
                                  const t = (
                                    m.display_name ||
                                    m.username ||
                                    ''
                                  ).toLowerCase();
                                  return filter(t);
                                })
                                .map((m) => (
                                  <li
                                    key={m.id}
                                    className='flex items-center gap-2 rounded-md border p-2'
                                  >
                                    <Avatar className='size-7'>
                                      <AvatarImage
                                        src={m.avatar_url || undefined}
                                      />
                                      <AvatarFallback className='text-[10px]'>
                                        {(m.display_name || m.username || 'U')
                                          .slice(0, 2)
                                          .toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className='min-w-0'>
                                      <div className='truncate text-sm font-medium'>
                                        {m.display_name || m.username || 'User'}
                                      </div>
                                      {m.username && (
                                        <div className='text-muted-foreground truncate text-[11px]'>
                                          @{m.username}
                                        </div>
                                      )}
                                    </div>
                                  </li>
                                ))}
                            </ul>
                          </TabsContent>

                          <TabsContent
                            value='media'
                            className='nv-scroll-hide min-h-0 overflow-y-auto p-3 pr-1'
                          >
                            <div className='space-y-4'>
                              {(() => {
                                const isImg = (u: string) =>
                                  /\.(png|jpg|jpeg|gif|webp|bmp|svg)(\?|#|$)/i.test(
                                    u
                                  );
                                const imageLinks = [
                                  ...linksF.filter((l) => isImg(l)),
                                  ...filesF
                                    .filter((f) => f.url && isImg(f.url))
                                    .map((f) => f.url as string)
                                ];
                                if (!imageLinks.length) return null;
                                const [showCount, more] = [
                                  48,
                                  Math.max(0, imageLinks.length - 48)
                                ];
                                return (
                                  <div className='rounded-md border p-3 shadow-sm'>
                                    <div className='mb-2 flex items-center gap-2'>
                                      <ChevronRight className='text-muted-foreground size-4' />
                                      <div className='font-medium'>Images</div>
                                      <span className='text-muted-foreground ml-auto text-xs'>
                                        {imageLinks.length}
                                      </span>
                                    </div>
                                    <div
                                      className='grid gap-2'
                                      style={{
                                        gridTemplateColumns:
                                          'repeat(auto-fit, minmax(84px, 1fr))'
                                      }}
                                    >
                                      {imageLinks
                                        .slice(0, showCount)
                                        .map((src, i) => (
                                          <a
                                            key={i}
                                            href={src}
                                            target='_blank'
                                            rel='noreferrer noopener'
                                            className='group block'
                                          >
                                            <img
                                              src={src}
                                              alt=''
                                              loading='lazy'
                                              className='aspect-square w-full rounded-md border object-cover transition-transform group-hover:scale-[1.01]'
                                            />
                                          </a>
                                        ))}
                                    </div>
                                    {more > 0 && (
                                      <div className='mt-2 text-right'>
                                        <Button
                                          variant='outline'
                                          size='sm'
                                          onClick={() =>
                                            setDetailsPage((p) => p + 1)
                                          }
                                        >
                                          Show more ({more})
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                              <div className='rounded-md border p-3 shadow-sm'>
                                <div className='mb-2 flex items-center gap-2'>
                                  <ChevronRight className='text-muted-foreground size-4' />
                                  <div className='font-medium'>
                                    Shared links
                                  </div>
                                  <span className='text-muted-foreground ml-auto text-xs'>
                                    {linksF.length}
                                  </span>
                                </div>
                                {linksF.length ? (
                                  <ul className='space-y-1 text-sm'>
                                    {linksF.slice(0, 400).map((l, i) => (
                                      <li key={i} className='truncate'>
                                        <a
                                          className='text-primary hover:underline'
                                          href={l}
                                          target='_blank'
                                          rel='noreferrer noopener'
                                        >
                                          {l}
                                        </a>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <div className='text-muted-foreground text-xs'>
                                    No links
                                  </div>
                                )}
                              </div>
                              <div className='rounded-md border p-3 shadow-sm'>
                                <div className='mb-2 flex items-center gap-2'>
                                  <ChevronRight className='text-muted-foreground size-4' />
                                  <div className='font-medium'>
                                    Shared files
                                  </div>
                                  <span className='text-muted-foreground ml-auto text-xs'>
                                    {filesF.length}
                                  </span>
                                </div>
                                {filesF.length ? (
                                  <ul className='space-y-2 text-sm'>
                                    {filesF.slice(0, 400).map((f, i) => (
                                      <li key={i} className='truncate'>
                                        <a
                                          className='text-primary hover:underline'
                                          href={f.url}
                                          target='_blank'
                                          rel='noreferrer noopener'
                                        >
                                          {f.name}
                                        </a>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <div className='text-muted-foreground text-xs'>
                                    No files
                                  </div>
                                )}
                              </div>
                            </div>
                          </TabsContent>

                          <TabsContent
                            value='mentions'
                            className='nv-scroll-hide min-h-0 overflow-y-auto p-3 pr-1'
                          >
                            {(() => {
                              const list = (
                                detailsRows.length
                                  ? detailsRows
                                  : initialMessages
                              )
                                .slice()
                                .map((m: any) => ({
                                  id: m.id || undefined,
                                  content: m.content,
                                  created_at: m.created_at || m.createdAt,
                                  user_id:
                                    m.user_id || m.sender_id || m.user?.id
                                }));
                              const items: Array<{
                                id?: string;
                                content: string;
                                createdAt?: string;
                                user?: string;
                              }> = [];
                              for (const m of list) {
                                const c = String(m.content || '');
                                const matches = Array.from(
                                  c.matchAll(/@([\w._-]{2,32})/g)
                                );
                                if (!matches.length) continue;
                                items.push({
                                  id: m.id,
                                  content: c,
                                  createdAt: m.created_at,
                                  user: m.user_id
                                });
                              }
                              const fmt = (iso?: string) => {
                                if (!iso) return '';
                                const d = new Date(iso);
                                if (!isFinite(d.getTime())) return '';
                                return new Intl.DateTimeFormat(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                }).format(d);
                              };
                              if (!items.length)
                                return (
                                  <div className='text-muted-foreground text-xs'>
                                    No mentions
                                  </div>
                                );
                              const nameMap = makeNameMap(act);
                              return (
                                <ul className='space-y-2'>
                                  {items.slice(0, 400).map((it, i) => {
                                    const label =
                                      nameMap.get(String(it.user)) || 'User';
                                    const preview = (it.content || '').slice(
                                      0,
                                      160
                                    );
                                    // Find avatar
                                    const member = act.members.find(
                                      (m) => m.id === it.user
                                    );
                                    return (
                                      <li key={it.id || i}>
                                        <button
                                          className='hover:bg-accent/50 w-full rounded-md border p-2 text-left shadow-sm transition-colors'
                                          onClick={() => {
                                            if (!it.id) return;
                                            const el = document.getElementById(
                                              `mid-${it.id}`
                                            );
                                            if (el)
                                              el.scrollIntoView({
                                                behavior: 'smooth',
                                                block: 'center'
                                              });
                                          }}
                                        >
                                          <div className='flex items-start gap-2'>
                                            <Avatar className='mt-0.5 size-7'>
                                              <AvatarImage
                                                src={
                                                  member?.avatar_url ||
                                                  undefined
                                                }
                                              />
                                              <AvatarFallback className='text-[10px]'>
                                                {(label || 'U')
                                                  .slice(0, 2)
                                                  .toUpperCase()}
                                              </AvatarFallback>
                                            </Avatar>
                                            <div className='min-w-0 flex-1'>
                                              <div className='flex items-center gap-2'>
                                                <div className='truncate text-sm font-medium'>
                                                  {label}
                                                </div>
                                                <span className='text-muted-foreground text-[11px]'>
                                                  •
                                                </span>
                                                <time className='text-muted-foreground text-[11px]'>
                                                  {fmt(it.createdAt)}
                                                </time>
                                              </div>
                                              <div className='text-muted-foreground mt-0.5 truncate text-[12px]'>
                                                {preview}
                                                {preview.length >= 160
                                                  ? '…'
                                                  : ''}
                                              </div>
                                            </div>
                                          </div>
                                        </button>
                                      </li>
                                    );
                                  })}
                                </ul>
                              );
                            })()}
                          </TabsContent>

                          <div className='mt-2 flex items-center gap-2 border-t pt-2'>
                            <Button
                              variant='outline'
                              size='sm'
                              onClick={() => setDetailsPage((p) => p + 1)}
                            >
                              Load more
                            </Button>
                            <Button
                              variant='ghost'
                              size='sm'
                              onClick={() => {
                                setDetailsPage(0);
                                setDetailsRows([]);
                              }}
                            >
                              Refresh
                            </Button>
                          </div>
                        </Tabs>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className='text-muted-foreground flex h-full items-center justify-center text-sm'>
              Select a conversation to start chatting.
            </div>
          )}
        </div>
      </div>

      {/* Modals and dialogs */}
      <NewMessageDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        fromEmail={me?.email ?? null}
        onSubmit={async ({
          recipientIds,
          text
        }: {
          recipientIds: string[];
          text: string;
        }) => {
          if (!me?.id) {
            toast.error('You must be signed in.');
            return;
          }
          if (recipientIds.length === 1) {
            const { data, error } = await supabase.rpc(
              'get_or_create_dm_room',
              { p_user1: me.id, p_user2: recipientIds[0] }
            );
            if (error || !data) {
              toast.error(error?.message || 'Could not start conversation');
              return;
            }
            const rid = data as string;
            await refreshRoomsAndFocus(rid);
            setDialogOpen(false);
            setPendingInitial({ roomId: rid, text: text.trim() });
            toast.success('Message sent');
          } else if (recipientIds.length > 1) {
            const ids = Array.from(new Set([me.id, ...recipientIds]));
            const { data: rid, error } = await supabase.rpc(
              'create_group_room',
              { p_title: null, p_member_ids: ids }
            );
            if (error || !rid) {
              toast.error(error?.message || 'Could not create group');
              return;
            }
            await refreshRoomsAndFocus(rid as string);
            setDialogOpen(false);
            if (text.trim())
              setPendingInitial({ roomId: rid as string, text: text.trim() });
            toast.success('Group message sent');
          }
        }}
      />

      {/* Confirm dialogs */}
      <AlertDialog
        open={!!confirm}
        onOpenChange={(o) => {
          if (!o) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.type === 'leave'
                ? 'Delete conversation from your inbox?'
                : 'Delete this conversation for everyone?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.type === 'leave'
                ? 'You will leave this conversation. Others will keep their history.'
                : 'This will permanently delete the room and its messages for all members.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirm(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirm || !me?.id) return;
                const rid = confirm.rid;
                if (confirm.type === 'leave') {
                  const del = await supabase
                    .from('chat_members')
                    .delete()
                    .match({ room_id: rid, user_id: me.id });
                  if (del.error) {
                    toast.error(del.error.message);
                    return;
                  }
                } else {
                  const delAll = await supabase
                    .from('chat_rooms')
                    .delete()
                    .eq('id', rid);
                  if (delAll.error) {
                    toast.error(delAll.error.message);
                    return;
                  }
                }
                setConfirm(null);
                await refreshRoomsAndFocus(
                  activeId === rid ? undefined : activeId || undefined
                );
                const next = rooms.find((x) => x.id !== rid)?.id || null;
                setActiveId(next);
                toast.success('Deleted');
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
