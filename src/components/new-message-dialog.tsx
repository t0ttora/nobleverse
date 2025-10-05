'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
// Input component not used in this dialog
// import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import {
  Paperclip,
  Send,
  X,
  Smile,
  Bold,
  Italic,
  Underline,
  Quote,
  List,
  Code
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import dynamic from 'next/dynamic';
const MarkdownPreview = dynamic(() => import('./markdown-preview'), {
  ssr: false,
  loading: () => <span className='text-muted-foreground'>Loading preview…</span>
});
import EmojiPicker from '@/components/ui/emoji-picker';

type Profile = {
  id: string;
  email: string | null;
  username: string | null;
  avatar_url: string | null;
};

export function NewMessageDialog({
  open,
  onOpenChange,
  onSubmit,
  fromEmail,
  presetRecipients
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (opts: {
    recipientIds: string[];
    text: string;
    files: File[];
  }) => Promise<void>;
  fromEmail: string | null;
  presetRecipients?: Profile[];
}) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<Profile[]>([]);
  const [recipients, setRecipients] = useState<Profile[]>([]);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [recipientsOpen, setRecipientsOpen] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setOptions([]);
      setRecipients([]);
      setText('');
      setFiles([]);
      return;
    }
    // When opening with preset recipients, initialize selection
    if (open && presetRecipients && presetRecipients.length) {
      setRecipients(presetRecipients);
    }
  }, [open, presetRecipients]);

  useEffect(() => {
    let active = true;
    async function run() {
      if (!recipientsOpen) return;
      const q = query.trim();
      const like = q ? `%${q}%` : '%';
      const { data } = await supabase
        .from('profiles')
        .select('id,email,username,avatar_url')
        .or(`email.ilike.${like},username.ilike.${like}`)
        .order('username', { ascending: true })
        .limit(10);
      if (active) setOptions((data ?? []) as Profile[]);
    }
    void run();
    return () => {
      active = false;
    };
  }, [query, recipientsOpen]);

  function toggleRecipient(p: Profile) {
    setRecipients((prev) => {
      const exists = prev.some((x) => x.id === p.id);
      if (exists) return prev.filter((x) => x.id !== p.id);
      return [...prev, p];
    });
    setRecipientsOpen(false);
    setQuery('');
  }

  async function handleSend() {
    if (!recipients.length) return;
    setSending(true);
    try {
      await onSubmit({
        recipientIds: recipients.map((r) => r.id),
        text: text.trim(),
        files
      });
      onOpenChange(false);
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName='z-[130]'
        className='z-[140] overflow-hidden p-0 sm:max-w-[720px]'
      >
        <DialogHeader className='px-6 pt-5'>
          <DialogTitle>New message</DialogTitle>
        </DialogHeader>
        <div className='space-y-3 px-6 pb-4'>
          {/* From */}
          <div className='flex items-center gap-3 text-sm'>
            <div className='text-muted-foreground w-16'>From</div>
            <div className='flex items-center gap-2'>
              <Avatar className='size-6'>
                <AvatarImage src='' alt='me' />
                <AvatarFallback>Me</AvatarFallback>
              </Avatar>
              <div className='font-medium'>{fromEmail ?? 'me'}</div>
            </div>
          </div>
          {/* To */}
          <div className='flex items-start gap-3'>
            <div className='text-muted-foreground w-16 py-2 text-sm'>To</div>
            <div className='flex-1'>
              <Popover open={recipientsOpen} onOpenChange={setRecipientsOpen}>
                <PopoverTrigger asChild>
                  <div
                    className='flex min-h-10 cursor-text flex-wrap items-center gap-1 rounded border px-2 py-1'
                    onClick={() => setRecipientsOpen(true)}
                  >
                    {recipients.map((r) => (
                      <Chip
                        key={r.id}
                        text={r.username || r.email || 'user'}
                        onRemove={() => toggleRecipient(r)}
                        avatarUrl={r.avatar_url || undefined}
                      />
                    ))}
                    <input
                      className='min-w-[120px] flex-1 text-sm outline-none'
                      placeholder={
                        recipients.length ? 'Add more…' : 'Type a name or email'
                      }
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                </PopoverTrigger>
                <PopoverContent className='w-[480px] p-0' align='start'>
                  <Command>
                    <CommandInput
                      placeholder='Search people…'
                      value={query}
                      onValueChange={setQuery}
                    />
                    <CommandList>
                      <CommandEmpty>No people found.</CommandEmpty>
                      <CommandGroup>
                        {options.map((o) => (
                          <CommandItem
                            key={o.id}
                            value={o.username || o.email || o.id}
                            onSelect={() => toggleRecipient(o)}
                          >
                            <div className='flex items-center gap-2'>
                              <Avatar className='size-6'>
                                <AvatarImage
                                  src={o.avatar_url ?? undefined}
                                  alt={o.username ?? o.email ?? ''}
                                />
                                <AvatarFallback>
                                  {(o.username || o.email || '')
                                    .slice(0, 2)
                                    .toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className='text-sm'>
                                  {o.username || o.email}
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
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Body toolbar */}
          <div className='text-muted-foreground flex items-center gap-2'>
            <Button variant='outline' size='sm' className='h-7 px-2'>
              Body 1
            </Button>
            <div className='flex items-center gap-1'>
              <ToolbarBtn
                icon={<Bold className='size-4' />}
                onClick={() => surroundSelection('**', '**')}
              />
              <ToolbarBtn
                icon={<Italic className='size-4' />}
                onClick={() => surroundSelection('*', '*')}
              />
              <ToolbarBtn
                icon={<Underline className='size-4' />}
                onClick={() => surroundSelection('<u>', '</u>')}
              />
              <ToolbarBtn
                icon={<Quote className='size-4' />}
                onClick={() => prependLine('> ')}
              />
              <ToolbarBtn
                icon={<List className='size-4' />}
                onClick={() => prependLine('- ')}
              />
              <ToolbarBtn
                icon={<Code className='size-4' />}
                onClick={() => surroundSelection('`', '`')}
              />
            </div>
          </div>

          {/* Body (Write / Preview) */}
          <Tabs defaultValue='write' className='w-full'>
            <TabsList>
              <TabsTrigger value='write'>Write</TabsTrigger>
              <TabsTrigger value='preview'>Preview</TabsTrigger>
            </TabsList>
            <TabsContent value='write'>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder='Write your message…'
                className='min-h-[160px]'
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
              />
            </TabsContent>
            <TabsContent value='preview'>
              <div className='min-h-[160px] rounded-md border p-3 text-sm'>
                <MarkdownPreview text={text} />
              </div>
            </TabsContent>
          </Tabs>

          {/* Attachments */}
          <div className='flex items-center gap-2'>
            <input
              ref={fileRef}
              type='file'
              multiple
              hidden
              onChange={(e) =>
                setFiles(e.target.files ? Array.from(e.target.files) : [])
              }
            />
            <Button
              variant='ghost'
              size='icon'
              onClick={() => fileRef.current?.click()}
            >
              <Paperclip className='size-4' />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant='ghost' size='icon' aria-label='Emoji picker'>
                  <Smile className='size-4' />
                </Button>
              </PopoverTrigger>
              <PopoverContent className='p-0' align='start'>
                <div className='w-[320px]'>
                  <EmojiPicker
                    onPick={(symbol: string) => {
                      const ta = document.querySelector(
                        'textarea'
                      ) as HTMLTextAreaElement | null;
                      if (!ta) {
                        setText((v) => v + symbol);
                        return;
                      }
                      const start = ta.selectionStart ?? 0;
                      const end = ta.selectionEnd ?? 0;
                      const next =
                        text.slice(0, start) + symbol + text.slice(end);
                      setText(next);
                      requestAnimationFrame(() => {
                        ta.focus();
                        const pos = start + symbol.length;
                        ta.setSelectionRange(pos, pos);
                      });
                    }}
                  />
                </div>
              </PopoverContent>
            </Popover>
            <div className='flex flex-1 gap-2 overflow-x-auto'>
              {files.map((f, i) => (
                <div
                  key={i}
                  className='flex items-center gap-2 rounded border px-2 py-1 text-xs'
                >
                  <div className='w-36 truncate'>{f.name}</div>
                  <button
                    onClick={() =>
                      setFiles(files.filter((_, idx) => idx !== i))
                    }
                    className='opacity-60 hover:opacity-100'
                  >
                    <X className='size-3' />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className='flex items-center justify-between pt-2'>
            <div className='flex items-center gap-2'>
              <Button variant='outline' size='sm'>
                Remind me
              </Button>
              <Button variant='outline' size='sm'>
                Send later
              </Button>
            </div>
            <Button
              onClick={handleSend}
              disabled={sending || recipients.length === 0}
              title='Ctrl+Enter to send'
            >
              <Send className='mr-2 size-4' /> Send
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  function surroundSelection(prefix: string, suffix: string) {
    const ta = document.querySelector('textarea');
    if (!ta) return;
    const start = (ta as HTMLTextAreaElement).selectionStart || 0;
    const end = (ta as HTMLTextAreaElement).selectionEnd || 0;
    const before = text.slice(0, start);
    const selected = text.slice(start, end);
    const after = text.slice(end);
    const next = `${before}${prefix}${selected || 'text'}${suffix}${after}`;
    setText(next);
  }
  function prependLine(prefix: string) {
    const ta = document.querySelector('textarea');
    if (!ta) return;
    const pos = (ta as HTMLTextAreaElement).selectionStart || 0;
    const before = text.slice(0, pos);
    const lineStart = before.lastIndexOf('\n') + 1;
    const next = `${text.slice(0, lineStart)}${prefix}${text.slice(lineStart)}`;
    setText(next);
  }
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
        <X className='size-3' />
      </button>
    </span>
  );
}

function ToolbarBtn({
  icon,
  onClick
}: {
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      className='hover:bg-accent text-muted-foreground hover:text-foreground rounded p-1.5'
    >
      {icon}
    </button>
  );
}
