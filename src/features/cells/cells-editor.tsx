'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Workbook } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import SuiteHeader from '@/components/suite/suite-header';
import { supabase } from '@/lib/supabaseClient';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import {
  ImportHelper,
  importToolBarItem,
  exportToolBarItem
} from '@corbe30/fortune-excel';
import { useTabs } from '@/components/layout/tabs-context';

type CellsEditorProps = {
  // Tab id to allow updating the tab title when renamed
  tabId?: string;
  // If provided, load this sheet id from API and save back to it
  sheetId?: string | null;
  // Optional initial title for new workbook
  title?: string;
  // Optional file context from files table (to show name)
  fileName?: string;
  // If provided and sheetId is not set, will import xlsx/csv from this URL into a new workbook
  importUrl?: string;
};

// Minimal FortuneSheet data type
type FortuneSheet = { name: string; celldata?: any[] };

export default function CellsEditor({
  tabId,
  sheetId,
  title,
  fileName,
  importUrl
}: CellsEditorProps) {
  const [sheets, setSheets] = useState<FortuneSheet[]>([{ name: 'Sheet1' }]);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [loadedSheetId, setLoadedSheetId] = useState<string | null>(null);
  const [registeredFileId, setRegisteredFileId] = useState<string | null>(null);
  const [lastSavedHash, setLastSavedHash] = useState<string>('');
  const workbookRef = useRef<any>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [hostReady, setHostReady] = useState(false);
  const [hostSize, setHostSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0
  });
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [workbookKey, setWorkbookKey] = useState(0);
  const [renderWorkbook, setRenderWorkbook] = useState(false);
  const didMountOnReadyRef = useRef(false);
  const { updateTabTitle } = useTabs();
  const [shareBusy, setShareBusy] = useState(false);
  const [currentShares, setCurrentShares] = useState<
    Array<{
      id: string;
      role: 'viewer' | 'editor' | 'owner';
      display_name?: string | null;
      avatar_url?: string | null;
    }>
  >([]);

  // Title / rename state
  const [baseTitle, setBaseTitle] = useState<string>(() =>
    fileName ? stripExt(fileName) : title || 'Untitled Cells'
  );
  const [nameInput, setNameInput] = useState(baseTitle);
  const [starred, setStarred] = useState<boolean>(false);

  // Load existing sheet content if sheetId provided
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!sheetId) return;
      try {
        setLoading(true);
        const res = await fetch(
          `/api/noblesuite/cells/sheets/${sheetId}/data`,
          {
            cache: 'no-store'
          }
        );
        const json = await res.json();
        if (!json?.ok) return;
        const sd = json.item?.sheet_data as any;
        const loaded: FortuneSheet[] =
          Array.isArray(sd) && sd.length ? sd : [{ name: 'Sheet1' }];
        if (!cancelled) {
          setSheets(loaded);
          setLoadedSheetId(sheetId);
          setLastSavedHash(hashData(loaded));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sheetId]);

  // If importUrl provided (xlsx/csv), fetch and import once on mount
  useEffect(() => {
    let cancelled = false;
    if (!importUrl || sheetId) return;
    (async () => {
      try {
        const resp = await fetch(importUrl, { cache: 'no-store' });
        if (!resp.ok) return;
        const blob = await resp.blob();
        const name = fileName || 'import.xlsx';
        const f = new File([blob], name, { type: blob.type || '' });
        if (!cancelled) await handleImport(f);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importUrl]);

  // Track user id once
  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }) => setCurrentUserId(data.user?.id || null));
  }, []);

  // If we have a sheet id, try to find the files row for star/name updates
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!loadedSheetId) return;
      try {
        const { data, error } = await supabase
          .from('files')
          .select('id,name,is_starred')
          .eq('storage_path', `cells:${loadedSheetId}`)
          .eq('is_deleted', false)
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        if (!error && data) {
          setRegisteredFileId((data as any).id);
          const base = stripExt((data as any).name || baseTitle);
          setBaseTitle(base);
          setNameInput(base);
          setStarred(Boolean((data as any).is_starred));
          // Load current shares for Share popover
          try {
            const { data: rows } = await supabase
              .from('files_shares')
              .select(
                'user_id,role,profiles:profiles(id,display_name,avatar_url)'
              )
              .eq('file_id', (data as any).id);
            const mapped = (rows || []).map((r: any) => ({
              id: r.user_id,
              role: (r.role as 'viewer' | 'editor') || 'viewer',
              display_name: r.profiles?.display_name ?? null,
              avatar_url: r.profiles?.avatar_url ?? null
            }));
            setCurrentShares(mapped);
          } catch {}
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [loadedSheetId]);

  // Measure host container to avoid NaN sizes in FortuneSheet
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect as DOMRectReadOnly | undefined;
      const rawW = rect?.width;
      const rawH = rect?.height;
      const validW = Number.isFinite(rawW as number) ? (rawW as number) : 0;
      const validH = Number.isFinite(rawH as number) ? (rawH as number) : 0;
      const width = Math.max(1, Math.floor(validW));
      const height = Math.max(1, Math.floor(validH));
      if (width && height) {
        setHostSize({ width, height });
        setHostReady(true);
      } else {
        setHostReady(false);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Once we have a valid host size, defer one frame before rendering Workbook
  useEffect(() => {
    if (hostReady) {
      let raf = requestAnimationFrame(() => {
        setRenderWorkbook(true);
        // Remount workbook once on first ready to let internals measure
        if (!didMountOnReadyRef.current) {
          didMountOnReadyRef.current = true;
          setWorkbookKey((k) => k + 1);
        }
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setRenderWorkbook(false);
    }
  }, [hostReady]);

  // Helper: simple JSON hash to detect changes
  const stableStringify = (val: any) => {
    try {
      return JSON.stringify(val);
    } catch {
      return '';
    }
  };
  function hashData(d: any) {
    return stableStringify(d);
  }

  // Debounced auto-save on sheets change
  useEffect(() => {
    if (!loadedSheetId) return;
    const currentHash = hashData(sheets);
    if (currentHash === lastSavedHash) return;
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        setSaving(true);
        const res = await fetch(
          `/api/noblesuite/cells/sheets/${loadedSheetId}/data`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sheet_data: sheets }),
            signal: controller.signal
          }
        );
        const json = await res.json();
        if (json?.ok) setLastSavedHash(currentHash);
      } finally {
        setSaving(false);
      }
    }, 600);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [sheets, loadedSheetId]);

  // If this is a new editor (no sheetId), create a workbook on first non-empty change
  const hasCreatedRef = useRef(false);
  useEffect(() => {
    if (loadedSheetId || hasCreatedRef.current) return; // already created/loaded
    // Detect non-empty data
    const nonEmpty = hasContent(sheets);
    if (!nonEmpty) return;
    hasCreatedRef.current = true; // guard against loops
    let mounted = true;
    (async () => {
      try {
        setSaving(true);
        const title0 = title || fileName || baseTitle || 'Untitled Cells';
        const res = await fetch('/api/noblesuite/cells/workbooks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title0 })
        });
        const json = await res.json();
        if (!json?.ok) return;
        const newSheetId: string = json.sheet?.id;
        if (mounted) setLoadedSheetId(newSheetId);
        // Save initial content
        await fetch(`/api/noblesuite/cells/sheets/${newSheetId}/data`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sheet_data: sheets })
        });
        if (mounted) setLastSavedHash(hashData(sheets));
        await registerAsFileIfMissing(newSheetId, baseTitle || title0);
      } finally {
        setSaving(false);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheets]);

  async function registerAsFileIfMissing(sheetId: string, baseTitle: string) {
    if (registeredFileId) return registeredFileId;
    try {
      const { data: auth } = await supabase.auth.getUser();
      const ownerId = auth.user?.id;
      if (!ownerId) return null;
      // Ensure unique name
      const name = `${await ensureUniqueBase(baseTitle, ownerId)}.cells`;
      const { data, error } = await supabase
        .from('files')
        .insert({
          name,
          parent_id: null,
          type: 'binary',
          owner_id: ownerId,
          ext: 'cells',
          mime_type: 'application/x-noblesheet',
          size_bytes: null,
          storage_path: `cells:${sheetId}`,
          is_starred: starred
        })
        .select('id')
        .single();
      if (!error && data?.id) setRegisteredFileId(data.id);
      return data?.id || null;
    } catch {
      return null;
    }
  }

  function hasContent(arr: FortuneSheet[]): boolean {
    try {
      return (arr?.[0]?.celldata || []).length > 0;
    } catch {
      return false;
    }
  }

  // Import from xlsx/csv using SheetJS -> convert to FortuneSheet celldata
  async function handleImport(file: File) {
    try {
      const lower = file.name.toLowerCase();
      const isCsv = lower.endsWith('.csv') || /csv/i.test(file.type || '');
      let wb: XLSX.WorkBook | null = null;

      // Helper: delimiter detection for CSV (very simple heuristic)
      const detectDelimiter = (txt: string) => {
        const lines = txt
          .split(/\r?\n/)
          .filter((l) => l.trim().length > 0)
          .slice(0, 5);
        let comma = 0,
          semi = 0,
          tab = 0;
        for (const l of lines) {
          comma += (l.match(/,/g) || []).length;
          semi += (l.match(/;/g) || []).length;
          tab += (l.match(/\t/g) || []).length;
        }
        if (tab >= comma && tab >= semi) return '\t';
        if (semi > comma) return ';';
        return ',';
      };

      if (isCsv) {
        const text = await file.text();
        const FS = detectDelimiter(text);
        try {
          wb = XLSX.read(text, { type: 'string', FS });
        } catch {
          // Fallback: try without FS
          wb = XLSX.read(text, { type: 'string' });
        }
      } else {
        // Try fortune-excel (optional) first for better fidelity
        try {
          const buf = await file.arrayBuffer();
          // Dynamic import to avoid bundling issues
          const fx: any = await import('@corbe30/fortune-excel').catch(
            () => null
          );
          if (fx && (fx.excel2Lucky || fx.default?.excel2Lucky)) {
            const excel2Lucky = fx.excel2Lucky || fx.default.excel2Lucky;
            const result = await excel2Lucky(buf);
            const luckySheets = result?.sheets || result?.Sheet || [];
            if (Array.isArray(luckySheets) && luckySheets.length) {
              const converted: FortuneSheet[] = luckySheets.map((s: any) => ({
                name: s.name || s.title || 'Sheet',
                celldata: s.celldata || s.data
              }));
              setSheets(converted);
              return;
            }
          }
        } catch {
          // ignore and fallback to SheetJS
        }
        // Try as array first
        try {
          const buf = await file.arrayBuffer();
          wb = XLSX.read(buf, { type: 'array' });
        } catch {
          wb = null;
        }
        // Fallback: try as string
        if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) {
          try {
            const text = await file.text();
            wb = XLSX.read(text, { type: 'string' });
          } catch {
            // leave null
          }
        }
      }

      if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) return;
      const out: FortuneSheet[] = [];
      wb.SheetNames.forEach((name) => {
        const ws = wb.Sheets[name];
        const aoa = XLSX.utils.sheet_to_json<string[]>(ws, {
          header: 1,
          blankrows: true
        }) as any[];
        const celldata: any[] = [];
        for (let r = 0; r < aoa.length; r++) {
          const row = aoa[r] || [];
          for (let c = 0; c < row.length; c++) {
            const v = row[c];
            if (v == null || v === '') continue;
            celldata.push({ r, c, v: { v } });
          }
        }
        out.push({ name: name || 'Sheet', celldata });
      });
      setSheets(out.length ? out : [{ name: 'Sheet1' }]);
    } catch (e) {
      console.error(e);
    }
  }

  const titleLabel = useMemo(() => baseTitle, [baseTitle]);

  function stripExt(n?: string) {
    if (!n) return '';
    const i = n.lastIndexOf('.');
    return i > 0 ? n.slice(0, i) : n;
  }

  async function ensureUniqueBase(base: string, ownerId: string) {
    const b = (base || 'Untitled Cells').trim();
    try {
      const { data } = await supabase
        .from('files')
        .select('name')
        .eq('owner_id', ownerId)
        .eq('ext', 'cells')
        .eq('is_deleted', false)
        .limit(500);
      const existing = new Set<string>(
        (data || []).map((r: any) => String(r.name).toLowerCase())
      );
      // names are stored with .cells extension
      const baseLower = `${b}.cells`.toLowerCase();
      if (!existing.has(baseLower)) return b;
      // Try incremental suffixes: base 1, base 2, ...
      for (let i = 1; i < 1000; i++) {
        const cand = `${b} ${i}.cells`.toLowerCase();
        if (!existing.has(cand)) return `${b} ${i}`;
      }
      return `${b} ${Date.now()}`;
    } catch {
      return b;
    }
  }

  async function submitRename() {
    const newBase = nameInput.trim() || 'Untitled Cells';
    // If not yet registered, just set base (will be applied on register)
    if (!registeredFileId) {
      // If we know the user, ensure uniqueness early
      const uniqueBase = currentUserId
        ? await ensureUniqueBase(newBase, currentUserId)
        : newBase;
      setBaseTitle(uniqueBase);
      if (tabId && updateTabTitle) updateTabTitle(tabId, uniqueBase);
      return;
    }
    try {
      const uniqueBase = currentUserId
        ? await ensureUniqueBase(newBase, currentUserId)
        : newBase;
      const res = await fetch(`/api/noblesuite/files/${registeredFileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `${uniqueBase}.cells` })
      });
      const json = await res.json();
      if (json?.ok) {
        setBaseTitle(uniqueBase);
        if (tabId && updateTabTitle) updateTabTitle(tabId, uniqueBase);
      } else if (json?.error === 'NAME_CONFLICT') {
        // As a fallback, try one more time with suffix
        const unique2 = `${uniqueBase} ${Math.floor(Math.random() * 1000)}`;
        const res2 = await fetch(`/api/noblesuite/files/${registeredFileId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: `${unique2}.cells` })
        });
        const j2 = await res2.json();
        if (j2?.ok) {
          setBaseTitle(unique2);
          if (tabId && updateTabTitle) updateTabTitle(tabId, unique2);
        }
      } else {
        // no-op
      }
    } catch {
      // no-op
    }
  }

  async function toggleStar() {
    const next = !starred;
    setStarred(next);
    if (!registeredFileId) return; // apply on register later
    try {
      await fetch(`/api/noblesuite/files/${registeredFileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_starred: next })
      });
    } catch {}
  }

  return (
    <div className='flex h-full min-h-0 flex-col'>
      <SuiteHeader
        title={nameInput}
        onTitleChange={setNameInput}
        onTitleSubmit={() => void submitRename()}
        app='cells'
        showStar
        starred={starred}
        onToggleStar={toggleStar}
        shareProps={{
          async onSearchContacts(q) {
            const like = `%${(q || '').trim()}%`;
            const { data } = await supabase
              .from('profiles')
              .select('id,display_name,avatar_url,email')
              .or(`display_name.ilike.${like},email.ilike.${like}`)
              .order('display_name', { ascending: true })
              .limit(10);
            return (data as any) || [];
          },
          currentShares: currentShares.map((s) => ({
            id: s.id,
            role: s.role,
            display_name: s.display_name,
            avatar_url: s.avatar_url
          })),
          async onRoleChange(uid, role) {
            if (!registeredFileId) return;
            try {
              await supabase
                .from('files_shares')
                .update({ role })
                .eq('file_id', registeredFileId)
                .eq('user_id', uid);
              setCurrentShares((prev) =>
                prev.map((x) => (x.id === uid ? { ...x, role } : x))
              );
            } catch {}
          },
          async onCopyLink() {
            if (!registeredFileId) return;
            const url = `/api/noblesuite/files/preview?id=${encodeURIComponent(registeredFileId)}`;
            await navigator.clipboard.writeText(url);
          },
          async onShare(ids) {
            if (!registeredFileId || !ids?.length) return;
            setShareBusy(true);
            try {
              const res = await fetch('/api/noblesuite/files/share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  fileIds: [registeredFileId],
                  recipientIds: ids
                })
              });
              const json = await res.json();
              if (!json?.ok) throw new Error(json?.error || 'SHARE_FAILED');
              // Refresh share list
              const { data: rows } = await supabase
                .from('files_shares')
                .select(
                  'user_id,role,profiles:profiles(id,display_name,avatar_url)'
                )
                .eq('file_id', registeredFileId);
              const mapped = (rows || []).map((r: any) => ({
                id: r.user_id,
                role: (r.role as 'viewer' | 'editor') || 'viewer',
                display_name: r.profiles?.display_name ?? null,
                avatar_url: r.profiles?.avatar_url ?? null
              }));
              setCurrentShares(mapped);
            } finally {
              setShareBusy(false);
            }
          },
          async onSendInbox(ids) {
            // Reuse the same API to create a chat message with links
            if (!registeredFileId || !ids?.length) return;
            await fetch('/api/noblesuite/files/share', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileIds: [registeredFileId],
                recipientIds: ids
              })
            });
          }
        }}
        rightSlot={
          loading ? (
            <span className='text-muted-foreground text-xs'>(loading…)</span>
          ) : saving ? (
            <span className='text-muted-foreground text-xs'>(saving…)</span>
          ) : loadedSheetId ? (
            <span className='text-muted-foreground text-xs'>(saved)</span>
          ) : null
        }
      />
      <div ref={hostRef} className='min-h-0 flex-1 overflow-hidden'>
        {/* Keep Workbook full-height */}
        <div
          className='h-full min-h-[520px]'
          style={{
            width:
              hostReady && Number.isFinite(hostSize.width) && hostSize.width > 0
                ? `${hostSize.width}px`
                : undefined,
            height:
              hostReady &&
              Number.isFinite(hostSize.height) &&
              hostSize.height > 0
                ? `${hostSize.height}px`
                : undefined
          }}
        >
          {hostReady && renderWorkbook ? (
            <div
              style={{
                width: `${hostSize.width}px`,
                height: `${hostSize.height}px`
              }}
            >
              {/* Hidden helper enables toolbar import/export items to work */}
              <ImportHelper
                setKey={setWorkbookKey}
                setSheets={setSheets}
                sheetRef={workbookRef as any}
              />
              <Workbook
                key={workbookKey}
                ref={workbookRef}
                data={sheets as any}
                onChange={(next: any) => {
                  const nextArr = next as FortuneSheet[];
                  if (hashData(nextArr) !== hashData(sheets)) {
                    setSheets(nextArr);
                  }
                }}
                showToolbar={true}
                // Add export/import actions into the FortuneSheet toolbar
                // @ts-ignore: customToolbarItems is supported by FortuneSheet
                customToolbarItems={[
                  exportToolBarItem(workbookRef as any),
                  importToolBarItem()
                ]}
              />
            </div>
          ) : (
            <div className='text-muted-foreground flex h-full items-center justify-center text-xs'>
              Preparing editor…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
