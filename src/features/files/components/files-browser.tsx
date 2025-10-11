'use client';
import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo
} from 'react';
import JSZip from 'jszip';
import { toast } from 'sonner';
import FileUploader from '@/components/file-uploader';
import UploadDialog from '@/features/files/components/upload-dialog';
import ShareDialog from '@/features/files/components/share-dialog';
import { supabase } from '@/lib/supabaseClient';
import { Icons } from '@/components/icons';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SidePanel } from '@/components/ui/side-panel';
import { Checkbox } from '@/components/ui/checkbox';
// Removed tooltip (Select mode removed)
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverAnchor
} from '@/components/ui/popover';
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
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem
} from '@/components/ui/command';

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
  owner_id?: string | null;
}

// Helpers for filename handling (hide extensions on UI)
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

// Local UUID v4 format check (for guarding client-only ids like optimistic ones)
function isUuid(s: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    s
  );
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
  // View & filters
  const [starOnly, setStarOnly] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Selection & renaming
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const shareInputRef = useRef<HTMLInputElement>(null);

  // Drag & drop / upload
  const [dndActive, setDndActive] = useState(false);
  const [dropHoverId, setDropHoverId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // New Folder dialog state
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderForm, setNewFolderForm] = useState<{
    name: string;
    color: 'blue' | 'violet' | 'green' | 'amber' | 'rose';
    include: Set<string>;
    star: boolean;
    genLinks: boolean;
    visibility: 'public' | 'private';
    shareWithIds: Set<string>;
  }>({
    name: '',
    color: 'blue',
    include: new Set(),
    star: false,
    genLinks: false,
    visibility: 'private',
    shareWithIds: new Set()
  });

  // Share link dialog (single file)
  const [sharePath, setSharePath] = useState<string | null>(null);
  const [shareLinks, setShareLinks] = useState<
    { name: string; url: string }[] | null
  >(null);

  // Misc UI state
  const [zipBusyId, setZipBusyId] = useState<string | null>(null);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{
    item: FileItem;
    url: string;
  } | null>(null);
  const [navLoading, setNavLoading] = useState(false);
  // Global recent files (across all folders)
  const [globalRecent, setGlobalRecent] = useState<FileItem[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);

  // Folder colors (client-only visuals)
  const [folderColors, setFolderColors] = useState<Record<string, string>>({});
  // Folder visibility (client-only badge)
  const [folderVisibility, setFolderVisibility] = useState<
    Record<string, 'public' | 'private'>
  >({});
  // Per-folder stats for top Folders section
  const [folderStats, setFolderStats] = useState<
    Record<string, { count: number; size: number }>
  >({});
  // Current folder (when inside)
  const [currentFolder, setCurrentFolder] = useState<FileItem | null>(null);
  // Current user id and owner profile cache (for shared avatar overlays)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [ownerProfiles, setOwnerProfiles] = useState<
    Record<string, { avatar_url?: string | null; display_name?: string | null }>
  >({});

  useEffect(() => {
    (async () => {
      try {
        const u = (await supabase.auth.getUser()).data.user;
        setCurrentUserId(u?.id || null);
      } catch {
        setCurrentUserId(null);
      }
    })();
  }, []);

  // Persist and restore current folder across reloads
  useEffect(() => {
    try {
      const saved = localStorage.getItem('files.parentId');
      const savedCrumb = localStorage.getItem('files.breadcrumb');
      if (saved) setParentId(saved === 'null' ? null : saved);
      if (savedCrumb) {
        const parsed = JSON.parse(savedCrumb);
        if (Array.isArray(parsed) && parsed.length) setBreadcrumb(parsed);
      }
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('files.parentId', String(parentId));
      localStorage.setItem('files.breadcrumb', JSON.stringify(breadcrumb));
    } catch {}
  }, [parentId, breadcrumb]);

  // Move popover state
  const [showMove, setShowMove] = useState(false);
  const [moveParentId, setMoveParentId] = useState<string | null>(null);
  const [movePath, setMovePath] = useState<
    Array<{ id: string | null; name: string }>
  >([{ id: null, name: 'Home' }]);
  const [moveFolders, setMoveFolders] = useState<FileItem[]>([]);
  const [moveLoading, setMoveLoading] = useState(false);

  // Share popover state
  const [showSend, setShowSend] = useState(false);
  const [sendQuery, setSendQuery] = useState('');
  const [sendSelected, setSendSelected] = useState<Set<string>>(new Set());
  const [sendPickerOpen, setSendPickerOpen] = useState(false);
  type ContactProfile = {
    id: string;
    display_name?: string | null;
    username?: string | null;
    email?: string | null;
    avatar_url?: string | null;
    details?: any;
  };
  const [sendContacts, setSendContacts] = useState<ContactProfile[]>([]);
  const [sendExpiry, setSendExpiry] = useState<'5m' | '1h' | '24h'>('24h');
  const [sendLinks, setSendLinks] = useState<{ name: string; url: string }[]>(
    []
  );
  const [sendBusy, setSendBusy] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareContacts, setShareContacts] = useState<any[]>([]);
  const [shareCache, setShareCache] = useState<Record<string, any>>({});
  const [shareQuery, setShareQuery] = useState('');
  const [foldersFilter, setFoldersFilter] = useState<
    'all' | 'starred' | 'mine' | 'shared'
  >('all');
  const useRecursiveStats = true;

  const sendOptions = useMemo(() => {
    const map = new Map<string, ContactProfile>();
    for (const c of sendContacts) map.set(c.id, c);
    for (const id of sendSelected) {
      const cached = shareCache[id];
      if (cached) map.set(id, cached as ContactProfile);
    }
    return Array.from(map.values());
  }, [sendContacts, sendSelected, shareCache]);

  // Small deterministic hash for pseudo-random layout (stable per id)
  const hashString = (s: string) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  };

  // Derived collections
  const atRoot = parentId == null;
  const itemsSource = starOnly ? items.filter((i) => i.is_starred) : items;
  const folders = itemsSource.filter((i) => i.type === 'folder');
  const files = itemsSource.filter((i) => i.type !== 'folder');

  // Data loader for list
  const load = useCallback(async () => {
    setLoading(true);
    setNavLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (parentId) params.set('parentId', parentId);
      if (search.trim()) params.set('search', search.trim());
      // When at root and Shared pill is active, fetch only shared items from server
      const atRootForLoad = parentId == null;
      if (atRootForLoad && foldersFilter === 'shared')
        params.set('sharedOnly', '1');
      const res = await fetch(`/api/noblesuite/files?${params}`, {
        cache: 'no-store'
      });
      const json = await res.json();
      if (!json.ok) setError(json.error || 'LOAD_FAILED');
      else setItems(json.items);
      // Refresh global recent if at root
      if (atRootForLoad) {
        try {
          setRecentLoading(true);
          const r = await fetch('/api/noblesuite/files/recent?limit=6', {
            cache: 'no-store'
          });
          const jr = await r.json();
          if (jr?.ok) setGlobalRecent(jr.items || []);
        } catch {
          /* ignore */
        } finally {
          setRecentLoading(false);
        }
      }
    } finally {
      setLoading(false);
      setNavLoading(false);
    }
  }, [parentId, search, foldersFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  // Load folders for Move popover
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
          setMoveFolders([]);
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

  // Load real contacts list for Share popover (based on public.contacts)
  useEffect(() => {
    if (!showSend) return;
    let cancelled = false;
    (async () => {
      try {
        const user = (await supabase.auth.getUser()).data.user;
        const userId = user?.id;
        if (!userId) {
          if (!cancelled) setSendContacts([]);
          return;
        }
        const { data: contactsRows, error: cErr } = await supabase
          .from('contacts')
          .select('contact_id')
          .eq('user_id', userId)
          .limit(500);
        if (cErr) {
          if (!cancelled) setSendContacts([]);
          return;
        }
        const ids = (contactsRows || [])
          .map((r: any) => r.contact_id)
          .filter(Boolean);
        if (ids.length === 0) {
          if (!cancelled) setSendContacts([]);
          return;
        }
        const q = sendQuery.trim();
        const { data: profs, error: pErr } = await supabase
          .from('profiles')
          .select('id,display_name,username,email,avatar_url,details')
          .in('id', ids)
          .limit(500);
        if (pErr) {
          if (!cancelled) setSendContacts([]);
          return;
        }
        let list = (profs || []) as ContactProfile[];
        if (q) {
          const lower = q.toLowerCase();
          list = list.filter((p: any) => {
            const full = (p.display_name || p.username || p.email || '')
              .toString()
              .toLowerCase();
            const detailsName = (
              p.details?.full_name ||
              p.details?.fullname ||
              ''
            )
              .toString()
              .toLowerCase();
            return full.includes(lower) || detailsName.includes(lower);
          });
        }
        if (!cancelled) {
          setSendContacts(list);
          setShareCache((prev) => {
            const next = { ...prev } as Record<string, any>;
            for (const c of list) next[c.id] = c;
            return next;
          });
        }
      } catch {
        if (!cancelled) setSendContacts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showSend, sendQuery]);

  // Load share contacts (placeholder implementation)
  useEffect(() => {
    let active = true;
    (async () => {
      if (!shareQuery.trim()) {
        if (active) setShareContacts([]);
        return;
      }
      setShareLoading(true);
      try {
        // If there is a contacts endpoint, call it here. Keep no-op to avoid errors.
        // const res = await fetch(`/api/contacts?search=${encodeURIComponent(shareQuery)}`);
        // const json = await res.json();
        // if (active) setShareContacts(json.items || []);
        if (active) setShareContacts([]);
      } finally {
        if (active) setShareLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [shareQuery]);

  // Local persistence helpers for folder color/visibility
  useEffect(() => {
    try {
      const c = localStorage.getItem('folderColors');
      if (c) setFolderColors(JSON.parse(c));
    } catch {}
    try {
      const v = localStorage.getItem('folderVisibility');
      if (v) setFolderVisibility(JSON.parse(v));
    } catch {}
  }, []);

  const setFolderColor = (id: string, color: string) => {
    setFolderColors((prev) => {
      const next = { ...prev, [id]: color };
      try {
        localStorage.setItem('folderColors', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const setFolderVisibilityLocal = (
    id: string,
    value: 'public' | 'private'
  ) => {
    setFolderVisibility((prev) => {
      const next = { ...prev, [id]: value };
      try {
        localStorage.setItem('folderVisibility', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const refreshBreadcrumbNames = (updated: FileItem) => {
    setBreadcrumb((prev) =>
      prev.map((b) => (b.id === updated.id ? { ...b, name: updated.name } : b))
    );
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
      toast(`${it.name} moved to Trash`, {
        description: 'Items are soft-deleted. Undo will restore them.',
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await fetch(`/api/noblesuite/files/${it.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_deleted: false })
              });
              setItems(prev);
              toast('Restored');
              void load();
            } catch {
              toast('Undo failed');
            }
          }
        }
      });
      // If we deleted a folder in breadcrumb, adjust breadcrumb
      setBreadcrumb((b) =>
        b.some((c) => c.id === it.id) ? [{ id: null, name: 'Home' }] : b
      );
    } catch (e: any) {
      setItems(prev);
      setError(mapError(e?.message));
    }
  };

  const createFolderDirect = async (name: string): Promise<FileItem | null> => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('NAME_REQUIRED');
      return null;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/noblesuite/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          parentId,
          type: 'folder',
          visibility: newFolderForm.visibility
        })
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || 'CREATE_FAILED');
      const created: FileItem = {
        id: json.item.id,
        parent_id: json.item.parent_id,
        name: json.item.name,
        type: 'folder',
        updated_at: new Date().toISOString(),
        is_starred: json.item.is_starred
      } as FileItem;
      setItems((prev) => [created, ...prev]);
      setFolderVisibilityLocal(
        created.id,
        (json.item.visibility as any) || newFolderForm.visibility
      );
      toast.success('Folder created');
      return created;
    } catch (e: any) {
      setError(mapError(e?.message));
      return null;
    } finally {
      setCreating(false);
    }
  };

  // Open file: generate a URL and either preview or download
  async function openFile(f: FileItem, forceDownload: boolean) {
    if (f.type === 'folder') return;
    if (!f.storage_path) return;
    try {
      const { data: signed } = await supabase.storage
        .from(FILES_BUCKET)
        .createSignedUrl(f.storage_path, 300);
      const url =
        signed?.signedUrl ||
        supabase.storage.from(FILES_BUCKET).getPublicUrl(f.storage_path).data
          ?.publicUrl ||
        '';
      if (!url) throw new Error('URL_NOT_FOUND');
      if (forceDownload) {
        const a = document.createElement('a');
        a.href = url;
        a.download = f.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        setPreview({ item: f, url });
      }
    } catch (e: any) {
      if (typeof e?.message === 'string' && /Bucket not found/i.test(e.message))
        setError('BUCKET_NOT_FOUND');
      else setError(e?.message || 'OPEN_FAILED');
    }
  }

  // Convenience preview wrapper
  const openPreview = async (f: FileItem) => {
    await openFile(f, false);
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
  const sortedFolders = [...folders]
    .sort(compare)
    .sort((a, b) => Number(!!b.is_starred) - Number(!!a.is_starred));
  const topFolders = useMemo(() => {
    if (!atRoot) return [] as FileItem[];
    let arr = sortedFolders;
    if (foldersFilter === 'starred') arr = arr.filter((f) => !!f.is_starred);
    // mine/shared placeholders: require owner_id and sharing model; keep 'mine' as default
    if (foldersFilter === 'mine') arr = arr; // assuming listing is already user-scoped
    if (foldersFilter === 'shared') arr = arr; // TODO: requires shared model
    return arr.slice(0, 12);
  }, [atRoot, sortedFolders, foldersFilter]);
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
  // At root, hide folders from the main list (they are shown in the top Folders section)
  const visibleList = useMemo(
    () => (atRoot ? [...sortedFiles] : [...sortedFolders, ...sortedFiles]),
    [atRoot, sortedFolders, sortedFiles]
  );
  const idToIndex = useMemo(() => {
    const m: Record<string, number> = {};
    visibleList.forEach((it, idx) => (m[it.id] = idx));
    return m;
  }, [visibleList]);

  // Prefetch owner profiles for visible items to overlay sharer avatar when not owner
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ids = Array.from(
          new Set(
            visibleList
              .map((it) => (it as any).owner_id)
              .filter((x): x is string => Boolean(x))
          )
        ).filter((id) => !(id in ownerProfiles));
        if (ids.length === 0) return;
        const { data } = await supabase
          .from('profiles')
          .select('id,display_name,avatar_url')
          .in('id', ids)
          .limit(200);
        if (cancelled) return;
        const next: Record<
          string,
          { avatar_url?: string | null; display_name?: string | null }
        > = {};
        for (const p of data || []) {
          next[(p as any).id] = {
            avatar_url: (p as any).avatar_url || null,
            display_name: (p as any).display_name || null
          };
        }
        if (Object.keys(next).length)
          setOwnerProfiles((prev) => ({ ...prev, ...next }));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
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
      setCurrentFolder(null);
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

  const isPdf = (f: FileItem) => {
    const mime = (f.mime_type || '').toLowerCase();
    const ext = (f.ext || '').toLowerCase() || extension(f.name);
    return mime === 'application/pdf' || ext === 'pdf';
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
    let cancelled = false;
    async function run() {
      const targets = visibleList.filter(
        (f) =>
          f.type !== 'folder' &&
          (isImage(f) || isPdf(f)) &&
          f.storage_path &&
          !thumbUrls[f.id]
      );
      if (!targets.length) return;
      const results: Array<{ id: string; url: string }> = [];
      for (const f of targets) {
        try {
          const { data: signed, error } = await supabase.storage
            .from(FILES_BUCKET)
            .createSignedUrl(f.storage_path!, 120);
          if (!error && signed?.signedUrl)
            results.push({ id: f.id, url: signed.signedUrl });
          else {
            const pub = supabase.storage
              .from(FILES_BUCKET)
              .getPublicUrl(f.storage_path!);
            results.push({ id: f.id, url: pub.data?.publicUrl || '' });
          }
        } catch {
          // ignore
        }
      }
      if (!cancelled && results.length) {
        setThumbUrls((prev) => {
          const next = { ...prev } as Record<string, string>;
          for (const r of results) if (r.url) next[r.id] = r.url;
          return next;
        });
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [visibleList]);

  // Refresh a single thumbnail when <img> fails to load
  const refreshThumb = useCallback(async (f: FileItem) => {
    if (!f.storage_path) return;
    try {
      const { data: signed } = await supabase.storage
        .from(FILES_BUCKET)
        .createSignedUrl(f.storage_path, 300);
      const url = signed?.signedUrl
        ? signed.signedUrl
        : supabase.storage.from(FILES_BUCKET).getPublicUrl(f.storage_path).data
            ?.publicUrl || '';
      if (url) setThumbUrls((prev) => ({ ...prev, [f.id]: `${url}` }));
    } catch {
      try {
        const pub = supabase.storage
          .from(FILES_BUCKET)
          .getPublicUrl(f.storage_path);
        const url = pub.data?.publicUrl || '';
        if (url) setThumbUrls((prev) => ({ ...prev, [f.id]: `${url}` }));
      } catch {}
    }
  }, []);

  // Fetch stats for top folders at root
  useEffect(() => {
    if (!atRoot || topFolders.length === 0) return;
    let cancelled = false;
    (async () => {
      const pairs = await Promise.all(
        topFolders.map(async (f) => {
          try {
            if (useRecursiveStats) {
              const res = await fetch(
                `/api/noblesuite/files/stats?folderId=${encodeURIComponent(f.id)}&recursive=1`
              );
              const json = await res.json();
              if (json?.ok)
                return [f.id, json.stats || { count: 0, size: 0 }] as const;
              return [f.id, { count: 0, size: 0 }] as const;
            } else {
              const params = new URLSearchParams();
              params.set('parentId', f.id);
              const res = await fetch(`/api/noblesuite/files?${params}`);
              const json = await res.json();
              if (!json?.ok) return [f.id, { count: 0, size: 0 }] as const;
              const arr: FileItem[] = json.items || [];
              let size = 0;
              for (const it of arr)
                if (it.type !== 'folder') size += it.size_bytes || 0;
              return [f.id, { count: arr.length, size }] as const;
            }
          } catch {
            return [f.id, { count: 0, size: 0 }] as const;
          }
        })
      );
      if (!cancelled) {
        setFolderStats((prev) => {
          const next = { ...prev };
          for (const [id, st] of pairs) next[id] = st;
          return next;
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [atRoot, topFolders]);

  // Selection helpers
  const clearSelection = () => setSelectedIds(new Set());
  const selectSingle = (id: string) => {
    setSelectedIds(new Set([id]));
    setAnchorId(id);
  };
  const toggleCtrl = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setAnchorId(id);
  };
  const selectRange = (toId: string, additive = false) => {
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
  const isSelected = (id: string) => selectedIds.has(id);

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
      if (!isTyping && e.key === 'Enter' && selectedIds.size === 1) {
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
      if (!isTyping && e.key === 'F2' && selectedIds.size === 1) {
        e.preventDefault();
        const id = Array.from(selectedIds)[0];
        const it = items.find((i) => i.id === id);
        if (it) startRename(it);
        return;
      }
      if (
        !isTyping &&
        (e.key === 'Delete' || e.key === 'Backspace') &&
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
        const msg = upErr.message || '';
        if (/bucket not found/i.test(msg)) setError('BUCKET_NOT_FOUND');
        else setError(msg);
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
    async (
      f: File,
      onProgress?: (p: number) => void,
      opts?: { signal?: AbortSignal }
    ) => {
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
          if (xhr.status >= 200 && xhr.status < 300) return resolve();
          try {
            const err = JSON.parse(xhr.responseText || '{}');
            const m = (err?.message || err?.error || '').toString();
            if (/bucket not found/i.test(m))
              return reject(new Error('BUCKET_NOT_FOUND'));
          } catch {}
          return reject(new Error(`UPLOAD_FAILED_${xhr.status}`));
        };
        const abort = () => {
          try {
            xhr.abort();
          } catch {}
          reject(new DOMException('Aborted', 'AbortError'));
        };
        if (opts?.signal) {
          if (opts.signal.aborted) return abort();
          const onAbort = () => abort();
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
      <div className='flex flex-wrap items-start gap-3'>
        <div className='flex-1'>
          <Heading
            title='Files'
            description='Manage, share, and organize your files.'
          />
        </div>
        <div className='ml-auto flex items-center gap-2'>
          <div className='relative'>
            <input
              placeholder='Search...'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              ref={searchInputRef}
              className='bg-background focus-visible:ring-primary/40 h-9 w-56 rounded-md border px-2 text-sm focus-visible:ring-2 focus-visible:outline-none'
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size='sm' variant='default' className='gap-1'>
                <Icons.add className='size-4' /> New
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-44 text-xs'>
              <DropdownMenuItem onClick={() => setShowNewFolder(true)}>
                New Folder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowUpload(true)}>
                Upload Files
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {/* Header breadcrumb removed; using fixed bottom breadcrumb strip as the primary navigation */}
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

      {/* Floating bottom selection bar */}
      {selectedIds.size > 0 && (
        <div className='pointer-events-auto fixed inset-x-0 bottom-4 z-20 flex justify-center px-4'>
          <div className='bg-card/95 supports-[backdrop-filter]:bg-card/70 relative flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs shadow-2xl backdrop-blur'>
            <div className='flex items-center gap-2 pr-2'>
              <Icons.check className='text-primary size-4' />
              <span className='font-medium'>{selectedIds.size} selected</span>
            </div>
            <div className='bg-muted mx-1 h-4 w-px' />
            <Popover
              open={showMove}
              onOpenChange={(o) => {
                setShowMove(o);
                if (o) {
                  setMoveParentId(parentId);
                  setMovePath(breadcrumb);
                } else {
                  setMoveFolders([]);
                  setMovePath([{ id: null, name: 'Home' }]);
                  setMoveParentId(null);
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
                <div className='grid grid-cols-5 gap-0'>
                  {/* Left: selected items mini-cards */}
                  <div className='col-span-2 border-r p-3'>
                    <div className='text-muted-foreground mb-2 text-[10px] tracking-wide uppercase'>
                      Selected
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      {Array.from(selectedIds)
                        .slice(0, 6)
                        .map((id) => {
                          const it = items.find((i) => i.id === id);
                          if (!it) return null;
                          const isFolder = it.type === 'folder';
                          return (
                            <div
                              key={`sel-${id}`}
                              className='from-card/90 to-background rounded-md border bg-gradient-to-br p-2 shadow-sm'
                            >
                              <div className='flex items-center gap-2'>
                                {isFolder ? (
                                  <Icons.folderFilled
                                    className={cn(
                                      'size-5',
                                      folderColorClass(it.id)
                                    )}
                                  />
                                ) : (
                                  <Icons.file className='size-5 opacity-70' />
                                )}
                                <div className='min-w-0'>
                                  <div className='truncate text-[12px] font-medium'>
                                    {displayName(it.name, 22)}
                                  </div>
                                  <div className='text-muted-foreground text-[10px]'>
                                    {isFolder
                                      ? 'Folder'
                                      : it.ext ||
                                        extension(it.name) ||
                                        it.mime_type ||
                                        'File'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      {selectedIds.size > 6 && (
                        <div className='text-muted-foreground col-span-2 text-center text-xs'>
                          +{selectedIds.size - 6} more…
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Right: breadcrumb-like stripe and folders list */}
                  <div className='col-span-3 p-3'>
                    {/* Breadcrumb styled like bottom stripe */}
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
                    {/* Folders list */}
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
                              if (!json?.ok) {
                                toast.error(
                                  mapError(json?.error || 'CREATE_FAILED')
                                );
                                return;
                              }
                              const created: FileItem = {
                                id: json.item.id,
                                name: json.item.name,
                                parent_id: json.item.parent_id,
                                type: 'folder',
                                updated_at: new Date().toISOString()
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
                                if (!isUuid(f.id)) return;
                                setMoveParentId(f.id);
                                setMovePath((prev) => [
                                  ...prev,
                                  { id: f.id, name: f.name }
                                ]);
                              }}
                            >
                              <Icons.folderFilled
                                className={cn('size-5', folderColorClass(f.id))}
                              />
                              <span className='truncate'>{f.name}</span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className='bg-card/50 flex items-center justify-end gap-2 border-t px-3 py-2'>
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
                    onClick={async () => {
                      const ids = Array.from(selectedIds);
                      if (ids.length === 0) return;
                      const dest = moveParentId; // can be null for root
                      if (dest && ids.includes(dest)) {
                        toast.error('Cannot move into the selected item');
                        return;
                      }
                      const prevItems = items;
                      setItems((p) => p.filter((it) => !ids.includes(it.id)));
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
                        if (res.some((r) => !r.ok))
                          throw new Error('MOVE_FAILED');
                        toast.success('Moved successfully');
                        setShowMove(false);
                        clearSelection();
                        void load();
                      } catch (e: any) {
                        setItems(prevItems);
                        setError(e?.message || 'MOVE_FAILED');
                      }
                    }}
                  >
                    <Icons.check className='size-4' /> Move here
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <Popover
              open={showSend}
              onOpenChange={(o) => {
                setShowSend(o);
                if (!o) {
                  setSendSelected(new Set());
                  setSendLinks([]);
                  setSendQuery('');
                }
              }}
            >
              <PopoverAnchor className='absolute top-0 left-1/2 -translate-x-1/2' />
              <PopoverTrigger asChild>
                <Button size='sm' variant='ghost' className='gap-1'>
                  <Icons.share className='size-4' />
                  Share
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align='center'
                side='top'
                sideOffset={14}
                className='w-[720px] max-w-[95vw] overflow-hidden p-0'
              >
                <div className='bg-muted/40 text-muted-foreground px-3 py-2 text-[11px] font-semibold tracking-wide uppercase'>
                  Share
                </div>
                <div className='grid grid-cols-5'>
                  {/* Left: avatar collage of selected recipients */}
                  <div className='col-span-2 border-r p-3'>
                    <div className='text-muted-foreground mb-2 text-[10px] tracking-wide uppercase'>
                      Recipients
                    </div>
                    <div className='bg-card/40 relative h-[210px] rounded-lg border'>
                      {Array.from(sendSelected)
                        .slice(0, 12)
                        .map((id) => {
                          const c = (sendContacts.find((x) => x.id === id) ||
                            shareCache[id]) as any;
                          const seed = hashString(id);
                          const size = 28 + (seed % 18);
                          const top = (seed % 160) + (seed % 2 ? 0 : 10);
                          const left = seed % 200;
                          const name =
                            c?.display_name || c?.username || c?.email || '';
                          const initials = name
                            ? name
                                .split(' ')
                                .map((p: string) => p[0])
                                .join('')
                                .slice(0, 2)
                                .toUpperCase()
                            : 'U';
                          const url = c?.avatar_url || '';
                          return (
                            <div
                              key={`av-${id}`}
                              className='absolute'
                              style={{ top, left }}
                            >
                              <Avatar
                                className='ring-background/70 size-10 rounded-full ring-2'
                                style={{ width: size, height: size }}
                              >
                                <AvatarImage src={url} />
                                <AvatarFallback className='text-[10px]'>
                                  {initials}
                                </AvatarFallback>
                              </Avatar>
                            </div>
                          );
                        })}
                      {sendSelected.size === 0 && (
                        <div className='text-muted-foreground absolute inset-0 flex items-center justify-center text-xs'>
                          No recipients yet
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Command-based people picker (inbox parity) */}
                  <div className='col-span-3 space-y-3 p-3'>
                    <div className='space-y-2'>
                      <div className='text-muted-foreground text-[10px] tracking-wide uppercase'>
                        To
                      </div>
                      <Popover
                        open={sendPickerOpen}
                        onOpenChange={(open) => {
                          setSendPickerOpen(open);
                          if (!open) setSendQuery('');
                        }}
                      >
                        <PopoverTrigger asChild>
                          <div
                            className='focus-within:ring-primary/40 flex min-h-10 cursor-text flex-wrap items-center gap-1 rounded border px-2 py-1 focus-within:ring-2'
                            onClick={() => {
                              setSendPickerOpen(true);
                              requestAnimationFrame(() =>
                                shareInputRef.current?.focus()
                              );
                            }}
                          >
                            {Array.from(sendSelected).map((id) => {
                              const c = (sendOptions.find((x) => x.id === id) ||
                                shareCache[id]) as ContactProfile | undefined;
                              const label =
                                c?.display_name ||
                                c?.username ||
                                c?.email ||
                                id;
                              return (
                                <span
                                  key={`chip-${id}`}
                                  className='bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs'
                                >
                                  <Avatar className='size-4'>
                                    <AvatarImage src={c?.avatar_url || ''} />
                                    <AvatarFallback>
                                      {label.slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  {label}
                                  <button
                                    className='opacity-60 hover:opacity-100'
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setSendSelected((prev) => {
                                        const next = new Set(prev);
                                        next.delete(id);
                                        return next;
                                      });
                                    }}
                                    aria-label='Remove recipient'
                                  >
                                    <Icons.close className='size-3' />
                                  </button>
                                </span>
                              );
                            })}
                            <input
                              ref={shareInputRef}
                              className='min-w-[140px] flex-1 text-sm outline-none'
                              placeholder={
                                sendSelected.size
                                  ? 'Add more…'
                                  : 'Type a name or email'
                              }
                              value={sendQuery}
                              onChange={(e) => setSendQuery(e.target.value)}
                              onFocus={() => setSendPickerOpen(true)}
                              onKeyDown={(e) => {
                                if (
                                  e.key === 'Backspace' &&
                                  !sendQuery &&
                                  sendSelected.size > 0
                                ) {
                                  e.preventDefault();
                                  const ids = Array.from(sendSelected);
                                  const last = ids[ids.length - 1];
                                  setSendSelected((prev) => {
                                    const next = new Set(prev);
                                    next.delete(last);
                                    return next;
                                  });
                                }
                              }}
                            />
                          </div>
                        </PopoverTrigger>
                        <PopoverContent className='w-[480px] p-0' align='start'>
                          <Command>
                            <CommandInput
                              placeholder='Search people…'
                              value={sendQuery}
                              onValueChange={setSendQuery}
                            />
                            <CommandList>
                              <CommandEmpty>No contacts found.</CommandEmpty>
                              <CommandGroup heading='Contacts'>
                                {sendOptions.map((c) => {
                                  const label =
                                    c.display_name ||
                                    c.username ||
                                    c.email ||
                                    c.id;
                                  const active = sendSelected.has(c.id);
                                  return (
                                    <CommandItem
                                      key={c.id}
                                      value={label as string}
                                      onSelect={() => {
                                        setShareCache((prev) => ({
                                          ...prev,
                                          [c.id]: c
                                        }));
                                        setSendSelected((prev) => {
                                          const next = new Set(prev);
                                          if (next.has(c.id)) next.delete(c.id);
                                          else next.add(c.id);
                                          return next;
                                        });
                                        setSendPickerOpen(false);
                                        setSendQuery('');
                                      }}
                                    >
                                      <div className='flex w-full items-center gap-2'>
                                        <Avatar className='size-6'>
                                          <AvatarImage
                                            src={c.avatar_url || ''}
                                          />
                                          <AvatarFallback>
                                            {label.slice(0, 2).toUpperCase()}
                                          </AvatarFallback>
                                        </Avatar>
                                        <div className='min-w-0 flex-1'>
                                          <div className='truncate text-sm'>
                                            {label}
                                          </div>
                                          {c.email && (
                                            <div className='text-muted-foreground text-xs'>
                                              {c.email}
                                            </div>
                                          )}
                                        </div>
                                        {active ? (
                                          <Icons.check className='text-primary size-4' />
                                        ) : null}
                                      </div>
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className='flex items-center gap-2'>
                      <label className='text-muted-foreground text-[10px] tracking-wide uppercase'>
                        Link expiry
                      </label>
                      <select
                        value={sendExpiry}
                        onChange={(e) => setSendExpiry(e.target.value as any)}
                        className='bg-background h-9 rounded-md border px-2 text-sm'
                      >
                        <option value='5m'>5 minutes</option>
                        <option value='1h'>1 hour</option>
                        <option value='24h'>24 hours</option>
                      </select>
                    </div>

                    {sendLinks.length > 0 && (
                      <div className='rounded-md border'>
                        <div className='bg-muted/50 text-muted-foreground flex items-center justify-between rounded-t-md px-2 py-1 text-[10px] tracking-wide uppercase'>
                          <div>Generated Links</div>
                          <button
                            className='text-muted-foreground hover:text-foreground text-[11px] underline'
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(
                                  sendLinks
                                    .map((l) => `${l.name}: ${l.url}`)
                                    .join('\n')
                                );
                                toast.success('Copied all links');
                              } catch {}
                            }}
                          >
                            Copy All
                          </button>
                        </div>
                        <div className='bg-background max-h-[160px] divide-y overflow-auto'>
                          {sendLinks.map((l, idx) => (
                            <div
                              key={`link-${idx}`}
                              className='flex items-center gap-2 px-3 py-2 text-xs'
                            >
                              <span
                                className='min-w-0 flex-1 truncate'
                                title={l.name}
                              >
                                {l.name}
                              </span>
                              <button
                                className='text-muted-foreground hover:text-foreground underline'
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(l.url);
                                    toast.success('Copied');
                                  } catch {}
                                }}
                              >
                                Copy
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className='bg-card/50 flex items-center justify-end gap-2 border-t px-3 py-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setShowSend(false)}
                  >
                    Close
                  </Button>
                  <Button
                    size='sm'
                    variant='default'
                    disabled={
                      sendBusy ||
                      sendSelected.size === 0 ||
                      selectedIds.size === 0
                    }
                    onClick={async () => {
                      setSendBusy(true);
                      try {
                        const fileIds = Array.from(selectedIds);
                        const recipientIds = Array.from(sendSelected);
                        const res = await fetch('/api/noblesuite/files/share', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            fileIds,
                            recipientIds,
                            text: ''
                          })
                        });
                        if (!res.ok) throw new Error('SHARE_FAILED');
                        toast.success('Shared');
                        setShowSend(false);
                        setSendSelected(new Set());
                        setSendLinks([]);
                        setSendQuery('');
                      } catch (e) {
                        toast.error('Failed to share');
                      } finally {
                        setSendBusy(false);
                      }
                    }}
                  >
                    Send
                  </Button>
                  <Button
                    size='sm'
                    disabled={sendBusy}
                    onClick={async () => {
                      setSendBusy(true);
                      try {
                        const secs =
                          sendExpiry === '5m'
                            ? 300
                            : sendExpiry === '1h'
                              ? 3600
                              : 86400;
                        const out: { name: string; url: string }[] = [];
                        for (const id of Array.from(selectedIds)) {
                          const it = items.find((i) => i.id === id);
                          if (!it?.storage_path) continue;
                          try {
                            const { data, error } = await supabase.storage
                              .from(FILES_BUCKET)
                              .createSignedUrl(it.storage_path, secs);
                            if (!error && data?.signedUrl) {
                              out.push({ name: it.name, url: data.signedUrl });
                            }
                          } catch {}
                        }
                        setSendLinks(out);
                        if (out.length === 0) toast.error('No links generated');
                        else toast.success('Links generated');
                      } finally {
                        setSendBusy(false);
                      }
                    }}
                  >
                    Generate links
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
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
                      setNavLoading(true);
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
            {/* Delete with confirmation popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  size='sm'
                  variant='ghost'
                  className='text-destructive gap-1'
                >
                  <Icons.trash className='size-4' />
                  Delete
                </Button>
              </PopoverTrigger>
              <PopoverContent
                side='top'
                align='center'
                className='w-72 text-xs'
              >
                <div className='space-y-3'>
                  <div className='font-semibold'>Delete selected?</div>
                  <div className='text-muted-foreground'>
                    These items will be moved to Trash. You can Undo immediately
                    after.
                  </div>
                  <div className='flex justify-end gap-2'>
                    <Button size='sm' variant='outline'>
                      Cancel
                    </Button>
                    <Button
                      size='sm'
                      variant='destructive'
                      className='gap-1'
                      onClick={() => {
                        const ids = Array.from(selectedIds);
                        const prev = items;
                        const toRestore = prev.filter((i) =>
                          ids.includes(i.id)
                        );
                        setItems((p) => p.filter((i) => !ids.includes(i.id)));
                        Promise.all(
                          ids.map((id) =>
                            fetch(`/api/noblesuite/files/${id}`, {
                              method: 'DELETE'
                            })
                          )
                        )
                          .then(async (res) => {
                            if (res.some((r) => !r.ok))
                              throw new Error('DELETE_FAILED');
                            toast(
                              `${ids.length} item${ids.length > 1 ? 's' : ''} moved to Trash`,
                              {
                                action: {
                                  label: 'Undo',
                                  onClick: async () => {
                                    try {
                                      await Promise.all(
                                        toRestore.map((it) =>
                                          fetch(
                                            `/api/noblesuite/files/${it.id}`,
                                            {
                                              method: 'PATCH',
                                              headers: {
                                                'Content-Type':
                                                  'application/json'
                                              },
                                              body: JSON.stringify({
                                                is_deleted: false
                                              })
                                            }
                                          )
                                        )
                                      );
                                      setItems(prev);
                                      toast('Restored');
                                      void load();
                                    } catch {
                                      toast('Undo failed');
                                    }
                                  }
                                }
                              }
                            );
                            clearSelection();
                            void load();
                          })
                          .catch(() => {
                            setItems(prev);
                            toast.error('Delete failed');
                          });
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <div className='bg-muted mx-1 h-4 w-px' />
            <Button
              size='sm'
              variant='secondary'
              className='gap-1'
              onClick={clearSelection}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* CONTENT: Unified grid/list below header */}
      {/* Note: Folders and files are unified in rendering via visibleList */}

      {/* Folders (horizontal at top, like Recent; only at root) */}
      {atRoot && (
        <div className='space-y-2'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div className='text-foreground text-sm font-semibold'>Folders</div>
            <div className='flex items-center gap-2'>
              {/* Segmented filter: rounded pill buttons */}
              <div className='bg-background/50 inline-flex items-center rounded-full border p-0.5 text-[11px] shadow-sm'>
                {(
                  [
                    ['all', 'All'],
                    ['starred', 'Starred'],
                    ['mine', 'Mine'],
                    ['shared', 'Shared']
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type='button'
                    onClick={() => setFoldersFilter(k as any)}
                    className={cn(
                      'rounded-full px-2.5 py-1 leading-none transition',
                      foldersFilter === k
                        ? 'bg-card text-foreground shadow'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <Button
                size='sm'
                variant='outline'
                onClick={() => setShowNewFolder(true)}
                className='gap-1'
              >
                <Icons.add className='size-4' /> New Folder
              </Button>
            </div>
          </div>
          {topFolders.length > 0 ? (
            <div className='no-scrollbar flex gap-3 overflow-x-auto pb-1'>
              {topFolders.map((f) => (
                <ContextMenu key={`folder-top-${f.id}`}>
                  <ContextMenuTrigger asChild>
                    <button
                      className={cn(
                        'group from-card/80 to-background hover:from-card hover:to-card min-w-[220px] rounded-xl border bg-gradient-to-br px-3 py-2 text-left shadow-sm transition md:min-w-[260px]',
                        isSelected(f.id) && 'ring-primary/40 ring-2',
                        dropHoverId === f.id &&
                          'scale-[1.01] ring-2 ring-amber-400/70'
                      )}
                      title={f.name}
                      draggable
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
                          } catch {}
                          const moveIds = (ids || []).filter(
                            (id) => id && id !== f.id
                          );
                          if (moveIds.length === 0) return;
                          // capture previous parents for Undo
                          const prevParents: Record<
                            string,
                            string | null | undefined
                          > = {};
                          moveIds.forEach((id) => {
                            const it = items.find((x) => x.id === id);
                            prevParents[id] = it?.parent_id ?? null;
                          });
                          const prevItems = items;
                          setItems((p) =>
                            p.filter((x) => !moveIds.includes(x.id))
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
                          if (res.some((r) => !r.ok)) {
                            setItems(prevItems);
                            toast('Move failed');
                          } else {
                            toast(
                              `${moveIds.length} item${moveIds.length > 1 ? 's' : ''} moved`,
                              {
                                action: {
                                  label: 'Undo',
                                  onClick: async () => {
                                    try {
                                      await Promise.all(
                                        moveIds.map((id) =>
                                          fetch(`/api/noblesuite/files/${id}`, {
                                            method: 'PATCH',
                                            headers: {
                                              'Content-Type': 'application/json'
                                            },
                                            body: JSON.stringify({
                                              parentId: prevParents[id] ?? null
                                            })
                                          })
                                        )
                                      );
                                      toast('Move undone');
                                      void load();
                                    } catch {
                                      toast('Undo failed');
                                    }
                                  }
                                }
                              }
                            );
                          }
                          void load();
                        } catch {}
                      }}
                      onClick={(e) => {
                        if (e.shiftKey)
                          return selectRange(f.id, e.ctrlKey || e.metaKey);
                        if (e.ctrlKey || e.metaKey) return toggleCtrl(f.id);
                        // Navigate into folder
                        if (!isUuid(f.id)) return;
                        setNavLoading(true);
                        setCurrentFolder(f);
                        setParentId(f.id);
                        setBreadcrumb((prev) => [
                          ...prev,
                          { id: f.id, name: f.name }
                        ]);
                      }}
                    >
                      <div className='flex items-center gap-2'>
                        <div className='relative'>
                          <Icons.folderFilled
                            className={cn(
                              'size-8 drop-shadow-sm',
                              folderColorClass(f.id)
                            )}
                          />
                          {f.is_starred ? (
                            <Icons.starFilled className='absolute -top-1 -right-1 size-3 text-amber-500 drop-shadow' />
                          ) : null}
                        </div>
                        <div className='min-w-0'>
                          <div className='truncate text-sm font-medium'>
                            {f.name}
                          </div>
                          <div className='text-muted-foreground text-[11px]'>
                            {folderStats[f.id]?.count ?? 0} items •{' '}
                            {formatSize(folderStats[f.id]?.size ?? 0)}
                          </div>
                        </div>
                        <div className='ml-auto'>
                          <span className='bg-muted/60 text-muted-foreground rounded px-1.5 py-0.5 text-[10px] tracking-wide uppercase shadow-sm'>
                            {(f as any).visibility === 'public'
                              ? 'Public'
                              : (folderVisibility[f.id] || 'private') ===
                                  'public'
                                ? 'Public'
                                : 'Private'}
                          </span>
                        </div>
                      </div>
                    </button>
                  </ContextMenuTrigger>
                  <ContextMenuContent className='text-xs'>
                    <ContextMenuItem
                      onClick={() => {
                        if (!isUuid(f.id)) return;
                        setNavLoading(true);
                        setCurrentFolder(f);
                        setParentId(f.id);
                        setBreadcrumb((prev) => [
                          ...prev,
                          { id: f.id, name: f.name }
                        ]);
                      }}
                    >
                      Open
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => startRename(f)}>
                      Rename
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => toggleStar(f)}>
                      {f.is_starred ? 'Unstar' : 'Star'}
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={async () => {
                        const next =
                          (f as any).visibility === 'public'
                            ? 'private'
                            : 'public';
                        try {
                          const res = await fetch(
                            `/api/noblesuite/files/${f.id}`,
                            {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ visibility: next })
                            }
                          );
                          const json = await res.json();
                          if (json?.ok) {
                            setItems((prev) =>
                              prev.map((it) =>
                                it.id === f.id
                                  ? ({ ...it, visibility: next } as any)
                                  : it
                              )
                            );
                            setFolderVisibilityLocal(f.id, next as any);
                          }
                        } catch {}
                      }}
                    >
                      {(f as any).visibility === 'public'
                        ? 'Make Private'
                        : 'Make Public'}
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => downloadFolderZip(f)}>
                      Download as ZIP
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
          ) : foldersFilter === 'shared' ? (
            <div className='text-muted-foreground/80 bg-muted/10 flex h-16 items-center justify-center rounded-xl border border-dashed px-3 text-xs'>
              No shared folders yet
            </div>
          ) : null}
        </div>
      )}

      {/* Global Recent (only at root) */}
      {atRoot && globalRecent.length > 0 && (
        <div className='space-y-2'>
          <div className='text-foreground text-sm font-semibold'>Recent</div>
          <div className='no-scrollbar flex gap-3 overflow-x-auto pb-1'>
            {globalRecent.map((f) => (
              <ContextMenu key={`recent-${f.id}`}>
                <ContextMenuTrigger asChild>
                  <button
                    className='bg-card hover:bg-card/80 min-w-[220px] rounded-xl border px-3 py-2 text-left shadow-sm transition md:min-w-[260px]'
                    title={f.name}
                    onClick={(e) => {
                      if (e.shiftKey)
                        return selectRange(f.id, e.ctrlKey || e.metaKey);
                      if (e.ctrlKey || e.metaKey) return toggleCtrl(f.id);
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
                      {f.owner_id &&
                        currentUserId &&
                        f.owner_id !== currentUserId && (
                          <Avatar className='ml-auto size-5'>
                            <AvatarImage
                              src={
                                ownerProfiles[f.owner_id || '']?.avatar_url ||
                                ''
                              }
                            />
                            <AvatarFallback className='text-[9px]'>
                              {(
                                ownerProfiles[f.owner_id || '']?.display_name ||
                                'U'
                              )
                                .toString()
                                .slice(0, 2)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        )}
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
      )}

      <div className='space-y-2'>
        <div className='flex items-center justify-between'>
          {atRoot ? (
            <div className='text-foreground text-sm font-semibold'>Files</div>
          ) : (
            <div className='flex min-w-0 items-center gap-3 py-1.5'>
              <Button
                size='sm'
                variant='ghost'
                onClick={goBack}
                aria-label='Back'
                className='h-7 w-7 rounded-full p-0'
              >
                <Icons.chevronLeft className='size-4' />
              </Button>
              <Icons.folderFilled
                className={cn(
                  'size-6',
                  currentFolder
                    ? folderColorClass(currentFolder.id)
                    : 'text-blue-500'
                )}
              />
              <div className='min-w-0'>
                <div className='truncate text-sm font-semibold'>
                  {breadcrumb[breadcrumb.length - 1]?.name || 'Folder'}
                </div>
                <div className='text-muted-foreground text-[11px]'>
                  {folderMeta[parentId || 'root-none']?.count || 0} items •{' '}
                  {formatSize(folderMeta[parentId || 'root-none']?.size || 0)}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className='bg-background/60 text-muted-foreground hover:bg-background ml-auto rounded-full border px-2 py-0.5 text-[10px] tracking-wide uppercase'>
                    {parentId &&
                    ((items.find((i) => i.id === parentId) as any)
                      ?.visibility === 'public' ||
                      (folderVisibility[parentId] || 'private') === 'public')
                      ? 'Public'
                      : 'Private'}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end' className='text-xs'>
                  <DropdownMenuItem
                    onClick={async () => {
                      if (!parentId) return;
                      try {
                        const res = await fetch(
                          `/api/noblesuite/files/${parentId}`,
                          {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ visibility: 'public' })
                          }
                        );
                        const json = await res.json();
                        if (json?.ok) {
                          setItems((prev) =>
                            prev.map((it) =>
                              it.id === parentId
                                ? ({ ...it, visibility: 'public' } as any)
                                : it
                            )
                          );
                          setFolderVisibilityLocal(parentId, 'public');
                        }
                      } catch {}
                    }}
                  >
                    Public
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={async () => {
                      if (!parentId) return;
                      try {
                        const res = await fetch(
                          `/api/noblesuite/files/${parentId}`,
                          {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ visibility: 'private' })
                          }
                        );
                        const json = await res.json();
                        if (json?.ok) {
                          setItems((prev) =>
                            prev.map((it) =>
                              it.id === parentId
                                ? ({ ...it, visibility: 'private' } as any)
                                : it
                            )
                          );
                          setFolderVisibilityLocal(parentId, 'private');
                        }
                      } catch {}
                    }}
                  >
                    Private
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
          <div className='flex items-center gap-2'>
            {/* Filters */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size='sm' variant='outline' className='gap-1'>
                  <Icons.filter className='size-4' /> Filters
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-44 text-xs'>
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
            {/* View toggle */}
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
            {/* Selection is always available; no Select mode button */}
          </div>
        </div>
        {/* Hide list content while navigating to prevent stale flash */}
        {navLoading ? (
          <div className='grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4'>
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={`sk-${i}`}
                className='bg-muted/20 h-28 animate-pulse rounded-xl border'
              />
            ))}
          </div>
        ) : viewMode === 'grid' ? (
          <ScrollArea className='max-h-[calc(100dvh-260px)]'>
            <div
              className={cn(
                'relative grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4 transition',
                dndActive &&
                  'ring-primary/60 bg-primary/5 rounded-md p-3 ring-2'
              )}
            >
              {visibleList.map((it) => (
                <ContextMenu key={`ctx-${it.id}`}>
                  <ContextMenuTrigger asChild>
                    {/* Grid item: render folder or file card */}
                    {it.type === 'folder' ? (
                      <div
                        className={cn(
                          'group from-card/80 to-background hover:from-card hover:to-card min-w-[220px] rounded-xl border bg-gradient-to-br px-3 py-2 text-left shadow-sm transition hover:shadow-md',
                          isSelected(it.id) && 'border-primary border-2',
                          dropHoverId === it.id &&
                            'scale-[1.01] ring-2 ring-amber-400/70'
                        )}
                        title={it.name}
                        draggable
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          setDropHoverId(it.id);
                        }}
                        onDrop={async (e) => {
                          e.preventDefault();
                          setDropHoverId((prev) =>
                            prev === it.id ? null : prev
                          );
                          try {
                            const raw =
                              e.dataTransfer.getData('text/plain') ||
                              e.dataTransfer.getData('application/json');
                            let ids: string[] = [];
                            try {
                              const parsed = JSON.parse(raw);
                              if (Array.isArray(parsed?.ids)) ids = parsed.ids;
                            } catch {}
                            const moveIds = (ids || []).filter(
                              (id) => id && id !== it.id
                            );
                            if (moveIds.length === 0) return;
                            // capture previous parents for Undo
                            const prevParents: Record<
                              string,
                              string | null | undefined
                            > = {};
                            moveIds.forEach((id) => {
                              const it = items.find((x) => x.id === id);
                              prevParents[id] = it?.parent_id ?? null;
                            });
                            const prevItems = items;
                            setItems((p) =>
                              p.filter((x) => !moveIds.includes(x.id))
                            );
                            const res = await Promise.all(
                              moveIds.map((id) =>
                                fetch(`/api/noblesuite/files/${id}`, {
                                  method: 'PATCH',
                                  headers: {
                                    'Content-Type': 'application/json'
                                  },
                                  body: JSON.stringify({ parentId: it.id })
                                })
                              )
                            );
                            if (res.some((r) => !r.ok)) {
                              setItems(prevItems);
                              toast('Move failed');
                            } else {
                              toast(
                                `${moveIds.length} item${moveIds.length > 1 ? 's' : ''} moved`,
                                {
                                  action: {
                                    label: 'Undo',
                                    onClick: async () => {
                                      try {
                                        await Promise.all(
                                          moveIds.map((id) =>
                                            fetch(
                                              `/api/noblesuite/files/${id}`,
                                              {
                                                method: 'PATCH',
                                                headers: {
                                                  'Content-Type':
                                                    'application/json'
                                                },
                                                body: JSON.stringify({
                                                  parentId:
                                                    prevParents[id] ?? null
                                                })
                                              }
                                            )
                                          )
                                        );
                                        toast('Move undone');
                                        void load();
                                      } catch {
                                        toast('Undo failed');
                                      }
                                    }
                                  }
                                }
                              );
                            }
                            void load();
                          } catch {}
                        }}
                        onDragLeave={() => {
                          // no-op: rely on onDrop and outer handlers to clear to avoid flicker
                        }}
                        onDragEnd={() => {
                          setDropHoverId((prev) =>
                            prev === it.id ? null : prev
                          );
                        }}
                      >
                        {/* Hover checkbox for selection */}
                        <button
                          type='button'
                          role='checkbox'
                          aria-checked={isSelected(it.id)}
                          className={cn(
                            'border-border/70 bg-background/90 text-primary hover:border-primary/70 focus-visible:ring-primary/50 focus-visible:ring-offset-background absolute top-2 left-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border opacity-0 shadow-sm transition group-hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                            isSelected(it.id) &&
                              'border-primary bg-primary/10 opacity-100'
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            const me = e as React.MouseEvent<HTMLButtonElement>;
                            if (me.shiftKey)
                              return selectRange(
                                it.id,
                                me.ctrlKey || me.metaKey
                              );
                            toggleCtrl(it.id);
                          }}
                          aria-label='Select folder'
                          title={isSelected(it.id) ? 'Deselect' : 'Select'}
                        >
                          {isSelected(it.id) ? (
                            <Icons.check className='size-4' />
                          ) : (
                            <span className='border-border/70 block h-3.5 w-3.5 rounded-full border' />
                          )}
                        </button>
                        <div className='flex w-full min-w-0 items-start gap-3'>
                          {renamingId === it.id ? (
                            <div className='flex flex-1 items-center gap-3'>
                              <Icons.folderFilled
                                className={cn(
                                  'size-9 shrink-0 drop-shadow',
                                  folderColorClass(it.id)
                                )}
                              />
                              <input
                                ref={renameInputRef}
                                defaultValue={it.name}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    submitRename(
                                      it,
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
                                  return selectRange(
                                    it.id,
                                    e.ctrlKey || e.metaKey
                                  );
                                if (e.ctrlKey || e.metaKey)
                                  return toggleCtrl(it.id);
                                if (!isUuid(it.id)) return;
                                setLoading(true);
                                setNavLoading(true);
                                setCurrentFolder(it as any);
                                setParentId(it.id);
                                setBreadcrumb((prev) => {
                                  const existingIdx = prev.findIndex(
                                    (c) => c.id === it.id
                                  );
                                  if (existingIdx !== -1)
                                    return prev.slice(0, existingIdx + 1);
                                  return [
                                    ...prev,
                                    { id: it.id, name: it.name }
                                  ];
                                });
                              }}
                              title={it.name}
                              data-selected={isSelected(it.id) || undefined}
                            >
                              <Icons.folderFilled
                                className={cn(
                                  'size-9 shrink-0 drop-shadow',
                                  folderColorClass(it.id)
                                )}
                              />
                              <span
                                className='min-w-0 flex-1 truncate pr-1 whitespace-nowrap'
                                title={it.name}
                              >
                                {displayName(it.name)}
                              </span>
                              {it.is_starred ? (
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
                            <DropdownMenuContent
                              align='end'
                              className='text-xs'
                            >
                              <DropdownMenuItem onClick={() => startRename(it)}>
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleStar(it)}>
                                {it.is_starred ? 'Unstar' : 'Star'}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => downloadFolderZip(it as any)}
                                disabled={zipBusyId === it.id}
                              >
                                {zipBusyId === it.id
                                  ? 'Zipping…'
                                  : 'Download as ZIP'}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => deleteItem(it)}
                                data-variant='destructive'
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className='text-muted-foreground flex justify-between text-[10px]'>
                          <span>{`${folderMeta[it.id]?.count || 0} Files`}</span>
                          <span>
                            {formatSize(folderMeta[it.id]?.size || 0)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={cn(
                          'group bg-card relative flex flex-col overflow-hidden rounded-xl border shadow-sm transition hover:shadow-md',
                          isSelected(it.id) && 'border-primary border-2'
                        )}
                        draggable
                        onDragStart={(e) => {
                          const ids =
                            selectedIds.size > 0 && selectedIds.has(it.id)
                              ? Array.from(selectedIds)
                              : [it.id];
                          e.dataTransfer.setData(
                            'application/json',
                            JSON.stringify({ ids })
                          );
                        }}
                      >
                        <button
                          type='button'
                          role='checkbox'
                          aria-checked={isSelected(it.id)}
                          className={cn(
                            'border-border/70 bg-background/90 text-primary hover:border-primary/70 focus-visible:ring-primary/50 focus-visible:ring-offset-background absolute top-2 left-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border opacity-0 shadow-sm transition group-hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                            isSelected(it.id) &&
                              'border-primary bg-primary/10 opacity-100'
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCtrl(it.id);
                          }}
                          aria-label='Select file'
                          title={isSelected(it.id) ? 'Deselect' : 'Select'}
                        >
                          {isSelected(it.id) ? (
                            <Icons.check className='size-4' />
                          ) : (
                            <span className='border-border/70 block h-3.5 w-3.5 rounded-full border' />
                          )}
                        </button>
                        <button
                          className='bg-muted/40 relative flex aspect-video w-full items-center justify-center overflow-hidden'
                          onClick={(e) => {
                            if (e.shiftKey)
                              return selectRange(it.id, e.ctrlKey || e.metaKey);
                            if (e.ctrlKey || e.metaKey)
                              return toggleCtrl(it.id);
                            return void openFile(it, false);
                          }}
                          title={it.name}
                          data-selected={isSelected(it.id) || undefined}
                        >
                          {isImage(it as FileItem) && thumbUrls[it.id] ? (
                            <img
                              src={thumbUrls[it.id]}
                              alt=''
                              className='h-full w-full object-cover'
                            />
                          ) : (
                            <div className='text-muted-foreground'>
                              {renderFileIcon(it as FileItem, 'size-10')}
                            </div>
                          )}
                          {it.is_starred ? (
                            <Icons.starFilled className='absolute top-2 right-2 size-4 text-amber-500 drop-shadow' />
                          ) : null}
                        </button>
                        <div className='flex flex-col gap-1 p-3 pt-2'>
                          {renamingId === it.id ? (
                            <input
                              ref={renameInputRef}
                              defaultValue={visibleName(it as FileItem)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  submitRename(
                                    it,
                                    (e.target as HTMLInputElement).value
                                  );
                                } else if (e.key === 'Escape') {
                                  setRenamingId(null);
                                }
                              }}
                              className='bg-background/80 focus:ring-primary/40 w-full rounded border px-1 py-1 text-xs ring-1 ring-transparent outline-none'
                            />
                          ) : (
                            <div className='flex items-start gap-2'>
                              <button
                                className='cursor-pointer truncate text-left font-medium'
                                onClick={() => void openFile(it, false)}
                                title={it.name}
                              >
                                {displayName(it.name)}
                              </button>
                              <span className='bg-muted/60 ml-auto rounded px-1.5 py-0.5 text-[10px] tracking-wide uppercase'>
                                {(it as any).ext ||
                                  (it as any).mime_type?.split('/')?.[1] ||
                                  'FILE'}
                              </span>
                            </div>
                          )}
                          <div
                            className='text-muted-foreground truncate text-[11px]'
                            title={`${formatDate(it.updated_at)} • ${formatSize((it as any).size_bytes)}`}
                          >
                            {formatDate(it.updated_at)} •{' '}
                            {formatSize((it as any).size_bytes)}
                          </div>
                          <div className='flex justify-end'>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className='text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer rounded-md p-1 opacity-0 transition group-hover:opacity-100'>
                                  <Icons.ellipsis className='size-4' />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align='end'
                                className='text-xs'
                              >
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
                                <DropdownMenuItem
                                  onClick={() => startRename(it)}
                                >
                                  Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => toggleStar(it)}
                                >
                                  {it.is_starred ? 'Unstar' : 'Star'}
                                </DropdownMenuItem>
                                {(it as any).storage_path ? (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      setSharePath((it as any).storage_path!)
                                    }
                                  >
                                    Share link
                                  </DropdownMenuItem>
                                ) : null}
                                <DropdownMenuItem
                                  onClick={() => deleteItem(it)}
                                  className='text-destructive focus:text-destructive'
                                >
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    )}
                  </ContextMenuTrigger>
                  <ContextMenuContent className='text-xs'>
                    {it.type === 'folder' ? (
                      <>
                        <ContextMenuItem onClick={() => startRename(it)}>
                          Rename
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => toggleStar(it)}>
                          {it.is_starred ? 'Unstar' : 'Star'}
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={() => downloadFolderZip(it as any)}
                          disabled={zipBusyId === it.id}
                        >
                          {zipBusyId === it.id ? 'Zipping…' : 'Download as ZIP'}
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={() => deleteItem(it)}
                          data-variant='destructive'
                        >
                          Delete
                        </ContextMenuItem>
                      </>
                    ) : (
                      <>
                        <ContextMenuItem
                          onClick={() => void openFile(it, false)}
                        >
                          Open
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={() => void openFile(it, true)}
                        >
                          Download
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => startRename(it)}>
                          Rename
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => toggleStar(it)}>
                          {it.is_starred ? 'Unstar' : 'Star'}
                        </ContextMenuItem>
                        {(it as any).storage_path ? (
                          <ContextMenuItem
                            onClick={() =>
                              setSharePath((it as any).storage_path!)
                            }
                          >
                            Share link
                          </ContextMenuItem>
                        ) : null}
                        <ContextMenuItem
                          onClick={() => deleteItem(it)}
                          data-variant='destructive'
                        >
                          Delete
                        </ContextMenuItem>
                      </>
                    )}
                  </ContextMenuContent>
                </ContextMenu>
              ))}
              {!loading && visibleList.length === 0 && (
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
                        {atRoot ? 'No items yet' : 'This folder is empty'}
                      </div>
                      <div className='text-xs'>
                        Drag and drop files here, upload, or create a new
                        folder.
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
          </ScrollArea>
        ) : (
          <ScrollArea className='max-h-[calc(100dvh-260px)]'>
            <div className='overflow-hidden rounded-md border'>
              <div className='bg-muted/50 text-muted-foreground grid grid-cols-[40px_1fr_120px_100px_120px_40px] px-2 py-1 text-[10px] tracking-wide uppercase'>
                <div className='flex items-center justify-center'>
                  <Checkbox
                    className='border-border focus-visible:ring-primary/50 focus-visible:ring-offset-background data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground h-5 w-5 rounded-md border-2 transition focus-visible:ring-2 focus-visible:ring-offset-2'
                    checked={
                      visibleList.length > 0 &&
                      selectedIds.size === visibleList.length
                    }
                    onCheckedChange={(v) => {
                      const checked = Boolean(v);
                      if (checked)
                        setSelectedIds(new Set(visibleList.map((x) => x.id)));
                      else setSelectedIds(new Set());
                    }}
                    aria-label='Select all items'
                  />
                </div>
                <div>Name</div>
                <div>Type</div>
                <div>Size</div>
                <div>Updated</div>
                <div />
              </div>
              <div className='divide-y text-sm'>
                {visibleList.map((it) => (
                  <ContextMenu key={`ctx-row-${it.id}`}>
                    <ContextMenuTrigger asChild>
                      <div
                        key={it.id}
                        className={cn(
                          'hover:bg-muted/20 grid grid-cols-[40px_1fr_120px_100px_120px_40px] items-center px-2 py-2 text-xs',
                          isSelected(it.id) &&
                            'outline-primary/50 rounded-sm outline outline-2'
                        )}
                        draggable
                        onDragStart={(e) => {
                          const ids =
                            selectedIds.size > 0 && selectedIds.has(it.id)
                              ? Array.from(selectedIds)
                              : [it.id];
                          e.dataTransfer.setData(
                            'application/json',
                            JSON.stringify({ ids })
                          );
                        }}
                      >
                        <div className='flex items-center gap-2'>
                          <button
                            type='button'
                            role='checkbox'
                            aria-checked={isSelected(it.id)}
                            className={cn(
                              'border-border/70 bg-background/95 text-primary hover:border-primary/70 focus-visible:ring-primary/50 focus-visible:ring-offset-background flex h-6 w-6 items-center justify-center rounded-full border transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                              isSelected(it.id) &&
                                'border-primary bg-primary/10'
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              const me =
                                e as React.MouseEvent<HTMLButtonElement>;
                              if (me.shiftKey)
                                return selectRange(
                                  it.id,
                                  me.ctrlKey || me.metaKey
                                );
                              toggleCtrl(it.id);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === ' ' || e.key === 'Enter') {
                                e.preventDefault();
                                if (e.shiftKey)
                                  return selectRange(
                                    it.id,
                                    e.ctrlKey || e.metaKey
                                  );
                                toggleCtrl(it.id);
                              }
                            }}
                            aria-label='Select row'
                          >
                            {isSelected(it.id) ? (
                              <Icons.check className='size-4' />
                            ) : (
                              <span className='border-border/70 block h-3 w-3 rounded-full border' />
                            )}
                          </button>
                          {renderFileIcon(it as any, 'size-5')}
                          {it &&
                            (it as any).owner_id &&
                            currentUserId &&
                            (it as any).owner_id !== currentUserId && (
                              <Avatar className='ml-1 size-4'>
                                <AvatarImage
                                  src={
                                    ownerProfiles[(it as any).owner_id]
                                      ?.avatar_url || ''
                                  }
                                />
                                <AvatarFallback className='text-[8px]'>
                                  {(
                                    ownerProfiles[(it as any).owner_id]
                                      ?.display_name || 'U'
                                  )
                                    ?.toString()
                                    .slice(0, 2)
                                    .toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            )}
                        </div>
                        <div className='flex w-full items-center gap-2'>
                          {renamingId === it.id ? (
                            <input
                              ref={renameInputRef}
                              defaultValue={it.name}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  submitRename(
                                    it,
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
                              title={it.name}
                              onClick={(e) => {
                                if (e.shiftKey)
                                  return selectRange(
                                    it.id,
                                    e.ctrlKey || e.metaKey
                                  );
                                if (e.ctrlKey || e.metaKey)
                                  return toggleCtrl(it.id);
                                if (it.type === 'folder') {
                                  if (!isUuid(it.id)) return;
                                  setLoading(true);
                                  setNavLoading(true);
                                  setCurrentFolder(it as any);
                                  setParentId(it.id);
                                  setBreadcrumb((prev) => {
                                    const existingIdx = prev.findIndex(
                                      (c) => c.id === it.id
                                    );
                                    if (existingIdx !== -1)
                                      return prev.slice(0, existingIdx + 1);
                                    return [
                                      ...prev,
                                      { id: it.id, name: it.name }
                                    ];
                                  });
                                  return;
                                }
                                return void openFile(it, false);
                              }}
                            >
                              {displayName(it.name)}
                            </button>
                          )}
                          {it.is_starred ? (
                            <Icons.starFilled className='size-3 text-amber-500' />
                          ) : null}
                        </div>
                        <div className='text-muted-foreground text-[10px] uppercase'>
                          {(it as any).ext ||
                            (it as any).mime_type?.split('/')?.[1] ||
                            (it.type === 'folder' ? 'FOLDER' : 'FILE')}
                        </div>
                        <div className='text-[10px]'>
                          {it.type === 'folder'
                            ? formatSize(folderMeta[it.id]?.size || 0)
                            : formatSize((it as any).size_bytes)}
                        </div>
                        <div className='text-[10px]'>
                          {formatDate(it.updated_at)}
                        </div>
                        <div className='flex justify-end'>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className='text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer rounded-md p-1'>
                                <Icons.ellipsis className='size-4' />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align='end'
                              className='text-xs'
                            >
                              {it.type === 'folder' ? (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => startRename(it)}
                                  >
                                    Rename
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => toggleStar(it)}
                                  >
                                    {it.is_starred ? 'Unstar' : 'Star'}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => downloadFolderZip(it as any)}
                                    disabled={zipBusyId === it.id}
                                  >
                                    {zipBusyId === it.id
                                      ? 'Zipping…'
                                      : 'Download as ZIP'}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => deleteItem(it)}
                                    className='text-destructive focus:text-destructive'
                                  >
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              ) : (
                                <>
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
                                  <DropdownMenuItem
                                    onClick={() => startRename(it)}
                                  >
                                    Rename
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => toggleStar(it)}
                                  >
                                    {it.is_starred ? 'Unstar' : 'Star'}
                                  </DropdownMenuItem>
                                  {(it as any).storage_path ? (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        setSharePath((it as any).storage_path!)
                                      }
                                    >
                                      Share link
                                    </DropdownMenuItem>
                                  ) : null}
                                  <DropdownMenuItem
                                    onClick={() => deleteItem(it)}
                                    className='text-destructive focus:text-destructive'
                                  >
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className='text-xs'>
                      {it.type === 'folder' ? (
                        <>
                          <ContextMenuItem onClick={() => startRename(it)}>
                            Rename
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => toggleStar(it)}>
                            {it.is_starred ? 'Unstar' : 'Star'}
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => downloadFolderZip(it as any)}
                            disabled={zipBusyId === it.id}
                          >
                            {zipBusyId === it.id
                              ? 'Zipping…'
                              : 'Download as ZIP'}
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => deleteItem(it)}
                            data-variant='destructive'
                          >
                            Delete
                          </ContextMenuItem>
                        </>
                      ) : (
                        <>
                          <ContextMenuItem
                            onClick={() => void openFile(it, false)}
                          >
                            Open
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => void openFile(it, true)}
                          >
                            Download
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => startRename(it)}>
                            Rename
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => toggleStar(it)}>
                            {it.is_starred ? 'Unstar' : 'Star'}
                          </ContextMenuItem>
                          {(it as any).storage_path ? (
                            <ContextMenuItem
                              onClick={() =>
                                setSharePath((it as any).storage_path!)
                              }
                            >
                              Share link
                            </ContextMenuItem>
                          ) : null}
                          <ContextMenuItem
                            onClick={() => deleteItem(it)}
                            data-variant='destructive'
                          >
                            Delete
                          </ContextMenuItem>
                        </>
                      )}
                    </ContextMenuContent>
                  </ContextMenu>
                ))}
                {!loading && visibleList.length === 0 && (
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
                        {atRoot ? 'No items yet' : 'This folder is empty'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        )}
      </div>
      {loading && (
        <div className='from-primary via-primary/40 to-primary absolute inset-x-0 top-0 h-0.5 animate-[pulse_2s_ease-in-out_infinite] bg-gradient-to-r' />
      )}

      {/* Fixed bottom breadcrumb strip with drop targets (primary nav) */}
      <div className='pointer-events-none fixed inset-x-0 bottom-0 z-10 flex justify-center px-5 pb-3'>
        <div className='bg-background/85 supports-[backdrop-filter]:bg-background/60 pointer-events-auto relative mx-auto flex max-w-[980px] items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-xs shadow-xl backdrop-blur-md'>
          {breadcrumb.map((b, idx) => (
            <div
              key={`crumb-bottom-${b.id ?? 'root'}-${idx}`}
              className='flex items-center'
            >
              <button
                className={cn(
                  'hover:bg-muted/50 flex items-center gap-2 rounded-full px-2.5 py-1.5 transition',
                  b.id === parentId
                    ? 'bg-primary/10 ring-primary/40 ring-1'
                    : 'bg-muted/20'
                )}
                title={b.name}
                onClick={() => {
                  if (b.id && !isUuid(b.id)) return;
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
                    // Capture previous parents for Undo
                    const targetParent = b.id || null;
                    const moveIds = ids;
                    const prevParents: Record<
                      string,
                      string | null | undefined
                    > = {};
                    moveIds.forEach((id) => {
                      const it = items.find((x) => x.id === id);
                      prevParents[id] = it?.parent_id ?? null;
                    });
                    const prevItems = items;
                    setItems((p) => p.filter((it) => !moveIds.includes(it.id)));
                    const res = await Promise.all(
                      moveIds.map((id) =>
                        fetch(`/api/noblesuite/files/${id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ parentId: targetParent })
                        })
                      )
                    );
                    if (res.some((r) => !r.ok)) {
                      setItems(prevItems);
                      toast('Move failed');
                    } else {
                      toast(
                        `${moveIds.length} item${moveIds.length > 1 ? 's' : ''} moved`,
                        {
                          action: {
                            label: 'Undo',
                            onClick: async () => {
                              try {
                                await Promise.all(
                                  moveIds.map((id) =>
                                    fetch(`/api/noblesuite/files/${id}`, {
                                      method: 'PATCH',
                                      headers: {
                                        'Content-Type': 'application/json'
                                      },
                                      body: JSON.stringify({
                                        parentId: prevParents[id] ?? null
                                      })
                                    })
                                  )
                                );
                                toast('Move undone');
                                void load();
                              } catch {
                                toast('Undo failed');
                              }
                            }
                          }
                        }
                      );
                    }
                    void load();
                  } catch {}
                }}
              >
                <Icons.folder className='size-4 opacity-60' />
                <span className='max-w-[160px] truncate'>{b.name}</span>
              </button>
              {idx < breadcrumb.length - 1 && (
                <Icons.chevronRight className='mx-1 size-4 opacity-40' />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* New Folder Dialog */}
      <Dialog
        open={showNewFolder}
        onOpenChange={(o: boolean) => setShowNewFolder(o)}
      >
        <DialogContent className='flex h-[100dvh] w-[100vw] flex-col sm:max-w-none md:h-[70vh] md:w-[50vw]'>
          <DialogHeader className='space-y-1'>
            <DialogTitle>Create new folder</DialogTitle>
            <DialogDescription className='leading-tight'>
              Choose a name, a color, and optionally include existing files.
            </DialogDescription>
          </DialogHeader>
          <div className='grid min-h-0 flex-1 grid-cols-1 gap-6 md:grid-cols-5'>
            {/* Left: folder preview */}
            <div className='md:col-span-2'>
              <div className='bg-card relative flex h-full flex-col rounded-xl border p-4 shadow-sm'>
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
                <div className='mt-1 text-center'>
                  <div className='truncate text-sm font-medium'>
                    {newFolderForm.name || 'New Folder'}
                  </div>
                  <div className='text-muted-foreground mt-0.5 text-[11px]'>
                    {newFolderForm.visibility === 'public'
                      ? 'Public'
                      : 'Private'}
                  </div>
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
            {/* Right: input fields (scrollable) */}
            <div className='min-h-0 md:col-span-3'>
              <ScrollArea className='h-full pr-1'>
                <div className='space-y-4'>
                  <div className='space-y-1'>
                    <label className='text-xs font-medium'>Name</label>
                    <input
                      value={newFolderForm.name}
                      onChange={(e) =>
                        setNewFolderForm((f) => ({
                          ...f,
                          name: e.target.value
                        }))
                      }
                      placeholder='e.g., Market Analysis'
                      className='bg-background mt-1 h-9 w-full rounded-md border px-2 text-sm'
                    />
                  </div>
                  {/* Visibility selector */}
                  <div className='space-y-1'>
                    <label className='text-xs font-medium'>Visibility</label>
                    <div className='flex items-center gap-2'>
                      <button
                        type='button'
                        onClick={() =>
                          setNewFolderForm((f) => ({
                            ...f,
                            visibility: 'public'
                          }))
                        }
                        className={cn(
                          'rounded-md border px-3 py-1.5 text-xs',
                          newFolderForm.visibility === 'public'
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'hover:bg-muted'
                        )}
                      >
                        Public
                      </button>
                      <button
                        type='button'
                        onClick={() =>
                          setNewFolderForm((f) => ({
                            ...f,
                            visibility: 'private'
                          }))
                        }
                        className={cn(
                          'rounded-md border px-3 py-1.5 text-xs',
                          newFolderForm.visibility === 'private'
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'hover:bg-muted'
                        )}
                      >
                        Private
                      </button>
                    </div>
                  </div>
                  {/* Share with (only when public) */}
                  {newFolderForm.visibility === 'public' && (
                    <div className='space-y-2'>
                      <label className='text-xs font-medium'>Share with</label>
                      <div className='space-y-2'>
                        {/* Chip input */}
                        <div className='flex flex-wrap items-center gap-1 rounded-md border px-2 py-1'>
                          {newFolderForm.shareWithIds &&
                            Array.from(newFolderForm.shareWithIds ?? []).map(
                              (id) => {
                                const c =
                                  shareCache[id] ||
                                  shareContacts.find((x) => x.id === id);
                                const label = (c?.display_name ||
                                  (c as any)?.username ||
                                  (c as any)?.email ||
                                  'User') as string;
                                return (
                                  <span
                                    key={`chip-${id}`}
                                    className='inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]'
                                  >
                                    {label}
                                    <button
                                      type='button'
                                      className='text-muted-foreground hover:text-foreground'
                                      onClick={() =>
                                        setNewFolderForm((prev) => {
                                          const next = new Set(
                                            prev.shareWithIds
                                          );
                                          next.delete(id);
                                          return {
                                            ...prev,
                                            shareWithIds: next
                                          } as any;
                                        })
                                      }
                                      aria-label='Remove'
                                    >
                                      ×
                                    </button>
                                  </span>
                                );
                              }
                            )}
                          <input
                            value={shareQuery}
                            onChange={(e) => setShareQuery(e.target.value)}
                            placeholder='Search contacts...'
                            className='h-7 min-w-[120px] flex-1 border-0 bg-transparent text-xs outline-none focus:outline-none'
                          />
                        </div>
                        {/* Results */}
                        <div className='max-h-36 overflow-auto rounded border'>
                          {shareLoading ? (
                            <div className='text-muted-foreground p-2 text-[11px]'>
                              Loading...
                            </div>
                          ) : (
                            <ul className='divide-y text-sm'>
                              {sendContacts.map((c) => {
                                const label =
                                  c.display_name ||
                                  c.username ||
                                  c.email ||
                                  c.id;
                                const isSelected =
                                  newFolderForm.shareWithIds.has(c.id);
                                return (
                                  <li key={c.id}>
                                    <button
                                      type='button'
                                      onClick={() =>
                                        setNewFolderForm((prev) => {
                                          const next = new Set(
                                            prev.shareWithIds
                                          );
                                          if (next.has(c.id)) next.delete(c.id);
                                          else next.add(c.id);
                                          return {
                                            ...prev,
                                            shareWithIds: next
                                          } as any;
                                        })
                                      }
                                      className={cn(
                                        'hover:bg-muted/40 w-full px-2 py-2 text-left',
                                        isSelected && 'bg-primary/5'
                                      )}
                                    >
                                      <div className='flex items-center gap-2'>
                                        <div className='bg-muted/60 flex h-6 w-6 items-center justify-center rounded-full text-[10px]'>
                                          {label.slice(0, 2).toUpperCase()}
                                        </div>
                                        <div className='min-w-0'>
                                          <div className='truncate text-xs font-medium'>
                                            {label}
                                          </div>
                                          {c.email ? (
                                            <div className='text-muted-foreground truncate text-[10px]'>
                                              {c.email}
                                            </div>
                                          ) : null}
                                        </div>
                                      </div>
                                    </button>
                                  </li>
                                );
                              })}
                              {sendContacts.length === 0 && (
                                <li className='text-muted-foreground px-2 py-2 text-[11px]'>
                                  No contacts found.
                                </li>
                              )}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  <div>
                    <label className='text-xs font-medium'>
                      Include existing files
                    </label>
                    <div className='text-muted-foreground mb-2 text-[11px]'>
                      Move selected files into the new folder after it’s
                      created.
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
              </ScrollArea>
            </div>
          </div>
          <DialogFooter className='flex items-center gap-2'>
            {/* Cancel left */}
            <Button variant='outline' onClick={() => setShowNewFolder(false)}>
              Cancel
            </Button>
            <div className='ml-auto' />
            {/* Primary actions right */}
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
                  visibility: 'private',
                  shareWithIds: new Set()
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
                        const { data, error } = await supabase.storage
                          .from(FILES_BUCKET)
                          .createSignedUrl(it.storage_path!, 24 * 60 * 60);
                        if (!error && data?.signedUrl) {
                          links.push(`${it.name}: ${data.signedUrl}`);
                        }
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
                    visibility: 'private',
                    shareWithIds: new Set()
                  });
                  void load();
                }}
              >
                Share
              </Button>
            )}
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

      {/* In-app File Preview SidePanel */}
      <SidePanel
        open={!!preview}
        onClose={() => setPreview(null)}
        title={
          preview?.item ? (
            <div className='flex min-w-0 items-center gap-2'>
              {preview ? renderFileIcon(preview.item, 'size-5') : null}
              <span className='truncate'>{preview?.item.name}</span>
            </div>
          ) : (
            'Preview'
          )
        }
        footer={
          preview?.item ? (
            <div className='flex w-full items-center gap-3'>
              {/* Left-aligned responsive metadata */}
              <div className='bg-card/70 flex min-w-0 flex-1 items-center gap-3 rounded-md border px-3 py-2 text-[11px]'>
                {renderFileIcon(preview.item, 'size-4')}
                <div className='min-w-0 truncate'>
                  <span className='text-muted-foreground'>
                    {formatSize(preview.item.size_bytes)}
                  </span>
                  <span className='mx-2 opacity-50'>•</span>
                  <span className='text-muted-foreground'>
                    {formatDate(preview.item.updated_at)}
                  </span>
                  <span className='mx-2 opacity-50'>•</span>
                  <span className='text-muted-foreground'>
                    {preview.item.ext?.toUpperCase() ||
                      preview.item.mime_type ||
                      'FILE'}
                  </span>
                </div>
              </div>
              {/* Actions right */}
              <div className='ml-auto flex items-center gap-2'>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => setPreview(null)}
                >
                  Close
                </Button>
                <Button
                  size='sm'
                  onClick={() => void openFile(preview.item!, true)}
                  className='gap-1'
                >
                  <Icons.download className='size-4' /> Download
                </Button>
                <Button
                  size='sm'
                  variant='ghost'
                  onClick={() => toggleStar(preview.item!)}
                  className='gap-1'
                >
                  {preview.item.is_starred ? (
                    <Icons.starFilled className='size-4 text-amber-500' />
                  ) : (
                    <Icons.star className='size-4' />
                  )}
                  {preview.item.is_starred ? 'Unstar' : 'Star'}
                </Button>
              </div>
            </div>
          ) : null
        }
      >
        {preview &&
          (() => {
            const kind = getKind(preview.item);
            if (kind === 'image') {
              return (
                <img
                  src={preview.url}
                  alt=''
                  className='max-h-[70vh] w-full object-contain'
                />
              );
            }
            if (kind === 'video') {
              return (
                <video
                  src={preview.url}
                  controls
                  className='h-[60vh] w-full bg-black'
                />
              );
            }
            if (kind === 'audio') {
              return (
                <div className='p-4'>
                  <audio src={preview.url} controls className='w-full' />
                </div>
              );
            }
            if (
              preview.item.ext?.toLowerCase() === 'pdf' ||
              preview.item.mime_type === 'application/pdf'
            ) {
              return (
                <iframe
                  src={`/api/noblesuite/files/preview?id=${preview.item.id}`}
                  className='h-full min-h-[60vh] w-full flex-1 rounded-lg border-0 shadow-sm'
                  title='PDF Preview'
                />
              );
            }
            return (
              <div className='p-6 text-sm'>
                <div className='text-muted-foreground mb-2'>
                  Preview not available for this file type.
                </div>
                <Button
                  size='sm'
                  onClick={() => void openFile(preview.item, true)}
                  className='gap-1'
                >
                  <Icons.download className='size-4' /> Download
                </Button>
              </div>
            );
          })()}
      </SidePanel>
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
      return 'Storage bucket not found. Ensure NEXT_PUBLIC_FILES_BUCKET matches an existing bucket (default "files"). Create it in Supabase Storage and verify RLS/policies allow uploads.';
    case 'NO_STORAGE_PATH':
      return 'File storage path is not set.';
    case 'FILE_URL_UNAVAILABLE':
      return 'File URL could not be generated.';
    case 'NOT_FOUND':
      return 'Record not found.';
    case 'FORBIDDEN':
      return 'You do not have permission to perform this action.';
    case 'FOLDER_NOT_EMPTY':
      return 'Folder is not empty.';
    case 'OPEN_FAILED':
      return 'Failed to open file (see console for details).';
    // Raw messages we sometimes surface from Supabase SDK:
    case 'new row violates row-level security policy for table "objects"':
    case 'permission denied for table objects':
      return 'RLS blocked: Path first segment does not match user id, or no active session.';
    case 'JWT expired':
      return 'Session expired. Please sign in again.';
    case 'Invalid JWT':
      return 'Invalid session. Please sign out and sign in again.';
    default:
      return code || 'Unknown error';
  }
}

// DEBUG HELP: Useful console snippets
// 1) (await supabase.auth.getUser()).data.user?.id  -> client user id
// 2) await supabase.storage.from('files').createSignedUrl('<storage_path>', 60)
// 3) Verify: storage_path first segment == user id ?
// 4) If RLS failure: bucket_id='files' AND split_part(name,'/',1)=auth.uid()::text
