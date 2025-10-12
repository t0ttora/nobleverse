'use client';
import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
// Card extraction helpers from chat-message
import { extractMeta, extractAttachments } from '@/components/chat-message';
import { extractCardsFromBody } from '@/components/chat-message';
import { useSearchParams } from 'next/navigation';
import { RealtimeChat } from '@/components/realtime-chat';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger
} from '@/components/ui/hover-card';
import { Button } from '@/components/ui/button';
import { SidePanel } from '@/components/ui/side-panel';
import { Input } from '@/components/ui/input';
import {
  Plus,
  Search,
  ArrowLeft,
  Info,
  Star,
  StarOff,
  X,
  ChevronRight,
  ChevronDown,
  Folder as FolderIcon,
  File as FileIcon
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

// Minimal Files model for inline folder browsing
type InlineFileItem = {
  id: string;
  parent_id: string | null;
  name: string;
  type: string; // 'folder' or file kind
  mime_type?: string | null;
  ext?: string | null;
  size_bytes?: number | null;
  storage_path?: string | null;
  updated_at?: string | null;
};

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
  // In-app file preview (NobleFiles-style)
  const [filePreview, setFilePreview] = useState<null | {
    item: {
      id: string;
      name: string;
      ext?: string | null;
      mime_type?: string | null;
      storage_path?: string | null;
    };
    url: string;
  }>(null);
  // Inline folder browsing panel
  const [folderView, setFolderView] = useState<null | {
    parentId: string | null;
    breadcrumb: { id: string | null; name: string }[];
    items: InlineFileItem[];
    loading: boolean;
    error?: string | null;
  }>(null);
  // Collapsible states for sections
  const [dmsOpen, setDmsOpen] = useState(true);
  const [groupsOpen, setGroupsOpen] = useState(true);

  const search = useSearchParams();
  const [query, setQuery] = useState('');

  // Favorites (starred rooms) persisted locally
  const STAR_KEY = 'nv_starred_rooms';
  const [starred, setStarred] = useState<Set<string>>(new Set());

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
  useEffect(() => {
    let stop = false;
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      const email = auth.user?.email ?? null;
      setMe(uid ? { id: uid, email } : null);
      if (!uid) return;

      const { data: rpc } = await supabase.rpc('get_inbox_rooms');
      const arr: RoomListItem[] = (rpc || []).map((r: any) => ({
        id: r.room_id as string,
        // extend type: include 'shipment'
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
      if (!stop) setRooms(arr);

      const qRoom = search.get('room');
      if (!stop && (qRoom || (arr[0]?.id && !activeId)))
        setActiveId((qRoom as string) || arr[0].id);
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
  }, []);

  // Listen to global preview requests from chat cards
  useEffect(() => {
    const handler = (ev: Event) => {
      const cev = ev as CustomEvent<{
        id: string;
        name: string;
        kind?: 'file' | 'folder';
        ext?: string | null;
        mime_type?: string | null;
        storage_path?: string | null;
      }>;
      const d = cev.detail;
      if (!d) return;
      try {
        ev.preventDefault();
      } catch {}
      // Folder preview: open inline panel and list folder contents
      if (d.kind === 'folder') {
        setFolderView({
          parentId: d.id,
          breadcrumb: [{ id: d.id, name: d.name || 'Folder' }],
          items: [],
          loading: true,
          error: null
        });
        (async () => {
          try {
            const params = new URLSearchParams();
            params.set('parentId', d.id);
            const res = await fetch(`/api/noblesuite/files?${params}`);
            const json = await res.json();
            if (!json?.ok) throw new Error(json?.error || 'LOAD_FAILED');
            setFolderView((prev) =>
              prev
                ? {
                    ...prev,
                    items: (json.items || []) as InlineFileItem[],
                    loading: false
                  }
                : prev
            );
          } catch (e: any) {
            setFolderView((prev) =>
              prev
                ? {
                    ...prev,
                    loading: false,
                    error: e?.message || 'LOAD_FAILED'
                  }
                : prev
            );
          }
        })();
        return;
      }
      if (!d.storage_path) return;
      (async () => {
        try {
          const bucket = process.env.NEXT_PUBLIC_FILES_BUCKET || 'files';
          const { data: signed, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(d.storage_path!, 300);
          if (error) throw error;
          const fallback = supabase.storage
            .from(bucket)
            .getPublicUrl(d.storage_path!).data?.publicUrl;
          const url = signed?.signedUrl || fallback;
          if (!url) throw new Error('Link unavailable');
          setFilePreview({ item: d, url });
        } catch (e: any) {
          toast.error('Unable to open file', {
            description: e?.message || undefined
          });
        }
      })();
    };
    window.addEventListener('noble:files:preview', handler as any);
    return () =>
      window.removeEventListener('noble:files:preview', handler as any);
  }, []);

  // Load starred list once
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STAR_KEY);
      if (raw) setStarred(new Set(JSON.parse(raw)));
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

  // Derived
  // Chat preview güncelleme: aktif konuşmada yeni mesaj gelirse rooms listesini güncelle
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

  // Refresh + focus
  async function refreshRoomsAndFocus(roomId?: string) {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id ?? null;
    if (!uid) return;
    const { data: rpc } = await supabase.rpc('get_inbox_rooms');
    const arr: RoomListItem[] = (rpc || []).map((r: any) => ({
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
    async function loadMessages(rid: string, type: RoomListItem['type']) {
      const rm = rooms.find((r) => r.id === rid);
      const nameMap = new Map<string, string>();
      rm?.members.forEach((m) => {
        const n = (m.display_name || m.username || 'User') as string;
        if (m.id) nameMap.set(m.id, n);
      });

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
            const rm = rooms.find((r) => r.id === activeId);
            const nameMap = new Map<string, string>();
            rm?.members.forEach((m) => {
              const n = (m.display_name || m.username || 'User') as string;
              if (m.id) nameMap.set(m.id, n);
            });
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
            'group hover:bg-accent/40 flex w-full items-start gap-3 p-3 transition-colors',
            isActive && 'bg-accent/40'
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
                    case 'suite_files_card':
                      label = `📁 Files: ${(card.items || []).length} shared`;
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
                  ⋯
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
    <div className='bg-background flex h-full min-h-0 w-full flex-1 overflow-hidden'>
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
        <div className='flex-1 overflow-y-auto'>
          {rooms.length === 0 ? (
            <div className='text-muted-foreground p-6 text-sm'>
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
              <div>
                <div className='text-muted-foreground flex items-center gap-2 px-3 pt-3 pb-1 text-[11px] font-medium tracking-wide'>
                  <span className='bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px]'>
                    {sections.dms.length}
                  </span>
                  <button
                    className='hover:text-foreground flex items-center gap-1'
                    onClick={() => setDmsOpen((v) => !v)}
                    aria-label='Toggle direct messages'
                  >
                    {dmsOpen ? (
                      <ChevronDown className='size-3' />
                    ) : (
                      <ChevronRight className='size-3' />
                    )}
                    <span>DIRECT MESSAGES</span>
                  </button>
                </div>
                {dmsOpen && (
                  <ul className='divide-border/60 divide-y'>
                    {sections.dms.length ? (
                      sections.dms.map(LeftItem)
                    ) : (
                      <li className='text-muted-foreground px-3 py-6 text-xs'>
                        No direct messages.
                      </li>
                    )}
                  </ul>
                )}
              </div>
              <div>
                <div className='text-muted-foreground flex items-center gap-2 px-3 pt-3 pb-1 text-[11px] font-medium tracking-wide'>
                  <span className='bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px]'>
                    {sections.groups.length}
                  </span>
                  <button
                    className='hover:text-foreground flex items-center gap-1'
                    onClick={() => setGroupsOpen((v) => !v)}
                    aria-label='Toggle groups'
                  >
                    {groupsOpen ? (
                      <ChevronDown className='size-3' />
                    ) : (
                      <ChevronRight className='size-3' />
                    )}
                    <span>GROUPS</span>
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
              </div>
              <div>
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
            </div>
          )}
        </div>
      </div>

      {/* Right chat */}
      <div
        className={clsx(
          'bg-background min-w-0 flex-1 flex-col',
          mobileView === 'chat' ? 'flex md:flex' : 'hidden md:flex'
        )}
      >
        {active ? (
          <>
            {/* Header */}
            <div className='bg-background/60 supports-[backdrop-filter]:bg-background/50 flex h-12 shrink-0 items-center justify-between border-b px-4 backdrop-blur'>
              <div className='flex min-w-0 items-center gap-2'>
                <Button
                  variant='ghost'
                  size='icon'
                  className='mr-1 md:hidden'
                  onClick={() => setMobileView('list')}
                  aria-label='Back to conversations'
                >
                  <ArrowLeft className='size-4' />
                </Button>
                {active.type === 'shipment' ? (
                  <div className='flex h-8 w-8 items-center justify-center rounded-md border bg-gradient-to-br from-orange-500/20 to-orange-600/10 text-[10px] font-semibold text-orange-600'>
                    SHP
                  </div>
                ) : active.type === 'group' ? (
                  <div className='relative h-8 w-8'>
                    {active.members.slice(0, 3).map((m, i) => (
                      <Avatar
                        key={m.id}
                        className={clsx(
                          'border-background absolute size-5 border',
                          i === 0
                            ? 'top-0 left-0'
                            : i === 1
                              ? 'top-1 left-2'
                              : 'top-2 left-4'
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
                  <Avatar className='size-8'>
                    {(() => {
                      const other =
                        active.members.find((m) => m.id !== me?.id) ||
                        active.members[0];
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
                <div className='min-w-0'>
                  {active.type === 'shipment' ? (
                    <div className='truncate font-medium'>
                      {active.title || 'Shipment'}
                    </div>
                  ) : active.type === 'group' ? (
                    <div className='truncate font-medium'>
                      {active.title ||
                        active.members
                          .map((m) => m.username || m.display_name || 'user')
                          .slice(0, 3)
                          .join(', ') +
                          (active.members.length > 3 ? ' and more' : '')}
                    </div>
                  ) : (
                    (() => {
                      const other = active.members.find((m) => m.id !== me?.id);
                      const label =
                        other?.username ||
                        other?.display_name ||
                        'Direct message';
                      return (
                        <HoverCard>
                          <HoverCardTrigger asChild>
                            <div className='cursor-default truncate font-medium'>
                              {label}
                            </div>
                          </HoverCardTrigger>
                          <HoverCardContent
                            className='w-96 overflow-hidden p-0'
                            align='start'
                          >
                            <ProfileHoverDetails
                              id={other?.id || ''}
                              fallbackName={label}
                              initialAvatar={other?.avatar_url || undefined}
                            />
                          </HoverCardContent>
                        </HoverCard>
                      );
                    })()
                  )}
                </div>
              </div>
              <div className='flex items-center gap-1'>
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={() => activeId && toggleStar(activeId)}
                  aria-label='Star'
                >
                  {activeId && starred.has(activeId) ? (
                    <Star className='size-4 fill-current' />
                  ) : (
                    <StarOff className='size-4' />
                  )}
                </Button>
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={() => setSideOpen((v) => !v)}
                  aria-label='Toggle details'
                >
                  <Info className='size-4' />
                </Button>
                <Button variant='ghost' size='icon' aria-label='More'>
                  ⋯
                </Button>
              </div>
            </div>

            {/* Chat + details */}
            <div className='flex min-h-0 flex-1'>
              <div className='min-w-0 flex-1'>
                <RealtimeChat
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
                  'bg-card/30 hidden w-[340px] shrink-0 flex-col border-l md:flex',
                  sideOpen ? 'md:flex' : 'md:hidden'
                )}
              >
                <div className='flex h-12 items-center justify-between border-b px-3'>
                  <div className='font-medium'>Group info</div>
                  <Button
                    variant='ghost'
                    size='icon'
                    onClick={() => setSideOpen(false)}
                    aria-label='Close'
                  >
                    <X className='size-4' />
                  </Button>
                </div>
                <div className='flex-1 overflow-y-auto'>
                  {active?.type === 'dm' &&
                    (() => {
                      const other =
                        active.members.find((m) => m.id !== me?.id) ||
                        active.members[0];
                      if (!other) return null;
                      return (
                        <div className='border-b'>
                          <ProfileHoverDetails
                            id={other.id}
                            fallbackName={
                              other.display_name || other.username || 'User'
                            }
                            initialAvatar={other.avatar_url || undefined}
                          />
                        </div>
                      );
                    })()}

                  <div className='border-b p-3'>
                    <div className='mb-2 flex items-center gap-2'>
                      <ChevronRight className='text-muted-foreground size-4' />
                      <div className='font-medium'>Members</div>
                      <span className='text-muted-foreground ml-auto text-xs'>
                        {active.members.length}
                      </span>
                    </div>
                    <ul className='space-y-2'>
                      {active.members.map((m) => (
                        <li key={m.id} className='flex items-center gap-2'>
                          <Avatar className='size-6'>
                            <AvatarImage src={m.avatar_url || undefined} />
                            <AvatarFallback className='text-[10px]'>
                              {(m.display_name || m.username || 'U')
                                .slice(0, 2)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className='min-w-0'>
                            <div className='truncate text-sm'>
                              {m.display_name || m.username || 'User'}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className='border-b p-3'>
                    <Input
                      placeholder='Search in details…'
                      value={detailsQuery}
                      onChange={(e) => setDetailsQuery(e.target.value)}
                    />
                  </div>

                  {(() => {
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
                    return (
                      <div className='space-y-4 p-3'>
                        <div>
                          <div className='mb-2 flex items-center gap-2'>
                            <ChevronRight className='text-muted-foreground size-4' />
                            <div className='font-medium'>Shared links</div>
                            <span className='text-muted-foreground ml-auto text-xs'>
                              {linksF.length}
                            </span>
                          </div>
                          {linksF.length ? (
                            <ul className='list-disc space-y-1 pl-5 text-sm'>
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
                        <div>
                          <div className='mb-2 flex items-center gap-2'>
                            <ChevronRight className='text-muted-foreground size-4' />
                            <div className='font-medium'>Shared files</div>
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
                        <div>
                          <div className='mb-2 flex items-center gap-2'>
                            <ChevronRight className='text-muted-foreground size-4' />
                            <div className='font-medium'>Mentions</div>
                            <span className='text-muted-foreground ml-auto text-xs'>
                              {mentionsF.length}
                            </span>
                          </div>
                          {mentionsF.length ? (
                            <div className='flex flex-wrap gap-1'>
                              {mentionsF.slice(0, 400).map((u, i) => (
                                <span
                                  key={i}
                                  className='bg-muted rounded px-2 py-0.5 text-xs'
                                >
                                  @{u}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className='text-muted-foreground text-xs'>
                              No mentions
                            </div>
                          )}
                        </div>
                        <div className='flex items-center gap-2 pt-2'>
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
                      </div>
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
      {/* SidePanel for file preview */}
      <SidePanel
        open={!!filePreview || !!folderView}
        onClose={() => {
          setFilePreview(null);
          setFolderView(null);
        }}
        title={
          folderView ? (
            <div className='flex min-w-0 items-center gap-2'>
              <FolderIcon className='size-4' />
              <span className='truncate'>
                {folderView.breadcrumb[folderView.breadcrumb.length - 1]
                  ?.name || 'Folder'}
              </span>
            </div>
          ) : filePreview?.item ? (
            <div className='flex min-w-0 items-center gap-2'>
              <span className='truncate'>{filePreview.item.name}</span>
            </div>
          ) : (
            'Preview'
          )
        }
      >
        {folderView ? (
          <div className='flex h-full min-h-[60vh] flex-col'>
            {/* Breadcrumb */}
            <div className='text-muted-foreground flex items-center gap-1 px-3 pt-3 text-xs'>
              {folderView.breadcrumb.map((b, idx) => (
                <span
                  key={`${b.id ?? 'root'}-${idx}`}
                  className='flex items-center gap-1'
                >
                  <button
                    className='hover:text-foreground underline-offset-2 hover:underline'
                    onClick={async () => {
                      // Navigate to this breadcrumb level
                      const nextCrumb = folderView.breadcrumb.slice(0, idx + 1);
                      const pid = nextCrumb[nextCrumb.length - 1].id;
                      setFolderView((prev) =>
                        prev
                          ? {
                              ...prev,
                              breadcrumb: nextCrumb,
                              parentId: pid || null,
                              loading: true,
                              error: null
                            }
                          : prev
                      );
                      try {
                        const params = new URLSearchParams();
                        if (pid) params.set('parentId', pid);
                        const res = await fetch(
                          `/api/noblesuite/files?${params}`
                        );
                        const json = await res.json();
                        if (!json?.ok)
                          throw new Error(json?.error || 'LOAD_FAILED');
                        setFolderView((prev) =>
                          prev
                            ? {
                                ...prev,
                                items: (json.items || []) as InlineFileItem[],
                                loading: false
                              }
                            : prev
                        );
                      } catch (e: any) {
                        setFolderView((prev) =>
                          prev
                            ? {
                                ...prev,
                                loading: false,
                                error: e?.message || 'LOAD_FAILED'
                              }
                            : prev
                        );
                      }
                    }}
                  >
                    {b.name}
                  </button>
                  {idx < folderView.breadcrumb.length - 1 && (
                    <ChevronRight className='size-3 opacity-60' />
                  )}
                </span>
              ))}
            </div>
            {/* Items */}
            <div className='flex-1 overflow-y-auto p-2'>
              {folderView.loading ? (
                <div className='text-muted-foreground p-4 text-sm'>
                  Loading…
                </div>
              ) : folderView.error ? (
                <div className='text-destructive p-4 text-sm'>
                  {folderView.error}
                </div>
              ) : folderView.items.length === 0 ? (
                <div className='text-muted-foreground p-6 text-sm'>
                  No items
                </div>
              ) : (
                <ul className='divide-border/60 divide-y'>
                  {folderView.items.map((it) => (
                    <li key={it.id}>
                      <button
                        className='hover:bg-muted/50 flex w-full items-center gap-3 px-3 py-2 text-left'
                        onClick={async () => {
                          if (it.type === 'folder') {
                            // Drill into subfolder
                            setFolderView((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    parentId: it.id,
                                    breadcrumb: [
                                      ...prev.breadcrumb,
                                      { id: it.id, name: it.name }
                                    ],
                                    loading: true,
                                    error: null
                                  }
                                : prev
                            );
                            try {
                              const params = new URLSearchParams();
                              params.set('parentId', it.id);
                              const res = await fetch(
                                `/api/noblesuite/files?${params}`
                              );
                              const json = await res.json();
                              if (!json?.ok)
                                throw new Error(json?.error || 'LOAD_FAILED');
                              setFolderView((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      items: (json.items ||
                                        []) as InlineFileItem[],
                                      loading: false
                                    }
                                  : prev
                              );
                            } catch (e: any) {
                              setFolderView((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      loading: false,
                                      error: e?.message || 'LOAD_FAILED'
                                    }
                                  : prev
                              );
                            }
                          } else if (it.storage_path) {
                            // Open file preview
                            try {
                              const bucket =
                                process.env.NEXT_PUBLIC_FILES_BUCKET || 'files';
                              const { data: signed } = await supabase.storage
                                .from(bucket)
                                .createSignedUrl(it.storage_path, 300);
                              const url =
                                signed?.signedUrl ||
                                supabase.storage
                                  .from(bucket)
                                  .getPublicUrl(it.storage_path).data
                                  ?.publicUrl ||
                                '';
                              if (!url) throw new Error('Link unavailable');
                              setFilePreview({
                                item: {
                                  id: it.id,
                                  name: it.name,
                                  ext: it.ext || null,
                                  mime_type: it.mime_type || null,
                                  storage_path: it.storage_path || null
                                },
                                url
                              });
                            } catch (e: any) {
                              toast.error('Unable to open file', {
                                description: e?.message || undefined
                              });
                            }
                          }
                        }}
                      >
                        <div className='flex items-center gap-3'>
                          {it.type === 'folder' ? (
                            <FolderIcon className='size-5 text-blue-600' />
                          ) : (
                            <FileIcon className='text-primary size-5' />
                          )}
                        </div>
                        <div className='min-w-0 flex-1'>
                          <div className='truncate text-sm'>{it.name}</div>
                          <div className='text-muted-foreground truncate text-[11px]'>
                            {it.type === 'folder'
                              ? 'Folder'
                              : it.ext || it.mime_type || 'File'}
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          (() => {
            const p = filePreview;
            if (!p) return null;
            const ext = (p.item.ext || '').toLowerCase();
            const mime = (p.item.mime_type || '').toLowerCase();
            const isImage =
              /^image\//.test(mime) ||
              ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);
            const isVideo =
              /^video\//.test(mime) || ['mp4', 'webm', 'mov'].includes(ext);
            const isAudio =
              /^audio\//.test(mime) || ['mp3', 'wav', 'ogg'].includes(ext);
            if (isImage)
              return (
                <img
                  src={p.url}
                  alt=''
                  className='max-h-[70vh] w-full object-contain'
                />
              );
            if (isVideo)
              return (
                <video
                  src={p.url}
                  controls
                  className='h-[60vh] w-full bg-black'
                />
              );
            if (isAudio)
              return (
                <div className='p-4'>
                  <audio src={p.url} controls className='w-full' />
                </div>
              );
            if (ext === 'pdf' || mime === 'application/pdf')
              return (
                <iframe
                  src={`/api/noblesuite/files/preview?id=${filePreview.item.id}`}
                  className='h-full min-h-[60vh] w-full flex-1 rounded-lg border-0 shadow-sm'
                  title='PDF Preview'
                />
              );
            return (
              <div className='p-6 text-sm'>
                <div className='text-muted-foreground mb-2'>
                  Preview not available for this file type.
                </div>
                <Button asChild size='sm' className='gap-1'>
                  <a href={p.url} target='_blank' rel='noreferrer noopener'>
                    Open
                  </a>
                </Button>
              </div>
            );
          })()
        )}
      </SidePanel>
    </div>
  );
}
