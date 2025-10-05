import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/hooks/use-realtime-chat';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import {
  Star,
  Pin,
  Smile,
  // Paperclip,
  Download,
  File,
  FileText,
  FileArchive,
  Image as ImageIcon,
  Video,
  Link as LinkIcon,
  MoreHorizontal,
  Reply as ReplyIcon,
  Edit3,
  Trash2,
  Copy as CopyIcon
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger
} from '@/components/ui/hover-card';
import {
  CardRenderer,
  type NobleCard,
  type NobleAction
} from '@/components/chat-cards/card-renderer';
import { createEvent, notifyUsersAboutEvent } from '@/lib/calendar';
import { useProfileRole } from '@/hooks/use-profile-role';
import EmojiPicker from '@/components/ui/emoji-picker';

interface ChatMessageItemProps {
  message: ChatMessage & { room_id?: string };
  isOwnMessage: boolean;
  showHeader: boolean;
  showBottomAvatar?: boolean;
  showTimestamp?: boolean;
  onReply?: (m: ChatMessage) => void;
  onEdit?: (m: ChatMessage) => void;
  onDeleted?: (id: string) => void;
  replyCount?: number;
  lastReplyAt?: string | undefined;
  compact?: boolean;
}

export const ChatMessageItem = ({
  message,
  isOwnMessage,
  showHeader,
  showBottomAvatar = true,
  showTimestamp = true,
  onReply,
  onEdit,
  onDeleted,
  compact = false
}: ChatMessageItemProps) => {
  const { role } = useProfileRole();
  const [menuOpen, setMenuOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [readers, setReaders] = useState<
    Array<{ id: string; name: string; avatar_url?: string | null }>
  >([]);
  // Avatar state removed (no longer needed)
  const [showAllAtt, setShowAllAtt] = useState(false);
  // Initials removed (no longer needed)
  const roomId = (message as any).room_id as string | undefined;
  const meta = useMemo(
    () => extractMeta(message.content ?? ''),
    [message.content]
  );
  const replyTo = meta.replyTo;
  const edited = meta.edited;
  const replyStripped = meta.body;
  const mentionMap = useMemo(
    () => extractMentionMap(message.content || ''),
    [message.content]
  );
  const decoded = useMemo(() => stripMentions(replyStripped), [replyStripped]);
  const { body: textBody, attachments } = useMemo(
    () => extractAttachments(decoded),
    [decoded]
  );
  const { text: textWithoutCards, cards } = useMemo(
    () => extractCardsFromBody(textBody),
    [textBody]
  );
  const processedBody = useMemo(
    () => linkifyMentions(textWithoutCards, mentionMap),
    [textWithoutCards, mentionMap]
  );
  const [reactions, setReactions] = useState<
    Array<{
      emoji: string;
      users: { id: string; name: string; avatar_url?: string | null }[];
    }>
  >([]);
  const [replyPreview, setReplyPreview] = useState<string | null>(null);
  const [replyAuthor, setReplyAuthor] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await supabase
        .from('chat_events')
        .select('actor_id')
        .eq('event_type', 'receipt')
        .eq('message_id', message.id);
      const ids = Array.from(
        new Set((data || []).map((r) => r.actor_id as string))
      );
      if (!ids.length) {
        if (active) setReaders([]);
        return;
      }
      const { data: profs } = await supabase
        .from('profiles')
        .select('id,display_name,username,avatar_url')
        .in('id', ids);
      const mapped = (profs || []).map((p) => ({
        id: p.id as string,
        name: ((p.display_name as string | null) ||
          (p.username as string | null) ||
          'User') as string,
        avatar_url: (p.avatar_url as string | null) ?? null
      }));
      if (active) setReaders(mapped);
    }
    void load();
    // realtime subscription
    const channel = supabase
      .channel(`receipts:${message.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_events',
          filter: `message_id=eq.${message.id}`
        },
        () => void load()
      )
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [message.id]);

  // Avatar effect removed (no longer needed)
  async function addReaction(emoji: string) {
    if (!roomId) return;
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;
    await supabase.from('chat_events').insert({
      room_id: roomId,
      message_id: message.id,
      actor_id: uid,
      event_type: 'emoji',
      payload: { emoji }
    });
    setEmojiOpen(false);
  }
  async function toggle(type: 'pin' | 'star') {
    if (!roomId) return;
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;
    await supabase.from('chat_events').insert({
      room_id: roomId,
      message_id: message.id,
      actor_id: uid,
      event_type: type
    });
  }
  // Load reply preview
  useEffect(() => {
    let active = true;
    async function load() {
      if (!replyTo) {
        if (active) {
          setReplyPreview(null);
          setReplyAuthor(null);
        }
        return;
      }
      const { data } = await supabase
        .from('chat_messages')
        .select('content,sender_id')
        .eq('id', replyTo)
        .single();
      const raw = (data?.content as string) || '';
      const { body } = extractAttachments(extractMeta(raw).body);
      const firstLine = body.trim().split(/\r?\n/)[0] || body.trim();
      const snippet = firstLine.slice(0, 140);
      if (active) setReplyPreview(snippet || 'Message');
      const uid = (data?.sender_id as string | undefined) || undefined;
      if (uid) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('display_name,username')
          .eq('id', uid)
          .single();
        const name = ((prof?.display_name as string | null) ||
          (prof?.username as string | null) ||
          'User') as string;
        if (active) setReplyAuthor(name);
      } else if (active) {
        setReplyAuthor(null);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [replyTo]);
  // Load reactions for this message and keep updated
  useEffect(() => {
    let active = true;
    async function loadReactions() {
      const { data } = await supabase
        .from('chat_events')
        .select('actor_id, payload')
        .eq('event_type', 'emoji')
        .eq('message_id', message.id);
      const byEmoji = new Map<
        string,
        {
          emoji: string;
          users: { id: string; name: string; avatar_url?: string | null }[];
        }
      >();
      for (const row of data || []) {
        const emoji = (row as any).payload?.emoji as string | undefined;
        if (!emoji) continue;
        const actor = (row as any).actor_id as string;
        // fetch profile minimal (could be optimized by joining)
        const { data: prof } = await supabase
          .from('profiles')
          .select('id,display_name,username,avatar_url')
          .eq('id', actor)
          .single();
        const name = ((prof?.display_name as string | null) ||
          (prof?.username as string | null) ||
          'User') as string;
        const item = byEmoji.get(emoji) || { emoji, users: [] };
        item.users.push({
          id: actor,
          name,
          avatar_url: (prof?.avatar_url as string | null) ?? null
        });
        byEmoji.set(emoji, item);
      }
      if (active) setReactions(Array.from(byEmoji.values()));
    }
    void loadReactions();
    const channel = supabase
      .channel(`emoji:${message.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_events',
          filter: `message_id=eq.${message.id}`
        },
        () => void loadReactions()
      )
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [message.id]);
  // Kenar boşluğu (her iki taraf için aynı değişken)
  const edgePadding = 'px-1 sm:px-1 md:px-1'; // Buradan ayar çekebilirsiniz
  // Balon padding (her iki taraf için aynı değişken)
  const balloonPadding = 'px-3.5 py-2.5'; // Buradan ayar çekebilirsiniz

  // Mesajlar arası mesafe için değişken
  const messageSpacing = 'mb-0.5 md:mb-0.5'; // Buradan ayar çekebilirsiniz

  return (
    <div
      className={`group relative flex ${isOwnMessage ? 'justify-end' : 'justify-start'} ${edgePadding} ${messageSpacing}`}
      style={{ overflow: 'visible' }}
    >
      <div
        className={cn(
          'flex max-w-full items-center',
          isOwnMessage ? 'gap-0' : 'gap-2'
        )}
      >
        {/* Side: for incoming show avatar on left, for outgoing show actions on left */}
        {isOwnMessage ? (
          // Outgoing: actions on left
          <div className='mr-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100'>
            <Button
              variant='ghost'
              size='icon'
              className='h-6 w-6 p-0'
              title='Reply'
              onClick={() => onReply?.(message)}
            >
              <ReplyIcon className='size-4' />
            </Button>
            <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-6 w-6 p-0'
                  title='React'
                >
                  <Smile className='size-4' />
                </Button>
              </PopoverTrigger>
              <PopoverContent className='w-fit p-0' align='center'>
                <EmojiPicker
                  className='h-[342px]'
                  onPick={(e) => void addReaction(e)}
                />
              </PopoverContent>
            </Popover>
            <Popover open={menuOpen} onOpenChange={setMenuOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-6 w-6 p-0'
                  title='More'
                >
                  <MoreHorizontal className='size-4' />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                side={'right'}
                className='w-auto p-1'
                align={'start'}
              >
                <div className='flex items-center gap-1'>
                  <Button
                    variant='ghost'
                    size='icon'
                    title='Copy'
                    onClick={() => {
                      try {
                        void navigator.clipboard?.writeText(
                          message.content || ''
                        );
                      } catch {
                        void 0;
                      }
                      setMenuOpen(false);
                    }}
                  >
                    <CopyIcon className='size-4' />
                  </Button>
                  <Button
                    variant='ghost'
                    size='icon'
                    title='Reply'
                    onClick={() => {
                      onReply?.(message);
                      setMenuOpen(false);
                    }}
                  >
                    <ReplyIcon className='size-4' />
                  </Button>
                  {isOwnMessage && (
                    <Button
                      variant='ghost'
                      size='icon'
                      title='Edit'
                      onClick={() => {
                        onEdit?.(message);
                        setMenuOpen(false);
                      }}
                    >
                      <Edit3 className='size-4' />
                    </Button>
                  )}
                  {isOwnMessage && (
                    <Button
                      variant='ghost'
                      size='icon'
                      title='Delete'
                      onClick={async () => {
                        await supabase
                          .from('chat_messages')
                          .delete()
                          .eq('id', message.id);
                        onDeleted?.(message.id);
                        setMenuOpen(false);
                      }}
                    >
                      <Trash2 className='size-4' />
                    </Button>
                  )}
                  <Button
                    variant='ghost'
                    size='icon'
                    title='Pin'
                    onClick={() => {
                      void toggle('pin');
                      setMenuOpen(false);
                    }}
                  >
                    <Pin className='size-4' />
                  </Button>
                  <Button
                    variant='ghost'
                    size='icon'
                    title='Star'
                    onClick={() => {
                      void toggle('star');
                      setMenuOpen(false);
                    }}
                  >
                    <Star className='size-4' />
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        ) : null}

        {/* Content column (bubble + extras) */}
        <div
          className={cn(
            'flex w-full max-w-[75%] min-w-0 flex-col',
            isOwnMessage ? 'ml-auto items-end' : 'mr-auto items-start'
          )}
          style={{ overflow: 'visible' }}
        >
          {/* Incoming header: avatar + name (her zaman reply preview'dan önce) */}
          {!isOwnMessage && showHeader && (
            <div className='mb-1 flex items-center gap-2'>
              <span className='text-muted-foreground truncate text-xs font-medium'>
                @{message.user.name}
              </span>
            </div>
          )}
          {/* Reply preview outside bubble (above the main message, header'dan sonra) */}
          {replyPreview && replyTo && (
            <div
              className={cn('mb-1', isOwnMessage ? 'self-end' : 'self-start')}
            >
              <button
                type='button'
                className='bg-muted/70 text-foreground hover:bg-accent/60 inline-flex max-w-[70vw] items-center gap-2 rounded-full px-3 py-1 text-xs'
                onClick={() => {
                  const el = document.getElementById(`mid-${replyTo}`);
                  if (el)
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                title='Jump to replied message'
              >
                <ReplyIcon className='size-3.5 opacity-70' />
                <span className='truncate'>{replyPreview}</span>
              </button>
            </div>
          )}
          {/* Top header removed per design */}
          <div
            className={cn(
              'relative flex items-end overflow-visible',
              compact ? 'gap-1' : 'gap-2'
            )}
          >
            {(textWithoutCards || replyTo) && (
              <div
                className={cn(
                  balloonPadding,
                  'w-fit rounded-2xl border text-sm break-words whitespace-pre-wrap shadow-sm',
                  'bg-card text-foreground border-border/50'
                )}
              >
                {/* reply preview moved outside bubble */}
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkBreaks]}
                  components={{
                    a: (
                      props: React.AnchorHTMLAttributes<HTMLAnchorElement>
                    ) => {
                      const href = props.href || '';
                      if (href.startsWith('mention://')) {
                        const payload = href.replace('mention://', '');
                        const [id, label] = payload.split('|');
                        return (
                          <MentionHover
                            id={id}
                            label={label || props.children?.toString() || ''}
                          />
                        );
                      }
                      return (
                        <a
                          className='break-words underline underline-offset-2'
                          {...props}
                        />
                      );
                    },
                    code: (props: React.HTMLAttributes<HTMLElement>) => (
                      <code
                        className={cn(
                          'bg-background/40 rounded px-1 py-0.5 text-xs break-words'
                        )}
                        {...props}
                      />
                    ),
                    pre: (props: React.HTMLAttributes<HTMLElement>) => (
                      <pre className='max-w-full overflow-x-auto' {...props} />
                    ),
                    p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
                      <p
                        className='leading-relaxed break-words whitespace-pre-wrap'
                        {...props}
                      />
                    ),
                    ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
                      <ul className='list-disc pl-5 break-words' {...props} />
                    ),
                    ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
                      <ol
                        className='list-decimal pl-5 break-words'
                        {...props}
                      />
                    ),
                    blockquote: (
                      props: React.BlockquoteHTMLAttributes<HTMLElement>
                    ) => (
                      <blockquote
                        className='border-foreground/20 border-l-2 pl-3 break-words italic'
                        {...props}
                      />
                    )
                  }}
                >
                  {processedBody}
                </ReactMarkdown>
                {edited && (
                  <div className='mt-1 text-[10px] italic opacity-75'>
                    edited
                  </div>
                )}
              </div>
            )}
            {/* No inline hover actions here; actions rendered as side columns */}
            {/* Read receipts */}
            {readers.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <div className='absolute right-1 -bottom-3 flex -space-x-2'>
                    {readers.slice(0, 3).map((u) => (
                      <span
                        key={u.id}
                        className='bg-muted text-muted-foreground border-border inline-flex size-4 items-center justify-center rounded-full border text-[10px] font-bold'
                        title={u.name}
                      >
                        {(u.name || 'U').slice(0, 2).toUpperCase()}
                      </span>
                    ))}
                  </div>
                </PopoverTrigger>
                <PopoverContent className='w-48 p-2'>
                  <div className='mb-1 text-xs font-medium'>Read by</div>
                  <div className='space-y-1'>
                    {readers.map((u) => (
                      <div
                        key={u.id}
                        className='flex items-center gap-2 text-sm'
                      >
                        <span
                          className='bg-muted text-muted-foreground border-border mr-2 inline-flex size-5 items-center justify-center rounded-full border text-xs font-bold'
                          title={u.name}
                        >
                          {(u.name || 'U').slice(0, 2).toUpperCase()}
                        </span>
                        <span>{u.name}</span>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Cards under message (attachment-like) */}
          {cards.length > 0 && (
            <div
              className={cn('mt-2', isOwnMessage ? 'self-end' : 'self-start')}
            >
              <div
                className={cn(
                  'flex flex-col gap-2',
                  isOwnMessage ? 'items-end' : 'items-start'
                )}
              >
                {cards.map((c, i) => (
                  <div
                    key={i}
                    className={cn(isOwnMessage ? 'self-end' : 'self-start')}
                  >
                    <CardRenderer
                      card={c}
                      userRole={mapRole(role)}
                      onAction={(a) => handleCardAction(a, c)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Attachments under message */}
          {attachments.length > 0 && (
            <div
              className={cn('mt-2', isOwnMessage ? 'self-end' : 'self-start')}
            >
              {/* responsive auto-fit columns, align to sender side */}
              <div
                className={cn(
                  'grid [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))] gap-2',
                  isOwnMessage ? 'justify-items-end' : 'justify-items-start'
                )}
              >
                {(showAllAtt ? attachments : attachments.slice(0, 6)).map(
                  (a, idx) => (
                    <div
                      key={idx}
                      className={cn(isOwnMessage ? 'self-end' : 'self-start')}
                    >
                      <AttachmentChip att={a} />
                    </div>
                  )
                )}
                {!showAllAtt && attachments.length > 6 && (
                  <button
                    type='button'
                    onClick={() => setShowAllAtt(true)}
                    className={cn(
                      'bg-card text-card-foreground hover:bg-accent/50 inline-flex items-center justify-center rounded-lg border px-2.5 py-1.5 text-sm',
                      isOwnMessage ? 'self-end' : 'self-start'
                    )}
                    aria-label={`Show ${attachments.length - 6} more attachments`}
                  >
                    +{attachments.length - 6} more
                  </button>
                )}
              </div>
            </div>
          )}
          {/* Timestamp */}
          {showTimestamp && (
            <div
              className={cn(
                'text-muted-foreground mt-1 text-[10px]',
                isOwnMessage ? 'text-right' : 'text-left'
              )}
            >
              {formatTime(message.createdAt)}
            </div>
          )}
          {/* Reactions bar */}
          {reactions.length > 0 && (
            <div
              className={cn(
                'mt-1 flex flex-wrap gap-1',
                isOwnMessage ? 'justify-end' : 'justify-start'
              )}
            >
              {reactions.map((r) => (
                <Popover key={r.emoji}>
                  <PopoverTrigger asChild>
                    <button className='bg-background hover:bg-accent/60 rounded-full border px-2 py-0.5 text-sm'>
                      {r.emoji}{' '}
                      <span className='text-muted-foreground text-xs'>
                        {r.users.length}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className='w-44 p-2'>
                    <div className='mb-1 text-xs font-medium'>Reacted</div>
                    <div className='space-y-1 text-sm'>
                      {r.users.map((u) => (
                        <div key={u.id} className='flex items-center gap-2'>
                          <span
                            className='bg-muted text-muted-foreground border-border mr-2 inline-flex size-5 items-center justify-center rounded-full border text-xs font-bold'
                            title={u.name}
                          >
                            {(u.name || 'U').slice(0, 2).toUpperCase()}
                          </span>
                          <span className='truncate'>{u.name}</span>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              ))}
            </div>
          )}
          {/* No bottom avatar; avatar is shown side-centered when needed */}
        </div>
        {/* Side: for incoming show actions on right; for outgoing keep spacer */}
        {!isOwnMessage ? (
          // Incoming: actions on right
          <div className='ml-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100'>
            <Button
              variant='ghost'
              size='icon'
              className='h-6 w-6 p-0'
              title='Reply'
              onClick={() => onReply?.(message)}
            >
              <ReplyIcon className='size-4' />
            </Button>
            <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-6 w-6 p-0'
                  title='React'
                >
                  <Smile className='size-4' />
                </Button>
              </PopoverTrigger>
              <PopoverContent className='w-fit p-0' align='center'>
                <EmojiPicker
                  className='h-[342px]'
                  onPick={(e) => void addReaction(e)}
                />
              </PopoverContent>
            </Popover>
            <Popover open={menuOpen} onOpenChange={setMenuOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-6 w-6 p-0'
                  title='More'
                >
                  <MoreHorizontal className='size-4' />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                side={'left'}
                className='w-auto p-1'
                align={'end'}
              >
                <div className='flex items-center gap-1'>
                  <Button
                    variant='ghost'
                    size='icon'
                    title='Copy'
                    onClick={() => {
                      try {
                        void navigator.clipboard?.writeText(
                          message.content || ''
                        );
                      } catch {
                        void 0;
                      }
                      setMenuOpen(false);
                    }}
                  >
                    <CopyIcon className='size-4' />
                  </Button>
                  <Button
                    variant='ghost'
                    size='icon'
                    title='Reply'
                    onClick={() => {
                      onReply?.(message);
                      setMenuOpen(false);
                    }}
                  >
                    <ReplyIcon className='size-4' />
                  </Button>
                  {!isOwnMessage && null}
                  {isOwnMessage && (
                    <Button
                      variant='ghost'
                      size='icon'
                      title='Edit'
                      onClick={() => {
                        onEdit?.(message);
                        setMenuOpen(false);
                      }}
                    >
                      <Edit3 className='size-4' />
                    </Button>
                  )}
                  {isOwnMessage && (
                    <Button
                      variant='ghost'
                      size='icon'
                      title='Delete'
                      onClick={async () => {
                        await supabase
                          .from('chat_messages')
                          .delete()
                          .eq('id', message.id);
                        onDeleted?.(message.id);
                        setMenuOpen(false);
                      }}
                    >
                      <Trash2 className='size-4' />
                    </Button>
                  )}
                  <Button
                    variant='ghost'
                    size='icon'
                    title='Pin'
                    onClick={() => {
                      void toggle('pin');
                      setMenuOpen(false);
                    }}
                  >
                    <Pin className='size-4' />
                  </Button>
                  <Button
                    variant='ghost'
                    size='icon'
                    title='Star'
                    onClick={() => {
                      void toggle('star');
                      setMenuOpen(false);
                    }}
                  >
                    <Star className='size-4' />
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        ) : null}
      </div>
    </div>
  );
};

function relativeTime(iso: string | Date) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const sec = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} ${min === 1 ? 'minute' : 'minutes'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ${hr === 1 ? 'hour' : 'hours'} ago`;
  const day = Math.floor(hr / 24);
  return `${day} ${day === 1 ? 'day' : 'days'} ago`;
}

// Attachment rendering
type Attachment = {
  name: string;
  url?: string;
  type: string;
  provider?: 'drive' | 'generic';
};

function AttachmentChip({ att }: { att: Attachment }) {
  const icon = getAttachmentIcon(att);
  const typeLabel = att.provider === 'drive' ? 'Drive' : att.type.toUpperCase();
  return (
    <div className='group/att bg-card text-card-foreground hover:bg-accent/30 inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 shadow-sm'>
      <span className='bg-muted text-muted-foreground inline-flex items-center justify-center rounded-md p-1'>
        {icon}
      </span>
      <div className='min-w-0'>
        <div
          className='max-w-[180px] truncate text-xs leading-tight font-medium'
          title={att.name}
        >
          {att.name}
        </div>
        <div className='text-muted-foreground text-[10px] leading-tight'>
          {typeLabel}
        </div>
      </div>
      {att.url ? (
        <a
          href={att.url}
          target='_blank'
          rel='noopener noreferrer'
          className='text-primary ml-1 inline-flex items-center gap-1 text-xs hover:underline'
        >
          <Download className='size-3' />
          Download
        </a>
      ) : null}
    </div>
  );
}

function getAttachmentIcon(att: Attachment) {
  if (att.provider === 'drive') return <LinkIcon className='size-4' />;
  switch (att.type) {
    case 'pdf':
      return <FileText className='size-4' />;
    case 'image':
      return <ImageIcon className='size-4' />;
    case 'video':
      return <Video className='size-4' />;
    case 'archive':
      return <FileArchive className='size-4' />;
    case 'doc':
    case 'sheet':
    case 'slides':
      return <FileText className='size-4' />;
    default:
      return <File className='size-4' />;
  }
}

function formatTime(iso: string | Date) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  }).format(d);
}

export function extractAttachments(content: string): {
  body: string;
  attachments: Attachment[];
} {
  // Look for an 'Attachments:' section appended at the end by the composer
  const marker = /(?:\r?\n|^)Attachments:\s*\r?\n([\s\S]*)$/;
  const m = content.match(marker);
  if (!m) return { body: content, attachments: [] };
  const tail = m[1] || '';
  // Parse lines starting with '- ' as list entries
  const lines = tail
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0 && l.trim().startsWith('- '))
    .map((l) => l.trim().replace(/^-\s+/, ''));

  const attachments: Attachment[] = lines.map((line) => {
    // Match markdown link: [name](url)
    const link = line.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const name = link[1];
      const url = link[2];
      return { name, url, ...inferAttachmentMeta(name, url) };
    }
    // Fallback: plain name
    const name = line;
    return { name, ...inferAttachmentMeta(name) };
  });

  // Remove the attachments block from the body
  const body = content.slice(0, m.index).trimEnd();
  return { body, attachments };
}

// Card extraction: detect fenced block starting with ```nvcard and parse JSON inside
export function extractCardsFromBody(body: string): {
  text: string;
  cards: NobleCard[];
} {
  const cards: NobleCard[] = [];
  const re = /```nvcard\s*\n([\s\S]*?)\n```/g;
  let m: RegExpExecArray | null;
  let lastIndex = 0;
  let cleaned = '';
  while ((m = re.exec(body)) !== null) {
    const raw = m[1];
    // append text between lastIndex and start of this match
    cleaned += body.slice(lastIndex, m.index);
    lastIndex = m.index + m[0].length;
    try {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === 'object' && (obj as any).type)
        cards.push(obj as NobleCard);
    } catch {
      /* ignore parse errors */
    }
  }
  cleaned += body.slice(lastIndex);
  return { text: cleaned.trim(), cards };
}

async function handleCardAction(action: NobleAction, card: NobleCard) {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;
    const roomId = (card as any).room_id || null;
    // Audit event
    await supabase.from('chat_events').insert({
      room_id: roomId,
      message_id: null,
      actor_id: uid,
      event_type: 'card_action',
      payload: { action, card }
    });

    // Behaviors by action
    switch (action.action) {
      case 'add_to_calendar': {
        const p = action.payload as any;
        const title = p?.title || (card as any).title || 'Event';
        const starts_at =
          p?.starts_at || (card as any).starts_at || new Date().toISOString();
        const ends_at = p?.ends_at || (card as any).ends_at || null;
        const location = p?.location || (card as any).location || null;
        const notes = p?.notes || (card as any).notes || null;
        const room = (card as any).room_id || null;
        const res = await createEvent({
          title,
          starts_at,
          ends_at,
          location,
          notes,
          source: 'other',
          room_id: room
        });
        if (res.ok && Array.isArray(p?.notify)) {
          await notifyUsersAboutEvent(p.notify as string[], {
            title,
            starts_at,
            ends_at,
            location,
            notes,
            source: 'other',
            room_id: room
          });
        }
        break;
      }
      case 'open_shipment': {
        // Navigate to shipments overview (or specific sections if provided)
        const url = '/shipments';
        try {
          if (typeof window !== 'undefined') window.location.assign(url);
        } catch {
          /* ignore */
        }
        break;
      }
      case 'open_tracking': {
        // Navigate to active operations (tracking)
        const url = '/shipments/active-operations';
        try {
          if (typeof window !== 'undefined') window.location.assign(url);
        } catch {
          /* ignore */
        }
        break;
      }
      case 'open_chat_thread': {
        // Navigate to inbox thread list
        const url = '/inbox';
        try {
          if (typeof window !== 'undefined') window.location.assign(url);
        } catch {
          /* ignore */
        }
        break;
      }
      case 'report_issue': {
        await supabase.from('chat_events').insert({
          room_id: roomId,
          message_id: null,
          actor_id: uid,
          event_type: 'shipment_issue',
          payload: action.payload || {}
        });
        break;
      }
      case 'update_status': {
        // Milestone entry for shipment
        await supabase.from('chat_events').insert({
          room_id: roomId,
          message_id: null,
          actor_id: uid,
          event_type: 'shipment_milestone',
          payload: action.payload || {}
        });
        break;
      }
      case 'upload_document': {
        await supabase.from('chat_events').insert({
          room_id: roomId,
          message_id: null,
          actor_id: uid,
          event_type: 'shipment_document_uploaded',
          payload: action.payload || {}
        });
        break;
      }
      case 'mark_customs_cleared': {
        await supabase.from('chat_events').insert({
          room_id: roomId,
          message_id: null,
          actor_id: uid,
          event_type: 'customs_cleared',
          payload: action.payload || {}
        });
        break;
      }
      case 'request_missing_docs': {
        await supabase.from('chat_events').insert({
          room_id: roomId,
          message_id: null,
          actor_id: uid,
          event_type: 'request_missing_docs',
          payload: action.payload || {}
        });
        break;
      }
      case 'open_invoice_list': {
        try {
          if (typeof window !== 'undefined')
            window.location.assign('/shipments/invoices');
        } catch {
          /* ignore */
        }
        break;
      }
      case 'match_payment': {
        await supabase.from('chat_events').insert({
          room_id: roomId,
          message_id: null,
          actor_id: uid,
          event_type: 'match_payment',
          payload: action.payload || {}
        });
        break;
      }
      case 'create_offer': {
        const requestId = (action.payload as any)?.request_id;
        if (requestId) {
          await supabase.from('offers').insert({
            request_id: requestId,
            status: 'draft',
            details: {} as any
          });
        }
        break;
      }
      case 'accept_offer': {
        const offerId = (action.payload as any)?.offer_id;
        if (offerId) {
          // Call server route to create shipment and perform full acceptance workflow
          try {
            await fetch(
              `/api/offers/${encodeURIComponent(String(offerId))}/accept`,
              { method: 'POST', credentials: 'include' }
            )
              .then(() => void 0)
              .catch(() => void 0);
          } catch {
            /* ignore */
          }
          // Also update local tables optimistically
          await supabase
            .from('offers')
            .update({ status: 'accepted' })
            .eq('id', offerId);
          try {
            await supabase
              .from('negotiations')
              .update({ status: 'accepted' })
              .eq('offer_id', offerId);
          } catch {
            /* ignore */
          }
          // Emit chat event for timeline
          try {
            await supabase.from('chat_events').insert({
              room_id: roomId,
              message_id: null,
              actor_id: uid,
              event_type: 'offer_accepted',
              payload: { offer_id: offerId }
            });
          } catch {
            /* ignore */
          }
        }
        break;
      }
      case 'counter_offer': {
        const offerId = (action.payload as any)?.offer_id;
        if (offerId) {
          await supabase
            .from('offers')
            .update({ status: 'countered' })
            .eq('id', offerId);
          // Mark related negotiations as countered
          try {
            await supabase
              .from('negotiations')
              .update({ status: 'countered' })
              .eq('offer_id', offerId);
          } catch {
            /* ignore */
          }
          // Log chat event to keep the flow visible; users can send a new negotiation card from composer
          try {
            await supabase.from('chat_events').insert({
              room_id: roomId,
              message_id: null,
              actor_id: uid,
              event_type: 'negotiation_countered',
              payload: { offer_id: offerId }
            });
          } catch {
            /* ignore */
          }
        }
        break;
      }
      case 'withdraw_offer': {
        const offerId = (action.payload as any)?.offer_id;
        if (offerId) {
          await supabase
            .from('offers')
            .update({ status: 'withdrawn' })
            .eq('id', offerId);
          try {
            await supabase
              .from('negotiations')
              .update({ status: 'withdrawn' })
              .eq('offer_id', offerId);
          } catch {
            /* ignore */
          }
        }
        break;
      }
      case 'open_request_details': {
        try {
          if (typeof window !== 'undefined')
            window.location.assign('/shipments/requests');
        } catch {
          /* ignore */
        }
        break;
      }
      case 'open_offers': {
        try {
          if (typeof window !== 'undefined')
            window.location.assign('/shipments/incoming-requests');
        } catch {
          /* ignore */
        }
        break;
      }
      case 'open_request_requirements': {
        await supabase.from('chat_events').insert({
          room_id: roomId,
          event_type: 'open_request_requirements',
          actor_id: uid,
          payload: action.payload || {}
        });
        break;
      }
      case 'flag_compliance_risk': {
        await supabase.from('chat_events').insert({
          room_id: roomId,
          event_type: 'compliance_risk_flagged',
          actor_id: uid,
          payload: action.payload || {}
        });
        break;
      }
      case 'open_cost_estimate': {
        await supabase.from('chat_events').insert({
          room_id: roomId,
          event_type: 'open_cost_estimate',
          actor_id: uid,
          payload: action.payload || {}
        });
        break;
      }
      case 'save_for_review': {
        await supabase.from('chat_events').insert({
          room_id: roomId,
          event_type: 'saved_for_review',
          actor_id: uid,
          payload: action.payload || {}
        });
        break;
      }
      case 'pay_invoice': {
        const invoiceId = (action.payload as any)?.invoice_id;
        if (invoiceId)
          await supabase
            .from('invoices')
            .update({ status: 'paid' })
            .eq('id', invoiceId);
        break;
      }
      case 'download_invoice': {
        try {
          if (typeof window !== 'undefined')
            window.location.assign('/shipments/invoices');
        } catch {
          /* ignore */
        }
        break;
      }
      case 'dispute_invoice': {
        const invoiceId = (action.payload as any)?.invoice_id;
        if (invoiceId)
          await supabase
            .from('invoices')
            .update({ status: 'disputed' })
            .eq('id', invoiceId);
        break;
      }
      case 'issue_invoice': {
        const payload = action.payload as any;
        await supabase.from('invoices').insert({
          amount: payload?.amount || null,
          due_date: payload?.due_date || null,
          status: 'issued',
          request_id: payload?.request_id || null
        });
        break;
      }
      case 'update_invoice_info': {
        const invoiceId = (action.payload as any)?.invoice_id;
        const patch: any = {};
        if ((action.payload as any)?.amount)
          patch.amount = (action.payload as any).amount;
        if ((action.payload as any)?.due_date)
          patch.due_date = (action.payload as any).due_date;
        if (invoiceId && Object.keys(patch).length)
          await supabase.from('invoices').update(patch).eq('id', invoiceId);
        break;
      }
      case 'approve_payment': {
        const invoiceId = (action.payload as any)?.invoice_id;
        if (invoiceId)
          await supabase
            .from('invoices')
            .update({ status: 'approved' })
            .eq('id', invoiceId);
        break;
      }
      case 'complete_task': {
        const taskId = (action.payload as any)?.task_id;
        if (taskId)
          await supabase
            .from('tasks')
            .update({ status: 'done' })
            .eq('id', taskId);
        break;
      }
      case 'create_task': {
        const p = action.payload as any;
        await supabase.from('tasks').insert({
          title: p?.title || 'Task',
          assigned_to: p?.assigned_to || null,
          status: 'open',
          deadline: p?.deadline || null
        });
        break;
      }
      case 'reassign_task': {
        const taskId = (action.payload as any)?.task_id;
        const to = (action.payload as any)?.assigned_to;
        if (taskId && to)
          await supabase
            .from('tasks')
            .update({ assigned_to: to })
            .eq('id', taskId);
        break;
      }
      case 'accept_task': {
        const taskId = (action.payload as any)?.task_id;
        if (taskId)
          await supabase
            .from('tasks')
            .update({ status: 'accepted' })
            .eq('id', taskId);
        break;
      }
      case 'upload_task_document': {
        await supabase.from('chat_events').insert({
          room_id: roomId,
          event_type: 'task_document_uploaded',
          actor_id: uid,
          payload: action.payload || {}
        });
        break;
      }
      case 'approve_expense_task': {
        const taskId = (action.payload as any)?.task_id;
        if (taskId)
          await supabase
            .from('tasks')
            .update({ status: 'expense_approved' })
            .eq('id', taskId);
        break;
      }
      case 'review_cost_impact': {
        try {
          if (typeof window !== 'undefined')
            window.location.assign('/dashboard');
        } catch {
          /* ignore */
        }
        break;
      }
      case 'approve_item': {
        const approvalId = (action.payload as any)?.approval_id;
        if (approvalId)
          await supabase
            .from('approvals')
            .update({ status: 'approved' })
            .eq('id', approvalId);
        break;
      }
      case 'request_revision': {
        const approvalId = (action.payload as any)?.approval_id;
        if (approvalId)
          await supabase
            .from('approvals')
            .update({ status: 'changes_requested' })
            .eq('id', approvalId);
        break;
      }
      case 'request_approval': {
        const p = action.payload as any;
        await supabase
          .from('approvals')
          .insert({ subject: p?.subject || 'Approval', status: 'pending' });
        break;
      }
      case 'open_approvals': {
        try {
          if (typeof window !== 'undefined')
            window.location.assign('/dashboard');
        } catch {
          /* ignore */
        }
        break;
      }
      case 'approve_cost_update': {
        const approvalId = (action.payload as any)?.approval_id;
        if (approvalId)
          await supabase
            .from('approvals')
            .update({ status: 'approved' })
            .eq('id', approvalId);
        break;
      }
      case 'reject_cost_update': {
        const approvalId = (action.payload as any)?.approval_id;
        if (approvalId)
          await supabase
            .from('approvals')
            .update({ status: 'rejected' })
            .eq('id', approvalId);
        break;
      }
      case 'approve_compliance_docs': {
        const approvalId = (action.payload as any)?.approval_id;
        if (approvalId)
          await supabase
            .from('approvals')
            .update({ status: 'approved' })
            .eq('id', approvalId);
        break;
      }
      case 'download_receipt': {
        try {
          if (typeof window !== 'undefined')
            window.location.assign('/shipments/invoices');
        } catch {
          /* ignore */
        }
        break;
      }
      case 'verify_payment': {
        await supabase.from('chat_events').insert({
          room_id: roomId,
          event_type: 'payment_verified',
          actor_id: uid,
          payload: action.payload || {}
        });
        break;
      }
      case 'send_payment_reminder': {
        await supabase.from('chat_events').insert({
          room_id: roomId,
          event_type: 'payment_reminder_sent',
          actor_id: uid,
          payload: action.payload || {}
        });
        break;
      }
      case 'reconcile_payment': {
        const invoiceId = (action.payload as any)?.invoice_id;
        if (invoiceId)
          await supabase
            .from('invoices')
            .update({ status: 'reconciled' })
            .eq('id', invoiceId);
        break;
      }
      case 'approve_refund': {
        const invoiceId = (action.payload as any)?.invoice_id;
        if (invoiceId)
          await supabase
            .from('invoices')
            .update({ status: 'refund_approved' })
            .eq('id', invoiceId);
        break;
      }
      case 'link_customs_file': {
        await supabase.from('chat_events').insert({
          room_id: roomId,
          event_type: 'link_customs_file',
          actor_id: uid,
          payload: action.payload || {}
        });
        break;
      }
      case 'link_clearance_task': {
        await supabase.from('chat_events').insert({
          room_id: roomId,
          event_type: 'link_clearance_task',
          actor_id: uid,
          payload: action.payload || {}
        });
        break;
      }
      case 'reply_note': {
        await supabase.from('chat_events').insert({
          room_id: roomId,
          event_type: 'note_replied',
          actor_id: uid,
          payload: action.payload || {}
        });
        break;
      }
      case 'pin_note': {
        await supabase.from('chat_events').insert({
          room_id: roomId,
          event_type: 'note_pinned',
          actor_id: uid,
          payload: action.payload || {}
        });
        break;
      }
      case 'share_note': {
        await supabase.from('chat_events').insert({
          room_id: roomId,
          event_type: 'note_shared',
          actor_id: uid,
          payload: action.payload || {}
        });
        break;
      }
      case 'attach_compliance_file': {
        await supabase.from('chat_events').insert({
          room_id: roomId,
          event_type: 'compliance_file_attached',
          actor_id: uid,
          payload: action.payload || {}
        });
        break;
      }
      case 'add_customs_note': {
        await supabase.from('chat_events').insert({
          room_id: roomId,
          event_type: 'customs_note_added',
          actor_id: uid,
          payload: action.payload || {}
        });
        break;
      }
      default:
        break;
    }

    // Notifications for task assignment
    if (card.type === 'task_card' && (card as any).assigned_to) {
      const assigneeId = (card as any).assigned_to as string;
      if (assigneeId && assigneeId !== uid) {
        await supabase.from('notifications').insert({
          user_id: assigneeId,
          actor_id: uid,
          type: 'task_assigned',
          title: 'New task assigned to you',
          body: (card as any).title || 'Task',
          category: 'tasks',
          data: { task_id: (card as any).id }
        });
      }
    }
  } catch {
    /* ignore */
  }
}

// Remove appended Mentions block (if present) to avoid rendering raw IDs
function stripMentions(content: string): string {
  const m = content.match(/([\s\S]*?)\n\nMentions:\s*\n[\s\S]*$/);
  if (m) return (m[1] || '').trimEnd();
  return content;
}

export function extractMeta(content: string): {
  replyTo: string | null;
  edited: boolean;
  body: string;
} {
  let c = content;
  let replyTo: string | null = null;
  let edited = false;
  const m1 = c.match(/^(?:\s*)ReplyTo:([0-9a-fA-F-]{36})\s*\n([\s\S]*)$/);
  if (m1) {
    replyTo = m1[1];
    c = m1[2];
  }
  const m2 = c.match(/^(?:\s*)Edited:1\s*\n([\s\S]*)$/);
  if (m2) {
    edited = true;
    c = m2[1];
  }
  return { replyTo, edited, body: c };
}

function inferAttachmentMeta(
  name: string,
  url?: string
): { type: string; provider?: 'drive' | 'generic' } {
  const lowerName = name.toLowerCase();
  const lowerUrl = (url || '').toLowerCase();
  // Provider
  if (
    lowerUrl.includes('drive.google.com') ||
    lowerUrl.includes('docs.google.com')
  ) {
    return { type: inferTypeFromExt(lowerName, lowerUrl), provider: 'drive' };
  }
  return { type: inferTypeFromExt(lowerName, lowerUrl), provider: 'generic' };
}

function inferTypeFromExt(name: string, url?: string): string {
  const src = url || name;
  const q = src.split('?')[0];
  const ext = (q.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext))
    return 'image';
  if (['mp4', 'mov', 'webm', 'mkv'].includes(ext)) return 'video';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
  if (['doc', 'docx'].includes(ext)) return 'doc';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'sheet';
  if (['ppt', 'pptx'].includes(ext)) return 'slides';
  return ext || 'file';
}

// Mentions helpers
function extractMentionMap(content: string): Record<string, string> {
  const m = content.match(/\n\nMentions:\s*\n([\s\S]*)$/);
  if (!m) return {};
  const lines = (m[1] || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- '));
  const map: Record<string, string> = {};
  for (const line of lines) {
    const payload = line.replace(/^-\s+/, '');
    const [id, label] = payload.split('|');
    if (id && label) map[label] = id;
  }
  return map;
}

function linkifyMentions(
  text: string,
  mentionMap: Record<string, string>
): string {
  if (!text) return text;
  // Replace @label with markdown link to special scheme including id
  return text.replace(/(^|\W)@([A-Za-z0-9._-]{2,32})\b/g, (m, pre, label) => {
    const id = mentionMap[label];
    if (!id) return m;
    return `${pre}[@${label}](mention://${id}|${label})`;
  });
}

function MentionHover({ id, label }: { id: string; label: string }) {
  const [avatar, setAvatar] = useState<string | undefined>(undefined);
  const [name, setName] = useState<string>(label);
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('display_name,username,avatar_url,role')
          .eq('id', id)
          .single();
        if (!alive) return;
        const n = ((data?.display_name as string | null) ||
          (data?.username as string | null) ||
          label) as string;
        setName(n);
        setAvatar((data?.avatar_url as string | null) || undefined);
        setRole((data?.role as string | null) || null);
      } catch {
        void 0;
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, [id, label]);
  return (
    <HoverCard openDelay={80} closeDelay={60}>
      <HoverCardTrigger asChild>
        <a
          href={`#user-${id}`}
          className='text-primary font-medium hover:underline'
        >
          @{label}
        </a>
      </HoverCardTrigger>
      <HoverCardContent
        align='start'
        sideOffset={8}
        side='bottom'
        className='w-72 overflow-hidden p-0'
      >
        <div className='bg-muted h-16' />
        <div className='-mt-6 px-3 pb-3'>
          <div className='flex items-end gap-3'>
            <span
              className='bg-muted text-muted-foreground border-border inline-flex size-10 items-center justify-center rounded-full border text-lg font-bold'
              title={name}
            >
              {name.slice(0, 2).toUpperCase()}
            </span>
            <div className='min-w-0'>
              <div className='truncate leading-tight font-medium'>{name}</div>
              {role && (
                <div className='text-muted-foreground truncate text-xs leading-tight'>
                  {role}
                </div>
              )}
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
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
