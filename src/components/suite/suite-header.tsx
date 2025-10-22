'use client';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/icons';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger
} from '@/components/ui/hover-card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';

export type SuiteHeaderProps = {
  title: string;
  onTitleChange?: (value: string) => void;
  onTitleSubmit?: (value: string) => void;
  onBackHref?: string;
  rightSlot?: React.ReactNode;
  // Optional Cells-like controls
  showStar?: boolean;
  starred?: boolean;
  onToggleStar?: () => void;
  showImport?: boolean;
  onImport?: (file: File) => void;
  importAccept?: string;
  // App identity and collaboration controls
  app?: 'docs' | 'cells' | 'files';
  appIcon?: React.ReactNode; // custom icon overrides app
  participants?: Array<{
    id: string;
    display_name?: string | null;
    avatar_url?: string | null;
  }>;
  onActivityClick?: () => void; // open timeline
  shareProps?: {
    onSearchContacts?: (query: string) => Promise<
      Array<{
        id: string;
        display_name?: string | null;
        avatar_url?: string | null;
        email?: string | null;
      }>
    >;
    currentShares?: Array<{
      id: string;
      role: 'viewer' | 'editor' | 'owner';
      display_name?: string | null;
      avatar_url?: string | null;
    }>;
    onRoleChange?: (
      id: string,
      role: 'viewer' | 'editor'
    ) => Promise<void> | void;
    onCopyLink?: () => Promise<void> | void;
    onShare?: (selectedIds: string[]) => Promise<void> | void;
    onSendInbox?: (selectedIds: string[]) => Promise<void> | void;
  };
};

export function SuiteHeader({
  title,
  onTitleChange,
  onTitleSubmit,
  onBackHref = '/noblesuite',
  rightSlot,
  showStar = false,
  starred = false,
  onToggleStar,
  showImport = false,
  onImport,
  importAccept = '.html,.txt',
  app,
  appIcon,
  participants,
  onActivityClick,
  shareProps
}: SuiteHeaderProps) {
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const AppIcon = React.useMemo(() => {
    if (appIcon) return () => <>{appIcon}</>;
    if (app === 'docs') return Icons.doc;
    if (app === 'cells') return Icons.sheet;
    if (app === 'files') return Icons.folder;
    return null;
  }, [app, appIcon]);
  const titleMeasureRef = React.useRef<HTMLSpanElement | null>(null);
  const [titleWidth, setTitleWidth] = React.useState<number>(240);

  React.useLayoutEffect(() => {
    if (!titleMeasureRef.current) return;
    const nextWidth = titleMeasureRef.current.offsetWidth + 28;
    setTitleWidth(Math.min(Math.max(nextWidth, 160), 640));
  }, [title]);
  return (
    <div className='bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30 w-full rounded-t-xl border-b backdrop-blur'>
      <div className='flex h-12 items-center gap-2 px-3 sm:h-14 sm:px-4'>
        {/* Left: app icon + title + star */}
        {AppIcon && (
          <div
            className={
              'flex items-center ' +
              (app === 'docs'
                ? 'text-blue-600'
                : app === 'cells'
                  ? 'text-green-600'
                  : 'text-primary')
            }
            style={{ marginRight: 4 }}
          >
            <AppIcon className='size-5 sm:size-6' />
          </div>
        )}
        <div className='flex min-w-0 items-center gap-1'>
          <div className='relative flex items-center'>
            <Input
              value={title}
              onChange={(e) => onTitleChange?.(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter')
                  onTitleSubmit?.((e.target as HTMLInputElement).value);
              }}
              onBlur={(e) => onTitleSubmit?.(e.target.value)}
              className='focus:border-input h-8 w-auto border-transparent px-2 text-base font-semibold focus-visible:ring-0 sm:text-lg'
              style={{ width: titleWidth }}
            />
            <span
              ref={titleMeasureRef}
              aria-hidden='true'
              className='pointer-events-none absolute top-0 left-0 -z-10 text-base font-semibold whitespace-pre opacity-0 sm:text-lg'
            >
              {(title && title.length ? title : 'Untitled doc') + ' '}
            </span>
          </div>
          {showStar && (
            <button
              className={
                'ml-0.5 rounded p-1 ' +
                (starred
                  ? 'text-yellow-500'
                  : 'text-muted-foreground hover:text-foreground')
              }
              title={starred ? 'Unstar' : 'Star'}
              onClick={() => onToggleStar?.()}
            >
              {starred ? (
                <Icons.starFilled className='size-4' />
              ) : (
                <Icons.star className='size-4' />
              )}
            </button>
          )}
        </div>

        {/* Right: CTAs (Share + Log), optional Import, then custom rightSlot */}
        <div className='ml-auto flex items-center gap-1 sm:gap-2'>
          {/* Share button */}
          {shareProps && <SharePopover {...shareProps} />}

          <HoverCard openDelay={100} closeDelay={100}>
            <HoverCardTrigger asChild>
              <Button
                size='icon'
                variant='ghost'
                title='Activity log'
                onClick={onActivityClick}
                aria-label='Activity log'
              >
                <Icons.history className='size-5' />
              </Button>
            </HoverCardTrigger>
            <HoverCardContent align='end' className='w-72'>
              {participants && participants.length > 0 ? (
                <>
                  <div className='mb-2 text-xs font-medium'>Collaborators</div>
                  <div className='mb-2 flex -space-x-2'>
                    {participants.slice(0, 6).map((p) => (
                      <Avatar
                        key={p.id}
                        className='ring-background size-7 rounded-full border ring-2'
                      >
                        {p.avatar_url ? (
                          <AvatarImage
                            src={p.avatar_url}
                            alt={p.display_name || ''}
                          />
                        ) : (
                          <AvatarFallback className='text-[10px]'>
                            {(p.display_name || '?').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        )}
                      </Avatar>
                    ))}
                    {participants.length > 6 && (
                      <div className='text-muted-foreground bg-muted flex size-7 items-center justify-center rounded-full border text-[11px]'>
                        +{participants.length - 6}
                      </div>
                    )}
                  </div>
                  <div className='text-muted-foreground text-xs'>
                    Click the history icon to open the activity timeline.
                  </div>
                </>
              ) : (
                <div className='text-muted-foreground text-xs'>
                  No collaborators yet. Invite teammates from Share.
                </div>
              )}
            </HoverCardContent>
          </HoverCard>
          {showImport && (
            <>
              <input
                ref={fileInputRef}
                type='file'
                className='hidden'
                accept={importAccept}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && onImport) onImport(f);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              />
              {/* Import button intentionally removed from UI */}
            </>
          )}
          {rightSlot}
        </div>
      </div>
    </div>
  );
}

export default SuiteHeader;

// --- Internal components ---
type SharePopoverProps = NonNullable<SuiteHeaderProps['shareProps']>;

function SharePopover({
  onSearchContacts,
  currentShares = [],
  onRoleChange,
  onCopyLink,
  onShare,
  onSendInbox
}: SharePopoverProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  type Contact = {
    id: string;
    username?: string | null;
    email?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
  };
  const [results, setResults] = React.useState<Contact[]>([]);
  const [selected, setSelected] = React.useState<Contact[]>([]);

  React.useEffect(() => {
    let active = true;
    async function run() {
      const q = query.trim();
      if (!q) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        if (onSearchContacts) {
          const res = await onSearchContacts(q);
          if (active) setResults((res || []) as any);
        } else {
          const like = `%${q}%`;
          const { data } = await supabase
            .from('profiles')
            .select('id,username,email,avatar_url')
            .or(`email.ilike.${like},username.ilike.${like}`)
            .order('username', { ascending: true })
            .limit(10);
          if (active) setResults((data || []) as any);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void run();
    return () => {
      active = false;
    };
  }, [query, onSearchContacts]);

  async function handleCopy() {
    try {
      if (onCopyLink) await onCopyLink();
      else if (typeof window !== 'undefined')
        await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied');
    } catch {
      toast.error('Copy failed');
    }
  }

  async function handleShare() {
    const ids = selected.map((s) => s.id);
    try {
      await onShare?.(ids);
      toast.success('Shared');
      setSelected([]);
      setQuery('');
      setResults([]);
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message || 'Share failed');
    }
  }

  async function handleSendInbox() {
    const ids = selected.map((s) => s.id);
    try {
      await onSendInbox?.(ids);
      toast.success('Sent to inbox');
      setSelected([]);
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message || 'Send failed');
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size='sm' variant='outline' className='gap-2'>
          <Icons.share className='size-4' /> Share
        </Button>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-[420px]'>
        <div className='space-y-3'>
          {/* Recipients chips + input */}
          <div>
            <div className='mb-1 text-xs font-semibold'>Invite people</div>
            <div className='flex min-h-10 flex-wrap items-center gap-1 rounded border px-2 py-1'>
              {selected.map((r) => (
                <Chip
                  key={r.id}
                  text={r.username || r.email || r.id}
                  avatarUrl={r.avatar_url || undefined}
                  onRemove={() =>
                    setSelected((prev) => prev.filter((x) => x.id !== r.id))
                  }
                />
              ))}
              <input
                className='min-w-[140px] flex-1 text-sm outline-none'
                placeholder={
                  selected.length ? 'Add more…' : 'Type a name or email'
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {/* Results (Command) */}
            <div className='mt-2'>
              <Command>
                <CommandInput
                  placeholder='Search people…'
                  value={query}
                  onValueChange={setQuery}
                />
                <CommandList>
                  <CommandEmpty>
                    {loading ? 'Searching…' : 'No people found.'}
                  </CommandEmpty>
                  <CommandGroup heading={query ? 'Results' : undefined}>
                    {results.map((o) => (
                      <CommandItem
                        key={o.id}
                        value={o.username || o.email || o.id}
                        onSelect={() => {
                          setSelected((prev) => {
                            if (prev.some((x) => x.id === o.id)) return prev;
                            return [...prev, o];
                          });
                          setQuery('');
                        }}
                      >
                        <div className='flex items-center gap-2'>
                          <Avatar className='size-6'>
                            {o.avatar_url ? (
                              <AvatarImage
                                src={o.avatar_url}
                                alt={o.username || o.email || ''}
                              />
                            ) : (
                              <AvatarFallback>
                                {(o.username || o.email || o.id)
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div>
                            <div className='text-sm'>
                              {o.username || o.email || o.id}
                            </div>
                            {o.email && (
                              <div className='text-muted-foreground text-xs'>
                                {o.email}
                              </div>
                            )}
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>
          </div>

          {currentShares?.length ? (
            <div>
              <div className='mb-1 text-xs font-semibold'>Shared with</div>
              <div className='max-h-40 space-y-2 overflow-auto'>
                {currentShares.map((s) => (
                  <div key={s.id} className='flex items-center gap-2'>
                    <Avatar className='size-6'>
                      {s.avatar_url ? (
                        <AvatarImage src={s.avatar_url} />
                      ) : (
                        <AvatarFallback className='text-[10px]'>
                          {(s.display_name || '?').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className='flex-1 truncate text-sm'>
                      {s.display_name || s.id}
                    </div>
                    <Select
                      defaultValue={s.role}
                      onValueChange={(v) =>
                        onRoleChange?.(s.id, v as 'viewer' | 'editor')
                      }
                      disabled={s.role === 'owner'}
                    >
                      <SelectTrigger size='sm' className='h-7 px-2'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='viewer'>Viewer</SelectItem>
                        <SelectItem value='editor'>Editor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className='flex items-center justify-between'>
            <Button variant='ghost' size='sm' onClick={handleCopy}>
              Copy link
            </Button>
            <div className='flex items-center gap-2'>
              {onSendInbox && (
                <Button
                  size='sm'
                  variant='outline'
                  onClick={handleSendInbox}
                  disabled={selected.length === 0}
                >
                  Send inbox
                </Button>
              )}
              <Button
                size='sm'
                onClick={handleShare}
                disabled={selected.length === 0}
              >
                Share
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Chip({
  text,
  onRemove,
  avatarUrl
}: {
  text: string;
  onRemove: () => void;
  avatarUrl?: string;
}) {
  return (
    <span className='bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs'>
      <Avatar className='size-4'>
        <AvatarImage src={avatarUrl} alt={text} />
        <AvatarFallback>{text.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      {text}
      <button onClick={onRemove} className='opacity-60 hover:opacity-100'>
        ×
      </button>
    </span>
  );
}
