'use client';

import { cn } from '@/lib/utils';
import { ChatMessageItem } from '@/components/chat-message';
import { useChatScroll } from '@/hooks/use-chat-scroll';
import { type ChatMessage, useRealtimeChat } from '@/hooks/use-realtime-chat';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Bold,
  Code,
  Italic,
  List,
  Paperclip,
  Plus,
  Quote,
  Send,
  Smile,
  X,
  Package,
  Handshake,
  ReceiptText,
  Wallet,
  ClipboardCheck,
  CheckSquare,
  StickyNote
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import EmojiPicker from '@/components/ui/emoji-picker';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CardBuilderDialog from '@/components/chat-cards/card-builder-dialog';
import { useProfileRole } from '@/hooks/use-profile-role';
import type { NobleCard } from '@/components/chat-cards/card-renderer';
import { useTheme } from 'next-themes';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';

interface RealtimeChatProps {
  roomName: string;
  username: string;
  userId?: string;
  onMessage?: (messages: ChatMessage[]) => void;
  messages?: ChatMessage[];
  initialToSend?: string;
  onInitialConsumed?: () => void;
  roomTitle?: string;
  mode?: 'chat' | 'shipment';
  shipmentId?: string;
}

export const RealtimeChat = ({
  roomName,
  username,
  onMessage,
  messages: initialMessages = [],
  initialToSend,
  onInitialConsumed,
  userId,
  roomTitle,
  mode = 'chat',
  shipmentId
}: RealtimeChatProps) => {
  const { containerRef, scrollToBottom } = useChatScroll();

  const {
    messages: realtimeMessages,
    sendMessage,
    isConnected
  } = useRealtimeChat({
    roomName,
    username,
    userId: userId || 'me'
  });

  // Persisted shipment messages (DB) to complement ephemeral broadcast
  const [persistedMessages, setPersistedMessages] = useState<ChatMessage[]>([]);
  const profileCache = useRef<
    Record<string, { name: string; avatar_url?: string }>
  >({});
  // Track optimistic (temp) messages awaiting server IDs
  const pendingOptimistics = useRef<
    Record<string, { content: string; createdAt: number; userId: string }>
  >({});

  useEffect(() => {
    if (mode !== 'shipment' || !shipmentId) return;
    let cancelled = false;
    async function load() {
      try {
        const { data: rows, error } = await supabase
          .from('shipment_messages')
          .select('id,user_id,content,created_at')
          .eq('shipment_id', shipmentId)
          .order('created_at', { ascending: true })
          .limit(300);
        if (error) return;
        const ids = Array.from(
          new Set((rows || []).map((r) => r.user_id as string))
        );
        if (ids.length) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id,display_name,username,avatar_url')
            .in('id', ids);
          for (const p of profs || []) {
            profileCache.current[p.id] = {
              name: (p.display_name || p.username || 'User') as string,
              avatar_url: p.avatar_url || undefined
            };
          }
        }
        const mapped: ChatMessage[] = (rows || []).map((r) => ({
          id: r.id as string,
          content: r.content as string,
          user: {
            id: r.user_id as string,
            name:
              profileCache.current[r.user_id]?.name || r.user_id.slice(0, 6),
            avatar_url: profileCache.current[r.user_id]?.avatar_url
          },
          createdAt: r.created_at as string
        }));
        if (!cancelled) setPersistedMessages(mapped);
      } catch {
        /* ignore */
      }
    }
    void load();
    // Realtime subscription for new DB inserts
    const channel = supabase
      .channel(`shipment_messages:${shipmentId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'shipment_messages',
          filter: `shipment_id=eq.${shipmentId}`
        },
        async (payload: any) => {
          const row = payload.new;
          const uid = row.user_id as string;
          if (!profileCache.current[uid]) {
            try {
              const { data: prof } = await supabase
                .from('profiles')
                .select('id,display_name,username,avatar_url')
                .eq('id', uid)
                .maybeSingle();
              if (prof)
                profileCache.current[uid] = {
                  name: (prof.display_name ||
                    prof.username ||
                    'User') as string,
                  avatar_url: prof.avatar_url || undefined
                };
            } catch {
              /* ignore */
            }
          }
          setPersistedMessages((cur) => {
            if (cur.some((m) => m.id === row.id)) return cur;
            // Try to find a matching optimistic message to replace
            const matchIdx = cur.findIndex(
              (m) =>
                m.id.startsWith('temp-') &&
                m.user.id === uid &&
                m.content === row.content &&
                Math.abs(
                  new Date(m.createdAt).getTime() -
                    new Date(row.created_at).getTime()
                ) < 8000
            );
            const real: ChatMessage = {
              id: row.id,
              content: row.content,
              user: {
                id: uid,
                name: profileCache.current[uid]?.name || uid.slice(0, 6),
                avatar_url: profileCache.current[uid]?.avatar_url
              },
              createdAt: row.created_at
            };
            if (matchIdx !== -1) {
              const tempId = cur[matchIdx].id;
              const next = [...cur];
              next[matchIdx] = real;
              delete pendingOptimistics.current[tempId];
              return next;
            }
            return [...cur, real];
          });
        }
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [mode, shipmentId]);

  const [newMessage, setNewMessage] = useState('');
  const [initialTokenSent, setInitialTokenSent] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Drag/drop & files
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editMsg, setEditMsg] = useState<ChatMessage | null>(null);
  // Unread marker
  const [lastSeen, setLastSeen] = useState<number | null>(null);
  const LAST_SEEN_KEY = useMemo(() => `nv_last_seen_${roomName}`, [roomName]);
  const [seenReady, setSeenReady] = useState(false);

  // Emoji theme + recents
  const { resolvedTheme } = useTheme();
  const RECENT_KEY = 'nv_recent_emojis';
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);

  // Mentions/Tags suggest
  type SuggestType = '@' | '#' | '/';
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestType, setSuggestType] = useState<SuggestType>('@');
  const [suggestQuery, setSuggestQuery] = useState('');
  const [suggestItems, setSuggestItems] = useState<
    Array<{ key: string; label: string; meta?: string; avatarUrl?: string }>
  >([]);
  const [roomMembers, setRoomMembers] = useState<
    Array<{
      id: string;
      username?: string | null;
      display_name?: string | null;
      avatar_url?: string | null;
    }>
  >([]);
  const [suggestIndex, setSuggestIndex] = useState(0);
  const [mentions, setMentions] = useState<
    Array<{ id: string; label: string }>
  >([]);
  const [cardBuilderOpen, setCardBuilderOpen] = useState(false);
  const [pendingInsertType, setPendingInsertType] = useState<
    NobleCard['type'] | null
  >(null);
  // Cards staged in composer
  const [pendingCards, setPendingCards] = useState<NobleCard[]>([]);
  const { role } = useProfileRole();

  // Merge realtime + initial
  const allMessages = useMemo(() => {
    const merged = [
      ...persistedMessages,
      ...initialMessages,
      ...realtimeMessages
    ];
    const unique = merged.filter(
      (m, i, self) => i === self.findIndex((x) => x.id === m.id)
    );
    return unique.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [persistedMessages, initialMessages, realtimeMessages]);

  // Replies meta hidden per design: no reply count or last reply time in UI

  // Load last seen marker for this room
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAST_SEEN_KEY);
      if (raw) setLastSeen(Number(raw) || null);
      else setLastSeen(null);
    } catch {
      setLastSeen(null);
    } finally {
      setSeenReady(true);
    }
  }, [LAST_SEEN_KEY]);

  // Initialize seen on first open (no stored value): set to latest message to avoid banner on first load
  useEffect(() => {
    if (!seenReady) return;
    if (lastSeen != null) return;
    if (!allMessages.length) return;
    const latest = allMessages[allMessages.length - 1]?.createdAt;
    if (!latest) return;
    const ts = new Date(latest).getTime();
    try {
      localStorage.setItem(LAST_SEEN_KEY, String(ts));
    } catch {
      void 0;
    }
    setLastSeen(ts);
  }, [seenReady, lastSeen, allMessages, LAST_SEEN_KEY]);

  const { unreadCount, firstUnreadAt } = useMemo(() => {
    if (!lastSeen)
      return {
        unreadCount: allMessages.length ? allMessages.length : 0,
        firstUnreadAt: allMessages[0]?.createdAt || null
      };
    const idx = allMessages.findIndex(
      (m) => new Date(m.createdAt).getTime() > lastSeen
    );
    if (idx === -1)
      return { unreadCount: 0, firstUnreadAt: null as string | null };
    return {
      unreadCount: allMessages.length - idx,
      firstUnreadAt: allMessages[idx]?.createdAt || null
    };
  }, [allMessages, lastSeen]);

  function markAsRead() {
    const latest = allMessages[allMessages.length - 1]?.createdAt;
    const ts = latest ? new Date(latest).getTime() : Date.now();
    try {
      localStorage.setItem(LAST_SEEN_KEY, String(ts));
    } catch {
      void 0;
    }
    setLastSeen(ts);
  }

  useEffect(() => {
    onMessage?.(allMessages);
  }, [allMessages, onMessage]);
  useEffect(() => {
    scrollToBottom();
  }, [allMessages, scrollToBottom]);

  // Auto mark-as-read when scrolled to bottom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 48;
      if (!nearBottom) return;
      const latest = allMessages[allMessages.length - 1]?.createdAt;
      if (!latest) return;
      const latestTs = new Date(latest).getTime();
      if (lastSeen && lastSeen >= latestTs) return;
      markAsRead();
    };
    el.addEventListener('scroll', onScroll, { passive: true } as any);
    return () => {
      el.removeEventListener('scroll', onScroll);
    };
  }, [containerRef, allMessages, lastSeen]);

  // Also handle the case where new messages arrive and we are already at bottom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 48;
    if (!nearBottom) return;
    const latest = allMessages[allMessages.length - 1]?.createdAt;
    if (!latest) return;
    const latestTs = new Date(latest).getTime();
    if (lastSeen && lastSeen >= latestTs) return;
    markAsRead();
  }, [allMessages, lastSeen, containerRef]);

  // Autogrow
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, [newMessage]);

  // Load recent emojis
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (raw) setRecentEmojis(JSON.parse(raw));
    } catch {
      void 0;
    }
  }, []);

  function pushRecentEmoji(e: string) {
    setRecentEmojis((prev) => {
      const arr = [e, ...prev.filter((x) => x !== e)].slice(0, 16);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(arr));
      } catch {
        void 0;
      }
      return arr;
    });
  }

  function onFilesAdd(fileList?: FileList | File[] | null) {
    if (!fileList) return;
    const arr = Array.from(fileList);
    if (arr.length === 0) return;
    setFiles((cur) => [...cur, ...arr]);
  }

  const persistAndNotify = useCallback(
    async (content: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) return { ok: false, error: 'Not authenticated' };
        if (mode === 'shipment') {
          if (!shipmentId) return { ok: false, error: 'Missing shipment id' };
          const { error } = await supabase
            .from('shipment_messages')
            .insert({ shipment_id: shipmentId, user_id: uid, content });
          if (error) return { ok: false, error: error.message };
          return { ok: true };
        }
        // Do not enforce UUID regex here; rely on DB validation/RLS
        let insertedId: string | null = null;
        let { data: inserted, error } = await supabase
          .from('chat_messages')
          .insert({ room_id: roomName, user_id: uid, content })
          .select('id')
          .single();
        if (error) {
          // Fallback to legacy schema using sender_id
          const { data: ins2, error: err2 } = await supabase
            .from('chat_messages')
            .insert({ room_id: roomName, sender_id: uid, content })
            .select('id')
            .single();
          if (err2) return { ok: false, error: err2.message };
          insertedId = (ins2?.id as string) || null;
        } else {
          insertedId = (inserted?.id as string) || null;
        }
        if (insertedId) {
          await supabase.from('chat_events').insert({
            room_id: roomName,
            message_id: insertedId,
            actor_id: uid,
            event_type: 'receipt'
          });
          const { data: members } = await supabase
            .from('chat_members')
            .select('user_id')
            .eq('room_id', roomName);
          const recipients = (members || [])
            .map((m) => m.user_id as string)
            .filter((id) => id !== uid);
          if (recipients.length) {
            await supabase.from('notifications').insert(
              recipients.map((r) => ({
                user_id: r,
                actor_id: uid,
                type: 'chat_message',
                title: `${username} sent a new message.`,
                body: content.slice(0, 120),
                category: 'inbox',
                data: { room_id: roomName }
              }))
            );
          }
        }
        return { ok: true };
      } catch {
        void 0;
      }
      return { ok: false, error: 'Unknown error' };
    },
    [roomName, username, mode, shipmentId]
  );

  const handleSendMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      // Allow sending in shipment mode even if realtime broadcast channel not yet connected.
      if (!newMessage.trim() && files.length === 0 && pendingCards.length === 0)
        return;

      // upload attachments
      let attachments: Array<{ name: string; url?: string }> = [];
      if (files.length) {
        const bucket = 'chat-uploads';
        const uploads = await Promise.all(
          files.map(async (f) => {
            try {
              const path = `${roomName}/${Date.now()}_${Math.random().toString(36).slice(2)}_${f.name}`;
              const up = await supabase.storage.from(bucket).upload(path, f, {
                cacheControl: '3600',
                upsert: false,
                contentType: f.type
              });
              if (up.error) throw up.error;
              const pub = supabase.storage.from(bucket).getPublicUrl(path);
              const url = pub.data?.publicUrl;
              return { name: f.name, url: url || undefined };
            } catch {
              return { name: f.name };
            }
          })
        );
        attachments = uploads;
      }

      const attachmentBlock = attachments.length
        ? `\n\nAttachments:\n${attachments.map((a) => `- ${a.url ? `[${a.name}](${a.url})` : a.name}`).join('\n')}`
        : '';
      const cardsBlock = pendingCards.length
        ? `\n\n${pendingCards.map((c) => `\n\n\`\`\`nvcard\n${safeStringify(c)}\n\`\`\`\n`).join('')}`
        : '';
      // Append ID-backed mentions for future parsing, only those still present in text
      const presentMentions = mentions.filter((m) =>
        newMessage.includes(`@${m.label}`)
      );
      const mentionsBlock = presentMentions.length
        ? `\n\nMentions:\n${presentMentions.map((m) => `- ${m.id}|${m.label}`).join('\n')}`
        : '';
      let content =
        `${newMessage.trim()}${cardsBlock}${mentionsBlock}${attachmentBlock}`.trim();
      if (replyTo) content = `ReplyTo:${replyTo.id}\n` + content;

      if (editMsg) {
        // inline edit: update row if within 10 minutes
        try {
          const created = new Date(editMsg.createdAt).getTime();
          const ok = Date.now() - created < 10 * 60 * 1000;
          if (ok) {
            const editedContent = `Edited:1\n${content}`;
            await supabase
              .from('chat_messages')
              .update({ content: editedContent })
              .eq('id', editMsg.id);
          }
        } catch {
          void 0;
        }
      } else {
        // In shipment mode rely on DB insert + realtime channel to avoid duplicate broadcast copies
        if (mode !== 'shipment') {
          if (isConnected) {
            sendMessage(content);
          }
          const result = await persistAndNotify(content);
          if (!result.ok) {
            toast.error(result.error || 'Message could not be saved');
          }
        } else {
          // Shipment mode: write to DB directly (persistAndNotify inserts). Optimistic append for snappy UX.
          const tempId = 'temp-' + crypto.randomUUID();
          let actualUid = userId || 'me';
          try {
            const { data: auth } = await supabase.auth.getUser();
            if (auth.user?.id) actualUid = auth.user.id;
          } catch {
            /* ignore */
          }
          const optimistic: ChatMessage = {
            id: tempId,
            content,
            user: { id: actualUid, name: username },
            createdAt: new Date().toISOString()
          };
          setPersistedMessages((cur) => [...cur, optimistic]);
          pendingOptimistics.current[tempId] = {
            content,
            createdAt: Date.now(),
            userId: actualUid
          };
          const result = await persistAndNotify(content);
          if (!result.ok) {
            // Remove optimistic message & notify error
            setPersistedMessages((cur) => cur.filter((m) => m.id !== tempId));
            delete pendingOptimistics.current[tempId];
            toast.error(result.error || 'Message failed');
          } else {
            // Fallback: if not replaced by realtime within 2s, refresh last messages
            setTimeout(() => {
              if (!pendingOptimistics.current[tempId]) return; // already replaced
              void (async () => {
                try {
                  const { data: rows, error } = await supabase
                    .from('shipment_messages')
                    .select('id,user_id,content,created_at')
                    .eq('shipment_id', shipmentId!)
                    .order('created_at', { ascending: true })
                    .limit(120);
                  if (error) return;
                  setPersistedMessages((cur) => {
                    // If temp still present attempt replacement
                    if (!cur.find((m) => m.id === tempId)) return cur;
                    const serverMapped: ChatMessage[] = (rows || []).map(
                      (r) => ({
                        id: r.id as string,
                        content: r.content as string,
                        user: {
                          id: r.user_id as string,
                          name:
                            profileCache.current[r.user_id]?.name ||
                            (r.user_id as string).slice(0, 6)
                        },
                        createdAt: r.created_at as string
                      })
                    );
                    // Find a server message matching the optimistic content
                    const match =
                      serverMapped.find(
                        (r) => r.content === content && r.user.id === actualUid
                      ) || serverMapped.find((r) => r.content === content);
                    if (!match) return cur;
                    delete pendingOptimistics.current[tempId];
                    return cur.map((m) => (m.id === tempId ? match : m));
                  });
                } catch {
                  /* ignore */
                }
              })();
            }, 2000);
          }
        }
        // Extra notifications for task assignments + system message
        try {
          const taskCards = pendingCards.filter(
            (c) => c.type === 'task_card'
          ) as Array<any>;
          if (taskCards.length) {
            const { data: auth } = await supabase.auth.getUser();
            const uid = auth.user?.id;
            for (const t of taskCards) {
              const assigneeId = t.assigned_to as string | undefined;
              if (assigneeId && uid && assigneeId !== uid) {
                // Notification to assignee
                await supabase.from('notifications').insert({
                  user_id: assigneeId,
                  actor_id: uid,
                  type: 'task_assigned',
                  title: 'New task assigned to you',
                  body: t.title || 'Task',
                  category: 'tasks',
                  data: { room_id: roomName, task_id: t.id }
                });

                // System message in chat to reflect assignment
                const member = roomMembers.find((m) => m.id === assigneeId);
                const label = (member?.display_name ||
                  member?.username ||
                  'user') as string;
                const sysLine = `System: Task assigned to @${label}${t.title ? ` — ${t.title}` : ''}`;
                const mentionsBlock = `\n\nMentions:\n- ${assigneeId}|${label}`;
                const sysContent = `${sysLine}${mentionsBlock}`;
                sendMessage(sysContent);
                await persistAndNotify(sysContent);
              }
            }
          }
        } catch {
          /* ignore */
        }
      }
      setNewMessage('');
      setFiles([]);
      setPendingCards([]);
      setReplyTo(null);
      setEditMsg(null);
      setMentions([]);
      requestAnimationFrame(() => textareaRef.current?.focus());
    },
    [
      newMessage,
      files,
      isConnected,
      sendMessage,
      persistAndNotify,
      replyTo,
      editMsg,
      mentions,
      pendingCards,
      roomMembers,
      roomName
    ]
  );

  // initialToSend
  useEffect(() => {
    const token = initialToSend && `${roomName}|${initialToSend.trim()}`;
    const shouldSend = Boolean(
      isConnected &&
        initialToSend &&
        initialToSend.trim() &&
        token !== initialTokenSent
    );
    if (!shouldSend) return;
    const content = initialToSend!.trim();
    sendMessage(content);
    void persistAndNotify(content);
    setInitialTokenSent(token || null);
    onInitialConsumed?.();
  }, [
    initialToSend,
    isConnected,
    roomName,
    initialTokenSent,
    persistAndNotify,
    sendMessage,
    onInitialConsumed
  ]);

  // reset on room change
  useEffect(() => {
    setNewMessage('');
    setInitialTokenSent(null);
    setFiles([]);
    setSuggestOpen(false);
    // Load room members for mentions
    let alive = true;
    async function loadMembers() {
      try {
        const isUuid =
          /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
            roomName
          );
        if (!isUuid) return;
        const { data } = await supabase
          .from('chat_members')
          .select(
            'profiles:profiles!inner(id,username,display_name,avatar_url)'
          )
          .eq('room_id', roomName);
        if (!alive) return;
        setRoomMembers((data || []).map((r: any) => r.profiles));
      } catch {
        void 0;
      }
    }
    void loadMembers();
    return () => {
      alive = false;
    };
  }, [roomName]);

  // Suggestions: detect & fetch
  const detectSuggest = useCallback(async () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const caret = ta.selectionStart ?? 0;
    const trigger = getTrigger(ta.value, caret);
    if (!trigger) {
      if (suggestOpen) setSuggestOpen(false);
      return;
    }
    setSuggestType(trigger.type);
    setSuggestQuery(trigger.query);

    if (trigger.type === '@') {
      // Filter current room members by display name or username
      const q = trigger.query.toLowerCase();
      const items = roomMembers
        .filter((m) =>
          (m.display_name || m.username || '').toLowerCase().includes(q)
        )
        .slice(0, 12)
        .map((m) => ({
          key: m.id,
          label: (m.display_name || m.username || 'user') as string,
          meta: m.username || undefined,
          avatarUrl: m.avatar_url || undefined
        }));
      setSuggestItems(items);
      setSuggestIndex(0);
      setSuggestOpen(items.length > 0);
    } else if (trigger.type === '#') {
      const base = [
        'urgent',
        'design',
        'bug',
        'feature',
        'ops',
        'finance',
        'product',
        'marketing'
      ];
      const items = base
        .filter((t) => t.toLowerCase().includes(trigger.query.toLowerCase()))
        .slice(0, 8)
        .map((t) => ({ key: t, label: t }));
      setSuggestItems(items);
      setSuggestIndex(0);
      setSuggestOpen(items.length > 0);
    } else if (trigger.type === '/') {
      const cmds = [
        { key: 'insert_card', label: 'Insert Card' },
        { key: 'shipment_card', label: 'Shipment Card' },
        { key: 'request_card', label: 'Request Card' },
        { key: 'negotiation_card', label: 'Negotiation Card' },
        { key: 'invoice_card', label: 'Invoice Card' },
        { key: 'task_card', label: 'Task Card' },
        { key: 'approval_card', label: 'Approval Card' },
        { key: 'note_card', label: 'Note Card' }
      ];
      const items = cmds.filter((c) =>
        c.label.toLowerCase().includes(trigger.query.toLowerCase())
      );
      setSuggestItems(items);
      setSuggestIndex(0);
      setSuggestOpen(items.length > 0);
    }
  }, [suggestOpen, roomMembers]);

  const applySuggestion = useCallback(
    (item: { key: string; label: string }) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const caret = ta.selectionStart ?? 0;
      const trigger = getTrigger(ta.value, caret);
      if (!trigger) return;
      if (trigger.type === '/') {
        setSuggestOpen(false);
        if (item.key === 'insert_card') {
          setPendingInsertType(null);
          setCardBuilderOpen(true);
          return;
        }
        setPendingInsertType(item.key as NobleCard['type']);
        setCardBuilderOpen(true);
        return;
      }
      const insert =
        (trigger.type === '@' ? `@${item.label}` : `#${item.label}`) + ' ';
      const next = replaceRange(ta.value, trigger.start, caret, insert);
      setNewMessage(next);
      if (trigger.type === '@') {
        setMentions((prev) =>
          prev.some((m) => m.id === item.key)
            ? prev
            : [...prev, { id: item.key, label: item.label }]
        );
      }
      requestAnimationFrame(() => {
        ta.focus();
        const pos = trigger.start + insert.length;
        ta.setSelectionRange(pos, pos);
      });
      setSuggestOpen(false);
    },
    []
  );

  return (
    <div
      className='bg-background text-foreground relative h-full w-full overflow-hidden antialiased'
      data-chat-root
    >
      {/* Messages (scrollable area) */}
      <div
        ref={containerRef}
        className='absolute inset-x-0 top-0 bottom-0 space-y-3 overflow-x-hidden overflow-y-auto px-3 pt-3 pb-36 md:space-y-4 md:px-4 md:pt-4'
      >
        {/* Debug guide: enable with ?debugChat=1 to verify right edge */}
        {typeof window !== 'undefined' &&
          new URLSearchParams(window.location.search).get('debugChat') ===
            '1' && (
            <div className='pointer-events-none absolute inset-y-0 right-9 z-50 w-px bg-fuchsia-500/50 md:right-10' />
          )}
        {/* Unread banner */}
        {seenReady && unreadCount > 0 && (
          <div className='bg-card/80 sticky top-0 z-10 flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-xs shadow-sm backdrop-blur'>
            <div className='text-sm'>
              <span className='font-medium'>
                {unreadCount > 16 ? '16+' : unreadCount} new messages
              </span>
              {firstUnreadAt && (
                <span className='text-muted-foreground'>
                  {' '}
                  since {formatBannerTime(firstUnreadAt)}
                </span>
              )}
            </div>
            <Button variant='outline' size='sm' onClick={markAsRead}>
              Mark As Read
            </Button>
          </div>
        )}
        {allMessages.length === 0 ? (
          <div className='text-muted-foreground text-center text-sm'>
            No messages yet.
          </div>
        ) : null}
        <div className='space-y-1 pb-2'>
          {allMessages.map((message, index) => {
            const prevMessage = index > 0 ? allMessages[index - 1] : null;
            const nextMessage =
              index < allMessages.length - 1 ? allMessages[index + 1] : null;
            const showHeader =
              !prevMessage || prevMessage.user.id !== message.user.id;
            // Group tail for avatar (uninterrupted run by same user)
            const showBottomAvatar =
              !nextMessage || nextMessage.user.id !== message.user.id;
            // Per-minute timestamp: only show on last message of the same minute run
            const sameMinute = (
              a?: ChatMessage | null,
              b?: ChatMessage | null
            ) => {
              if (!a || !b) return false;
              const da = new Date(a.createdAt);
              const db = new Date(b.createdAt);
              return (
                da.getFullYear() === db.getFullYear() &&
                da.getMonth() === db.getMonth() &&
                da.getDate() === db.getDate() &&
                da.getHours() === db.getHours() &&
                da.getMinutes() === db.getMinutes()
              );
            };
            const showTimestamp = !sameMinute(message, nextMessage);
            const renderDateDivider = (() => {
              const d1 = prevMessage ? new Date(prevMessage.createdAt) : null;
              const d2 = new Date(message.createdAt);
              if (!d1) return true;
              return (
                d1.getFullYear() !== d2.getFullYear() ||
                d1.getMonth() !== d2.getMonth() ||
                d1.getDate() !== d2.getDate()
              );
            })();
            // Compact grouping: same sender and same minute as previous message
            const compact = Boolean(
              prevMessage &&
                prevMessage.user.id === message.user.id &&
                sameMinute(prevMessage, message)
            );
            return (
              <div
                key={message.id}
                id={`mid-${message.id}`}
                className='animate-in fade-in slide-in-from-bottom-4 overflow-x-hidden duration-300'
              >
                {renderDateDivider && (
                  <div className='my-3 flex items-center justify-center'>
                    <div className='bg-card text-muted-foreground rounded-full border px-3 py-1 text-xs shadow-sm'>
                      {formatDayBanner(message.createdAt)}
                    </div>
                  </div>
                )}
                <ChatMessageItem
                  message={{ ...message, room_id: roomName }}
                  isOwnMessage={message.user.id === (userId || 'me')}
                  showHeader={showHeader}
                  showBottomAvatar={showBottomAvatar}
                  showTimestamp={showTimestamp}
                  compact={compact}
                  onReply={(m) => setReplyTo(m)}
                  onEdit={(m) => setEditMsg(m)}
                  onDeleted={() => {
                    /* could optimistically remove from list if needed */
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Composer */}
      <form
        onSubmit={handleSendMessage}
        className='border-border bg-card absolute inset-x-0 bottom-0 space-y-1.5 border-t px-2 py-2'
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          onFilesAdd(e.dataTransfer?.files);
        }}
      >
        {/* Hidden file input for manual attachments */}
        <input
          ref={fileInputRef}
          type='file'
          multiple
          className='hidden'
          onChange={(e) => {
            onFilesAdd(e.target.files);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }}
        />
        {/* Reply/Edit banner */}
        {(replyTo || editMsg) && (
          <div className='bg-accent/40 mb-1 flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[11px]'>
            <span className='font-medium'>
              {editMsg ? 'Editing message' : 'Replying to a message'}
            </span>
            {replyTo && (
              <button
                className='underline'
                onClick={() => {
                  const el = document.getElementById(`mid-${replyTo.id}`);
                  if (el)
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
              >
                Jump to
              </button>
            )}
            <button
              className='ml-auto'
              onClick={() => {
                setReplyTo(null);
                setEditMsg(null);
              }}
            >
              ✕
            </button>
          </div>
        )}
        {/* Attachments moved above input */}
        {(files.length > 0 || pendingCards.length > 0) && (
          <div className='mb-2 flex flex-wrap items-center gap-2'>
            {files.map((f, i) => (
              <div
                key={i}
                className='bg-background/70 flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[11px]'
              >
                <Paperclip className='size-3' />
                <span className='max-w-40 truncate' title={f.name}>
                  {f.name}
                </span>
                <button
                  type='button'
                  onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                  className='opacity-60 hover:opacity-100'
                  aria-label='Remove file'
                >
                  <X className='size-3' />
                </button>
              </div>
            ))}
            {pendingCards.map((c, i) => (
              <div
                key={`card-${i}`}
                className='bg-background/70 flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[11px]'
              >
                <span className='bg-primary/10 text-primary inline-flex size-4 items-center justify-center rounded'>
                  ◆
                </span>
                <span className='max-w-40 truncate' title={humanizeCard(c)}>
                  {humanizeCard(c)}
                </span>
                <button
                  type='button'
                  onClick={() =>
                    setPendingCards(pendingCards.filter((_, idx) => idx !== i))
                  }
                  className='opacity-60 hover:opacity-100'
                  aria-label='Remove card'
                >
                  <X className='size-3' />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Toolbar */}
        <div className='text-muted-foreground flex items-center gap-1 text-[11px] md:text-xs'>
          <ToolbarBtn
            title='Bold'
            onClick={() => surroundSelection('**', '**')}
          >
            <Bold className='size-4' />
          </ToolbarBtn>
          <ToolbarBtn
            title='Italic'
            onClick={() => surroundSelection('*', '*')}
          >
            <Italic className='size-4' />
          </ToolbarBtn>
          <ToolbarBtn
            title='Inline code'
            onClick={() => surroundSelection('`', '`')}
          >
            <Code className='size-4' />
          </ToolbarBtn>
          <ToolbarBtn title='Quote' onClick={() => prependLine('> ')}>
            <Quote className='size-4' />
          </ToolbarBtn>
          <ToolbarBtn title='List' onClick={() => prependLine('- ')}>
            <List className='size-4' />
          </ToolbarBtn>
          {/* Separator between formatting and insert */}
          <div className='bg-border mx-1 h-4 w-px' />
          {/* Attach files (paperclip) just left of plus dropdown */}
          <button
            type='button'
            onClick={() => fileInputRef.current?.click()}
            className='bg-background hover:bg-accent/60 inline-flex h-8 w-8 items-center justify-center rounded-md border transition'
            aria-label='Attach files'
            title='Attach files'
          >
            <Paperclip className='size-4' />
          </button>
          {/* Insert Card dropdown (grouped) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type='button'
                title='Insert card'
                className='inline-flex items-center rounded-md p-1.5 shadow-sm transition-shadow hover:shadow'
                style={{
                  backgroundColor: 'rgba(255, 90, 38, 0.2)',
                  color: '#ff5a26'
                }}
              >
                <Plus className='size-4' />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='start' className='w-64'>
              {/* Shipment Cards group: include Shipment, Request, Negotiation */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <div className='flex items-start gap-2'>
                    <Package className='mt-0.5 size-4' />
                    <div className='-mt-0.5 flex flex-col'>
                      <span>Shipment Cards</span>
                      <span className='text-muted-foreground text-[11px]'>
                        Plan, request & negotiate
                      </span>
                    </div>
                  </div>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem
                    onClick={() => {
                      setPendingInsertType('shipment_card');
                      setCardBuilderOpen(true);
                    }}
                  >
                    <Package className='mr-2 size-4' /> Shipment
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setPendingInsertType('request_card');
                      setCardBuilderOpen(true);
                    }}
                  >
                    <ReceiptText className='mr-2 size-4' /> Request
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setPendingInsertType('negotiation_card');
                      setCardBuilderOpen(true);
                    }}
                  >
                    <Handshake className='mr-2 size-4' /> Negotiation
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSeparator />

              {/* Payment Cards */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <div className='flex items-start gap-2'>
                    <Wallet className='mt-0.5 size-4' />
                    <div className='-mt-0.5 flex flex-col'>
                      <span>Payment Cards</span>
                      <span className='text-muted-foreground text-[11px]'>
                        Invoices & payment status
                      </span>
                    </div>
                  </div>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem
                    onClick={() => {
                      setPendingInsertType('invoice_card');
                      setCardBuilderOpen(true);
                    }}
                  >
                    <ReceiptText className='mr-2 size-4' /> Invoice
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setPendingInsertType('payment_status_card');
                      setCardBuilderOpen(true);
                    }}
                  >
                    <Wallet className='mr-2 size-4' /> Payment Status
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* Task & Approval Cards */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <div className='flex items-start gap-2'>
                    <ClipboardCheck className='mt-0.5 size-4' />
                    <div className='-mt-0.5 flex flex-col'>
                      <span>Task & Approval Cards</span>
                      <span className='text-muted-foreground text-[11px]'>
                        Assign work or request sign-off
                      </span>
                    </div>
                  </div>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem
                    onClick={() => {
                      setPendingInsertType('task_card');
                      setCardBuilderOpen(true);
                    }}
                  >
                    <CheckSquare className='mr-2 size-4' /> Task
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setPendingInsertType('approval_card');
                      setCardBuilderOpen(true);
                    }}
                  >
                    <ClipboardCheck className='mr-2 size-4' /> Approval
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSeparator />

              {/* Note Cards */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <div className='flex items-start gap-2'>
                    <StickyNote className='mt-0.5 size-4' />
                    <div className='-mt-0.5 flex flex-col'>
                      <span>Note Cards</span>
                      <span className='text-muted-foreground text-[11px]'>
                        Quick annotations
                      </span>
                    </div>
                  </div>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem
                    onClick={() => {
                      setPendingInsertType('note_card');
                      setCardBuilderOpen(true);
                    }}
                  >
                    <StickyNote className='mr-2 size-4' /> Note
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className='text-muted-foreground ml-auto text-[10px] md:text-xs'>
            Ctrl+Enter
          </div>
        </div>

        <div
          className={cn(
            'bg-background flex items-end gap-1.5 rounded-lg px-2 py-1.5',
            dragging ? 'ring-primary/60 ring-2' : 'border-border/60 border'
          )}
        >
          <Textarea
            ref={textareaRef}
            className={cn(
              'resize-none bg-transparent text-[12px] leading-5 md:text-xs',
              'max-h-36 min-h-8'
            )}
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              detectSuggest();
            }}
            onKeyDown={(e) => {
              if (suggestOpen) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setSuggestIndex((i) =>
                    Math.min(i + 1, Math.max(0, suggestItems.length - 1))
                  );
                  return;
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setSuggestIndex((i) => Math.max(i - 1, 0));
                  return;
                }
                if (e.key === 'Enter' || e.key === 'Tab') {
                  e.preventDefault();
                  if (suggestItems[suggestIndex])
                    applySuggestion(suggestItems[suggestIndex]);
                  return;
                }
                if (e.key === 'Escape') {
                  setSuggestOpen(false);
                  return;
                }
              }
              // If user just typed a trigger, schedule detection after the input applies
              if (e.key === '@' || e.key === '#') {
                requestAnimationFrame(() => detectSuggest());
              }
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void handleSendMessage(e as unknown as React.FormEvent);
              }
            }}
            placeholder={
              roomTitle ? `Messages #${roomTitle}...` : 'Type a message...'
            }
            disabled={!isConnected}
            rows={3}
            onCompositionEnd={() => detectSuggest()}
            onPaste={(e) => {
              const fs = e.clipboardData?.files;
              if (fs && fs.length) {
                e.preventDefault();
                onFilesAdd(fs);
              }
            }}
            onInput={() => detectSuggest()}
          />

          <Popover>
            <PopoverTrigger asChild>
              <Button
                type='button'
                variant='ghost'
                className='shrink-0'
                aria-label='Emoji picker'
              >
                <Smile className='size-5' />
              </Button>
            </PopoverTrigger>
            <PopoverContent className='p-0' align='end'>
              <div className='w-[320px]'>
                <EmojiPicker
                  onPick={(emoji) => {
                    insertAtCursorStrict(textareaRef, setNewMessage, emoji);
                    pushRecentEmoji(emoji);
                  }}
                />
              </div>
            </PopoverContent>
          </Popover>

          <Button
            className='h-8 shrink-0 px-3'
            type='submit'
            disabled={
              !newMessage.trim() &&
              files.length === 0 &&
              pendingCards.length === 0
            }
            aria-label='Send'
            size='sm'
          >
            <Send className='size-3' />
          </Button>
        </div>

        {/* (Removed bottom attach button as requested) */}

        {suggestOpen && (
          <div className='bg-popover text-popover-foreground absolute bottom-16 left-2 z-50 w-60 rounded-md border shadow-md'>
            <div className='max-h-56 overflow-auto p-1'>
              {suggestItems.length === 0 ? (
                <div className='text-muted-foreground px-2 py-1.5 text-[11px]'>
                  No matches
                </div>
              ) : (
                suggestItems.map((item, idx) => (
                  <button
                    key={item.key}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[12px]',
                      idx === suggestIndex ? 'bg-accent' : 'hover:bg-accent'
                    )}
                    onClick={() => applySuggestion(item)}
                  >
                    {suggestType === '@' ? (
                      <>
                        <Avatar className='size-6'>
                          <AvatarImage src={item.avatarUrl} alt={item.label} />
                          <AvatarFallback className='text-[10px]'>
                            {item.label.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className='truncate font-medium'>
                          {item.label}
                        </span>
                        {item.meta && (
                          <span className='text-muted-foreground ml-auto truncate text-xs'>
                            @{item.meta}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <span className='bg-muted inline-flex size-5 items-center justify-center rounded-full text-xs'>
                          #
                        </span>
                        <span className='truncate'>{item.label}</span>
                      </>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </form>
      <CardBuilderDialog
        open={cardBuilderOpen}
        onOpenChange={setCardBuilderOpen}
        type={pendingInsertType || 'shipment_card'}
        members={roomMembers}
        userRole={mapRole(role)}
        onInsert={(card) => {
          // Stage card visually; don't insert JSON into textarea
          setPendingCards((prev) => [...prev, card]);
          setPendingInsertType(null);
        }}
      />
    </div>
  );
};

function formatBannerTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const opts: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit'
  };
  const time = new Intl.DateTimeFormat(undefined, opts).format(d);
  const month = new Intl.DateTimeFormat(undefined, { month: 'long' }).format(d);
  const year = d.getFullYear();
  return `${time} on ${month}, ${year}`;
}

function formatDayBanner(iso: string | Date) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const weekday = new Intl.DateTimeFormat(undefined, {
    weekday: 'long'
  }).format(d);
  const month = new Intl.DateTimeFormat(undefined, { month: 'long' }).format(d);
  const day = d.getDate();
  return `${weekday}, ${month} ${ordinal(day)}`;
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'],
    v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function ToolbarBtn({
  children,
  onClick,
  title
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type='button'
      title={title}
      onClick={onClick}
      className='hover:bg-accent text-muted-foreground hover:text-foreground rounded p-1.5'
    >
      {children}
    </button>
  );
}

// Helpers
function surroundSelection(prefix: string, suffix: string) {
  const ta =
    document.activeElement?.tagName === 'TEXTAREA'
      ? (document.activeElement as HTMLTextAreaElement)
      : (document.querySelector('textarea') as HTMLTextAreaElement | null);
  if (!ta) return;
  const start = ta.selectionStart ?? 0;
  const end = ta.selectionEnd ?? 0;
  const value = ta.value;
  const before = value.slice(0, start);
  const selected = value.slice(start, end) || 'text';
  const after = value.slice(end);
  const next = `${before}${prefix}${selected}${suffix}${after}`;
  ta.value = next;
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  const pos = before.length + prefix.length + selected.length + suffix.length;
  ta.setSelectionRange(pos, pos);
}

function prependLine(prefix: string) {
  const ta =
    document.activeElement?.tagName === 'TEXTAREA'
      ? (document.activeElement as HTMLTextAreaElement)
      : (document.querySelector('textarea') as HTMLTextAreaElement | null);
  if (!ta) return;
  const pos = ta.selectionStart ?? 0;
  const value = ta.value;
  const lineStart = value.lastIndexOf('\n', Math.max(0, pos - 1)) + 1;
  const next = `${value.slice(0, lineStart)}${prefix}${value.slice(lineStart)}`;
  ta.value = next;
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  const newPos = pos + prefix.length;
  ta.setSelectionRange(newPos, newPos);
}

function insertAtCursorStrict(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  setValue: (v: string) => void,
  text: string
) {
  const ta =
    ref.current ??
    (document.querySelector('textarea') as HTMLTextAreaElement | null);
  if (!ta) return;
  const start = ta.selectionStart ?? 0;
  const end = ta.selectionEnd ?? 0;
  const value = ta.value;
  const next = value.slice(0, start) + text + value.slice(end);
  ta.value = next;
  setValue(next);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  const pos = start + text.length;
  ta.setSelectionRange(pos, pos);
}

function getTrigger(
  text: string,
  caret: number
): null | { type: '@' | '#' | '/'; start: number; query: string } {
  const slice = text.slice(0, caret);
  // Allow trigger at start or after any non-word char (prevents emails like test@example.com)
  const m = slice.match(/(^|[^\w])([@#\/])([A-Za-z0-9._-]{0,32})$/);
  if (!m) return null;
  const type = m[2] as '@' | '#' | '/';
  const query = m[3] || '';
  const start = caret - (query.length + 1);
  return { type, start, query };
}

function replaceRange(
  original: string,
  start: number,
  end: number,
  insert: string
) {
  return original.slice(0, start) + insert + original.slice(end);
}

function safeStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return '{}';
  }
}

function humanizeCard(card: NobleCard): string {
  const typeMap: Record<NobleCard['type'], string> = {
    shipment_card: 'Shipment',
    request_card: 'Request',
    negotiation_card: 'Negotiation',
    invoice_card: 'Invoice',
    payment_status_card: 'Payment Status',
    task_card: 'Task',
    calendar_card: 'Calendar',
    approval_card: 'Approval',
    note_card: 'Note'
  };
  const label = typeMap[card.type] || card.type;
  const id = (card as any).id ? ` #${(card as any).id}` : '';
  const title =
    (card as any).title ||
    (card as any).subject ||
    (card as any).requester ||
    (card as any).forwarder ||
    '';
  const tail = title ? ` — ${title}` : '';
  return `${label}${id}${tail}`;
}

function mapRole(
  role: any
): 'owner' | 'forwarder' | 'customs_broker' | 'finance' | undefined {
  if (!role) return undefined;
  const r = String(role).toLowerCase();
  if (r.includes('owner')) return 'owner';
  if (r.includes('forwarder')) return 'forwarder';
  if (r.includes('customs')) return 'customs_broker';
  if (r.includes('finance')) return 'finance';
  return undefined;
}
