'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTabs } from '@/components/layout/tabs-context';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import UploadDialog from '@/features/files/components/upload-dialog';
import { supabase } from '@/lib/supabaseClient';
import { Icons } from '@/components/icons';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/components/ui/context-menu';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const FILES_BUCKET = process.env.NEXT_PUBLIC_FILES_BUCKET || 'files';

type FileItem = {
  id: string;
  name: string;
  type: string; // folder | binary
  ext?: string | null;
  mime_type?: string | null;
  storage_path?: string | null;
  updated_at?: string;
  size_bytes?: number | null;
  is_starred?: boolean;
  parent_id?: string | null;
};

const OFFICE_EXTS = new Set([
  'xls',
  'xlsx',
  'csv',
  'cells',
  'doc',
  'docx',
  'ppt',
  'pptx'
]);

export default function NobleSuiteHomePage() {
  const { openTab } = useTabs();
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'sheets' | 'docs'>('all');
  const [starOnly, setStarOnly] = useState(false);
  type ViewMode = 'grid' | 'list';
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  type SortKey = 'updated' | 'name' | 'type';
  type SortDir = 'asc' | 'desc';
  const [sortKey, setSortKey] = useState<SortKey>('updated');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Move popover state
  const [showMove, setShowMove] = useState(false);
  const [moveParentId, setMoveParentId] = useState<string | null>(null);
  const [movePath, setMovePath] = useState<
    Array<{ id: string | null; name: string }>
  >([{ id: null, name: 'Home' }]);
  const [moveFolders, setMoveFolders] = useState<FileItem[]>([]);
  const [moveLoading, setMoveLoading] = useState(false);
  // Share links popover (simplified)
  const [showShare, setShowShare] = useState(false);
  const [shareLinks, setShareLinks] = useState<
    Array<{ name: string; url: string }>
  >([]);

  // Load recent files from the shared Files table (root scope)
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/noblesuite/files?limit=60', {
          cache: 'no-store'
        });
        const json = await res.json();
        if (!json?.ok) throw new Error(json?.error || 'LOAD_FAILED');
        if (!active) return;
        const list: FileItem[] = (json.items || []).filter(
          (it: FileItem) =>
            it.type !== 'folder' &&
            OFFICE_EXTS.has(
              (it.ext || it.name.split('.').pop() || '').toLowerCase()
            )
        );
        setItems(list);
        setError(null);
      } catch (e: any) {
        if (!active) return;
        setError(e?.message || 'LOAD_FAILED');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const openFile = useCallback(
    async (it: FileItem, forceDownload = false) => {
      if (it.type === 'folder' || !it.storage_path) return;
      const ext = (it.ext || it.name.split('.').pop() || '').toLowerCase();
      const isSheet =
        ext === 'xls' || ext === 'xlsx' || ext === 'csv' || ext === 'cells';
      // If it's a sheet and not forced to download, open in Cells tab
      if (isSheet && !forceDownload) {
        // If this is a native cells file, storage_path is cells:<sheetId>
        let sheetId: string | null = null;
        let importUrl: string | undefined;
        if (it.storage_path?.startsWith('cells:')) {
          sheetId = it.storage_path.slice('cells:'.length);
        } else {
          try {
            const { data: signed } = await supabase.storage
              .from(FILES_BUCKET)
              .createSignedUrl(it.storage_path, 300);
            importUrl = signed?.signedUrl || undefined;
          } catch {}
          if (!importUrl) {
            // Robust fallback through API proxy
            importUrl = `/api/noblesuite/files/preview?id=${encodeURIComponent(it.id)}`;
          }
        }
        openTab({
          kind: 'cells',
          title: it.name.replace(/\.(xlsx|xls|csv|cells)$/i, ''),
          icon: Icons.sheet,
          // @ts-ignore: payload is supported
          payload: { sheetId, fileName: it.name, importUrl }
        });
        return;
      }
      try {
        const { data: signed } = await supabase.storage
          .from(FILES_BUCKET)
          .createSignedUrl(it.storage_path, 300);
        const url =
          signed?.signedUrl ||
          supabase.storage.from(FILES_BUCKET).getPublicUrl(it.storage_path).data
            ?.publicUrl ||
          '';
        if (!url) throw new Error('FILE_URL_UNAVAILABLE');
        if (forceDownload) {
          const a = document.createElement('a');
          a.href = url;
          a.download = it.name;
          document.body.appendChild(a);
          a.click();
          a.remove();
        } else {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      } catch (e) {
        console.error(e);
        setError((e as any)?.message || 'OPEN_FAILED');
      }
    },
    [openTab]
  );

  // Load folders for Move popover (rooted at selected destination)
  useEffect(() => {
    if (!showMove) return;
    let cancelled = false;
    (async () => {
      setMoveLoading(true);
      try {
        const params = new URLSearchParams();
        if (moveParentId) params.set('parentId', moveParentId);
        const res = await fetch(`/api/noblesuite/files?${params.toString()}`);
        const json = await res.json();
        if (!json?.ok) {
          if (!cancelled) setMoveFolders([]);
        } else {
          const arr: FileItem[] = (json.items || []).filter(
            (x: FileItem) => x.type === 'folder'
          );
          if (!cancelled) setMoveFolders(arr);
        }
      } catch {
        if (!cancelled) setMoveFolders([]);
      } finally {
        if (!cancelled) setMoveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showMove, moveParentId]);

  function formatDate(iso?: string) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function formatSize(bytes?: number | null) {
    if (!bytes && bytes !== 0) return '';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let b = bytes || 0;
    let u = 0;
    while (b >= 1024 && u < units.length - 1) {
      b /= 1024;
      u++;
    }
    return `${b.toFixed(b < 10 && u > 0 ? 1 : 0)} ${units[u]}`;
  }

  // Single-file uploader compatible with UploadDialog
  const uploadOne = useCallback(
    async (
      f: File,
      onProgress?: (p: number) => void,
      opts?: { signal?: AbortSignal }
    ) => {
      const resp = await fetch('/api/noblesuite/files/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: f.name, fileType: f.type })
      });
      const json = await resp.json();
      if (!json?.ok) throw new Error(json?.error || 'UPLOAD_INIT_FAILED');
      const { path, fileId } = json;

      const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(
        /\/$/,
        ''
      );
      const uploadUrl = `${baseUrl}/storage/v1/object/${encodeURIComponent(FILES_BUCKET)}/${encodeURIComponent(path)}`;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', uploadUrl, true);
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        if (f.type) xhr.setRequestHeader('Content-Type', f.type);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress?.((e.loaded / e.total) * 100);
        };
        xhr.onerror = () => reject(new Error('UPLOAD_NETWORK_ERROR'));
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error(`UPLOAD_FAILED_${xhr.status}`));
        if (opts?.signal) {
          if (opts.signal.aborted)
            return reject(new DOMException('Aborted', 'AbortError'));
          const onAbort = () => {
            try {
              xhr.abort();
            } catch {}
            reject(new DOMException('Aborted', 'AbortError'));
          };
          opts.signal.addEventListener('abort', onAbort, { once: true });
          xhr.addEventListener('loadend', () =>
            opts.signal?.removeEventListener('abort', onAbort)
          );
        }
        xhr.send(f);
      });

      await supabase
        .from('files')
        .update({ size_bytes: f.size })
        .eq('id', fileId);
    },
    []
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      const ext = (it.ext || it.name.split('.').pop() || '').toLowerCase();
      if (
        filter === 'sheets' &&
        !(ext === 'xls' || ext === 'xlsx' || ext === 'csv' || ext === 'cells')
      )
        return false;
      if (
        filter === 'docs' &&
        !(ext === 'doc' || ext === 'docx' || ext === 'ppt' || ext === 'pptx')
      )
        return false;
      if (starOnly && !it.is_starred) return false;
      if (q && !it.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, filter, starOnly]);

  const compare = (a: FileItem, b: FileItem) => {
    let r = 0;
    if (sortKey === 'updated')
      r = (a.updated_at || '').localeCompare(b.updated_at || '');
    else if (sortKey === 'name')
      r = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    else if (sortKey === 'type') {
      const ea = (a.ext || a.name.split('.').pop() || '').toLowerCase();
      const eb = (b.ext || b.name.split('.').pop() || '').toLowerCase();
      r = ea.localeCompare(eb);
    }
    return sortDir === 'asc' ? r : -r;
  };
  const officeCards = useMemo(
    () => filtered.slice(0, 200).sort(compare),
    [filtered, sortKey, sortDir]
  );

  const sortLabel = () => {
    if (sortKey === 'updated')
      return `Sort By: ${sortDir === 'desc' ? 'Latest' : 'Oldest'}`;
    if (sortKey === 'name')
      return `Sort By: ${sortDir === 'asc' ? 'Name A→Z' : 'Name Z→A'}`;
    if (sortKey === 'type')
      return `Sort By: ${sortDir === 'asc' ? 'Type A→Z' : 'Type Z→A'}`;
    return 'Sort By';
  };
  function setSort(k: SortKey, dir: SortDir) {
    setSortKey(k);
    setSortDir(dir);
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());
  const visibleList = useMemo(() => officeCards, [officeCards]);
  const allVisibleSelected =
    visibleList.length > 0 && selectedIds.size === visibleList.length;
  const toggleSelectAllVisible = (checked: boolean) => {
    if (checked) setSelectedIds(new Set(visibleList.map((x) => x.id)));
    else clearSelection();
  };

  const toggleStar = async (it: FileItem) => {
    const next = !it.is_starred;
    const prev = items;
    setItems((p) =>
      p.map((x) => (x.id === it.id ? { ...x, is_starred: next } : x))
    );
    try {
      const res = await fetch(`/api/noblesuite/files/${it.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_starred: next })
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || 'STAR_FAILED');
    } catch (e: any) {
      setItems(prev);
      setError(e?.message || 'STAR_FAILED');
    }
  };

  const deleteItem = async (it: FileItem) => {
    const prev = items;
    setItems((p) => p.filter((x) => x.id !== it.id));
    try {
      const res = await fetch(`/api/noblesuite/files/${it.id}`, {
        method: 'DELETE'
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || 'DELETE_FAILED');
      toast(`${it.name} removed`);
    } catch (e: any) {
      setItems(prev);
      setError(e?.message || 'DELETE_FAILED');
    }
  };

  const deleteSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const prev = items;
    setItems((p) => p.filter((x) => !ids.includes(x.id)));
    try {
      const res = await Promise.all(
        ids.map((id) =>
          fetch(`/api/noblesuite/files/${id}`, { method: 'DELETE' })
        )
      );
      const ok = await Promise.all(res.map((r) => r.json()));
      if (ok.some((j) => !j?.ok)) throw new Error('DELETE_FAILED');
      toast.success('Deleted selected');
      clearSelection();
    } catch (e: any) {
      setItems(prev);
      setError(e?.message || 'DELETE_FAILED');
    }
  };

  const moveSelected = async (dest: string | null) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const prev = items;
    setItems((p) => p.filter((x) => !ids.includes(x.id)));
    try {
      const res = await Promise.all(
        ids.map((id) =>
          fetch(`/api/noblesuite/files/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ parentId: dest })
          })
        )
      );
      if (res.some((r) => !r.ok)) throw new Error('MOVE_FAILED');
      toast.success('Moved successfully');
      setShowMove(false);
      clearSelection();
    } catch (e: any) {
      setItems(prev);
      setError(e?.message || 'MOVE_FAILED');
    }
  };

  const generateShareLinks = useCallback(async () => {
    const ids = Array.from(selectedIds);
    const out: Array<{ name: string; url: string }> = [];
    for (const id of ids) {
      const it = items.find((x) => x.id === id);
      if (!it || !it.storage_path) continue;
      try {
        const { data: signed } = await supabase.storage
          .from(FILES_BUCKET)
          .createSignedUrl(it.storage_path, 300);
        const url =
          signed?.signedUrl ||
          supabase.storage.from(FILES_BUCKET).getPublicUrl(it.storage_path).data
            ?.publicUrl ||
          '';
        if (url) out.push({ name: it.name, url });
      } catch {
        const pub = supabase.storage
          .from(FILES_BUCKET)
          .getPublicUrl(it.storage_path);
        if (pub.data?.publicUrl)
          out.push({ name: it.name, url: pub.data.publicUrl });
      }
    }
    setShareLinks(out);
  }, [selectedIds, items]);

  return (
    <div className='p-6'>
      {/* Header (match shipments layout: title+sub, upload on the right) */}
      <div className='mb-6 flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h1 className='text-2xl font-bold'>Suite</h1>
          <p className='text-muted-foreground mt-1 max-w-2xl text-sm'>
            Logistics‑tuned spreadsheets and docs—think clearer, move faster.
          </p>
        </div>
        <div>
          <Button className='gap-2' onClick={() => setShowUpload(true)}>
            <Icons.add className='size-4' /> Upload
          </Button>
        </div>
      </div>

      {/* Quick actions as cards with subheaders */}
      <div className='mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3'>
        <button
          className='group hover:ring-offset-background relative overflow-hidden rounded-xl border p-4 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50/60 hover:ring-1 hover:ring-emerald-400/40 hover:ring-offset-1 dark:hover:bg-emerald-950/25 dark:hover:ring-emerald-300/40'
          onClick={() => {
            openTab({
              kind: 'cells',
              title: 'Untitled Cells',
              icon: Icons.sheet
            });
          }}
        >
          {/* Decorative Excel-like corner (no clipping; expands on hover) */}
          <div className='pointer-events-none absolute -top-2 -right-2 h-20 w-24 opacity-60 transition-all duration-300 [mask-image:linear-gradient(to_left,black,transparent)] group-hover:opacity-90'>
            <div className='absolute inset-0 rounded-bl-2xl bg-gradient-to-l from-emerald-400/15 to-emerald-400/0 group-hover:from-emerald-400/30 dark:from-emerald-300/10 dark:group-hover:from-emerald-300/30' />
            <div className='absolute top-3 right-3 rounded-sm border border-emerald-500/30 bg-emerald-500/10 p-1.5 shadow-sm group-hover:scale-[1.05]'>
              <div className='grid grid-cols-3 gap-[2px]'>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={`g-${i}`}
                    className='size-1.5 rounded-sm bg-emerald-500/30'
                  />
                ))}
              </div>
            </div>
          </div>
          <div className='mb-3 inline-flex items-center justify-center rounded-lg bg-emerald-50 p-2 dark:bg-emerald-950/30'>
            <Icons.sheet className='size-5 text-emerald-600 dark:text-emerald-400' />
          </div>
          <div className='text-sm font-medium'>New cells</div>
          <div className='text-muted-foreground mt-1 text-xs'>
            Spreadsheet for your operations and analytics
          </div>
        </button>
        <button
          className='group hover:ring-offset-background relative overflow-hidden rounded-xl border p-4 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50/60 hover:ring-1 hover:ring-indigo-400/40 hover:ring-offset-1 dark:hover:bg-indigo-950/25 dark:hover:ring-indigo-300/40'
          onClick={() => {
            openTab({ kind: 'docs', title: 'Untitled Doc', icon: Icons.doc });
          }}
        >
          {/* Decorative Word-like corner (hover flare) */}
          <div className='pointer-events-none absolute -top-2 -right-2 h-20 w-24 opacity-60 transition-all duration-300 [mask-image:linear-gradient(to_left,black,transparent)] group-hover:opacity-90'>
            <div className='absolute inset-0 rounded-bl-2xl bg-gradient-to-l from-indigo-400/15 to-indigo-400/0 group-hover:from-indigo-400/30 dark:from-indigo-300/10 dark:group-hover:from-indigo-300/30' />
            <div className='absolute top-3 right-3 rounded-sm border border-indigo-500/30 bg-indigo-500/10 p-1.5 shadow-sm group-hover:scale-[1.05]'>
              <div className='h-1 w-9 rounded-sm bg-indigo-500/30' />
              <div className='mt-1 h-1 w-7 rounded-sm bg-indigo-500/20' />
              <div className='mt-1 h-1 w-10 rounded-sm bg-indigo-500/25' />
            </div>
          </div>
          <div className='mb-3 inline-flex items-center justify-center rounded-lg bg-indigo-50 p-2 dark:bg-indigo-950/30'>
            <Icons.doc className='size-5 text-indigo-600 dark:text-indigo-400' />
          </div>
          <div className='text-sm font-medium'>New document</div>
          <div className='text-muted-foreground mt-1 text-xs'>
            Word‑style docs tailored for logistics workflows
          </div>
        </button>
        <button
          className='group hover:ring-offset-background relative overflow-hidden rounded-xl border p-4 text-left transition-colors hover:border-violet-300 hover:bg-violet-50/60 hover:ring-1 hover:ring-violet-400/40 hover:ring-offset-1 dark:hover:bg-violet-950/25 dark:hover:ring-violet-300/40'
          onClick={() => alert('Templates are coming soon.')}
        >
          {/* Decorative templates corner (hover flare) */}
          <div className='pointer-events-none absolute -top-2 -right-2 h-20 w-24 opacity-60 transition-all duration-300 [mask-image:linear-gradient(to_left,black,transparent)] group-hover:opacity-90'>
            <div className='absolute inset-0 rounded-bl-2xl bg-gradient-to-l from-violet-400/15 to-violet-400/0 group-hover:from-violet-400/30 dark:from-violet-300/10 dark:group-hover:from-violet-300/30' />
            <div className='absolute top-3 right-3 grid grid-cols-2 gap-1'>
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={`t-${i}`}
                  className='h-2.5 w-3 rounded-sm bg-gradient-to-br from-violet-500/25 to-violet-500/10'
                />
              ))}
            </div>
          </div>
          <div className='mb-3 inline-flex items-center justify-center rounded-lg bg-violet-50 p-2 dark:bg-violet-950/30'>
            {/* Alternate icon for Templates: apps/grid */}
            <Icons.apps className='size-5 text-violet-600 dark:text-violet-400' />
          </div>
          <div className='text-sm font-medium'>Templates</div>
          <div className='text-muted-foreground mt-1 text-xs'>
            Start faster with ready‑made patterns
          </div>
        </button>
      </div>

      {/* All files */}
      {/* Files header + Files-like controls with shadcn Tabs (tabs right-aligned) */}
      <div className='mb-2 flex flex-wrap items-center justify-between gap-2'>
        <h2 className='text-base font-medium'>Files</h2>
        <div className='ml-auto flex items-center gap-2'>
          <div className='relative'>
            <input
              placeholder='Search...'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className='bg-background focus-visible:ring-primary/40 h-9 w-56 rounded-md border px-2 text-sm focus-visible:ring-2 focus-visible:outline-none'
            />
          </div>
          {/* Filters dropdown (add Starred only) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size='sm' variant='outline' className='gap-1'>
                <Icons.filter className='size-4' /> Filters
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-44 text-xs'>
              <DropdownMenuItem onClick={() => setStarOnly((v) => !v)}>
                {starOnly ? (
                  <Icons.check className='mr-1.5 size-3.5' />
                ) : (
                  <span className='mr-3 inline-block w-3.5' />
                )}
                Starred only
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Sort By dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size='sm' variant='outline' className='gap-1'>
                {sortLabel()}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-44 text-xs'>
              <div className='text-muted-foreground px-2 py-1.5 text-[10px] tracking-wide uppercase'>
                Modified
              </div>
              <DropdownMenuItem
                onClick={() => setSort('updated', 'desc')}
                inset
                disabled={sortKey === 'updated' && sortDir === 'desc'}
              >
                Latest
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSort('updated', 'asc')}
                inset
                disabled={sortKey === 'updated' && sortDir === 'asc'}
              >
                Oldest
              </DropdownMenuItem>
              <div className='text-muted-foreground px-2 pt-2 pb-1 text-[10px] tracking-wide uppercase'>
                Name
              </div>
              <DropdownMenuItem
                onClick={() => setSort('name', 'asc')}
                inset
                disabled={sortKey === 'name' && sortDir === 'asc'}
              >
                A → Z
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSort('name', 'desc')}
                inset
                disabled={sortKey === 'name' && sortDir === 'desc'}
              >
                Z → A
              </DropdownMenuItem>
              <div className='text-muted-foreground px-2 pt-2 pb-1 text-[10px] tracking-wide uppercase'>
                Type
              </div>
              <DropdownMenuItem
                onClick={() => setSort('type', 'asc')}
                inset
                disabled={sortKey === 'type' && sortDir === 'asc'}
              >
                A → Z
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSort('type', 'desc')}
                inset
                disabled={sortKey === 'type' && sortDir === 'desc'}
              >
                Z → A
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* View mode toggle */}
          <div className='ml-1 inline-flex rounded-md border p-0.5'>
            <Button
              size='sm'
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              className='h-8 px-2'
              onClick={() => setViewMode('grid')}
              title='Grid view'
            >
              <Icons.grid className='size-4' />
            </Button>
            <Button
              size='sm'
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              className='h-8 px-2'
              onClick={() => setViewMode('list')}
              title='List view'
            >
              <Icons.file className='size-4' />
            </Button>
          </div>
          {/* Tabs on the far right */}
          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
            <TabsList>
              <TabsTrigger value='all'>All</TabsTrigger>
              <TabsTrigger value='sheets'>Cells</TabsTrigger>
              <TabsTrigger value='docs'>Docs</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
      {error && (
        <div className='text-destructive border-destructive/30 bg-destructive/5 mb-3 rounded border px-2 py-1 text-xs'>
          {error}
        </div>
      )}
      {officeCards.length === 0 && !loading ? (
        <div className='rounded-md border p-8 text-center'>
          <div
            className={`mx-auto mb-3 flex size-12 items-center justify-center rounded-full ${filter === 'sheets' ? 'bg-emerald-100 dark:bg-emerald-950/30' : filter === 'docs' ? 'bg-indigo-100 dark:bg-indigo-950/30' : 'bg-muted'}`}
          >
            {filter === 'sheets' ? (
              <Icons.sheet className='size-6 text-emerald-600 dark:text-emerald-400' />
            ) : filter === 'docs' ? (
              <Icons.doc className='size-6 text-indigo-600 dark:text-indigo-400' />
            ) : (
              <Icons.folder className='size-6 opacity-60' />
            )}
          </div>
          <div className='text-sm font-medium'>
            {filter === 'sheets'
              ? 'No sheets yet'
              : filter === 'docs'
                ? 'No docs yet'
                : 'No files yet'}
          </div>
          <div className='text-muted-foreground mx-auto mt-1 max-w-md text-xs'>
            {filter === 'sheets'
              ? 'Create your first sheet or upload an .xlsx or .csv file.'
              : filter === 'docs'
                ? 'Create a document or upload a .docx/.pptx file.'
                : 'Upload office files or start with Cells/Docs to see them here.'}
          </div>
          <div className='mt-3'>
            <Button
              size='sm'
              className='gap-1'
              onClick={() => setShowUpload(true)}
            >
              <Icons.add className='size-4' /> Upload
            </Button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'>
          {officeCards.map((it) => {
            const ext = (
              it.ext ||
              it.name.split('.').pop() ||
              ''
            ).toLowerCase();
            const isSheet =
              ext === 'xls' ||
              ext === 'xlsx' ||
              ext === 'csv' ||
              ext === 'cells';
            const selected = selectedIds.has(it.id);
            return (
              <ContextMenu key={it.id}>
                <ContextMenuTrigger asChild>
                  <div
                    key={it.id}
                    className={`group bg-card relative flex flex-col overflow-hidden rounded-xl border shadow-sm transition hover:shadow-md ${
                      isSheet
                        ? 'hover:ring-offset-background hover:border-emerald-300 hover:bg-emerald-50/40 hover:ring-1 hover:ring-emerald-400/40 hover:ring-offset-1 dark:hover:bg-emerald-950/15 dark:hover:ring-emerald-300/40'
                        : 'hover:ring-offset-background hover:border-indigo-300 hover:bg-indigo-50/40 hover:ring-1 hover:ring-indigo-400/40 hover:ring-offset-1 dark:hover:bg-indigo-950/15 dark:hover:ring-indigo-300/40'
                    } ${selected ? 'ring-primary/60 ring-offset-background ring-2 ring-offset-1' : ''}`}
                  >
                    {/* Corner hover flare */}
                    <div
                      className={`pointer-events-none absolute -top-2 -right-2 h-20 w-24 opacity-0 transition-opacity duration-300 [mask-image:linear-gradient(to_left,black,transparent)] group-hover:opacity-90 ${
                        isSheet
                          ? 'bg-gradient-to-l from-emerald-400/20 to-emerald-400/0 dark:from-emerald-300/20'
                          : 'bg-gradient-to-l from-indigo-400/20 to-indigo-400/0 dark:from-indigo-300/20'
                      }`}
                    />
                    {/* Hover controls: select checkbox & star */}
                    <div className='pointer-events-none absolute top-2 left-2 z-10 opacity-0 transition-opacity duration-200 group-hover:opacity-100'>
                      <button
                        type='button'
                        role='checkbox'
                        aria-checked={selected}
                        className={cn(
                          'border-border/70 bg-background/90 text-primary hover:border-primary/70 focus-visible:ring-primary/50 focus-visible:ring-offset-background pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full border shadow-sm transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                          selected && 'border-primary bg-primary/10'
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(it.id);
                        }}
                        title={selected ? 'Deselect' : 'Select'}
                      >
                        {selected ? (
                          <Icons.check className='size-4' />
                        ) : (
                          <span className='border-border/70 block h-3.5 w-3.5 rounded-full border' />
                        )}
                      </button>
                    </div>
                    <div className='pointer-events-none absolute top-2 right-2 z-10 opacity-0 transition-opacity duration-200 group-hover:opacity-100'>
                      <button
                        className={`pointer-events-auto rounded-md p-1 shadow-sm ${
                          it.is_starred
                            ? isSheet
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                            : 'bg-background/80 text-muted-foreground'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          void toggleStar(it);
                        }}
                        title={it.is_starred ? 'Unstar' : 'Star'}
                      >
                        {it.is_starred ? (
                          <Icons.starFilled className='size-4' />
                        ) : (
                          <Icons.star className='size-4' />
                        )}
                      </button>
                    </div>
                    {/* Preview area */}
                    <button
                      className='bg-muted/40 relative flex aspect-video w-full items-center justify-center overflow-hidden'
                      onClick={() => void openFile(it, false)}
                      title={it.name}
                    >
                      {/* Tinted overlay on hover */}
                      <div
                        className={`pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 ${
                          isSheet
                            ? 'bg-emerald-200/10 dark:bg-emerald-900/20'
                            : 'bg-indigo-200/10 dark:bg-indigo-900/20'
                        }`}
                      />
                      <div className='text-muted-foreground transition-transform duration-200 group-hover:scale-110'>
                        {isSheet ? (
                          <Icons.sheet
                            className={`size-10 transition-colors duration-200 ${
                              isSheet
                                ? 'group-hover:text-emerald-600 dark:group-hover:text-emerald-400'
                                : 'group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
                            }`}
                          />
                        ) : (
                          <Icons.doc
                            className={`size-10 transition-colors duration-200 ${
                              isSheet
                                ? 'group-hover:text-emerald-600 dark:group-hover:text-emerald-400'
                                : 'group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
                            }`}
                          />
                        )}
                      </div>
                    </button>
                    {/* Bottom accent bar on hover */}
                    <div
                      className={`absolute top-[calc(100%-2px)] left-0 h-0.5 w-0 transition-[width] duration-300 group-hover:w-full ${
                        isSheet
                          ? 'bg-emerald-300 dark:bg-emerald-400/70'
                          : 'bg-indigo-300 dark:bg-indigo-400/70'
                      }`}
                    />
                    {/* Meta */}
                    <div className='flex flex-col gap-1 p-3 pt-2'>
                      <div className='flex items-start gap-2'>
                        <button
                          className='cursor-pointer truncate text-left font-medium'
                          onClick={() => void openFile(it, false)}
                          title={it.name}
                        >
                          {it.name}
                        </button>
                        <span className='bg-muted/60 ml-auto rounded px-1.5 py-0.5 text-[10px] tracking-wide uppercase'>
                          {ext || 'file'}
                        </span>
                      </div>
                      <div className='text-muted-foreground truncate text-[11px]'>
                        {[
                          formatSize(it.size_bytes),
                          it.updated_at ? formatDate(it.updated_at) : ''
                        ]
                          .filter(Boolean)
                          .join(' • ')}
                      </div>
                      <div className='flex justify-end'>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className='text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer rounded-md p-1 opacity-0 transition group-hover:opacity-100'>
                              <Icons.ellipsis className='size-4' />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align='end' className='text-xs'>
                            <DropdownMenuItem
                              onClick={() => void openFile(it, false)}
                            >
                              Open
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => void openFile(it, true)}
                            >
                              Download
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleStar(it)}>
                              {it.is_starred ? 'Unstar' : 'Star'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => deleteItem(it)}
                              data-variant='destructive'
                            >
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent className='text-xs'>
                  <ContextMenuItem onClick={() => void openFile(it, false)}>
                    Open
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => void openFile(it, true)}>
                    Download
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => toggleStar(it)}>
                    {it.is_starred ? 'Unstar' : 'Star'}
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => deleteItem(it)}
                    data-variant='destructive'
                  >
                    Remove
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })}
        </div>
      ) : (
        <div className='rounded-md border'>
          {/* List view with selectable header and sortable columns */}
          <div className='bg-muted/40 text-muted-foreground grid grid-cols-[40px_1fr_140px_120px_140px_40px] items-center gap-2 rounded-t-md px-2 py-2 text-[11px] tracking-wide uppercase'>
            <div className='flex items-center justify-center'>
              <Checkbox
                className='border-border data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground h-4 w-4 rounded'
                checked={allVisibleSelected}
                onCheckedChange={(v) => toggleSelectAllVisible(Boolean(v))}
                aria-label='Select all'
              />
            </div>
            <button
              className='hover:text-foreground text-left'
              onClick={() =>
                setSort(
                  'name',
                  sortKey === 'name' && sortDir === 'asc' ? 'desc' : 'asc'
                )
              }
            >
              Name {sortKey === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
            </button>
            <button
              className='hover:text-foreground text-left'
              onClick={() =>
                setSort(
                  'type',
                  sortKey === 'type' && sortDir === 'asc' ? 'desc' : 'asc'
                )
              }
            >
              Type {sortKey === 'type' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
            </button>
            <button
              className='hover:text-foreground text-left'
              onClick={() =>
                setSort(
                  'name',
                  sortKey === 'name' && sortDir === 'asc' ? 'desc' : 'asc'
                )
              }
              disabled
            >
              Size
            </button>
            <button
              className='hover:text-foreground text-right'
              onClick={() =>
                setSort(
                  'updated',
                  sortKey === 'updated' && sortDir === 'asc' ? 'desc' : 'asc'
                )
              }
            >
              Modified{' '}
              {sortKey === 'updated' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
            </button>
            <div />
          </div>
          <div className='divide-y'>
            {officeCards.map((it) => {
              const ext = (
                it.ext ||
                it.name.split('.').pop() ||
                ''
              ).toLowerCase();
              const isSheet =
                ext === 'xls' ||
                ext === 'xlsx' ||
                ext === 'csv' ||
                ext === 'cells';
              const selected = selectedIds.has(it.id);
              return (
                <ContextMenu key={`row-${it.id}`}>
                  <ContextMenuTrigger asChild>
                    <div
                      className={cn(
                        'hover:bg-muted/40 grid grid-cols-[40px_1fr_140px_120px_140px_40px] items-center gap-2 px-2 py-2 text-sm',
                        selected && 'bg-muted/60'
                      )}
                    >
                      <div className='flex items-center justify-center'>
                        <button
                          type='button'
                          role='checkbox'
                          aria-checked={selected}
                          className={cn(
                            'border-border/70 bg-background/95 text-primary hover:border-primary/70 focus-visible:ring-primary/50 focus-visible:ring-offset-background flex h-6 w-6 items-center justify-center rounded-full border transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                            selected && 'border-primary bg-primary/10'
                          )}
                          onClick={() => toggleSelect(it.id)}
                          title={selected ? 'Deselect' : 'Select'}
                        >
                          {selected ? (
                            <Icons.check className='size-4' />
                          ) : (
                            <span className='border-border/70 block h-3.5 w-3.5 rounded-full border' />
                          )}
                        </button>
                      </div>
                      <div className='flex items-center gap-2 overflow-hidden'>
                        <div
                          className={`size-6 shrink-0 rounded ${isSheet ? 'bg-emerald-100 dark:bg-emerald-950/30' : 'bg-indigo-100 dark:bg-indigo-950/30'} flex items-center justify-center`}
                        >
                          {isSheet ? (
                            <Icons.sheet className='size-4 text-emerald-600 dark:text-emerald-400' />
                          ) : (
                            <Icons.doc className='size-4 text-indigo-600 dark:text-indigo-400' />
                          )}
                        </div>
                        <button
                          className='truncate text-left'
                          title={it.name}
                          onClick={() => void openFile(it, false)}
                        >
                          {it.name}
                        </button>
                        <button
                          className={cn(
                            'ml-2 rounded p-1',
                            it.is_starred
                              ? isSheet
                                ? 'text-emerald-600'
                                : 'text-indigo-600'
                              : 'text-muted-foreground'
                          )}
                          onClick={() => void toggleStar(it)}
                          title={it.is_starred ? 'Unstar' : 'Star'}
                        >
                          {it.is_starred ? (
                            <Icons.starFilled className='size-4' />
                          ) : (
                            <Icons.star className='size-4' />
                          )}
                        </button>
                      </div>
                      <div className='text-[11px] uppercase'>
                        {ext || 'file'}
                      </div>
                      <div className='text-[12px]'>
                        {formatSize(it.size_bytes)}
                      </div>
                      <div className='text-right text-[12px]'>
                        {it.updated_at ? formatDate(it.updated_at) : ''}
                      </div>
                      <div className='flex justify-end'>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className='text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer rounded-md p-1'>
                              <Icons.ellipsis className='size-4' />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align='end' className='text-xs'>
                            <DropdownMenuItem
                              onClick={() => void openFile(it, false)}
                            >
                              Open
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => void openFile(it, true)}
                            >
                              Download
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleStar(it)}>
                              {it.is_starred ? 'Unstar' : 'Star'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => deleteItem(it)}
                              data-variant='destructive'
                            >
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent className='text-xs'>
                    <ContextMenuItem onClick={() => void openFile(it, false)}>
                      Open
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => void openFile(it, true)}>
                      Download
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => toggleStar(it)}>
                      {it.is_starred ? 'Unstar' : 'Star'}
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={() => deleteItem(it)}
                      data-variant='destructive'
                    >
                      Remove
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </div>
        </div>
      )}

      {/* Selection action bar (Move / Share / Delete) */}
      {selectedIds.size > 0 && (
        <div className='pointer-events-auto fixed inset-x-0 bottom-4 z-20 flex justify-center px-4'>
          <div className='bg-card/95 supports-[backdrop-filter]:bg-card/70 relative flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs shadow-2xl backdrop-blur'>
            <div className='flex items-center gap-2 pr-2'>
              <Icons.check className='text-primary size-4' />
              <span className='font-medium'>{selectedIds.size} selected</span>
            </div>
            <div className='bg-muted mx-1 h-4 w-px' />

            {/* Move */}
            <Popover
              open={showMove}
              onOpenChange={(o) => {
                setShowMove(o);
                if (o) {
                  setMoveParentId(null);
                  setMovePath([{ id: null, name: 'Home' }]);
                } else {
                  setMoveFolders([]);
                }
              }}
            >
              <PopoverAnchor className='absolute top-0 left-1/2 -translate-x-1/2' />
              <PopoverTrigger asChild>
                <Button size='sm' variant='ghost' className='gap-1'>
                  <Icons.folder className='size-4' />
                  Move
                </Button>
              </PopoverTrigger>
              <PopoverContent
                side='top'
                sideOffset={14}
                align='center'
                className='w-[720px] max-w-[95vw] overflow-hidden p-0'
              >
                <div className='bg-muted/40 text-muted-foreground px-3 py-2 text-[11px] font-semibold tracking-wide uppercase'>
                  Move
                </div>
                <div className='p-3'>
                  <div className='bg-card/60 mb-2 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs shadow-sm'>
                    {movePath.map((b, idx) => (
                      <span
                        key={`${b.id ?? 'root'}-${idx}`}
                        className='flex items-center'
                      >
                        <button
                          className={cn(
                            'flex items-center gap-1 rounded-full px-2 py-1',
                            b.id === moveParentId
                              ? 'bg-primary/10 ring-primary/40 ring-1'
                              : 'hover:bg-muted/60'
                          )}
                          onClick={() => {
                            setMoveParentId(b.id);
                            setMovePath((prev) => prev.slice(0, idx + 1));
                          }}
                        >
                          <Icons.folder className='size-4 opacity-60' />
                          <span className='max-w-[120px] truncate'>
                            {b.name}
                          </span>
                        </button>
                        {idx < movePath.length - 1 && (
                          <Icons.chevronRight className='mx-1 size-4 opacity-50' />
                        )}
                      </span>
                    ))}
                  </div>
                  <div className='rounded-md border'>
                    <div className='bg-muted/50 text-muted-foreground flex items-center justify-between rounded-t-md px-2 py-1 text-[10px] tracking-wide uppercase'>
                      <span>Folders</span>
                      <button
                        className='text-muted-foreground hover:text-foreground underline'
                        onClick={async () => {
                          const name = prompt('New folder name');
                          if (!name) return;
                          try {
                            const res = await fetch('/api/noblesuite/files', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                name,
                                parentId: moveParentId,
                                type: 'folder'
                              })
                            });
                            const json = await res.json();
                            if (!json?.ok)
                              return toast.error(
                                json?.error || 'CREATE_FAILED'
                              );
                            const created: FileItem = {
                              id: json.item.id,
                              name: json.item.name,
                              parent_id: json.item.parent_id,
                              type: 'folder'
                            } as FileItem;
                            setMoveFolders((prev) => [created, ...prev]);
                            setMoveParentId(created.id);
                            setMovePath((prev) => [
                              ...prev,
                              { id: created.id, name: created.name }
                            ]);
                          } catch (e: any) {
                            toast.error(e?.message || 'CREATE_FAILED');
                          }
                        }}
                      >
                        New folder here
                      </button>
                    </div>
                    <div className='max-h-[320px] divide-y overflow-auto'>
                      {moveLoading ? (
                        <div className='text-muted-foreground p-4 text-xs'>
                          Loading…
                        </div>
                      ) : moveFolders.length === 0 ? (
                        <div className='text-muted-foreground p-4 text-xs'>
                          No folders here
                        </div>
                      ) : (
                        moveFolders.map((f) => (
                          <button
                            key={`mv-${f.id}`}
                            className='hover:bg-muted/50 flex w-full items-center gap-2 px-3 py-2 text-left text-sm'
                            onClick={() => {
                              setMoveParentId(f.id!);
                              setMovePath((prev) => [
                                ...prev,
                                { id: f.id!, name: f.name }
                              ]);
                            }}
                          >
                            <Icons.folderFilled className='size-5 text-blue-500' />
                            <span className='truncate'>{f.name}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                  <div className='bg-card/50 mt-2 flex items-center justify-end gap-2 border-t px-3 py-2'>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => setShowMove(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size='sm'
                      className='gap-1'
                      onClick={() => void moveSelected(moveParentId)}
                    >
                      <Icons.check className='size-4' /> Move here
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Share */}
            <Popover
              open={showShare}
              onOpenChange={async (o) => {
                setShowShare(o);
                if (o) await generateShareLinks();
                else setShareLinks([]);
              }}
            >
              <PopoverTrigger asChild>
                <Button size='sm' variant='ghost' className='gap-1'>
                  <Icons.share className='size-4' />
                  Share
                </Button>
              </PopoverTrigger>
              <PopoverContent
                side='top'
                sideOffset={14}
                align='center'
                className='w-[560px] max-w-[95vw] overflow-hidden p-0'
              >
                <div className='bg-muted/40 text-muted-foreground px-3 py-2 text-[11px] font-semibold tracking-wide uppercase'>
                  Share Links
                </div>
                <div className='bg-background max-h-[260px] divide-y overflow-auto'>
                  {shareLinks.length === 0 ? (
                    <div className='text-muted-foreground p-4 text-xs'>
                      No sharable items
                    </div>
                  ) : (
                    shareLinks.map((l, idx) => (
                      <div
                        key={`link-${idx}`}
                        className='flex items-center justify-between gap-2 px-3 py-2 text-xs'
                      >
                        <div className='min-w-0'>
                          <div className='truncate font-medium'>{l.name}</div>
                          <div className='text-muted-foreground truncate'>
                            {l.url}
                          </div>
                        </div>
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(l.url);
                              toast.success('Copied');
                            } catch {}
                          }}
                        >
                          Copy
                        </Button>
                      </div>
                    ))
                  )}
                </div>
                {shareLinks.length > 0 && (
                  <div className='bg-card/50 flex items-center justify-end gap-2 border-t px-3 py-2'>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(
                            shareLinks
                              .map((l) => `${l.name}: ${l.url}`)
                              .join('\n')
                          );
                          toast.success('Copied all');
                        } catch {}
                      }}
                    >
                      Copy All
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            <div className='bg-muted mx-1 h-4 w-px' />
            <Button
              size='sm'
              variant='ghost'
              className='text-destructive gap-1'
              onClick={() => void deleteSelected()}
            >
              <Icons.trash className='size-4' /> Delete
            </Button>
          </div>
        </div>
      )}

      <UploadDialog
        open={showUpload}
        onOpenChange={(o) => setShowUpload(o)}
        uploadOne={uploadOne}
        accept={'.xls,.xlsx,.csv,.doc,.docx,.ppt,.pptx'}
        description={
          'Only Office file types are allowed: .xls, .xlsx, .csv, .doc, .docx, .ppt, .pptx (up to 50 MB).'
        }
      />
    </div>
  );
}
