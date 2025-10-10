'use client';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import JSZip from 'jszip';
import { toast } from 'sonner';
import FileUploader from '@/components/file-uploader';
import UploadDialog from '@/features/files/components/upload-dialog';
import ShareDialog from '@/features/files/components/share-dialog';
import { supabase } from '@/lib/supabaseClient';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem
} from '@/components/ui/context-menu';

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
  is_starred?: boolean;
}

// Helpers for filename handling (hide extensions on UI)
function isUuid(s: string | null | undefined): boolean {
  if (!s) return false;
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    s
  );
}
function baseName(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx > 0 ? name.slice(0, idx) : name;
}
function extension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx > 0 ? name.slice(idx + 1).toLowerCase() : '';
}
function visibleName(item: FileItem): string {
  return item.type === 'folder' ? item.name : baseName(item.name);
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
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [sharePath, setSharePath] = useState<string | null>(null);
  const [dropHoverId, setDropHoverId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [starOnly, setStarOnly] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderForm, setNewFolderForm] = useState<{
    name: string;
    color: 'blue' | 'violet' | 'green' | 'amber' | 'rose';
    include: Set<string>;
    star: boolean;
    genLinks: boolean;
    visibility: 'public' | 'private';
  }>({
    name: '',
    color: 'blue',
    include: new Set(),
    star: false,
    genLinks: false,
    visibility: 'private'
  });
  const [folderColors, setFolderColors] = useState<Record<string, string>>({});
  const [zipBusyId, setZipBusyId] = useState<string | null>(null);
  const [shareLinks, setShareLinks] = useState<
    { name: string; url: string }[] | null
  >(null);

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

  // Load & persist folder colors (client-only visual)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('folderColors');
      if (raw) setFolderColors(JSON.parse(raw));
    } catch {}
  }, []);
  const setFolderColor = useCallback((id: string, color: string) => {
    setFolderColors((prev) => {
      const next = { ...prev, [id]: color };
      try {
        localStorage.setItem('folderColors', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  // Direct creation helper to avoid stale state issues
  const createFolderDirect = useCallback(
    async (name: string) => {
      if (!name.trim()) return null;
      setCreating(true);
      try {
        const res = await fetch('/api/noblesuite/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, parentId, type: 'folder' })
        });
        const json = await res.json();
        if (!json.ok) {
          setError(mapError(json.error));
          return null;
        }
        const created: FileItem = {
          id: json.item.id,
          name: json.item.name,
          parent_id: json.item.parent_id,
          type: 'folder',
          updated_at: new Date().toISOString()
        } as FileItem;
        setItems((prev) => [created, ...prev]);
        return created;
      } finally {
        setCreating(false);
      }
    },
    [parentId]
  );

  const atRoot = parentId == null;
  const itemsSource = starOnly ? items.filter((i) => i.is_starred) : items;
  const folders = itemsSource.filter((i) => i.type === 'folder');
  const files = itemsSource.filter((i) => i.type !== 'folder');

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

  const toggleStar = async (item: FileItem) => {
    const prev = items;
    const nextStar = !item.is_starred;
    // optimistic toggle
    setItems((p) =>
      p.map((it) => (it.id === item.id ? { ...it, is_starred: nextStar } : it))
    );
    const res = await fetch(`/api/noblesuite/files/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_starred: nextStar })
    });
    const json = await res.json();
    if (!json.ok) {
      setItems(prev); // revert
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

  // Helper: Download folder contents as a ZIP (recursively)
  const downloadFolderZip = useCallback(async (folder: FileItem) => {
    if (folder.type !== 'folder') return;
    setZipBusyId(folder.id);
    try {
      const zip = new JSZip();
      const sanitize = (s: string) =>
        s.replace(/[\0-\x1F\x7F<>:\"|?*\\/]+/g, '_');

      async function fetchChildren(parent: string | null) {
        const params = new URLSearchParams();
        if (parent) params.set('parentId', parent);
        const res = await fetch(`/api/noblesuite/files?${params.toString()}`);
        const json = await res.json();
        if (!json?.ok) return [] as FileItem[];
        return json.items as FileItem[];
      }

      async function addFolderToZip(folderId: string, pathPrefix: string) {
        const children = await fetchChildren(folderId);
        for (const child of children) {
          if (child.type === 'folder') {
            await addFolderToZip(
              child.id,
              `${pathPrefix}/${sanitize(child.name)}`
            );
          } else if (child.storage_path) {
            let fileUrl: string | undefined;
            try {
              const { data: signed } = await supabase.storage
                .from(FILES_BUCKET)
                .createSignedUrl(child.storage_path, 300);
              fileUrl = signed?.signedUrl || undefined;
              if (!fileUrl) {
                const pub = supabase.storage
                  .from(FILES_BUCKET)
                  .getPublicUrl(child.storage_path);
                fileUrl = pub.data?.publicUrl || undefined;
              }
            } catch {
              const pub = supabase.storage
                .from(FILES_BUCKET)
                .getPublicUrl(child.storage_path);
              fileUrl = pub.data?.publicUrl || undefined;
            }
            if (!fileUrl) continue;
            const resp = await fetch(fileUrl);
            if (!resp.ok) continue;
            const blob = await resp.blob();
            zip.file(
              `${pathPrefix}/${sanitize(child.name)}` || sanitize(child.name),
              blob
            );
          }
        }
      }

      await addFolderToZip(folder.id, sanitize(folder.name));
      const out = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(out);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sanitize(folder.name)}.zip`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
      }, 0);
    } catch (e: any) {
      setError(e?.message || 'ZIP_FAILED');
    } finally {
      setZipBusyId(null);
    }
  }, []);

  const startRename = (item: FileItem) => {
    setRenamingId(item.id);
    setTimeout(() => renameInputRef.current?.focus(), 0);
  };

  const submitRename = async (item: FileItem, newName: string) => {
    const trimmed = newName.trim();
    // Recombine with original extension for files
    const oldExt =
      item.type !== 'folder' ? item.ext || extension(item.name) : '';
    const finalName =
      item.type !== 'folder' && oldExt ? `${trimmed}.${oldExt}` : trimmed;
    if (!trimmed || finalName === item.name) {
      setRenamingId(null);
      return;
    }
    const prev = items;
    setItems((p) =>
      p.map((i) => (i.id === item.id ? { ...i, name: finalName } : i))
    );
    const res = await fetch(`/api/noblesuite/files/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: finalName })
    });
    const json = await res.json();
    if (!json.ok) {
      setItems(prev);
      setError(mapError(json.error));
    }
    setRenamingId(null);
    refreshBreadcrumbNames({ ...item, name: finalName });
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
  const folderMeta = useMemo(() => {
    const byParent: Record<string, { count: number; size: number }> = {};
    items.forEach((i) => {
      const pid = i.parent_id || 'root-none';
      if (!byParent[pid]) byParent[pid] = { count: 0, size: 0 };
      if (i.type !== 'folder') byParent[pid].size += i.size_bytes || 0;
      byParent[pid].count += 1;
    });
    return byParent;
  }, [items]);
  const sortedFiles = [...files].sort(compare);
  const visibleList = useMemo(
    () => [...sortedFolders, ...sortedFiles],
    [sortedFolders, sortedFiles]
  );
  const idToIndex = useMemo(() => {
    const m: Record<string, number> = {};
    visibleList.forEach((it, idx) => (m[it.id] = idx));
    return m;
  }, [visibleList]);

  const sortLabel = () => {
    if (sortKey === 'updated')
      return `Sort By: ${sortDir === 'desc' ? 'Latest' : 'Oldest'}`;
    if (sortKey === 'name')
      return `Sort By: ${sortDir === 'asc' ? 'Name A→Z' : 'Name Z→A'}`;
    if (sortKey === 'size')
      return `Sort By: ${sortDir === 'desc' ? 'Largest' : 'Smallest'}`;
    if (sortKey === 'type')
      return `Sort By: ${sortDir === 'asc' ? 'Type A→Z' : 'Type Z→A'}`;
    return 'Sort By';
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

  function formatDate(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  // Image thumbnails
  const isImage = (f: FileItem) => {
    const ext = (f.ext || '').toLowerCase();
    return (
      (f.mime_type || '').startsWith('image/') ||
      ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)
    );
  };

  const getKind = (
    f: FileItem
  ): 'image' | 'video' | 'audio' | 'archive' | 'code' | 'doc' | 'file' => {
    if (f.type === 'folder') return 'file';
    const mime = (f.mime_type || '').toLowerCase();
    const ext = (f.ext || '').toLowerCase();
    if (isImage(f)) return 'image';
    if (
      mime.startsWith('video/') ||
      ['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext)
    )
      return 'video';
    if (
      mime.startsWith('audio/') ||
      ['mp3', 'wav', 'flac', 'm4a', 'ogg'].includes(ext)
    )
      return 'audio';
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext))
      return 'archive';
    if (
      [
        'js',
        'ts',
        'tsx',
        'jsx',
        'py',
        'rb',
        'go',
        'rs',
        'java',
        'cs',
        'php',
        'html',
        'css',
        'json',
        'yml',
        'yaml',
        'md',
        'sh',
        'bat',
        'ps1'
      ].includes(ext)
    )
      return 'code';
    if (
      [
        'pdf',
        'doc',
        'docx',
        'xls',
        'xlsx',
        'ppt',
        'pptx',
        'txt',
        'rtf'
      ].includes(ext)
    )
      return 'doc';
    return 'file';
  };

  const renderFileIcon = (f: FileItem, sizeClass = 'size-7') => {
    const kind = getKind(f);
    if (kind === 'image' && thumbUrls[f.id]) {
      return (
        <img
          src={thumbUrls[f.id]}
          alt=''
          className={`${sizeClass} shrink-0 rounded object-cover`}
        />
      );
    }
    const iconProps = { className: `${sizeClass} shrink-0` } as const;
    switch (kind) {
      case 'video':
        return (
          <Icons.video
            {...iconProps}
            className={`text-purple-500 ${iconProps.className}`}
          />
        );
      case 'audio':
        return (
          <Icons.audio
            {...iconProps}
            className={`text-emerald-500 ${iconProps.className}`}
          />
        );
      case 'archive':
        return (
          <Icons.archive
            {...iconProps}
            className={`text-amber-600 ${iconProps.className}`}
          />
        );
      case 'code':
        return (
          <Icons.code
            {...iconProps}
            className={`text-blue-500 ${iconProps.className}`}
          />
        );
      case 'doc':
        return (
          <Icons.doc
            {...iconProps}
            className={`text-cyan-600 ${iconProps.className}`}
          />
        );
      case 'file':
      default:
        return (
          <Icons.file
            {...iconProps}
            className={`text-primary ${iconProps.className}`}
          />
        );
    }
  };

  const folderColorClass = (id: string) => {
    const c = folderColors[id] || 'blue';
    const map: Record<string, string> = {
      blue: 'text-blue-500',
      violet: 'text-violet-500',
      green: 'text-green-500',
      amber: 'text-amber-500',
      rose: 'text-rose-500'
    };
    return map[c] || 'text-blue-500';
  };
  useEffect(() => {
    // generate signed/public urls for image files in view
    (async () => {
      const promises = visibleList
        .filter(
          (f) =>
            f.type !== 'folder' &&
            isImage(f) &&
            f.storage_path &&
            !thumbUrls[f.id]
        )
        .map(async (f) => {
          try {
            const { data: signed, error } = await supabase.storage
              .from(FILES_BUCKET)
              .createSignedUrl(f.storage_path!, 120);
            if (!error && signed?.signedUrl)
              return { id: f.id, url: signed.signedUrl };
            const pub = supabase.storage
              .from(FILES_BUCKET)
              .getPublicUrl(f.storage_path!);
            return { id: f.id, url: pub.data?.publicUrl || '' };
          } catch {
            return { id: f.id, url: '' };
          }
        });
      if (promises.length) {
        const results = await Promise.all(promises);
        setThumbUrls((prev) => {
          const next = { ...prev };
          results.forEach((r) => {
            if (r.url) next[r.id] = r.url;
          });
          return next;
        });
      }
    })();
  }, [visibleList, thumbUrls]);

  // Selection helpers
  const clearSelection = () => setSelectedIds(new Set());
  const selectSingle = (id: string) => {
    if (!selectMode) return; // gating selection behind select mode
    setSelectedIds(new Set([id]));
    setAnchorId(id);
  };
  const toggleCtrl = (id: string) => {
    if (!selectMode) return; // gating
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setAnchorId(id);
  };
  const selectRange = (toId: string, additive = false) => {
    if (!selectMode) return; // gating
    if (!anchorId) return selectSingle(toId);
    const a = idToIndex[anchorId];
    const b = idToIndex[toId];
    if (a == null || b == null) return selectSingle(toId);
    const [start, end] = a < b ? [a, b] : [b, a];
    const rangeIds = new Set<string>();
    for (let i = start; i <= end; i++) rangeIds.add(visibleList[i].id);
    setSelectedIds((prev) =>
      additive ? new Set([...prev, ...rangeIds]) : rangeIds
    );
  };
  const isSelected = (id: string) => selectMode && selectedIds.has(id);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping =
        ['INPUT', 'TEXTAREA'].includes(target?.tagName || '') ||
        target?.closest('[contenteditable="true"]');
      const hasSelection = selectedIds.size > 0;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (
        !isTyping &&
        e.key === 'Enter' &&
        selectMode &&
        selectedIds.size === 1
      ) {
        e.preventDefault();
        const id = Array.from(selectedIds)[0];
        const it = items.find((i) => i.id === id);
        if (it) {
          if (it.type === 'folder') {
            if (!isUuid(it.id)) return;
            setParentId(it.id);
            setBreadcrumb((prev) => [...prev, { id: it.id, name: it.name }]);
          } else void openFile(it, false);
        }
        return;
      }
      if (!isTyping && e.key === 'F2' && selectMode && selectedIds.size === 1) {
        e.preventDefault();
        const id = Array.from(selectedIds)[0];
        const it = items.find((i) => i.id === id);
        if (it) startRename(it);
        return;
      }
      if (
        !isTyping &&
        (e.key === 'Delete' || e.key === 'Backspace') &&
        selectMode &&
        hasSelection
      ) {
        e.preventDefault();
        const ids = Array.from(selectedIds);
        ids.forEach((id) => {
          const it = items.find((i) => i.id === id);
          if (it) void deleteItem(it);
        });
        clearSelection();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedIds, items, breadcrumb, parentId]);

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

  // Single-file wrapper to reuse existing upload pipeline for the dialog
  const uploadOne = useCallback(
    async (f: File, onProgress?: (p: number) => void) => {
      // Create metadata + path
      const resp = await fetch('/api/noblesuite/files/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: f.name, fileType: f.type, parentId })
      });
      const json = await resp.json();
      if (!json.ok) throw new Error(mapError(json.error));
      const { path, fileId } = json;

      // Use XHR to report real-time progress. Construct the public upload endpoint.
      // Supabase Storage endpoint format: https://<project>.supabase.co/storage/v1/object/{bucket}/{path}
      const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(
        /\/$/,
        ''
      );
      const uploadUrl = `${baseUrl}/storage/v1/object/${encodeURIComponent(FILES_BUCKET)}/${encodeURIComponent(path)}`;

      // Retrieve current session access token to authorize the upload request.
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', uploadUrl, true);
        if (accessToken)
          xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
        // Content-Type should match the file type; Supabase infers if omitted but we set for correctness.
        if (f.type) xhr.setRequestHeader('Content-Type', f.type);
        // Avoid CORS preflight complications by not adding non-simple headers unnecessarily.

        xhr.upload.onprogress = (e) => {
          if (!e.lengthComputable) return;
          const pct = (e.loaded / e.total) * 100;
          onProgress?.(pct);
        };
        xhr.onerror = () => reject(new Error('UPLOAD_NETWORK_ERROR'));
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`UPLOAD_FAILED_${xhr.status}`));
        };
        xhr.send(f);
      });

      await supabase
        .from('files')
        .update({ size_bytes: f.size })
        .eq('id', fileId);
      // Optimistic add
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
    },
    [parentId]
  );

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
        const types = Array.from((e.dataTransfer?.types as any) || []);
        const hasFiles = types.includes('Files');
        setDndActive(hasFiles);
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
        <h2 className='text-lg font-semibold tracking-tight'>Documents</h2>
        <div className='flex items-center gap-2'>
          {/* New menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size='sm' variant='default' className='gap-1'>
                <Icons.add className='size-4' /> New
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='start' className='w-44 text-xs'>
              <DropdownMenuItem onClick={() => setShowNewFolder(true)}>
                New Folder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowUpload(true)}>
                Upload Files
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Filters */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size='sm' variant='outline' className='gap-1'>
                <Icons.filter className='size-4' /> Filters
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='start' className='w-44 text-xs'>
              <DropdownMenuItem
                onClick={() => setStarOnly((v) => !v)}
                className='flex items-center gap-2'
              >
                {starOnly ? (
                  <Icons.check className='text-primary size-4' />
                ) : (
                  <span className='inline-block size-4' />
                )}
                Starred only
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Sort By */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size='sm' variant='outline' className='gap-1'>
                {sortLabel()}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='start' className='w-44 text-xs'>
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
        <div className='ml-auto flex items-center gap-2'>
          <div className='relative'>
            <input
              placeholder='Search...'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              ref={searchInputRef}
              className='bg-background focus-visible:ring-primary/40 h-8 w-52 rounded-md border px-2 text-xs focus-visible:ring-2 focus-visible:outline-none'
            />
          </div>
          <Button
            size='sm'
            variant='outline'
            onClick={() => setViewMode((v) => (v === 'grid' ? 'list' : 'grid'))}
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
          <Button
            size='sm'
            variant={selectMode ? 'default' : 'outline'}
            onClick={() => {
              setSelectMode((v) => !v);
              if (selectMode) clearSelection();
            }}
            className='gap-1'
          >
            <Icons.check className='size-4' />
            <span className='hidden sm:inline'>
              {selectMode ? 'Done' : 'Select files'}
            </span>
          </Button>
        </div>
      </div>
      <div className='text-foreground flex flex-wrap items-center gap-1 text-sm md:text-base'>
        {breadcrumb.map((b, idx) => (
          <span
            key={`${b.id ?? 'root'}-${idx}`}
            className='flex items-center gap-1'
          >
            <button
              className={cn(
                'transition-colors hover:underline',
                b.id === parentId
                  ? 'text-foreground font-semibold'
                  : 'text-muted-foreground'
              )}
              onClick={() => {
                if (b.id && !isUuid(b.id)) return; // ignore invalid id crumbs
                setParentId(b.id);
                setBreadcrumb((prev) => prev.slice(0, idx + 1));
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }}
              onDrop={async (e) => {
                e.preventDefault();
                try {
                  const raw =
                    e.dataTransfer.getData('text/plain') ||
                    e.dataTransfer.getData('application/json');
                  let ids: string[] = [];
                  try {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed?.ids)) ids = parsed.ids;
                  } catch {}
                  if (!ids.length) return;
                  const prevItems = items;
                  setItems((p) => p.filter((it) => !ids.includes(it.id)));
                  const res = await Promise.all(
                    ids.map((id) =>
                      fetch(`/api/noblesuite/files/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ parentId: b.id || null })
                      })
                    )
                  );
                  if (res.some((r) => !r.ok)) setItems(prevItems);
                  void load();
                } catch {}
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
      <UploadDialog
        open={showUpload}
        onOpenChange={(o: boolean) => {
          setShowUpload(o);
          if (!o) setDndActive(false);
        }}
        uploadOne={async (file: File, onProgress?: (p: number) => void) => {
          setUploading(true);
          try {
            await uploadOne(file, onProgress);
          } finally {
            setUploading(false);
            setUploadProgress(null);
          }
          // After each file, refresh list lazily
          void load();
        }}
      />
      <ShareDialog
        open={!!sharePath}
        onOpenChange={(o) => {
          if (!o) setSharePath(null);
        }}
        bucket={FILES_BUCKET}
        storagePath={sharePath || ''}
      />

      {/* Floating bottom selection bar (only in select mode) */}
      {selectMode && selectedIds.size > 0 && (
        <div className='pointer-events-auto fixed inset-x-0 bottom-4 z-20 flex justify-center px-4'>
          <div className='bg-card/95 supports-[backdrop-filter]:bg-card/70 flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs shadow-2xl backdrop-blur'>
            <div className='flex items-center gap-2 pr-2'>
              <Icons.check className='text-primary size-4' />
              <span className='font-medium'>{selectedIds.size} selected</span>
            </div>
            <div className='bg-muted mx-1 h-4 w-px' />
            {selectedIds.size === 1 && (
              <Button
                size='sm'
                variant='ghost'
                className='gap-1'
                onClick={() => {
                  const id = Array.from(selectedIds)[0];
                  const it = items.find((i) => i.id === id);
                  if (it) {
                    if (it.type === 'folder') {
                      if (!isUuid(it.id)) return;
                      setParentId(it.id);
                      setBreadcrumb((prev) => [
                        ...prev,
                        { id: it.id, name: it.name }
                      ]);
                    } else void openFile(it, false);
                  }
                }}
              >
                <Icons.external className='size-4' />
                Open
              </Button>
            )}
            <Button
              size='sm'
              variant='ghost'
              className='gap-1'
              onClick={() => {
                const ids = Array.from(selectedIds);
                ids.forEach((id) => {
                  const it = items.find((i) => i.id === id);
                  if (it && it.type !== 'folder') void openFile(it, true);
                });
              }}
            >
              <Icons.download className='size-4' />
              Download
            </Button>
            <Button
              size='sm'
              variant='ghost'
              className='text-destructive gap-1'
              onClick={() => {
                const ids = Array.from(selectedIds);
                ids.forEach((id) => {
                  const it = items.find((i) => i.id === id);
                  if (it) void deleteItem(it);
                });
                clearSelection();
              }}
            >
              <Icons.trash className='size-4' />
              Delete
            </Button>
            <div className='bg-muted mx-1 h-4 w-px' />
            <Button
              size='sm'
              variant='secondary'
              className='gap-1'
              onClick={clearSelection}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* CONTENT: Sections - Folders, Recent, All Files */}
      {/* Folders */}
      {sortedFolders.length > 0 && (
        <div className='space-y-2'>
          <div className='text-muted-foreground text-xs font-medium tracking-wide'>
            Folders
          </div>
          <div
            className={cn(
              'relative grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4 transition',
              dndActive && 'ring-primary/60 bg-primary/5 rounded-md p-3 ring-2'
            )}
          >
            {sortedFolders.map((f) => (
              <ContextMenu key={`ctx-${f.id}`}>
                <ContextMenuTrigger asChild>
                  <div
                    key={f.id}
                    className={cn(
                      'group from-card/80 to-background hover:from-card hover:to-card hover:border-primary/40 relative flex flex-col gap-2 overflow-hidden rounded-xl border bg-gradient-to-br p-4 shadow-sm transition hover:shadow-md',
                      isSelected(f.id) && 'ring-primary/60 ring-2',
                      dropHoverId === f.id && 'ring-2 ring-amber-400/70'
                    )}
                    draggable
                    onDragStart={(e) => {
                      const ids =
                        selectedIds.size > 0 && selectedIds.has(f.id)
                          ? Array.from(selectedIds)
                          : [f.id];
                      const payload = JSON.stringify({ ids });
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', payload);
                      e.dataTransfer.setData('application/json', payload);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      setDropHoverId(f.id);
                    }}
                    onDrop={async (e) => {
                      e.preventDefault();
                      setDropHoverId((prev) => (prev === f.id ? null : prev));
                      try {
                        const raw =
                          e.dataTransfer.getData('text/plain') ||
                          e.dataTransfer.getData('application/json');
                        let ids: string[] = [];
                        try {
                          const parsed = JSON.parse(raw);
                          if (Array.isArray(parsed?.ids)) ids = parsed.ids;
                        } catch {
                          // noop
                        }
                        const moveIds = (ids || []).filter(
                          (id) => id && id !== f.id
                        );
                        if (moveIds.length === 0) return;
                        const prevItems = items;
                        setItems((p) =>
                          p.filter((it) => !moveIds.includes(it.id))
                        );
                        const res = await Promise.all(
                          moveIds.map((id) =>
                            fetch(`/api/noblesuite/files/${id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ parentId: f.id })
                            })
                          )
                        );
                        if (res.some((r) => !r.ok)) setItems(prevItems);
                        void load();
                      } catch {}
                    }}
                    onDragLeave={() => {
                      setDropHoverId((prev) => (prev === f.id ? null : prev));
                    }}
                  >
                    <div className='flex w-full min-w-0 items-start gap-3'>
                      {renamingId === f.id ? (
                        <div className='flex flex-1 items-center gap-3'>
                          <Icons.folderFilled
                            className={cn(
                              'size-9 shrink-0 drop-shadow',
                              folderColorClass(f.id)
                            )}
                          />
                          <input
                            ref={renameInputRef}
                            defaultValue={f.name}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                submitRename(
                                  f,
                                  (e.target as HTMLInputElement).value
                                );
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
                          onClick={(e) => {
                            if (e.shiftKey)
                              return selectRange(f.id, e.ctrlKey || e.metaKey);
                            if (e.ctrlKey || e.metaKey) return toggleCtrl(f.id);
                            // normal click navigates, do not select unless in select mode
                            if (selectMode) selectSingle(f.id);
                            if (!isUuid(f.id)) return;
                            setParentId(f.id);
                            setBreadcrumb((prev) => {
                              const existingIdx = prev.findIndex(
                                (c) => c.id === f.id
                              );
                              if (existingIdx !== -1)
                                return prev.slice(0, existingIdx + 1);
                              return [...prev, { id: f.id, name: f.name }];
                            });
                          }}
                          title={f.name}
                          data-selected={isSelected(f.id) || undefined}
                        >
                          <Icons.folderFilled
                            className={cn(
                              'size-9 shrink-0 drop-shadow',
                              folderColorClass(f.id)
                            )}
                          />
                          <span
                            className='min-w-0 flex-1 truncate pr-1 whitespace-nowrap'
                            title={f.name}
                          >
                            {displayName(f.name)}
                          </span>
                          {f.is_starred ? (
                            <Icons.starFilled className='size-4 shrink-0 text-amber-500' />
                          ) : null}
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
                          <DropdownMenuItem onClick={() => toggleStar(f)}>
                            {f.is_starred ? 'Unstar' : 'Star'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => downloadFolderZip(f)}
                            disabled={zipBusyId === f.id}
                          >
                            {zipBusyId === f.id
                              ? 'Zipping…'
                              : 'Download as ZIP'}
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
                      <span>{`${folderMeta[f.id]?.count || 0} Files`}</span>
                      <span>{formatSize(folderMeta[f.id]?.size || 0)}</span>
                    </div>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent className='text-xs'>
                  <ContextMenuItem onClick={() => startRename(f)}>
                    Rename
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => toggleStar(f)}>
                    {f.is_starred ? 'Unstar' : 'Star'}
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => downloadFolderZip(f)}
                    disabled={zipBusyId === f.id}
                  >
                    {zipBusyId === f.id ? 'Zipping…' : 'Download as ZIP'}
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => deleteItem(f)}
                    data-variant='destructive'
                  >
                    Delete
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))}
          </div>
        </div>
      )}

      {/* Recent (only at root) */}
      {atRoot &&
        files.length > 0 &&
        (() => {
          const recent = [...files]
            .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
            .slice(0, 6);
          return recent.length ? (
            <div className='space-y-2'>
              <div className='text-muted-foreground text-xs font-medium tracking-wide'>
                Recent
              </div>
              <div className='no-scrollbar flex gap-3 overflow-x-auto pb-1'>
                {recent.map((f) => (
                  <ContextMenu key={`recent-${f.id}`}>
                    <ContextMenuTrigger asChild>
                      <button
                        className='bg-card hover:bg-card/80 min-w-[220px] rounded-xl border px-3 py-2 text-left shadow-sm transition md:min-w-[260px]'
                        title={f.name}
                        onClick={(e) => {
                          if (selectMode) return toggleCtrl(f.id);
                          void openFile(f, false);
                        }}
                      >
                        <div className='flex items-center gap-2'>
                          {renderFileIcon(f, 'size-8')}
                          <div className='min-w-0'>
                            <div className='truncate text-sm font-medium'>
                              {visibleName(f)}
                            </div>
                            <div className='text-muted-foreground text-[11px]'>
                              {formatDate(f.updated_at)} •{' '}
                              {formatSize(f.size_bytes)}
                            </div>
                          </div>
                        </div>
                      </button>
                    </ContextMenuTrigger>
                    <ContextMenuContent className='text-xs'>
                      <ContextMenuItem onClick={() => void openFile(f, false)}>
                        Open
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => void openFile(f, true)}>
                        Download
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => startRename(f)}>
                        Rename
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => toggleStar(f)}>
                        {f.is_starred ? 'Unstar' : 'Star'}
                      </ContextMenuItem>
                      {f.storage_path ? (
                        <ContextMenuItem
                          onClick={() => setSharePath(f.storage_path!)}
                        >
                          Share link
                        </ContextMenuItem>
                      ) : null}
                      <ContextMenuItem
                        onClick={() => deleteItem(f)}
                        data-variant='destructive'
                      >
                        Delete
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))}
              </div>
            </div>
          ) : null;
        })()}

      {/* All Files */}
      <div className='space-y-2'>
        <div className='text-muted-foreground text-xs font-medium tracking-wide'>
          All Files
        </div>
        {viewMode === 'grid' ? (
          <div
            className={cn(
              'relative grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4 transition',
              dndActive && 'ring-primary/60 bg-primary/5 rounded-md p-3 ring-2'
            )}
          >
            {sortedFiles.map((f) => (
              <ContextMenu key={`ctx-${f.id}`}>
                <ContextMenuTrigger asChild>
                  <div
                    key={f.id}
                    className={cn(
                      'group from-card/80 to-background hover:from-card hover:to-card hover:border-primary/40 relative flex flex-col gap-2 overflow-hidden rounded-xl border bg-gradient-to-br p-4 shadow-sm transition hover:shadow-md',
                      isSelected(f.id) && 'ring-primary/60 ring-2'
                    )}
                    draggable
                    onDragStart={(e) => {
                      const ids =
                        selectedIds.size > 0 && selectedIds.has(f.id)
                          ? Array.from(selectedIds)
                          : [f.id];
                      e.dataTransfer.setData(
                        'application/json',
                        JSON.stringify({ ids })
                      );
                    }}
                  >
                    <div className='flex w-full min-w-0 items-start gap-3'>
                      {renamingId === f.id ? (
                        <div className='flex flex-1 items-center gap-3'>
                          {isImage(f) && thumbUrls[f.id] ? (
                            <img
                              src={thumbUrls[f.id]}
                              alt=''
                              className='size-9 shrink-0 rounded object-cover'
                            />
                          ) : (
                            <Icons.file className='text-primary size-7 shrink-0' />
                          )}
                          <input
                            ref={renameInputRef}
                            defaultValue={visibleName(f)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                submitRename(
                                  f,
                                  (e.target as HTMLInputElement).value
                                );
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
                          onClick={(e) => {
                            if (e.shiftKey)
                              return selectRange(f.id, e.ctrlKey || e.metaKey);
                            if (e.ctrlKey || e.metaKey) return toggleCtrl(f.id);
                            if (selectMode) selectSingle(f.id);
                            else void openFile(f, false);
                          }}
                          title={f.name}
                          data-selected={isSelected(f.id) || undefined}
                        >
                          {renderFileIcon(f, 'size-7')}
                          <span
                            className='min-w-0 flex-1 truncate pr-1 whitespace-nowrap'
                            title={f.name}
                          >
                            {displayName(f.name)}
                          </span>
                          {f.is_starred ? (
                            <Icons.starFilled className='size-4 shrink-0 text-amber-500' />
                          ) : null}
                        </button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className='text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer rounded-md p-1 opacity-0 transition group-hover:opacity-100'>
                            <Icons.ellipsis className='size-4' />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end' className='text-xs'>
                          <DropdownMenuItem
                            onClick={() => void openFile(f, false)}
                          >
                            Open
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => void openFile(f, true)}
                          >
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => startRename(f)}>
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleStar(f)}>
                            {f.is_starred ? 'Unstar' : 'Star'}
                          </DropdownMenuItem>
                          {f.storage_path ? (
                            <DropdownMenuItem
                              onClick={() => setSharePath(f.storage_path!)}
                            >
                              Share link
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem
                            onClick={() => deleteItem(f)}
                            className='text-destructive focus:text-destructive'
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className='text-muted-foreground flex items-center justify-between text-[11px]'>
                      <span className='bg-muted/60 rounded px-1.5 py-0.5 text-[10px] tracking-wide uppercase'>
                        {f.ext || f.mime_type?.split('/')?.[1] || 'FILE'}
                      </span>
                      <span className='truncate'>
                        {formatSize(f.size_bytes)}
                      </span>
                    </div>
                    <div className='text-muted-foreground text-[11px]'>
                      Updated {formatDate(f.updated_at)}
                    </div>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent className='text-xs'>
                  <ContextMenuItem onClick={() => void openFile(f, false)}>
                    Open
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => void openFile(f, true)}>
                    Download
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => startRename(f)}>
                    Rename
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => toggleStar(f)}>
                    {f.is_starred ? 'Unstar' : 'Star'}
                  </ContextMenuItem>
                  {f.storage_path ? (
                    <ContextMenuItem
                      onClick={() => setSharePath(f.storage_path!)}
                    >
                      Share link
                    </ContextMenuItem>
                  ) : null}
                  <ContextMenuItem
                    onClick={() => deleteItem(f)}
                    data-variant='destructive'
                  >
                    Delete
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))}
            {!loading && files.length === 0 && (
              <div className='col-span-full'>
                {search.trim() && items.length === 0 ? (
                  <div className='text-muted-foreground/80 bg-muted/10 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-10 text-center'>
                    <Icons.search className='size-8 opacity-60' />
                    <div className='text-sm font-medium'>
                      No results for “{search.trim()}”
                    </div>
                    <div className='text-xs'>
                      Try a different term or clear the search.
                    </div>
                    <div className='mt-2'>
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() => setSearch('')}
                      >
                        Clear search
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className='text-muted-foreground/70 bg-muted/10 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-10 text-center'>
                    <Icons.folder className='size-8 opacity-60' />
                    <div className='text-sm font-medium'>
                      {atRoot ? 'No files yet' : 'This folder is empty'}
                    </div>
                    <div className='text-xs'>
                      Drag and drop files here, upload, or create a new folder.
                    </div>
                    <div className='mt-2 flex gap-2'>
                      <Button
                        size='sm'
                        variant='secondary'
                        onClick={() => setShowUpload(true)}
                        className='gap-1'
                      >
                        <Icons.file className='size-4' /> Upload
                      </Button>
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() => nameInputRef.current?.focus()}
                        className='gap-1'
                      >
                        <Icons.add className='size-4' /> New Folder
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className='overflow-hidden rounded-md border'>
            <div className='bg-muted/50 text-muted-foreground grid grid-cols-[40px_1fr_120px_100px_120px] px-2 py-1 text-[10px] tracking-wide uppercase'>
              <div />
              <div>Name</div>
              <div>Type</div>
              <div>Size</div>
              <div>Updated</div>
            </div>
            <div className='divide-y text-sm'>
              {sortedFiles.map((f) => (
                <ContextMenu key={`ctx-row-${f.id}`}>
                  <ContextMenuTrigger asChild>
                    <div
                      key={f.id}
                      className={cn(
                        'hover:bg-muted/40 grid grid-cols-[40px_1fr_120px_100px_120px] items-center px-2 py-2 text-xs',
                        isSelected(f.id) && 'bg-primary/5'
                      )}
                      draggable
                      onDragStart={(e) => {
                        const ids =
                          selectedIds.size > 0 && selectedIds.has(f.id)
                            ? Array.from(selectedIds)
                            : [f.id];
                        e.dataTransfer.setData(
                          'application/json',
                          JSON.stringify({ ids })
                        );
                      }}
                    >
                      <div>{renderFileIcon(f, 'size-5')}</div>
                      <div className='flex w-full items-center gap-2'>
                        {renamingId === f.id ? (
                          <input
                            ref={renameInputRef}
                            defaultValue={f.name}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                submitRename(
                                  f,
                                  (e.target as HTMLInputElement).value
                                );
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
                            onClick={(e) => {
                              if (e.shiftKey)
                                return selectRange(
                                  f.id,
                                  e.ctrlKey || e.metaKey
                                );
                              if (e.ctrlKey || e.metaKey)
                                return toggleCtrl(f.id);
                              if (selectMode) selectSingle(f.id);
                              else void openFile(f, false);
                            }}
                          >
                            {displayName(f.name)}
                          </button>
                        )}
                        {f.is_starred ? (
                          <Icons.starFilled className='size-3 text-amber-500' />
                        ) : null}
                      </div>
                      <div className='text-muted-foreground text-[10px] uppercase'>
                        {f.ext || f.mime_type?.split('/')?.[1] || 'FILE'}
                      </div>
                      <div className='text-[10px]'>
                        {formatSize(f.size_bytes)}
                      </div>
                      <div className='text-[10px]'>
                        {formatDate(f.updated_at)}
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
                              onClick={() => void openFile(f, false)}
                            >
                              Open
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => void openFile(f, true)}
                            >
                              Download
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => startRename(f)}>
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleStar(f)}>
                              {f.is_starred ? 'Unstar' : 'Star'}
                            </DropdownMenuItem>
                            {f.storage_path ? (
                              <DropdownMenuItem
                                onClick={() => setSharePath(f.storage_path!)}
                              >
                                Share link
                              </DropdownMenuItem>
                            ) : null}
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
                  </ContextMenuTrigger>
                  <ContextMenuContent className='text-xs'>
                    <ContextMenuItem onClick={() => void openFile(f, false)}>
                      Open
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => void openFile(f, true)}>
                      Download
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => startRename(f)}>
                      Rename
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => toggleStar(f)}>
                      {f.is_starred ? 'Unstar' : 'Star'}
                    </ContextMenuItem>
                    {f.storage_path ? (
                      <ContextMenuItem
                        onClick={() => setSharePath(f.storage_path!)}
                      >
                        Share link
                      </ContextMenuItem>
                    ) : null}
                    <ContextMenuItem
                      onClick={() => deleteItem(f)}
                      data-variant='destructive'
                    >
                      Delete
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))}
              {!loading && items.length === 0 && (
                <div className='py-6 text-center text-xs'>
                  {search.trim() ? (
                    <div className='text-muted-foreground'>
                      No results for “{search.trim()}”.{' '}
                      <button
                        className='underline'
                        onClick={() => setSearch('')}
                      >
                        Clear search
                      </button>
                    </div>
                  ) : (
                    <div className='text-muted-foreground'>
                      {atRoot ? 'No files yet' : 'This folder is empty'}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {loading && (
        <div className='from-primary via-primary/40 to-primary absolute inset-x-0 top-0 h-0.5 animate-[pulse_2s_ease-in-out_infinite] bg-gradient-to-r' />
      )}

      {/* New Folder Dialog */}
      <Dialog
        open={showNewFolder}
        onOpenChange={(o: boolean) => setShowNewFolder(o)}
      >
        <DialogContent className='w-[60vw] sm:max-w-none'>
          <DialogHeader>
            <DialogTitle>Create new folder</DialogTitle>
            <DialogDescription>
              Choose a name, a color, and optionally include existing files.
            </DialogDescription>
          </DialogHeader>
          <div className='grid grid-cols-1 gap-6 md:grid-cols-5'>
            {/* Left: folder preview */}
            <div className='md:col-span-2'>
              <div className='bg-card relative flex h-60 flex-col rounded-xl border p-4 shadow-sm md:h-80'>
                {/* Star toggle */}
                <button
                  type='button'
                  onClick={() =>
                    setNewFolderForm((f) => ({ ...f, star: !f.star }))
                  }
                  className={cn(
                    'absolute top-3 right-3 rounded-md p-1 transition',
                    newFolderForm.star
                      ? 'text-amber-500 hover:bg-amber-500/10'
                      : 'text-muted-foreground hover:bg-muted/50'
                  )}
                  title={newFolderForm.star ? 'Unstar' : 'Star'}
                >
                  {newFolderForm.star ? (
                    <Icons.starFilled className='size-5' />
                  ) : (
                    <Icons.star className='size-5' />
                  )}
                </button>
                {/* Visibility badge */}
                <div className='absolute top-3 left-3'>
                  <span className='bg-muted/60 text-muted-foreground rounded px-2 py-0.5 text-[10px] tracking-wide uppercase'>
                    {newFolderForm.visibility === 'public'
                      ? 'Public'
                      : 'Private'}
                  </span>
                </div>
                <div className='flex flex-1 items-center justify-center'>
                  <Icons.folderFilled
                    className={cn(
                      'size-24 drop-shadow',
                      newFolderForm.color === 'blue' && 'text-blue-500',
                      newFolderForm.color === 'violet' && 'text-violet-500',
                      newFolderForm.color === 'green' && 'text-green-500',
                      newFolderForm.color === 'amber' && 'text-amber-500',
                      newFolderForm.color === 'rose' && 'text-rose-500'
                    )}
                  />
                </div>
                <div className='truncate text-center text-sm font-medium'>
                  {newFolderForm.name || 'New Folder'}
                </div>
                {/* Color picker at bottom */}
                <div className='mt-3'>
                  <div className='text-muted-foreground text-xs'>Color</div>
                  <div className='mt-2 flex gap-2'>
                    {(
                      [
                        { k: 'blue', cls: 'bg-blue-500' },
                        { k: 'violet', cls: 'bg-violet-500' },
                        { k: 'green', cls: 'bg-green-500' },
                        { k: 'amber', cls: 'bg-amber-500' },
                        { k: 'rose', cls: 'bg-rose-500' }
                      ] as const
                    ).map((c) => (
                      <button
                        key={c.k}
                        type='button'
                        className={cn(
                          'size-7 rounded-md ring-2 ring-transparent transition',
                          c.cls,
                          newFolderForm.color === c.k && 'ring-foreground/80'
                        )}
                        onClick={() =>
                          setNewFolderForm((f) => ({ ...f, color: c.k }))
                        }
                        title={c.k}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {/* Right: input fields */}
            <div className='space-y-4 md:col-span-3'>
              <div className='space-y-1'>
                <label className='text-xs font-medium'>Name</label>
                <input
                  value={newFolderForm.name}
                  onChange={(e) =>
                    setNewFolderForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder='e.g., Market Analysis'
                  className='bg-background mt-1 h-9 w-full rounded-md border px-2 text-sm'
                />
              </div>
              {/* Visibility selector */}
              <div className='space-y-1'>
                <label className='text-xs font-medium'>Visibility</label>
                <div className='inline-flex overflow-hidden rounded-md border text-xs'>
                  <button
                    type='button'
                    onClick={() =>
                      setNewFolderForm((f) => ({ ...f, visibility: 'public' }))
                    }
                    className={cn(
                      'px-3 py-1.5',
                      newFolderForm.visibility === 'public'
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    )}
                  >
                    Public
                  </button>
                  <button
                    type='button'
                    onClick={() =>
                      setNewFolderForm((f) => ({ ...f, visibility: 'private' }))
                    }
                    className={cn(
                      'border-l px-3 py-1.5',
                      newFolderForm.visibility === 'private'
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    )}
                  >
                    Private
                  </button>
                </div>
              </div>
              <div>
                <label className='text-xs font-medium'>
                  Include existing files
                </label>
                <div className='text-muted-foreground mb-2 text-[11px]'>
                  Move selected files into the new folder after it’s created.
                </div>
                {files.length === 0 ? (
                  <div className='text-muted-foreground text-[11px]'>
                    No files to include in this location.
                  </div>
                ) : (
                  <div className='max-h-48 overflow-auto rounded border p-2'>
                    <div className='grid grid-cols-2 gap-2 md:grid-cols-3'>
                      {files.map((f) => {
                        const selected = newFolderForm.include.has(f.id);
                        return (
                          <button
                            key={`inc-${f.id}`}
                            type='button'
                            onClick={() =>
                              setNewFolderForm((prev) => {
                                const next = new Set(prev.include);
                                if (next.has(f.id)) next.delete(f.id);
                                else next.add(f.id);
                                return { ...prev, include: next };
                              })
                            }
                            className={cn(
                              'bg-card hover:bg-card/80 rounded-lg border p-2 text-left shadow-sm transition',
                              selected && 'ring-primary/60 ring-2'
                            )}
                            title={f.name}
                          >
                            <div className='flex items-center gap-2'>
                              {renderFileIcon(f, 'size-6')}
                              <div className='min-w-0'>
                                <div className='truncate text-xs font-medium'>
                                  {visibleName(f)}
                                </div>
                                <div className='text-muted-foreground text-[10px]'>
                                  {formatSize(f.size_bytes)}
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className='flex items-center gap-2'>
            {/* Primary actions */}
            <Button
              disabled={!newFolderForm.name.trim() || creating}
              onClick={async () => {
                const created = await createFolderDirect(
                  newFolderForm.name.trim()
                );
                if (!created) return;
                // Color persistence
                setFolderColor(created.id, newFolderForm.color);
                // Star if needed (client-side only)
                if (newFolderForm.star) {
                  void fetch(`/api/noblesuite/files/${created.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ is_starred: true })
                  });
                }
                // Move selected files
                if (newFolderForm.include.size > 0) {
                  const ids = Array.from(newFolderForm.include);
                  await Promise.all(
                    ids.map((id) =>
                      fetch(`/api/noblesuite/files/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ parentId: created.id })
                      })
                    )
                  );
                  setItems((prev) =>
                    prev.map((it) =>
                      newFolderForm.include.has(it.id)
                        ? { ...it, parent_id: created.id }
                        : it
                    )
                  );
                }
                setShowNewFolder(false);
                setNewFolderForm({
                  name: '',
                  color: 'blue',
                  include: new Set(),
                  star: false,
                  genLinks: false,
                  visibility: 'private'
                });
                void load();
              }}
            >
              Create
            </Button>
            {newFolderForm.visibility === 'public' && (
              <Button
                variant='secondary'
                disabled={!newFolderForm.name.trim() || creating}
                onClick={async () => {
                  const created = await createFolderDirect(
                    newFolderForm.name.trim()
                  );
                  if (!created) return;
                  // Persist color & star
                  setFolderColor(created.id, newFolderForm.color);
                  if (newFolderForm.star) {
                    void fetch(`/api/noblesuite/files/${created.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ is_starred: true })
                    });
                  }
                  // Move files
                  if (newFolderForm.include.size > 0) {
                    const ids = Array.from(newFolderForm.include);
                    await Promise.all(
                      ids.map((id) =>
                        fetch(`/api/noblesuite/files/${id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ parentId: created.id })
                        })
                      )
                    );
                    setItems((prev) =>
                      prev.map((it) =>
                        newFolderForm.include.has(it.id)
                          ? { ...it, parent_id: created.id }
                          : it
                      )
                    );
                  }
                  // Generate share links for included files and copy
                  let copiedText = '';
                  if (newFolderForm.include.size > 0) {
                    const selected = files.filter(
                      (it) =>
                        newFolderForm.include.has(it.id) && !!it.storage_path
                    );
                    const links: string[] = [];
                    for (const it of selected) {
                      try {
                        const { data: signed } = await supabase.storage
                          .from(FILES_BUCKET)
                          .createSignedUrl(it.storage_path!, 24 * 60 * 60);
                        const url =
                          signed?.signedUrl ||
                          supabase.storage
                            .from(FILES_BUCKET)
                            .getPublicUrl(it.storage_path!).data?.publicUrl ||
                          '';
                        if (url) links.push(`${it.name}: ${url}`);
                      } catch {
                        const pub = supabase.storage
                          .from(FILES_BUCKET)
                          .getPublicUrl(it.storage_path!);
                        const url = pub.data?.publicUrl;
                        if (url) links.push(`${it.name}: ${url}`);
                      }
                    }
                    if (links.length) copiedText = links.join('\n');
                  }
                  if (copiedText) {
                    try {
                      await navigator.clipboard?.writeText(copiedText);
                      toast.success('Share links copied to clipboard');
                    } catch {
                      toast(
                        'Share links generated. Copy from the next dialog.'
                      );
                      setShareLinks(
                        copiedText.split('\n').map((l) => {
                          const idx = l.indexOf(': ');
                          return {
                            name: idx > -1 ? l.slice(0, idx) : 'File',
                            url: idx > -1 ? l.slice(idx + 2) : l
                          };
                        })
                      );
                    }
                  } else {
                    toast('Folder created');
                  }
                  setShowNewFolder(false);
                  setNewFolderForm({
                    name: '',
                    color: 'blue',
                    include: new Set(),
                    star: false,
                    genLinks: false,
                    visibility: 'private'
                  });
                  void load();
                }}
              >
                Share
              </Button>
            )}
            {/* Spacer to push Cancel to far right */}
            <div className='ml-auto' />
            <Button variant='outline' onClick={() => setShowNewFolder(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Share links preview dialog */}
      <Dialog
        open={!!shareLinks}
        onOpenChange={(o) => !o && setShareLinks(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Links</DialogTitle>
            <DialogDescription>
              Copy and share the generated links. These links expire in 24
              hours.
            </DialogDescription>
          </DialogHeader>
          <div className='max-h-72 overflow-auto rounded border p-2 text-xs'>
            {shareLinks?.map((l, idx) => (
              <div key={`${l.name}-${idx}`} className='mb-2'>
                <div className='truncate font-medium'>{l.name}</div>
                <div className='flex items-center gap-2'>
                  <input
                    readOnly
                    value={l.url}
                    className='bg-muted/30 w-full rounded border px-2 py-1 text-[11px]'
                  />
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => navigator.clipboard?.writeText(l.url)}
                  >
                    Copy
                  </Button>
                </div>
              </div>
            ))}
            {!shareLinks?.length && (
              <div className='text-muted-foreground text-xs'>
                No links generated.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShareLinks(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
