'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  MapPin,
  Globe2,
  Phone,
  Mail,
  User as UserIcon,
  ArrowUpRight,
  Briefcase,
  Filter,
  AtSign,
  Link2,
  Package
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
// Card extraction helpers from chat-message
import { extractMeta, extractAttachments } from '@/components/chat-message';
import { extractCardsFromBody } from '@/components/chat-message';
import type { NobleCard } from '@/components/chat-cards/card-renderer';
import { useSearchParams } from 'next/navigation';
import { RealtimeChat } from '@/components/realtime-chat';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger
} from '@/components/ui/hover-card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SidePanel } from '@/components/ui/side-panel';
import { Input } from '@/components/ui/input';
import {
  Plus,
  Search,
  ArrowLeft,
  Star,
  X,
  Pencil,
  Check,
  ChevronRight,
  ChevronDown,
  PanelRightOpen,
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
    username?: string | null;
    nobleid?: string | null;
    email?: string | null;
    role?: string | null;
    banner_url?: string | null;
    avatar_url?: string | null;
    bio?: string | null;
    company_name?: string | null;
    website?: string | null;
    location?: string | null;
    phone?: string | null;
    completed_requests?: number | null;
    completed_shipments?: number | null;
    noble_score?: number | null;
  } | null>(null);
  useEffect(() => {
    let alive = true;
    async function load() {
      if (!id) return;
      const { data } = await supabase
        .from('profiles')
        .select(
          'username,nobleid,email,role,avatar_url,banner_url,bio,company_name,website,location,phone,completed_requests,completed_shipments,noble_score'
        )
        .eq('id', id)
        .single();
      if (!alive) return;
      setState({
        username: (data?.username as string) || null,
        nobleid: (data?.nobleid as string) || null,
        email: (data?.email as string) || null,
        role: ((data?.role as any) ?? null) as any,
        avatar_url: ((data?.avatar_url as string) || null) as any,
        banner_url: ((data?.banner_url as string) || null) as any,
        bio: ((data?.bio as string) || null) as any,
        company_name: (data?.company_name as string) || null,
        website: (data?.website as string) || null,
        location: (data?.location as string) || null,
        phone: (data?.phone as string) || null,
        completed_requests: (data?.completed_requests as number) ?? null,
        completed_shipments: (data?.completed_shipments as number) ?? null,
        noble_score: (data?.noble_score as number) ?? null
      });
    }
    void load();
    return () => {
      alive = false;
    };
  }, [id]);
  const name = state?.username || state?.nobleid || fallbackName;
  const banner = state?.banner_url || null;
  const avatar = state?.avatar_url || initialAvatar || undefined;
  const stats = [
    state?.noble_score != null && {
      label: 'Score',
      value: state.noble_score.toFixed(2)
    },
    state?.completed_requests != null && {
      label: 'Req',
      value: String(state.completed_requests)
    },
    state?.completed_shipments != null && {
      label: 'Ship',
      value: String(state.completed_shipments)
    }
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className='bg-background/80 relative border shadow-sm backdrop-blur-sm'>
      <div
        className={clsx(
          'from-primary/20 to-primary/5 h-24 w-full bg-gradient-to-r',
          banner && 'bg-none'
        )}
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
      <div className='px-4 pb-5'>
        <div className='-mt-12 flex flex-col items-center'>
          <div className='relative'>
            <Avatar className='ring-background size-16 shadow-md ring-2'>
              <AvatarImage src={avatar} />
              <AvatarFallback className='text-base'>
                {(name || 'U').slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {state?.nobleid && (
              <Button
                size='icon'
                variant='secondary'
                className='absolute -right-1 -bottom-1 h-6 w-6 rounded-full shadow'
                onClick={() =>
                  window.open(`/profile/${state.nobleid}`, '_self')
                }
                aria-label='Open profile'
              >
                <ArrowUpRight className='size-3' />
              </Button>
            )}
          </div>
          <div className='mt-3 w-full text-center'>
            <h3 className='truncate text-sm leading-tight font-semibold'>
              {name}
            </h3>
            {state?.nobleid && (
              <div className='text-muted-foreground truncate text-[11px]'>
                @{state.nobleid}
              </div>
            )}
          </div>
          {state?.bio && (
            <p className='text-muted-foreground mt-2 line-clamp-4 max-w-[92%] text-center text-xs leading-relaxed'>
              {state.bio}
            </p>
          )}
          {/* Company/Contact sections removed for a cleaner minimal card */}
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
  // Lightweight prefetch cache (hover-based)
  const prefetchCache = useRef<
    Record<string, import('@/hooks/use-realtime-chat').ChatMessage[]>
  >({});
  // (Removed per-room cache; reverting to original load behavior)
  const [sideOpen, setSideOpen] = useState(false);
  const [detailsQuery, setDetailsQuery] = useState('');
  const [detailsSearchOpen, setDetailsSearchOpen] = useState(false);
  const [detailsPage, setDetailsPage] = useState(0);
  const pageSize = 100;
  const [shipmentsOpen, setShipmentsOpen] = useState(true);
  const [detailsMembers, setDetailsMembers] = useState<
    Array<{
      id: string;
      username?: string | null;
      nobleid?: string | null;
      avatar_url?: string | null;
      role?: string | null;
    }>
  >([]);
  const [editingTitle, setEditingTitle] = useState<string>('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [savingTitle, setSavingTitle] = useState(false);
  const [detailsRows, setDetailsRows] = useState<
    { id: string; content: string; created_at: string }[]
  >([]);
  // Cached profile fields (first/last name etc.) keyed by user id for richer identity display
  const [profileMap, setProfileMap] = useState<
    Record<
      string,
      {
        first_name?: string | null;
        last_name?: string | null;
        username?: string | null;
        display_name?: string | null;
        avatar_url?: string | null;
      }
    >
  >({});
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

  // Load members with roles for active room (used in details panel for groups/shipments)
  useEffect(() => {
    let alive = true;
    async function loadMembers() {
      if (!activeId) {
        setDetailsMembers([]);
        return;
      }
      try {
        // Primary source: chat_rooms.participants (uuid[])
        const { data: roomRow, error: roomErr } = await supabase
          .from('chat_rooms')
          .select('participants')
          .eq('id', activeId)
          .maybeSingle();
        if (roomErr) {
          // ignore and try fallback
        }
        const ids = ((roomRow as any)?.participants || []) as string[];
        if (Array.isArray(ids) && ids.length) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id,username,nobleid,avatar_url,role')
            .in('id', ids);
          if (!alive) return;
          setDetailsMembers(
            (profs || []).map((p) => ({
              id: p.id as string,
              username: (p.username as string) || null,
              nobleid: (p.nobleid as string) || null,
              avatar_url: (p.avatar_url as string) || null,
              role: (p.role as string) || null
            }))
          );
          return;
        }
        // Fallback: legacy chat_members join (if available)
        try {
          const { data } = await supabase
            .from('chat_members')
            .select(
              'profiles:profiles!inner(id,username,nobleid,avatar_url,role)'
            )
            .eq('room_id', activeId);
          if (!alive) return;
          setDetailsMembers((data || []).map((r: any) => r.profiles));
        } catch {
          if (!alive) return;
          setDetailsMembers([]);
        }
        // Display-only fallback to current room members if nothing fetched
        if (alive && (!detailsMembers || detailsMembers.length === 0)) {
          const current = rooms.find((r) => r.id === activeId);
          if (current) {
            setDetailsMembers(
              (current.members || []).map((m) => ({
                id: m.id,
                username: m.username || null,
                nobleid: null,
                avatar_url: m.avatar_url || null,
                role: null
              }))
            );
          }
        }
      } catch {
        if (!alive) return;
        setDetailsMembers([]);
      }
    }
    void loadMembers();
    return () => {
      alive = false;
    };
  }, [activeId, rooms]);

  // Helper to extract shipment label/id from a message content
  function findShipmentLabel(content?: string | null): string | null {
    if (!content) return null;
    try {
      const meta = extractMeta(content);
      const { body } = extractAttachments(meta.body);
      const { cards } = extractCardsFromBody(body);
      const ship = (cards || []).find(
        (c: any) => c.type === 'shipment_card'
      ) as any;
      if (ship) return ship.code || ship.title || ship.id || null;
    } catch {
      /* ignore */
    }
    return null;
  }

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

  // Fetch missing profile details (first_name, last_name) for room members
  useEffect(() => {
    const allIds = new Set<string>();
    rooms.forEach((r) => r.members.forEach((m) => m.id && allIds.add(m.id)));
    const missing = Array.from(allIds).filter((id) => {
      const p = profileMap[id];
      return !p || (p.first_name == null && p.last_name == null); // need enriched data
    });
    if (!missing.length) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id,first_name,last_name,username,display_name,avatar_url')
          .in('id', missing);
        if (cancelled || !Array.isArray(data)) return;
        setProfileMap((prev) => {
          const next = { ...prev };
          (data || []).forEach((row: any) => {
            next[row.id] = {
              first_name: row.first_name,
              last_name: row.last_name,
              username: row.username,
              display_name: row.display_name,
              avatar_url: row.avatar_url
            };
          });
          return next;
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rooms, profileMap]);

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

  // Load initial messages for the selected room (original behavior restored)
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
      } catch {
        /* silent */
      }

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

  // Removed per-room INSERT subscription to avoid duplicate messages;
  // realtime handled by RealtimeChat hook.

  function handleOpenRoom(rid: string) {
    // If prefetched, show immediately
    const cached = prefetchCache.current[rid];
    if (cached && cached.length) {
      setInitialMessages(cached);
    }
    setActiveId(rid);
    const isSmall = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isSmall) setMobileView('chat');
  }

  // Unified name derivation similar to user-nav logic.
  function deriveMemberName(member: {
    id: string;
    username?: string | null;
    display_name?: string | null;
  }): { first: string; last: string; full: string } {
    const prof = profileMap[member.id];
    const firstName = (prof?.first_name || '').trim();
    const lastName = (prof?.last_name || '').trim();
    if (firstName || lastName) {
      const full = [firstName, lastName].filter(Boolean).join(' ').trim();
      return { first: firstName, last: lastName, full };
    }
    const disp = (prof?.display_name || member.display_name || '').trim();
    if (disp) {
      const parts = disp.split(/\s+/).filter(Boolean);
      const f = parts[0] || '';
      const l = parts.slice(1).join(' ');
      return {
        first: f,
        last: l,
        full: [f, l].filter(Boolean).join(' ').trim()
      };
    }
    // Fallback: nobleid (username) if present
    const noble = (prof?.username || member.username || '').trim();
    if (noble) return { first: noble, last: '', full: noble };
    return { first: '', last: '', full: '' };
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
          onMouseEnter={() => {
            if (isActive || prefetchCache.current[r.id]) return;
            (async () => {
              try {
                const { data: rows } = await supabase.rpc('get_room_messages', {
                  p_room: r.id,
                  p_page: 0,
                  p_size: 200
                });
                let list: any[] | null = null;
                if (Array.isArray(rows) && rows.length) list = rows as any[];
                if (!list) {
                  const { data: rows2 } = await supabase
                    .from('chat_messages')
                    .select('id, room_id, sender_id, content, created_at')
                    .eq('room_id', r.id)
                    .order('created_at', { ascending: true })
                    .limit(200);
                  list = Array.isArray(rows2) ? rows2 : [];
                }
                const nameMap = new Map<string, string>();
                r.members.forEach((m) => {
                  if (m.id)
                    nameMap.set(
                      m.id,
                      (m.display_name || m.username || 'User') as string
                    );
                });
                const mapped = (list || [])
                  .slice()
                  .sort(
                    (a: any, b: any) =>
                      new Date(a.created_at as string).getTime() -
                      new Date(b.created_at as string).getTime()
                  )
                  .map((m: any) => {
                    const uid =
                      (m.sender_id as string) || (m.user_id as string) || '';
                    return {
                      id: m.id as string,
                      content: (m.content as string) || '',
                      user: { id: uid, name: nameMap.get(uid) || 'User' },
                      createdAt: m.created_at as string
                    };
                  });
                prefetchCache.current[r.id] = mapped;
              } catch {
                /* ignore */
              }
            })();
          }}
        >
          {isShipment ? (
            <div className='flex h-10 w-10 items-center justify-center rounded-full border bg-orange-500/10 text-orange-600'>
              <Package className='size-5' />
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
                {(() => {
                  if (isShipment) {
                    if (r.title) return r.title;
                    const guess = findShipmentLabel(
                      r.lastMessage?.content || ''
                    );
                    return guess || '';
                  }
                  if (r.type === 'group') {
                    return (
                      r.title ||
                      r.members
                        .map((m) => m.username || m.display_name || 'user')
                        .slice(0, 3)
                        .join(', ') + (r.members.length > 3 ? ' and more' : '')
                    );
                  }
                  const other =
                    r.members.find((m) => m.id !== me?.id) || r.members[0];
                  if (!other) return '';
                  const { first, full } = deriveMemberName(other);
                  if (!full) return first; // may still be ''
                  return full.length > 22 ? first || full : full;
                })()}
              </div>
              <time className='text-muted-foreground ml-auto shrink-0 text-[10px]'>
                {formatListTime(r.lastMessage?.created_at)}
              </time>
            </div>
            {/* Username line intentionally removed for DM list */}
            <div
              className='text-muted-foreground max-w-[240px] truncate text-xs'
              title={(() => {
                const raw = r.lastMessage?.content || '';
                if (!raw) return '';
                const meta = extractMeta(raw);
                const { body, attachments } = extractAttachments(meta.body);
                const { text } = extractCardsFromBody(body);
                if (attachments.length) {
                  const names = attachments.map((a) => a.name || 'file');
                  return names.join(', ');
                }
                return text.trim();
              })()}
            >
              {(() => {
                const raw = r.lastMessage?.content || '';
                if (!raw) return 'No messages yet';
                const meta = extractMeta(raw);
                const { body, attachments } = extractAttachments(meta.body);
                const { text, cards } = extractCardsFromBody(body);
                if (!text.trim() && attachments.length) {
                  const names = attachments.map((a) => a.name || 'file');
                  const limit = 30;
                  const shown: string[] = [];
                  let used = 0;
                  for (const n of names) {
                    const add = (shown.length ? 2 : 0) + n.length;
                    if (used + add > limit) break;
                    shown.push(n);
                    used += add;
                  }
                  const rest = names.length - shown.length;
                  return (
                    <span title={names.join(', ')}>
                      📎 {shown.join(', ')}
                      {rest > 0 ? ' +' + rest : ''}
                    </span>
                  );
                }
                if (cards && cards.length > 0) {
                  const card = cards[0];
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
                if (attachments.length) {
                  return (
                    <span
                      title={attachments
                        .map((a) => a.name || 'file')
                        .join(', ')}
                    >
                      {text.replace(/\n/g, ' ').slice(0, 80)}{' '}
                      <span className='opacity-70'>📎{attachments.length}</span>
                    </span>
                  );
                }
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
    <div className='bg-background md:bg-sidebar flex h-full min-h-0 w-full flex-1 overflow-hidden md:gap-3'>
      {/* Left list */}
      <div
        className={clsx(
          'bg-card/50 md:ring-border/50 w-full flex-col md:max-w-[320px] md:overflow-hidden md:rounded-tr-2xl md:ring-1',
          mobileView === 'chat' ? 'hidden md:flex' : 'flex md:flex'
        )}
      >
        <div className='bg-background/60 supports-[backdrop-filter]:bg-background/50 flex items-center gap-2 border-b p-3 backdrop-blur md:rounded-tr-2xl'>
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
                <div className='text-muted-foreground flex items-center gap-2 px-3 pt-3 pb-1 text-[11px] font-medium tracking-wide'>
                  <span className='bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px]'>
                    {sections.shipments.length}
                  </span>
                  <button
                    className='hover:text-foreground flex items-center gap-1'
                    onClick={() => setShipmentsOpen((v) => !v)}
                    aria-label='Toggle shipments'
                  >
                    {shipmentsOpen ? (
                      <ChevronDown className='size-3' />
                    ) : (
                      <ChevronRight className='size-3' />
                    )}
                    <span>SHIPMENTS</span>
                  </button>
                </div>
                {shipmentsOpen && (
                  <ul className='divide-border/60 divide-y'>
                    {sections.shipments.length ? (
                      sections.shipments.map(LeftItem)
                    ) : (
                      <li className='text-muted-foreground px-3 py-6 text-xs'>
                        No shipments yet.
                      </li>
                    )}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right chat */}
      <div
        className={clsx(
          'bg-background md:ring-border/50 min-w-0 flex-1 flex-col md:overflow-hidden md:rounded-tl-2xl md:ring-1',
          mobileView === 'chat' ? 'flex md:flex' : 'hidden md:flex'
        )}
      >
        {active ? (
          <>
            {/* Header */}
            <div className='bg-background/60 supports-[backdrop-filter]:bg-background/50 flex h-14 shrink-0 items-center justify-between border-b px-4 backdrop-blur md:rounded-tl-2xl'>
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
                  <div className='flex h-8 w-8 items-center justify-center rounded-full border bg-orange-500/10 text-orange-600'>
                    <Package className='size-4' />
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
                    <div className='min-w-0'>
                      <div className='truncate font-medium'>
                        {active.title ||
                          findShipmentLabel(initialMessages[0]?.content) ||
                          ''}
                      </div>
                      <div className='mt-0.5 flex items-center gap-1'>
                        {(() => {
                          const others = active.members.filter(
                            (m) => m.id !== me?.id
                          );
                          const shown = others.slice(0, 3);
                          const rest = others.length - shown.length;
                          return (
                            <>
                              {shown.map((m) => (
                                <Avatar key={m.id} className='size-5'>
                                  <AvatarImage
                                    src={m.avatar_url || undefined}
                                  />
                                  <AvatarFallback className='text-[10px]'>
                                    {(m.username || m.display_name || 'U')
                                      .slice(0, 2)
                                      .toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                              ))}
                              {rest > 0 && (
                                <span className='bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]'>
                                  +{rest}
                                </span>
                              )}
                            </>
                          );
                        })()}
                      </div>
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
                      const { full: fullName } = other
                        ? deriveMemberName(other)
                        : ({ full: '' } as any);
                      return (
                        <HoverCard>
                          <HoverCardTrigger asChild>
                            <div className='min-w-0 cursor-default truncate'>
                              <div className='truncate leading-tight font-semibold'>
                                {fullName}
                              </div>
                            </div>
                          </HoverCardTrigger>
                          <HoverCardContent
                            className='w-96 overflow-hidden p-0'
                            align='start'
                          >
                            <ProfileHoverDetails
                              id={other?.id || ''}
                              fallbackName={fullName}
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
                  aria-pressed={activeId ? starred.has(activeId) : false}
                  onClick={() => activeId && toggleStar(activeId)}
                  aria-label={
                    activeId && starred.has(activeId) ? 'Unstar' : 'Star'
                  }
                >
                  <Star
                    className={clsx(
                      'size-4 transition-colors',
                      activeId && starred.has(activeId)
                        ? 'fill-yellow-400 text-yellow-500'
                        : 'text-muted-foreground'
                    )}
                  />
                </Button>
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={() => setSideOpen((v) => !v)}
                  aria-label='Toggle details'
                >
                  <PanelRightOpen className='size-4' />
                </Button>
              </div>
            </div>

            {/* Chat + details */}
            <div className='flex min-h-0 flex-1'>
              <div className='min-w-0 flex-1'>
                <RealtimeChat
                  key={active.id}
                  roomName={active.id}
                  nobleId={nobleId}
                  userId={me?.id}
                  messages={Array.from(
                    new Map(initialMessages.map((m) => [m.id, m])).values()
                  )}
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
                <div className='flex-1 overflow-y-auto'>
                  {active?.type === 'dm' &&
                    (() => {
                      const other =
                        active.members.find((m) => m.id !== me?.id) ||
                        active.members[0];
                      if (!other) return null;
                      return (
                        <ProfileHoverDetails
                          id={other.id}
                          fallbackName={
                            other.display_name || other.username || 'User'
                          }
                          initialAvatar={other.avatar_url || undefined}
                        />
                      );
                    })()}
                  {active?.type === 'group' && (
                    <div className='border-b p-3'>
                      {/* Group card: avatar stack + inline title & edit */}
                      <div className='rounded-md border p-3'>
                        <div className='flex items-center gap-3'>
                          <div className='relative h-10 w-16'>
                            {detailsMembers.slice(0, 3).map((m, i) => (
                              <Avatar
                                key={m.id}
                                className={clsx(
                                  'border-background absolute size-7 border',
                                  i === 0
                                    ? 'top-0 left-0'
                                    : i === 1
                                      ? 'top-1 left-4'
                                      : 'top-2 left-8'
                                )}
                              >
                                <AvatarImage src={m.avatar_url || undefined} />
                                <AvatarFallback className='text-[10px]'>
                                  {(m.username || m.nobleid || 'U')
                                    .slice(0, 2)
                                    .toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                          </div>
                          <div className='min-w-0 flex-1'>
                            {!isEditingTitle ? (
                              <div className='flex items-center gap-2'>
                                <div className='flex-1 truncate font-medium'>
                                  {active.title ||
                                    active.members
                                      .map(
                                        (m) =>
                                          m.username || m.display_name || 'user'
                                      )
                                      .slice(0, 3)
                                      .join(', ') +
                                      (active.members.length > 3
                                        ? ' and more'
                                        : '')}
                                </div>
                                <Button
                                  variant='ghost'
                                  size='icon'
                                  className='text-muted-foreground hover:text-foreground ml-auto h-7 w-7 opacity-60 transition-colors hover:opacity-100'
                                  aria-label='Edit group name'
                                  onClick={() => {
                                    setIsEditingTitle(true);
                                    setEditingTitle(active.title || '');
                                  }}
                                >
                                  <Pencil className='size-4' />
                                </Button>
                              </div>
                            ) : (
                              <div className='flex items-center gap-2'>
                                <Input
                                  value={editingTitle}
                                  onChange={(e) =>
                                    setEditingTitle(e.target.value)
                                  }
                                  placeholder='Group name'
                                  className='h-8 text-xs'
                                />
                                <Button
                                  size='icon'
                                  className='h-8 w-8'
                                  disabled={
                                    savingTitle || !editingTitle?.trim()
                                  }
                                  aria-label='Save group name'
                                  onClick={async () => {
                                    try {
                                      setSavingTitle(true);
                                      const title = editingTitle.trim();
                                      const { error } = await supabase
                                        .from('chat_rooms')
                                        .update({ title })
                                        .eq('id', active.id);
                                      if (!error) {
                                        setRooms((prev) =>
                                          prev.map((r) =>
                                            r.id === active.id
                                              ? { ...r, title }
                                              : r
                                          )
                                        );
                                        toast.success('Group name updated');
                                        setIsEditingTitle(false);
                                      } else {
                                        toast.error('Could not update');
                                      }
                                    } catch {
                                      toast.error('Could not update');
                                    } finally {
                                      setSavingTitle(false);
                                    }
                                  }}
                                >
                                  <Check className='size-4' />
                                </Button>
                                <Button
                                  variant='ghost'
                                  size='sm'
                                  className='h-8'
                                  aria-label='Cancel edit'
                                  onClick={() => setIsEditingTitle(false)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                        {detailsMembers.length > 0 ? (
                          <ul className='mt-3 space-y-2'>
                            {detailsMembers.map((m) => (
                              <li
                                key={m.id}
                                className='flex items-center gap-2'
                              >
                                <Avatar className='size-6'>
                                  <AvatarImage
                                    src={m.avatar_url || undefined}
                                  />
                                  <AvatarFallback className='text-[10px]'>
                                    {(m.username || m.nobleid || 'U')
                                      .slice(0, 2)
                                      .toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className='truncate text-xs'>
                                  {m.username || m.nobleid || 'User'}
                                </span>
                                <span className='bg-muted text-muted-foreground ml-auto rounded px-1.5 py-0.5 text-[10px]'>
                                  {m.role || 'member'}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className='text-muted-foreground mt-3 text-xs'>
                            No members
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {active?.type === 'shipment' && (
                    <div className='border-b p-3'>
                      <div className='mb-2 text-xs font-medium'>
                        Participants
                      </div>
                      {detailsMembers.length ? (
                        <ul className='space-y-2'>
                          {detailsMembers.map((m) => (
                            <li key={m.id} className='flex items-center gap-2'>
                              <Avatar className='size-6'>
                                <AvatarImage src={m.avatar_url || undefined} />
                                <AvatarFallback className='text-[10px]'>
                                  {(m.username || m.nobleid || 'U')
                                    .slice(0, 2)
                                    .toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className='truncate text-xs'>
                                {m.username || m.nobleid || 'User'}
                              </span>
                              <span className='bg-muted text-muted-foreground ml-auto rounded px-1.5 py-0.5 text-[10px]'>
                                {m.role || 'member'}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className='text-muted-foreground text-xs'>
                          No participants
                        </div>
                      )}
                    </div>
                  )}
                  {/* Details Tabs: Links, Files, Mentions */}
                  <div className='p-3'>
                    <Tabs defaultValue='links' className='w-full'>
                      <div className='flex items-center justify-between gap-2'>
                        <TabsList className='scrollbar-thin max-w-full overflow-x-auto'>
                          <TabsTrigger value='links' className='text-xs'>
                            Links
                          </TabsTrigger>
                          <TabsTrigger value='files' className='text-xs'>
                            Files
                          </TabsTrigger>
                          <TabsTrigger value='mentions' className='text-xs'>
                            Mentions
                          </TabsTrigger>
                        </TabsList>
                        <div className='ml-2 flex items-center gap-1'>
                          <Button
                            variant='ghost'
                            size='icon'
                            aria-label='Search'
                            onClick={() => setDetailsSearchOpen((v) => !v)}
                          >
                            <Filter className='size-4' />
                          </Button>
                        </div>
                      </div>
                      {detailsSearchOpen && (
                        <div className='mt-2'>
                          <Input
                            value={detailsQuery}
                            onChange={(e) => setDetailsQuery(e.target.value)}
                            placeholder='Search in details'
                            className='h-8 w-full text-xs'
                          />
                        </div>
                      )}
                      {(() => {
                        const msgPairs = (
                          detailsRows.length
                            ? detailsRows.map((r) => ({
                                id: r.id,
                                content: r.content,
                                created_at: r.created_at
                              }))
                            : (initialMessages || []).map((m) => ({
                                id: m.id,
                                content: m.content,
                                created_at: (m as any).createdAt
                              }))
                        ) as Array<{
                          id: string;
                          content: string;
                          created_at?: string;
                        }>;

                        const q = detailsQuery.trim().toLowerCase();

                        const links = msgPairs
                          .flatMap((m) =>
                            Array.from(
                              ((m.content || '') as string).matchAll(
                                /https?:\/\/\S+/g
                              )
                            ).map((x) => x[0] as string)
                          )
                          .filter((l, idx, arr) => arr.indexOf(l) === idx);

                        const files = msgPairs
                          .flatMap((m) =>
                            Array.from(
                              ((m.content || '') as string).matchAll(
                                /\[([^\]]+)]\(([^)]+)\)/g
                              )
                            ).map((x) => ({
                              name: x[1] as string,
                              url: x[2] as string
                            }))
                          )
                          .filter(
                            (f, idx, arr) =>
                              arr.findIndex(
                                (y) => y.name === f.name && y.url === f.url
                              ) === idx
                          );

                        // Mentions: list messages that contain at least one mention
                        const mentionMsgs = msgPairs.reduce(
                          (acc, m) => {
                            const labels = Array.from(
                              ((m.content || '') as string).matchAll(
                                /(^|\s)@([\w._-]{2,32})/g
                              )
                            ).map((x) => x[2] as string);
                            if (labels.length) {
                              // Build a small snippet centered around first mention
                              const idx = (m.content || '').indexOf(
                                '@' + labels[0]
                              );
                              const start = Math.max(0, idx - 30);
                              const end = Math.min(
                                (m.content || '').length,
                                idx + 60
                              );
                              const raw = (m.content || '').slice(start, end);
                              acc.push({
                                id: m.id,
                                when: m.created_at,
                                labels: Array.from(new Set(labels)),
                                snippet: raw.replace(/\n/g, ' ')
                              });
                            }
                            return acc;
                          },
                          [] as Array<{
                            id: string;
                            when?: string;
                            labels: string[];
                            snippet: string;
                          }>
                        );

                        const linksF = q
                          ? links.filter((l) => l.toLowerCase().includes(q))
                          : links;
                        const filesF = q
                          ? files.filter(
                              (f) =>
                                f.name.toLowerCase().includes(q) ||
                                f.url.toLowerCase().includes(q)
                            )
                          : files;
                        const mentionsF = q
                          ? mentionMsgs.filter(
                              (m) =>
                                m.labels.some((lb) =>
                                  lb.toLowerCase().includes(q)
                                ) || m.snippet.toLowerCase().includes(q)
                            )
                          : mentionMsgs;

                        return (
                          <>
                            <TabsContent value='links' className='mt-3'>
                              {linksF.length ? (
                                <ul className='space-y-1'>
                                  {linksF.slice(0, 400).map((l, i) => (
                                    <li key={i} className='truncate text-xs'>
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
                                <div className='text-muted-foreground flex flex-col items-center justify-center gap-2 py-8'>
                                  <Link2 className='size-6 opacity-60' />
                                  <div className='text-xs'>No links found</div>
                                  <div className='text-[11px] opacity-70'>
                                    Shared links in this chat will appear here.
                                  </div>
                                </div>
                              )}
                            </TabsContent>
                            <TabsContent value='files' className='mt-3'>
                              {filesF.length ? (
                                <ul className='space-y-2'>
                                  {filesF.slice(0, 400).map((f, i) => (
                                    <li key={i} className='truncate text-xs'>
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
                                <div className='text-muted-foreground flex flex-col items-center justify-center gap-2 py-8'>
                                  <FileIcon className='size-6 opacity-60' />
                                  <div className='text-xs'>No files found</div>
                                  <div className='text-[11px] opacity-70'>
                                    Files shared in this chat will show up here.
                                  </div>
                                </div>
                              )}
                            </TabsContent>
                            <TabsContent value='mentions' className='mt-3'>
                              {mentionsF.length ? (
                                <ul className='space-y-2'>
                                  {mentionsF.slice(0, 400).map((m) => (
                                    <li key={m.id}>
                                      <button
                                        className='bg-card hover:bg-accent/50 w-full rounded-md border px-2 py-2 text-left text-xs shadow-sm transition-colors'
                                        onClick={() => {
                                          const el = document.getElementById(
                                            `mid-${m.id}`
                                          );
                                          if (el) {
                                            el.scrollIntoView({
                                              behavior: 'smooth',
                                              block: 'center'
                                            });
                                            try {
                                              el.classList.add(
                                                'bg-amber-100/60',
                                                'dark:bg-amber-900/20',
                                                'transition-colors'
                                              );
                                              setTimeout(() => {
                                                el.classList.remove(
                                                  'bg-amber-100/60',
                                                  'dark:bg-amber-900/20',
                                                  'transition-colors'
                                                );
                                              }, 1200);
                                            } catch {
                                              /* noop */
                                            }
                                          }
                                        }}
                                        title='Jump to message'
                                      >
                                        <div className='flex flex-wrap items-center gap-1'>
                                          {m.labels.map((lb) => (
                                            <span
                                              key={lb}
                                              className='bg-muted rounded px-2 py-0.5 text-[10px]'
                                            >
                                              <AtSign className='mr-1 inline size-3' />
                                              {lb}
                                            </span>
                                          ))}
                                        </div>
                                        <div className='mt-1 line-clamp-2 text-[11px] opacity-80'>
                                          {m.snippet}
                                        </div>
                                        {m.when && (
                                          <div className='text-muted-foreground mt-1 text-[10px]'>
                                            {new Date(m.when).toLocaleString()}
                                          </div>
                                        )}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <div className='text-muted-foreground flex flex-col items-center justify-center gap-2 py-8'>
                                  <AtSign className='size-6 opacity-60' />
                                  <div className='text-xs'>
                                    No mentions found
                                  </div>
                                  <div className='text-[11px] opacity-70'>
                                    Messages with @mentions will be collected
                                    here.
                                  </div>
                                </div>
                              )}
                            </TabsContent>
                          </>
                        );
                      })()}
                    </Tabs>
                  </div>
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
