'use client';
import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandEmpty,
  CommandInput
} from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabaseClient';

export type QuickShareDialogProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  targetIds: string[]; // recipients to share with
};

type FileRow = {
  id: string;
  name: string;
  type: string;
  updated_at: string;
  owner_id?: string | null;
};

export function QuickShareDialog({
  open,
  onOpenChange,
  targetIds
}: QuickShareDialogProps) {
  const [files, setFiles] = React.useState<FileRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [selectedFiles, setSelectedFiles] = React.useState<Set<string>>(
    new Set()
  );
  const [selectedDocs, setSelectedDocs] = React.useState<Set<string>>(
    new Set()
  );
  const [busy, setBusy] = React.useState(false);
  const [tab, setTab] = React.useState<'recent' | 'search' | 'docs'>(() => {
    if (typeof window === 'undefined') return 'recent';
    const saved = window.localStorage.getItem('nv.quickShare.lastTab');
    return saved === 'recent' || saved === 'search' || saved === 'docs'
      ? (saved as any)
      : 'recent';
  });
  const [searchResults, setSearchResults] = React.useState<FileRow[]>([]);
  const [searchLoading, setSearchLoading] = React.useState(false);
  // Docs tab state (dedicated source)
  const [docs, setDocs] = React.useState<
    Array<{ id: string; title: string; updated_at: string }>
  >([]);
  const [docsLoading, setDocsLoading] = React.useState(false);
  const [docsQuery, setDocsQuery] = React.useState('');
  const [meId, setMeId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/noblesuite/files/recent?limit=24', {
          cache: 'no-store'
        });
        const json = await res.json();
        if (!cancelled) setFiles((json?.items || []) as FileRow[]);
      } catch {
        if (!cancelled) setFiles([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Persist last-selected tab
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('nv.quickShare.lastTab', tab);
    } catch {}
  }, [tab]);

  // Load current user id once for sharing docs via chat
  React.useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      setMeId(data?.user?.id ?? null);
    })();
    return () => {
      active = false;
    };
  }, []);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => (f.name || '').toLowerCase().includes(q));
  }, [files, query]);

  // Dedicated Docs loader: query nv_docs with optional title filter
  React.useEffect(() => {
    if (!open || tab !== 'docs') return;
    let active = true;
    (async () => {
      try {
        setDocsLoading(true);
        let q = supabase
          .from('nv_docs')
          .select('id,title,updated_at')
          .order('updated_at', { ascending: false })
          .limit(50);
        const dq = docsQuery.trim();
        if (dq.length > 1) {
          q = q.ilike('title', `%${dq}%`);
        }
        const { data, error } = await q;
        if (error) throw error;
        if (active) setDocs((data || []) as any);
      } catch (e) {
        if (active) setDocs([]);
      } finally {
        if (active) setDocsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [open, tab, docsQuery]);

  React.useEffect(() => {
    if (tab !== 'search') return;
    const q = query.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    let active = true;
    (async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(
          `/api/noblesuite/files?search=${encodeURIComponent(q)}`,
          { cache: 'no-store' }
        );
        const json = await res.json();
        if (active) setSearchResults((json?.items || []) as FileRow[]);
      } catch {
        if (active) setSearchResults([]);
      } finally {
        if (active) setSearchLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [tab, query]);

  async function handleSendInbox() {
    const fileIds = Array.from(selectedFiles);
    const docIds = Array.from(selectedDocs);
    if (fileIds.length === 0 && docIds.length === 0) return;
    setBusy(true);
    try {
      // 1) Share files via API
      if (fileIds.length > 0) {
        const res = await fetch('/api/noblesuite/files/share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileIds, recipientIds: targetIds })
        });
        const json = await res.json();
        if (!json?.ok) throw new Error(json?.error || 'Share failed');
      }
      // 2) Share docs by posting a message with links to DM or group
      if (docIds.length > 0) {
        if (!meId) throw new Error('Please sign in');
        // Build content
        const picked = docs.filter((d) => docIds.includes(d.id));
        const lines = picked.map(
          (d) =>
            `• ${d.title || 'Untitled'} — ${typeof window !== 'undefined' ? `${window.location.origin}/nobledocs/${d.id}` : `/nobledocs/${d.id}`}`
        );
        const content = [`Shared documents:`, '', ...lines].join('\n');
        if (targetIds.length === 1) {
          const { data, error } = await supabase.rpc('get_or_create_dm_room', {
            p_user1: meId,
            p_user2: targetIds[0]
          });
          if (error || !data)
            throw new Error(error?.message || 'Could not send');
          const rid = data as string;
          const ins = await supabase
            .from('chat_messages')
            .insert({ room_id: rid, sender_id: meId, content });
          if (ins.error) throw new Error(ins.error.message);
        } else if (targetIds.length > 1) {
          const all = Array.from(new Set([meId, ...targetIds]));
          const { data: rid, error } = await supabase.rpc('create_group_room', {
            p_title: null,
            p_member_ids: all
          });
          if (error || !rid)
            throw new Error(error?.message || 'Could not create group');
          const ins = await supabase
            .from('chat_messages')
            .insert({ room_id: rid as string, sender_id: meId, content });
          if (ins.error) throw new Error(ins.error.message);
        }
      }
      toast.success('Sent to Inbox');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Share failed');
    } finally {
      setBusy(false);
    }
  }

  // Generate signed links for files and direct links for docs, then copy
  async function handleShareLinks() {
    const fileIds = Array.from(selectedFiles);
    const docIds = Array.from(selectedDocs);
    if (fileIds.length === 0 && docIds.length === 0) return;
    setBusy(true);
    try {
      const BUCKET = process.env.NEXT_PUBLIC_FILES_BUCKET || 'files';
      const links: string[] = [];
      for (const id of fileIds) {
        try {
          const res = await fetch(`/api/noblesuite/files/${id}`);
          const json = await res.json();
          const storagePath = json?.item?.storage_path || json?.storage_path;
          const name = json?.item?.name || json?.name || 'File';
          if (storagePath) {
            try {
              const { data, error } = await (supabase as any).storage
                .from(BUCKET)
                .createSignedUrl(storagePath, 24 * 60 * 60);
              if (!error && data?.signedUrl) {
                links.push(`${name}: ${data.signedUrl}`);
              } else {
                const pub = (supabase as any).storage
                  .from(BUCKET)
                  .getPublicUrl(storagePath);
                const url = pub?.data?.publicUrl;
                if (url) links.push(`${name}: ${url}`);
              }
            } catch {
              const pub = (supabase as any).storage
                .from(BUCKET)
                .getPublicUrl(storagePath);
              const url = pub?.data?.publicUrl;
              if (url) links.push(`${name}: ${url}`);
            }
          }
        } catch {}
      }
      for (const id of docIds) {
        const doc = docs.find((d) => d.id === id);
        const title = doc?.title || 'Document';
        const url =
          typeof window !== 'undefined'
            ? `${window.location.origin}/nobledocs/${id}`
            : `/nobledocs/${id}`;
        links.push(`${title}: ${url}`);
      }
      if (links.length) {
        try {
          await navigator.clipboard.writeText(links.join('\n'));
          toast.success('Share links copied to clipboard');
        } catch {
          toast.error('Could not copy links');
        }
        onOpenChange(false);
      } else {
        toast('No links available');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[720px]'>
        <DialogHeader>
          <DialogTitle>Share a document</DialogTitle>
          <DialogDescription>
            Select one or more recent files to share.
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-3'>
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList>
              <TabsTrigger value='recent'>Recent</TabsTrigger>
              <TabsTrigger value='search'>Search</TabsTrigger>
              <TabsTrigger value='docs'>Docs</TabsTrigger>
            </TabsList>
            <TabsContent value='recent'>
              <Input
                placeholder='Filter…'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className='h-9'
              />
              <div className='mt-2 rounded border'>
                <ScrollArea className='h-[280px]'>
                  <Command shouldFilter={false}>
                    <CommandList>
                      <CommandEmpty>
                        {loading ? 'Loading…' : 'No files found.'}
                      </CommandEmpty>
                      <CommandGroup heading='Recent'>
                        {filtered.map((f) => (
                          <CommandItem
                            key={f.id}
                            value={f.name}
                            onSelect={() =>
                              setSelectedFiles((prev) => {
                                const n = new Set(prev);
                                n.has(f.id) ? n.delete(f.id) : n.add(f.id);
                                return n;
                              })
                            }
                          >
                            <Row f={f} checked={selectedFiles.has(f.id)} />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </ScrollArea>
              </div>
            </TabsContent>
            <TabsContent value='search'>
              <Input
                placeholder='Search across folders…'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className='h-9'
              />
              <div className='mt-2 rounded border'>
                <ScrollArea className='h-[280px]'>
                  <Command shouldFilter={false}>
                    <CommandList>
                      <CommandEmpty>
                        {searchLoading ? 'Searching…' : 'No results.'}
                      </CommandEmpty>
                      <CommandGroup
                        heading={
                          query.trim()
                            ? `Results for "${query.trim()}"`
                            : 'Results'
                        }
                      >
                        {(searchResults || []).map((f) => (
                          <CommandItem
                            key={f.id}
                            value={f.name}
                            onSelect={() =>
                              setSelectedFiles((prev) => {
                                const n = new Set(prev);
                                n.has(f.id) ? n.delete(f.id) : n.add(f.id);
                                return n;
                              })
                            }
                          >
                            <Row f={f} checked={selectedFiles.has(f.id)} />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </ScrollArea>
              </div>
            </TabsContent>
            <TabsContent value='docs'>
              <Input
                placeholder='Search documents…'
                value={docsQuery}
                onChange={(e) => setDocsQuery(e.target.value)}
                className='h-9'
              />
              <div className='mt-2 rounded border'>
                <ScrollArea className='h-[280px]'>
                  <Command shouldFilter={false}>
                    <CommandList>
                      <CommandEmpty>
                        {docsLoading ? 'Loading…' : 'No docs found.'}
                      </CommandEmpty>
                      <CommandGroup heading='Docs'>
                        {docs.map((d) => (
                          <CommandItem
                            key={d.id}
                            value={d.title}
                            onSelect={() =>
                              setSelectedDocs((prev) => {
                                const n = new Set(prev);
                                n.has(d.id) ? n.delete(d.id) : n.add(d.id);
                                return n;
                              })
                            }
                          >
                            <DocRow d={d} checked={selectedDocs.has(d.id)} />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </ScrollArea>
              </div>
            </TabsContent>
          </Tabs>
          <div className='flex items-center justify-end gap-2'>
            <Button variant='ghost' onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant='outline'
              disabled={
                busy || (selectedFiles.size === 0 && selectedDocs.size === 0)
              }
              onClick={handleSendInbox}
            >
              Send to Inbox
            </Button>
            <Button
              disabled={
                busy || (selectedFiles.size === 0 && selectedDocs.size === 0)
              }
              onClick={handleShareLinks}
            >
              Share link
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ f, checked }: { f: FileRow; checked: boolean }) {
  const ext = (f.name || '').split('.').pop()?.toLowerCase();
  const isImage =
    !!ext && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
  const previewUrl = isImage
    ? `/api/noblesuite/files/preview?id=${encodeURIComponent(f.id)}`
    : null;
  return (
    <div className='flex w-full items-center gap-2'>
      {previewUrl ? (
        <div className='flex size-8 items-center justify-center overflow-hidden rounded border'>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={f.name}
            className='h-full w-full object-cover'
          />
        </div>
      ) : (
        <div className='bg-muted flex size-8 items-center justify-center rounded'>
          <span className='text-xs uppercase'>
            {(f.name?.split('.')?.pop() || '').slice(0, 4)}
          </span>
        </div>
      )}
      <div className='min-w-0 flex-1'>
        <div className='truncate text-sm'>{f.name}</div>
        <div className='text-muted-foreground text-[11px]'>
          {new Date(f.updated_at).toLocaleString()}
        </div>
      </div>
      <input type='checkbox' checked={checked} readOnly />
    </div>
  );
}

function DocRow({
  d,
  checked
}: {
  d: { id: string; title: string; updated_at: string };
  checked: boolean;
}) {
  return (
    <div className='flex w-full items-center gap-2'>
      <div className='bg-primary/10 text-primary flex size-8 items-center justify-center rounded text-[10px] font-semibold'>
        DOC
      </div>
      <div className='min-w-0 flex-1'>
        <div className='truncate text-sm'>{d.title || 'Untitled'}</div>
        <div className='text-muted-foreground text-[11px]'>
          {new Date(d.updated_at).toLocaleString()}
        </div>
      </div>
      <input type='checkbox' checked={checked} readOnly />
    </div>
  );
}
