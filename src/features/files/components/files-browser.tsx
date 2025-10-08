'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import FileUploader from '@/components/file-uploader';
import { supabase } from '@/lib/supabaseClient';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu';

const FILES_BUCKET = process.env.NEXT_PUBLIC_FILES_BUCKET || 'files';

type ViewMode = 'grid' | 'list';

interface FileItem {
  id: string;
  parent_id: string | null;
  name: string;
  type: string;
  mime_type?: string | null;
  ext?: string | null;
  size_bytes?: number | null;
  storage_path?: string | null;
  updated_at: string;
}

export default function FilesBrowser() {
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<
    { id: string | null; name: string }[]
  >([{ id: null, name: 'Home' }]);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [dndActive, setDndActive] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (parentId) params.set('parentId', parentId);
    if (search.trim()) params.set('search', search.trim());
    const res = await fetch(`/api/noblesuite/files?${params}`, {
      cache: 'no-store'
    });
    const json = await res.json();
    if (!json.ok) setError(json.error || 'LOAD_FAILED');
    else setItems(json.items);
    setLoading(false);
  }, [parentId, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    setCreating(true);
    const optimisticId = `optim-${Date.now()}`;
    // Optimistic UI
    setItems((prev) => [
      {
        id: optimisticId,
        parent_id: parentId,
        name: newFolderName.trim(),
        type: 'folder',
        updated_at: new Date().toISOString()
      },
      ...prev
    ]);
    const res = await fetch('/api/noblesuite/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newFolderName, parentId, type: 'folder' })
    });
    const json = await res.json();
    if (json.ok) {
      setNewFolderName('');
      // Replace optimistic with real
      setItems((prev) =>
        prev.map((i) => (i.id === optimisticId ? json.item : i))
      );
    } else {
      // Revert optimistic
      setItems((prev) => prev.filter((i) => i.id !== optimisticId));
      setError(mapError(json.error));
    }
    setCreating(false);
  };

  const atRoot = parentId == null;
  const folders = items.filter((i) => i.type === 'folder');
  const files = items.filter((i) => i.type !== 'folder');

  const refreshBreadcrumbNames = useCallback((updated: FileItem) => {
    setBreadcrumb((prev) =>
      prev.map((b) =>
        b.id === updated.id ? { id: b.id, name: updated.name } : b
      )
    );
  }, []);

  const deleteItem = async (item: FileItem) => {
    if (item.type === 'folder') {
      // Prevent deleting non-empty folder quickly client-side
      const hasChildren = items.some(
        (i) => i.parent_id === item.id && !i.type?.startsWith('deleted')
      );
      if (hasChildren) {
        setError('FOLDER_NOT_EMPTY');
        return;
      }
    }
    const prevItems = items;
    setItems((p) => p.filter((i) => i.id !== item.id));
    const res = await fetch(`/api/noblesuite/files/${item.id}`, {
      method: 'DELETE'
    });
    const json = await res.json();
    if (!json.ok) {
      setItems(prevItems);
      setError(mapError(json.error));
    }
  };

  const openFile = async (f: FileItem, download = false) => {
    if (!f.storage_path) {
      setError('NO_STORAGE_PATH');
      return;
    }
    try {
      let url: string | null | undefined = null;
      // Prefer signed URL first (works for private buckets). Fallback to public URL if bucket is public.
      const { data: signed, error: signErr } = await supabase.storage
        .from(FILES_BUCKET)
        .createSignedUrl(f.storage_path, 120);
      if (!signErr && signed?.signedUrl) {
        url = signed.signedUrl;
      } else {
        // If signing failed other than bucket missing, log it for debugging.
        if (signErr) {
          if (/Bucket not found/i.test(signErr.message)) {
            console.warn(
              'Bucket not found while signing',
              FILES_BUCKET,
              signErr
            );
            return setError('BUCKET_NOT_FOUND');
          }
          console.warn(
            'Signed URL error, will try public URL fallback',
            signErr
          );
        }
        const pub = supabase.storage
          .from(FILES_BUCKET)
          .getPublicUrl(f.storage_path);
        url = pub.data?.publicUrl;
      }
      if (!url) return setError('FILE_URL_UNAVAILABLE');
      if (download) {
        try {
          // Force correct filename & handle Content-Disposition absent case.
          const resp = await fetch(url);
          if (!resp.ok) throw new Error('DOWNLOAD_FAILED');
          const blob = await resp.blob();
          const objUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = objUrl;
          // sanitize name for some browsers (no slashes)
          a.download = f.name.replace(/[\\/]/g, '_');
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            URL.revokeObjectURL(objUrl);
            a.remove();
          }, 0);
        } catch (e) {
          // Fallback to direct navigation
          const a = document.createElement('a');
          a.href = url;
          a.download = f.name;
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
      } else window.open(url, '_blank');
    } catch (e: any) {
      if (typeof e?.message === 'string' && /Bucket not found/i.test(e.message))
        setError('BUCKET_NOT_FOUND');
      else setError(e?.message || 'OPEN_FAILED');
    }
  };

  const startRename = (item: FileItem) => {
    setRenamingId(item.id);
    setTimeout(() => renameInputRef.current?.focus(), 0);
  };

  const submitRename = async (item: FileItem, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === item.name) {
      setRenamingId(null);
      return;
    }
    const prev = items;
    setItems((p) =>
      p.map((i) => (i.id === item.id ? { ...i, name: trimmed } : i))
    );
    const res = await fetch(`/api/noblesuite/files/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed })
    });
    const json = await res.json();
    if (!json.ok) {
      setItems(prev);
      setError(mapError(json.error));
    }
    setRenamingId(null);
    refreshBreadcrumbNames({ ...item, name: trimmed });
  };

  type SortKey = 'updated' | 'name' | 'size' | 'type';
  type SortDir = 'asc' | 'desc';
  const [sortKey, setSortKey] = useState<SortKey>('updated');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const compare = (a: FileItem, b: FileItem): number => {
    let r = 0;
    switch (sortKey) {
      case 'updated':
        r = a.updated_at.localeCompare(b.updated_at);
        break;
      case 'name':
        r = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        break;
      case 'size':
        r = (a.size_bytes || 0) - (b.size_bytes || 0);
        break;
      case 'type':
        r = (a.ext || '').localeCompare(b.ext || '');
        break;
    }
    return sortDir === 'asc' ? r : -r;
  };
  const sortedFolders = [...folders].sort(compare);
  const sortedFiles = [...files].sort(compare);

  const sortLabel = () => {
    if (sortKey === 'updated')
      return sortDir === 'desc' ? 'Modified (Newest)' : 'Modified (Oldest)';
    if (sortKey === 'name')
      return sortDir === 'asc' ? 'Name (A→Z)' : 'Name (Z→A)';
    if (sortKey === 'size')
      return sortDir === 'desc' ? 'Size (Largest)' : 'Size (Smallest)';
    if (sortKey === 'type')
      return sortDir === 'asc' ? 'Type (A→Z)' : 'Type (Z→A)';
    return 'Sort';
  };

  function setSort(k: SortKey, dir: SortDir) {
    setSortKey(k);
    setSortDir(dir);
  }

  // Basit truncation: sadece baştan belli bir uzunluk göster ve '...' ekle (uzantıyı da kesebilir).
  function displayName(name: string, max = 28): string {
    if (name.length <= max) return name;
    return name.slice(0, Math.max(0, max - 3)) + '...';
  }

  const goBack = () => {
    if (breadcrumb.length > 1) {
      const prev = breadcrumb[breadcrumb.length - 2];
      setParentId(prev.id);
      setBreadcrumb((b) => b.slice(0, b.length - 1));
    }
  };

  function formatSize(bytes?: number | null) {
    if (!bytes) return '';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let b = bytes;
    let u = 0;
    while (b >= 1024 && u < units.length - 1) {
      b /= 1024;
      u++;
    }
    return `${b.toFixed(b < 10 && u > 0 ? 1 : 0)} ${units[u]}`;
  }

  const handleFilesSelected = async (fileList: File[] | FileList | null) => {
    if (!fileList) return;
    const arr = Array.from(fileList as any as File[]);
    setUploading(true);
    for (let idx = 0; idx < arr.length; idx++) {
      const f = arr[idx];
      setUploadProgress(Math.round((idx / arr.length) * 100));
      // Create metadata + path
      const resp = await fetch('/api/noblesuite/files/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: f.name, fileType: f.type, parentId })
      });
      const json = await resp.json();
      if (!json.ok) {
        setError(mapError(json.error));
        continue;
      }
      const { path, fileId } = json;
      const { error: upErr } = await supabase.storage
        .from(FILES_BUCKET)
        .upload(path, f, { upsert: false });
      if (upErr) {
        setError(upErr.message);
        continue;
      }
      // Update size after upload
      await supabase
        .from('files')
        .update({ size_bytes: f.size })
        .eq('id', fileId);
      // Optimistic add (if not already fetched)
      setItems((prev) => [
        {
          id: fileId,
          parent_id: parentId,
          name: f.name,
          type: 'binary',
          mime_type: f.type,
          ext: (f.name.split('.').pop() || '').toLowerCase(),
          size_bytes: f.size,
          storage_path: path,
          updated_at: new Date().toISOString()
        },
        ...prev
      ]);
    }
    setUploadProgress(100);
    setTimeout(() => setUploadProgress(null), 800);
    setUploading(false);
    void load();
    // Close upload panel & clear drag state
    setShowUpload(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDndActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length) {
      void handleFilesSelected(e.dataTransfer.files);
    }
  };

  return (
    <div
      className='relative flex h-full flex-col gap-5 p-6'
      onDragOver={(e) => {
        e.preventDefault();
        setDndActive(true);
      }}
      onDragLeave={(e) => {
        if ((e.target as HTMLElement).contains(e.relatedTarget as any)) return;
        setDndActive(false);
      }}
      onDrop={handleDrop}
    >
      {dndActive && (
        <div className='border-primary/60 bg-background/80 text-primary pointer-events-none absolute inset-0 z-10 flex animate-pulse items-center justify-center rounded-md border-4 border-dashed text-sm font-medium backdrop-blur-sm'>
          Drop to upload
        </div>
      )}
      <div className='flex flex-wrap items-center gap-3'>
        <h2 className='text-lg font-semibold tracking-tight'>Files</h2>
        <div className='ml-auto flex items-center gap-2'>
          <div className='relative'>
            <input
              placeholder='Search...'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className='bg-background focus-visible:ring-primary/40 h-8 w-52 rounded-md border px-2 text-xs focus-visible:ring-2 focus-visible:outline-none'
            />
          </div>
          <div className='flex items-center gap-1'>
            <input
              ref={nameInputRef}
              placeholder='Folder name'
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className='bg-background h-8 w-32 rounded-md border px-2 text-xs'
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void createFolder();
                }
              }}
            />
            <Button
              size='sm'
              variant='default'
              onClick={() => createFolder()}
              disabled={creating || !newFolderName.trim()}
              className='gap-1'
            >
              <Icons.add className='size-4' />
              <span className='hidden sm:inline'>New</span>
            </Button>
            <Button
              size='sm'
              variant={showUpload ? 'destructive' : 'secondary'}
              onClick={() => setShowUpload((v) => !v)}
              className='gap-1'
            >
              <Icons.file className='size-4' />
              <span className='hidden sm:inline'>Upload</span>
            </Button>
            <Button
              size='sm'
              variant='outline'
              onClick={() =>
                setViewMode((v) => (v === 'grid' ? 'list' : 'grid'))
              }
              className='gap-1'
            >
              {viewMode === 'grid' ? (
                <Icons.fileDescription className='size-4' />
              ) : (
                <Icons.grid className='size-4' />
              )}
              <span className='hidden md:inline'>
                {viewMode === 'grid' ? 'List' : 'Grid'}
              </span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size='sm' variant='outline' className='gap-1'>
                  <Icons.grid className='size-3.5 opacity-60' />
                  <span className='hidden lg:inline'>{sortLabel()}</span>
                  <span className='lg:hidden'>Sort</span>
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
                  Newest first
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSort('updated', 'asc')}
                  inset
                  disabled={sortKey === 'updated' && sortDir === 'asc'}
                >
                  Oldest first
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
                  Size
                </div>
                <DropdownMenuItem
                  onClick={() => setSort('size', 'desc')}
                  inset
                  disabled={sortKey === 'size' && sortDir === 'desc'}
                >
                  Largest
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSort('size', 'asc')}
                  inset
                  disabled={sortKey === 'size' && sortDir === 'asc'}
                >
                  Smallest
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
          </div>
        </div>
      </div>
      <div className='text-muted-foreground flex flex-wrap items-center gap-1 text-[11px]'>
        {breadcrumb.length > 1 && (
          <button
            onClick={goBack}
            className='hover:border-border hover:bg-muted/40 text-foreground mr-1 inline-flex cursor-pointer items-center gap-1 rounded-md border border-transparent px-1.5 py-0.5 text-[10px]'
          >
            <Icons.chevronLeft className='size-3' /> Up
          </button>
        )}
        {breadcrumb.map((b, idx) => (
          <span key={b.id ?? 'root'} className='flex items-center gap-1'>
            <button
              className={cn(
                'transition-colors hover:underline',
                b.id === parentId ? 'text-foreground font-medium' : ''
              )}
              onClick={() => {
                setParentId(b.id);
                setBreadcrumb((prev) => prev.slice(0, idx + 1));
              }}
            >
              {b.name}
            </button>
            {idx < breadcrumb.length - 1 && (
              <span className='opacity-40'>/</span>
            )}
          </span>
        ))}
      </div>
      {error && (
        <div className='text-destructive border-destructive/30 bg-destructive/5 rounded border px-2 py-1 text-xs'>
          {mapError(error)}
        </div>
      )}
      {showUpload && (
        <div className='bg-muted/30 animate-in fade-in flex flex-col gap-3 rounded-lg border border-dashed p-4 text-xs'>
          <span className='text-foreground flex items-center gap-2 font-medium'>
            <Icons.file className='text-primary size-4' /> Upload files
          </span>
          <FileUploader
            maxFiles={20}
            maxSize={50 * 1024 * 1024}
            accept='*/*'
            onValueChange={(files) => {
              if (files) void handleFilesSelected(files as any);
            }}
          />
          {uploadProgress !== null && (
            <div className='bg-muted h-2 w-full overflow-hidden rounded'>
              <div
                className='from-primary to-primary/60 h-full bg-gradient-to-r transition-all'
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
          <p className='text-muted-foreground'>Drag & drop destekleniyor.</p>
        </div>
      )}

      {/* CONTENT */}
      {viewMode === 'grid' ? (
        <div
          className={cn(
            'relative grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 transition',
            dndActive && 'ring-primary/60 bg-primary/5 rounded-md p-3 ring-2'
          )}
        >
          {sortedFolders.map((f) => (
            <div
              key={f.id}
              className='group from-card/80 to-background hover:from-card hover:to-card hover:border-primary/40 relative flex flex-col gap-2 overflow-hidden rounded-xl border bg-gradient-to-br p-4 shadow-sm transition hover:shadow-md'
            >
              <div className='flex w-full min-w-0 items-start gap-3'>
                {renamingId === f.id ? (
                  <div className='flex flex-1 items-center gap-3'>
                    <Icons.folder className='size-8 shrink-0 text-amber-500 drop-shadow' />
                    <input
                      ref={renameInputRef}
                      defaultValue={f.name}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          submitRename(f, (e.target as HTMLInputElement).value);
                        } else if (e.key === 'Escape') {
                          setRenamingId(null);
                        }
                      }}
                      className='bg-background/80 focus:ring-primary/40 w-full rounded border px-1 py-1 text-xs ring-1 ring-transparent outline-none'
                    />
                  </div>
                ) : (
                  <button
                    className='flex flex-1 cursor-pointer items-center gap-3 text-left text-[14px] font-medium'
                    onClick={() => {
                      setParentId(f.id);
                      setBreadcrumb((prev) => [
                        ...prev,
                        { id: f.id, name: f.name }
                      ]);
                    }}
                    title={f.name}
                  >
                    <Icons.folder className='size-8 shrink-0 text-amber-500 drop-shadow' />
                    <span
                      className='min-w-0 flex-1 truncate pr-1 whitespace-nowrap'
                      title={f.name}
                    >
                      {displayName(f.name)}
                    </span>
                  </button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className='text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer rounded-md p-1 opacity-0 transition group-hover:opacity-100'>
                      <Icons.ellipsis className='size-4' />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='end' className='text-xs'>
                    <DropdownMenuItem onClick={() => startRename(f)}>
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => deleteItem(f)}
                      className='text-destructive focus:text-destructive'
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className='text-muted-foreground flex justify-between text-[10px]'>
                <span>Folder</span>
              </div>
            </div>
          ))}
          {sortedFiles.map((f) => (
            <div
              key={f.id}
              className='group from-card/80 to-background hover:from-card hover:to-card hover:border-primary/40 relative flex flex-col gap-2 overflow-hidden rounded-xl border bg-gradient-to-br p-4 shadow-sm transition hover:shadow-md'
            >
              <div className='flex w-full min-w-0 items-start gap-3'>
                {renamingId === f.id ? (
                  <div className='flex flex-1 items-center gap-3'>
                    <Icons.file className='text-primary size-7 shrink-0' />
                    <input
                      ref={renameInputRef}
                      defaultValue={f.name}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          submitRename(f, (e.target as HTMLInputElement).value);
                        } else if (e.key === 'Escape') {
                          setRenamingId(null);
                        }
                      }}
                      className='bg-background/80 focus:ring-primary/40 w-full rounded border px-1 py-1 text-xs ring-1 ring-transparent outline-none'
                    />
                  </div>
                ) : (
                  <button
                    className='flex flex-1 cursor-pointer items-center gap-3 text-left text-[14px] font-medium'
                    onClick={() => void openFile(f, false)}
                    title={f.name}
                  >
                    <Icons.file className='text-primary size-7 shrink-0' />
                    <span
                      className='min-w-0 flex-1 truncate pr-1 whitespace-nowrap'
                      title={f.name}
                    >
                      {displayName(f.name)}
                    </span>
                  </button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className='text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer rounded-md p-1 opacity-0 transition group-hover:opacity-100'>
                      <Icons.ellipsis className='size-4' />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='end' className='text-xs'>
                    <DropdownMenuItem onClick={() => void openFile(f, false)}>
                      Open
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void openFile(f, true)}>
                      Download
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => startRename(f)}>
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => deleteItem(f)}
                      className='text-destructive focus:text-destructive'
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className='text-muted-foreground flex items-center justify-between text-[10px]'>
                <span className='bg-muted/60 rounded px-1.5 py-0.5 text-[9px] tracking-wide uppercase'>
                  {f.ext || f.mime_type?.split('/')?.[1] || 'FILE'}
                </span>
                <span>{formatSize(f.size_bytes)}</span>
              </div>
            </div>
          ))}
          {!loading && items.length === 0 && (
            <div className='text-muted-foreground col-span-full rounded-md border p-8 text-center text-xs'>
              Empty
            </div>
          )}
        </div>
      ) : (
        <div className='overflow-hidden rounded-md border'>
          <div className='bg-muted/50 text-muted-foreground grid grid-cols-[40px_1fr_90px_80px_60px] px-2 py-1 text-[10px] tracking-wide uppercase'>
            <div />
            <div>Name</div>
            <div>Type</div>
            <div>Size</div>
            <div />
          </div>
          <div className='divide-y text-sm'>
            {sortedFolders.map((f) => (
              <div
                key={f.id}
                className='hover:bg-muted/40 grid grid-cols-[40px_1fr_90px_80px_60px] items-center px-2 py-2 text-xs'
              >
                <div>
                  <Icons.folder className='size-5 text-amber-500' />
                </div>
                <div className='flex w-full items-center gap-2'>
                  {renamingId === f.id ? (
                    <input
                      ref={renameInputRef}
                      defaultValue={f.name}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          submitRename(f, (e.target as HTMLInputElement).value);
                        } else if (e.key === 'Escape') {
                          setRenamingId(null);
                        }
                      }}
                      className='bg-background/80 focus:ring-primary/40 w-full rounded border px-1 py-1 text-xs outline-none focus:ring-1'
                    />
                  ) : (
                    <button
                      className='cursor-pointer truncate pr-1 text-left whitespace-nowrap hover:underline'
                      title={f.name}
                      onClick={() => {
                        setParentId(f.id);
                        setBreadcrumb((prev) => [
                          ...prev,
                          { id: f.id, name: f.name }
                        ]);
                      }}
                    >
                      {displayName(f.name)}
                    </button>
                  )}
                </div>
                <div className='text-muted-foreground text-[10px]'>Folder</div>
                <div className='text-[10px]' />
                <div className='flex justify-end'>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className='text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer rounded-md p-1'>
                        <Icons.ellipsis className='size-4' />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='end' className='text-xs'>
                      <DropdownMenuItem onClick={() => startRename(f)}>
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => deleteItem(f)}
                        className='text-destructive focus:text-destructive'
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
            {sortedFiles.map((f) => (
              <div
                key={f.id}
                className='hover:bg-muted/40 grid grid-cols-[40px_1fr_90px_80px_60px] items-center px-2 py-2 text-xs'
              >
                <div>
                  <Icons.file className='text-primary size-5' />
                </div>
                <div className='flex w-full items-center gap-2'>
                  {renamingId === f.id ? (
                    <input
                      ref={renameInputRef}
                      defaultValue={f.name}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          submitRename(f, (e.target as HTMLInputElement).value);
                        } else if (e.key === 'Escape') {
                          setRenamingId(null);
                        }
                      }}
                      className='bg-background/80 focus:ring-primary/40 w-full rounded border px-1 py-1 text-xs outline-none focus:ring-1'
                    />
                  ) : (
                    <button
                      className='cursor-pointer truncate pr-1 text-left whitespace-nowrap hover:underline'
                      title={f.name}
                      onClick={() => void openFile(f, false)}
                    >
                      {displayName(f.name)}
                    </button>
                  )}
                </div>
                <div className='text-muted-foreground text-[10px] uppercase'>
                  {f.ext || f.mime_type?.split('/')?.[1] || 'FILE'}
                </div>
                <div className='text-[10px]'>{formatSize(f.size_bytes)}</div>
                <div className='flex justify-end'>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className='text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer rounded-md p-1'>
                        <Icons.ellipsis className='size-4' />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='end' className='text-xs'>
                      <DropdownMenuItem onClick={() => void openFile(f, false)}>
                        Open
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void openFile(f, true)}>
                        Download
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => startRename(f)}>
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => deleteItem(f)}
                        className='text-destructive focus:text-destructive'
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
            {!loading && items.length === 0 && (
              <div className='text-muted-foreground py-6 text-center text-xs'>
                Empty
              </div>
            )}
          </div>
        </div>
      )}
      {loading && (
        <div className='from-primary via-primary/40 to-primary absolute inset-x-0 top-0 h-0.5 animate-[pulse_2s_ease-in-out_infinite] bg-gradient-to-r' />
      )}
    </div>
  );
}

function mapError(code?: string): string {
  switch (code) {
    case 'UNAUTHENTICATED':
      return 'Please sign in to view your files.';
    case 'NAME_REQUIRED':
      return 'Folder name cannot be empty.';
    case 'NAME_CONFLICT':
      return 'A folder with this name already exists here.';
    case 'LOAD_FAILED':
      return 'Unable to load files.';
    case 'BUCKET_NOT_FOUND':
      return 'Storage bucket "files" bulunamadı veya politikalar erişimi engelliyor. Supabase Storage > files bucket oluştur / politikaları ekle.';
    case 'NO_STORAGE_PATH':
      return 'Dosya yolu kayıtlı değil.';
    case 'FILE_URL_UNAVAILABLE':
      return 'Dosya URL üretilemedi.';
    case 'NOT_FOUND':
      return 'Kayıt bulunamadı.';
    case 'FORBIDDEN':
      return 'Bu dosyayı silme yetkin yok.';
    case 'FOLDER_NOT_EMPTY':
      return 'Klasör boş değil.';
    case 'OPEN_FAILED':
      return 'Dosya açılamadı (detay için console bak).';
    // Raw messages we sometimes surface from Supabase SDK:
    case 'new row violates row-level security policy for table "objects"':
    case 'permission denied for table objects':
      return 'RLS engeli: Path ilk segmenti user id ile eşleşmiyor veya oturum yok.';
    case 'JWT expired':
      return 'Oturum süresi doldu, yeniden giriş yap.';
    case 'Invalid JWT':
      return 'Oturum geçersiz, çıkış yapıp tekrar giriş deneyin.';
    default:
      return code || 'Unknown error';
  }
}

// DEBUG YARDIMI: Tarayıcı console’da şu komutları çalıştırabilirsin:
// 1) (await supabase.auth.getUser()).data.user?.id  -> client user id
// 2) await supabase.storage.from('files').createSignedUrl('<storage_path>', 60)
// 3) Karşılaştır: storage_path ilk segment == user id ?
// 4) Hata RLS ise politika koşulu: bucket_id='files' AND split_part(name,'/',1)=auth.uid()::text
