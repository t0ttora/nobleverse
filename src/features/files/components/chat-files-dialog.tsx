'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Folder,
  FileText,
  File as FileIcon,
  Loader2,
  ChevronRight,
  CornerUpLeft,
  ExternalLink,
  Info,
  XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type SuiteFileItem = {
  id: string;
  parent_id: string | null;
  name: string;
  type: string;
  mime_type?: string | null;
  ext?: string | null;
  size_bytes?: number | null;
  storage_path?: string | null;
  updated_at?: string | null;
  owner_id?: string | null;
  visibility?: string | null;
};

export type SuiteFilesSelectionPayload = {
  items: SuiteFileItem[];
  breadcrumb: { id: string | null; name: string }[];
};

type BreadcrumbEntry = { id: string | null; name: string };

const ROOT_CRUMB: BreadcrumbEntry[] = [{ id: null, name: 'Home' }];

function formatBytes(size?: number | null) {
  if (!size || size <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let idx = 0;
  let value = size;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value.toFixed(value >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function formatDate(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(d);
}

function iconFor(item: SuiteFileItem) {
  if (item.type === 'folder')
    return <Folder className='size-5 text-blue-500' />;
  const ext = (item.ext || item.name.split('.').pop() || '').toLowerCase();
  if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext))
    return <FileText className='size-5 text-purple-500' />;
  return <FileIcon className='text-muted-foreground size-5' />;
}

export function ChatFilesDialog({
  open,
  onOpenChange,
  onShare
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onShare: (payload: SuiteFilesSelectionPayload) => void;
}) {
  const [recent, setRecent] = useState<SuiteFileItem[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [items, setItems] = useState<SuiteFileItem[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbEntry[]>(ROOT_CRUMB);
  const [selected, setSelected] = useState<Record<string, SuiteFileItem>>({});
  const [focusedId, setFocusedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSelected({});
      setFocusedId(null);
      return;
    }
    setBreadcrumb(ROOT_CRUMB);
    setFocusedId(null);
    void fetchRecent();
    void fetchList(null);
  }, [open]);

  async function fetchRecent() {
    setRecentLoading(true);
    try {
      const res = await fetch('/api/noblesuite/files/recent?limit=8', {
        cache: 'no-store'
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || 'RECENT_FAILED');
      setRecent(json.items as SuiteFileItem[]);
    } catch (e: any) {
      toast.error('Could not load recent files', {
        description: e?.message || undefined
      });
      setRecent([]);
    } finally {
      setRecentLoading(false);
    }
  }

  async function fetchList(parentId: string | null) {
    setListLoading(true);
    try {
      const params = new URLSearchParams();
      if (parentId) params.set('parentId', parentId);
      params.set('limit', '100');
      const res = await fetch(`/api/noblesuite/files?${params.toString()}`, {
        cache: 'no-store'
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || 'FILES_FAILED');
      setItems(json.items as SuiteFileItem[]);
    } catch (e: any) {
      toast.error('Could not load files', {
        description: e?.message || undefined
      });
      setItems([]);
    } finally {
      setListLoading(false);
    }
  }

  const selectedItems = useMemo(() => Object.values(selected), [selected]);

  const selectionCount = selectedItems.length;
  const atRoot = breadcrumb.length === 1;
  const rootFolders = useMemo(
    () => (atRoot ? items.filter((item) => item.type === 'folder') : []),
    [atRoot, items]
  );
  const focusedItem = useMemo(() => {
    if (!selectionCount) return null;
    if (focusedId && selected[focusedId]) return selected[focusedId];
    return selectedItems[0];
  }, [focusedId, selected, selectedItems, selectionCount]);
  const otherSelected = useMemo(() => {
    if (!focusedItem) return [] as SuiteFileItem[];
    return selectedItems.filter((it) => it.id !== focusedItem.id);
  }, [focusedItem, selectedItems]);

  function toggle(item: SuiteFileItem) {
    const alreadySelected = Boolean(selected[item.id]);
    const nextSelection = alreadySelected
      ? selectedItems.filter((it) => it.id !== item.id)
      : [...selectedItems, item];
    const nextMap = { ...selected };
    if (alreadySelected) delete nextMap[item.id];
    else nextMap[item.id] = item;
    setSelected(nextMap);
    setFocusedId(alreadySelected ? (nextSelection[0]?.id ?? null) : item.id);
  }

  function enterFolder(item: SuiteFileItem) {
    if (item.type !== 'folder') return;
    setBreadcrumb((prev) => [...prev, { id: item.id, name: item.name }]);
    setSelected({});
    setFocusedId(null);
    void fetchList(item.id);
  }

  function goToBreadcrumb(index: number) {
    setBreadcrumb((prev) => {
      const target = prev[index];
      const next = prev.slice(0, index + 1);
      setSelected({});
      setFocusedId(null);
      void fetchList(target.id);
      return next;
    });
  }

  function handleShare() {
    if (selectedItems.length === 0) return;
    onShare({ items: selectedItems, breadcrumb });
    setSelected({});
    setFocusedId(null);
    onOpenChange(false);
  }

  function handleOpenInSuite(item: SuiteFileItem) {
    if (typeof window === 'undefined') return;
    const target =
      item.type === 'folder'
        ? `/noblefiles?folder=${item.id}`
        : item.parent_id
          ? `/noblefiles?folder=${item.parent_id}`
          : '/noblefiles';
    window.open(target, '_blank', 'noopener,noreferrer');
  }

  const currentPathLabel = useMemo(
    () => breadcrumb.map((crumb) => crumb.name).join(' / '),
    [breadcrumb]
  );

  const PreviewPanel = () => (
    <div className='px-6 py-5'>
      {focusedItem ? (
        <div className='space-y-4'>
          <div className='space-y-2'>
            <div className='flex flex-wrap items-center gap-2'>
              <Badge variant='outline' className='tracking-wide uppercase'>
                {focusedItem.type === 'folder' ? 'Folder' : 'File'}
              </Badge>
              <span className='text-muted-foreground text-xs'>
                {currentPathLabel}
              </span>
            </div>
            <h2 className='text-base leading-tight font-semibold'>
              {focusedItem.name}
            </h2>
            <div className='text-muted-foreground space-y-1 text-sm'>
              {focusedItem.type !== 'folder' && (
                <p>Size: {formatBytes(focusedItem.size_bytes) || '—'}</p>
              )}
              {focusedItem.updated_at && (
                <p>Updated {formatDate(focusedItem.updated_at)}</p>
              )}
              {focusedItem.visibility && (
                <p className='capitalize'>
                  Visibility: {focusedItem.visibility}
                </p>
              )}
            </div>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button
              size='sm'
              onClick={() => handleOpenInSuite(focusedItem)}
              variant='secondary'
            >
              <ExternalLink className='mr-2 size-3' />
              Open in NobleFiles
            </Button>
            <Button
              size='sm'
              variant='ghost'
              onClick={() => toggle(focusedItem)}
            >
              <XCircle className='mr-2 size-3' />
              Remove
            </Button>
          </div>
          {otherSelected.length > 0 && (
            <div className='space-y-2'>
              <p className='text-muted-foreground text-xs font-semibold tracking-wide uppercase'>
                Also selected
              </p>
              <div className='flex flex-wrap gap-2'>
                {otherSelected.map((item) => (
                  <button
                    key={item.id}
                    type='button'
                    onClick={() => setFocusedId(item.id)}
                    className='bg-muted hover:bg-muted/70 rounded-full px-3 py-1 text-xs font-medium transition'
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className='flex h-full flex-col items-center justify-center gap-3 text-center'>
          <div className='bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full border'>
            <Info className='size-5' />
          </div>
          <div className='space-y-1'>
            <p className='text-foreground text-sm font-medium'>
              Nothing selected yet
            </p>
            <p className='text-muted-foreground text-xs'>
              Choose files or folders on the left to see their details here.
            </p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='w-full max-w-[92vw] overflow-hidden p-0 lg:max-w-[1120px]'>
        <div className='flex h-[min(85vh,720px)] flex-col overflow-hidden'>
          <DialogHeader className='border-b px-6 py-4 text-left'>
            <DialogTitle className='text-lg font-semibold'>
              Share from NobleFiles
            </DialogTitle>
            <DialogDescription className='text-muted-foreground text-sm'>
              Pick files or folders to include in your Suite Card and send them
              instantly in chat.
            </DialogDescription>
          </DialogHeader>
          <div className='grid flex-1 overflow-hidden border-b lg:grid-cols-[minmax(0,1fr)_360px]'>
            <div className='flex min-h-0 flex-col'>
              <ScrollArea className='h-full'>
                <div className='space-y-6 px-6 py-4'>
                  <section className='space-y-2'>
                    <div className='flex items-center justify-between'>
                      <h3 className='text-sm font-semibold'>Recent files</h3>
                      {recentLoading && (
                        <Loader2 className='size-4 animate-spin' />
                      )}
                    </div>
                    {recent.length === 0 && !recentLoading ? (
                      <p className='text-muted-foreground text-sm'>
                        No recent files yet. Upload something new to see it
                        here.
                      </p>
                    ) : (
                      <div className='no-scrollbar flex gap-3 overflow-x-auto pb-1'>
                        {recent.map((item) => {
                          const isSelected = Boolean(selected[item.id]);
                          return (
                            <button
                              key={item.id}
                              type='button'
                              onClick={() => toggle(item)}
                              className={cn(
                                'bg-card hover:bg-card/80 min-w-[200px] rounded-xl border px-3 py-2 text-left shadow-sm transition md:min-w-[220px]',
                                isSelected &&
                                  'ring-primary/60 ring-offset-background ring-2 ring-offset-2 ring-inset'
                              )}
                            >
                              <div className='flex items-center gap-2'>
                                {iconFor(item)}
                                <div className='min-w-0'>
                                  <div className='truncate text-sm font-medium'>
                                    {item.name}
                                  </div>
                                  <div className='text-muted-foreground text-[11px]'>
                                    {formatBytes(item.size_bytes)}
                                    {item.updated_at
                                      ? ` • ${formatDate(item.updated_at)}`
                                      : ''}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  {atRoot && rootFolders.length > 0 && (
                    <section className='space-y-2'>
                      <div className='flex items-center justify-between'>
                        <h3 className='text-sm font-semibold'>Folders</h3>
                        <span className='text-muted-foreground text-xs'>
                          {rootFolders.length} total
                        </span>
                      </div>
                      <div className='no-scrollbar flex gap-3 overflow-x-auto pb-1'>
                        {rootFolders.map((folder) => {
                          const isSelected = Boolean(selected[folder.id]);
                          return (
                            <div
                              key={folder.id}
                              className={cn(
                                'bg-muted/40 hover:bg-muted min-w-[200px] rounded-xl border p-3 shadow-sm transition',
                                isSelected &&
                                  'ring-primary/60 ring-offset-background ring-2 ring-offset-2 ring-inset'
                              )}
                            >
                              <div className='flex items-center gap-2'>
                                <div className='flex size-9 items-center justify-center rounded-lg border bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-200'>
                                  <Folder className='size-5' />
                                </div>
                                <div className='min-w-0'>
                                  <div className='truncate text-sm font-medium'>
                                    {folder.name}
                                  </div>
                                  <p className='text-muted-foreground text-[11px]'>
                                    Tap Select to add, Open to explore inside.
                                  </p>
                                </div>
                              </div>
                              <div className='mt-3 flex items-center gap-2'>
                                <Button
                                  size='sm'
                                  variant='secondary'
                                  className='flex-1'
                                  onClick={() => toggle(folder)}
                                >
                                  {isSelected ? 'Remove' : 'Select'}
                                </Button>
                                <Button
                                  size='sm'
                                  variant='ghost'
                                  onClick={() => enterFolder(folder)}
                                  aria-label='Open folder'
                                >
                                  <CornerUpLeft className='mr-1 size-3' />
                                  Open
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  <section className='space-y-3'>
                    <div className='flex flex-wrap items-center justify-between gap-2'>
                      <div className='flex flex-wrap items-center gap-1 text-sm'>
                        {breadcrumb.map((crumb, index) => (
                          <span
                            key={crumb.id ?? 'root'}
                            className='flex items-center'
                          >
                            <button
                              type='button'
                              onClick={() => goToBreadcrumb(index)}
                              className={cn(
                                'text-foreground/80 hover:text-foreground font-medium',
                                index === breadcrumb.length - 1 &&
                                  'text-foreground cursor-default'
                              )}
                              disabled={index === breadcrumb.length - 1}
                            >
                              {crumb.name}
                            </button>
                            {index < breadcrumb.length - 1 && (
                              <ChevronRight className='text-muted-foreground mx-1 size-3' />
                            )}
                          </span>
                        ))}
                      </div>
                      <div className='text-muted-foreground flex items-center gap-2 text-xs'>
                        {listLoading && (
                          <Loader2 className='size-4 animate-spin' />
                        )}
                        {selectionCount > 0 && (
                          <Badge variant='secondary'>
                            {selectionCount} selected
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className='divide-border divide-y overflow-hidden rounded-lg border'>
                      {items.length === 0 && !listLoading ? (
                        <div className='text-muted-foreground py-12 text-center text-sm'>
                          This folder is empty.
                        </div>
                      ) : (
                        items.map((item) => {
                          const isSelected = Boolean(selected[item.id]);
                          const isFolder = item.type === 'folder';
                          return (
                            <div
                              key={item.id}
                              className={cn(
                                'flex items-center gap-2 px-3 py-3 transition',
                                isSelected && 'bg-primary/5'
                              )}
                            >
                              <button
                                type='button'
                                onClick={() => toggle(item)}
                                className='flex flex-1 items-center gap-3 text-left'
                              >
                                <div
                                  className={cn(
                                    'flex size-9 items-center justify-center rounded border',
                                    isFolder
                                      ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-200'
                                      : 'bg-muted text-muted-foreground'
                                  )}
                                >
                                  {iconFor(item)}
                                </div>
                                <div className='min-w-0'>
                                  <div className='truncate text-sm font-medium'>
                                    {item.name}
                                  </div>
                                  <div className='text-muted-foreground text-[11px]'>
                                    {isFolder
                                      ? 'Folder'
                                      : formatBytes(item.size_bytes) || 'File'}
                                    {item.updated_at
                                      ? ` • ${formatDate(item.updated_at)}`
                                      : ''}
                                  </div>
                                </div>
                              </button>
                              {isFolder ? (
                                <Button
                                  variant='ghost'
                                  size='sm'
                                  onClick={() => enterFolder(item)}
                                  aria-label='Open folder'
                                >
                                  <CornerUpLeft className='mr-1 size-3' />
                                  Open
                                </Button>
                              ) : null}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </section>

                  <div className='lg:hidden'>
                    <div className='bg-muted/10 rounded-lg border'>
                      <PreviewPanel />
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </div>
            <aside className='hidden min-h-0 border-l lg:flex lg:flex-col'>
              <ScrollArea className='h-full'>
                <PreviewPanel />
              </ScrollArea>
            </aside>
          </div>

          <DialogFooter className='bg-muted/30 border-t px-6 py-4'>
            <div className='flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
              <div className='text-muted-foreground text-xs'>
                {selectionCount === 0
                  ? 'No items selected'
                  : `${selectionCount} item${selectionCount > 1 ? 's' : ''} ready for your Suite Card`}
              </div>
              <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => {
                    setSelected({});
                    setFocusedId(null);
                  }}
                  disabled={selectionCount === 0}
                >
                  Clear selection
                </Button>
                <Button onClick={handleShare} disabled={selectionCount === 0}>
                  Add to chat card
                </Button>
              </div>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
