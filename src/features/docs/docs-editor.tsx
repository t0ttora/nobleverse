'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';
import { useTabs } from '@/components/layout/tabs-context';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import SimpleEditor, {
  type SimpleEditorHandle
} from '@/components/tiptap-templates/simple/simple-editor';

type DocsEditorProps = {
  tabId?: string;
  docId?: string | null;
  title?: string;
  fileName?: string;
  importUrl?: string; // for .docx/.md import
};

const FILES_BUCKET = process.env.NEXT_PUBLIC_FILES_BUCKET || 'files';

export default function DocsEditor({
  tabId,
  docId,
  title,
  fileName,
  importUrl
}: DocsEditorProps) {
  const { updateTabTitle } = useTabs();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [registeredFileId, setRegisteredFileId] = useState<string | null>(null);
  const [baseTitle, setBaseTitle] = useState<string>(() =>
    fileName ? stripExt(fileName) : title || 'Untitled Doc'
  );
  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState(baseTitle);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [starred, setStarred] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [docKey, setDocKey] = useState<string | null>(docId || null);
  const editorRef = useRef<SimpleEditorHandle>(null);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }) => setCurrentUserId(data.user?.id || null));
  }, []);

  // Load initial HTML if docId exists; also read files row for star/name
  const [initialHtml, setInitialHtml] = useState<string>('');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!docKey) return;
      try {
        setLoading(true);
        const res = await fetch(`/api/noblesuite/docs/${docKey}/data`, {
          cache: 'no-store'
        });
        const json = await res.json();
        if (cancelled) return;
        if (json?.ok) setInitialHtml(String(json.item?.doc_html || ''));
        // Fetch file row by storage_path
        const { data, error } = await supabase
          .from('files')
          .select('id,name,is_starred')
          .eq('storage_path', `docs:${docKey}`)
          .eq('is_deleted', false)
          .limit(1)
          .maybeSingle();
        if (!error && data && !cancelled) {
          setRegisteredFileId((data as any).id);
          const base = stripExt((data as any).name || baseTitle);
          setBaseTitle(base);
          setNameInput(base);
          setStarred(Boolean((data as any).is_starred));
          if (tabId && updateTabTitle) updateTabTitle(tabId, base);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docKey]);

  // Debounced autosave when content changes via SimpleEditor
  const onEditorChange = (html: string) => {
    // first non-empty create
    const text = html.replace(/<[^>]+>/g, '').trim();
    if (!docKey && text.length > 0) {
      const newId = crypto.randomUUID();
      setDocKey(newId);
      // fire-and-forget initial save and registration
      void (async () => {
        try {
          setSaving(true);
          await fetch(`/api/noblesuite/docs/${newId}/data`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ doc_html: html })
          });
          await registerAsFileIfMissing(newId, baseTitle);
        } finally {
          setSaving(false);
        }
      })();
      return;
    }
    if (!docKey) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(async () => {
      try {
        setSaving(true);
        await fetch(`/api/noblesuite/docs/${docKey}/data`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ doc_html: html })
        });
      } finally {
        setSaving(false);
      }
    }, 800);
  };

  // Import from URL (docx/md)
  useEffect(() => {
    let cancelled = false;
    if (!importUrl) return;
    (async () => {
      try {
        const resp = await fetch(importUrl, { cache: 'no-store' });
        if (!resp.ok) return;
        const ct = resp.headers.get('content-type') || '';
        const blob = await resp.blob();
        const name = fileName || 'import';
        if (/docx/i.test(ct) || /\.docx$/i.test(name)) {
          const buf = await blob.arrayBuffer();
          const res = await mammoth.convertToHtml({ arrayBuffer: buf });
          if (!cancelled) editorRef.current?.setContent(res.value || '');
        } else if (/markdown|md/i.test(ct) || /\.md$/i.test(name)) {
          const text = await blob.text();
          const html = mdToHtml(text);
          if (!cancelled) editorRef.current?.setContent(html || '');
        } else if (/html/i.test(ct)) {
          const html = await blob.text();
          if (!cancelled) editorRef.current?.setContent(html || '');
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [importUrl, fileName]);

  const titleLabel = useMemo(() => baseTitle, [baseTitle]);

  function stripExt(n?: string) {
    if (!n) return '';
    const i = n.lastIndexOf('.');
    return i > 0 ? n.slice(0, i) : n;
  }

  async function ensureUniqueBase(base: string, ownerId: string) {
    const b = (base || 'Untitled Doc').trim();
    try {
      const { data } = await supabase
        .from('files')
        .select('name')
        .eq('owner_id', ownerId)
        .eq('ext', 'docs')
        .eq('is_deleted', false)
        .limit(500);
      const existing = new Set<string>(
        (data || []).map((r: any) => String(r.name).toLowerCase())
      );
      const baseLower = `${b}.docs`.toLowerCase();
      if (!existing.has(baseLower)) return b;
      for (let i = 1; i < 1000; i++) {
        const cand = `${b} ${i}.docs`.toLowerCase();
        if (!existing.has(cand)) return `${b} ${i}`;
      }
      return `${b} ${Date.now()}`;
    } catch {
      return b;
    }
  }

  async function submitRename() {
    const newBase = nameInput.trim() || 'Untitled Doc';
    if (!registeredFileId) {
      const uniqueBase = currentUserId
        ? await ensureUniqueBase(newBase, currentUserId)
        : newBase;
      setBaseTitle(uniqueBase);
      setRenaming(false);
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
        body: JSON.stringify({ name: `${uniqueBase}.docs` })
      });
      const json = await res.json();
      if (json?.ok) {
        setBaseTitle(uniqueBase);
        setRenaming(false);
        if (tabId && updateTabTitle) updateTabTitle(tabId, uniqueBase);
      } else {
        setRenaming(false);
      }
    } catch {
      setRenaming(false);
    }
  }

  async function toggleStar() {
    const next = !starred;
    setStarred(next);
    if (!registeredFileId) return;
    try {
      await fetch(`/api/noblesuite/files/${registeredFileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_starred: next })
      });
    } catch {}
  }

  async function registerAsFileIfMissing(id: string, base: string) {
    if (registeredFileId) return registeredFileId;
    try {
      const { data: auth } = await supabase.auth.getUser();
      const ownerId = auth.user?.id;
      if (!ownerId) return null;
      const name = `${await ensureUniqueBase(base, ownerId)}.docs`;
      const { data, error } = await supabase
        .from('files')
        .insert({
          name,
          parent_id: null,
          type: 'binary',
          owner_id: ownerId,
          ext: 'docs',
          mime_type: 'application/x-nobledoc',
          size_bytes: null,
          storage_path: `docs:${id}`,
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

  // Import handlers
  const onChooseImport = () => importFileRef.current?.click();
  const onImportFile = async (file: File) => {
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.docx')) return void importDocx(file);
    if (lower.endsWith('.md')) return void importMarkdown(file);
    if (
      lower.endsWith('.xlsx') ||
      lower.endsWith('.xls') ||
      lower.endsWith('.csv')
    )
      return void importTable(file);
    // Fallback: try as HTML
    try {
      const html = await file.text();
      editorRef.current?.setContent(html);
    } catch {}
  };

  async function importDocx(file: File) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      const html = result.value || '';
      editorRef.current?.setContent(html);
    } catch (e) {
      console.error(e);
    }
  }

  async function importMarkdown(file: File) {
    try {
      const text = await file.text();
      const html = mdToHtml(text);
      editorRef.current?.setContent(html);
    } catch {}
  }

  async function importTable(file: File) {
    try {
      const lower = file.name.toLowerCase();
      let wb: XLSX.WorkBook | null = null;
      if (lower.endsWith('.csv')) {
        const text = await file.text();
        wb = XLSX.read(text, { type: 'string' });
      } else {
        const buf = await file.arrayBuffer();
        wb = XLSX.read(buf, { type: 'array' });
      }
      if (!wb || !wb.SheetNames.length) return;
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any[]>(ws, {
        header: 1,
        blankrows: true
      }) as any[];
      const html = aoaToHtmlTable(rows as any[]);
      editorRef.current?.insertHTML(html);
    } catch (e) {
      console.error(e);
    }
  }

  // Image upload handler for SimpleEditor
  async function handleImageUpload(file: File): Promise<string> {
    const path = `docs-content/${crypto.randomUUID()}-${encodeURIComponent(file.name)}`;
    const { error } = await supabase.storage
      .from(FILES_BUCKET)
      .upload(path, file, { upsert: false });
    if (error) throw new Error(error.message);
    const { data: signed } = await supabase.storage
      .from(FILES_BUCKET)
      .createSignedUrl(path, 3600);
    const url =
      signed?.signedUrl ||
      supabase.storage.from(FILES_BUCKET).getPublicUrl(path).data?.publicUrl ||
      '';
    return url;
  }

  // Export as DOCX via server
  async function exportDocx() {
    const html = editorRef.current?.getHTML() || '';
    const res = await fetch('/api/noblesuite/docs/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html, title: baseTitle })
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(baseTitle || 'Document').replace(/\s+/g, '_')}.docx`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 0);
  }

  return (
    <div className='flex h-full min-h-0 flex-col'>
      <div className='flex items-center gap-2 border-b px-3 py-2 text-sm'>
        <div className='flex items-center gap-2'>
          {renaming ? (
            <input
              ref={nameInputRef}
              className='bg-background h-7 rounded border px-2 text-sm outline-none'
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submitRename();
                if (e.key === 'Escape') {
                  setRenaming(false);
                  setNameInput(baseTitle);
                }
              }}
              onBlur={() => void submitRename()}
            />
          ) : (
            <button
              className={cn(
                'rounded px-1.5 py-0.5 font-medium',
                'hover:ring-border hover:ring-1'
              )}
              title='Rename'
              onClick={() => {
                setRenaming(true);
                setTimeout(() => nameInputRef.current?.focus(), 0);
              }}
            >
              {titleLabel}
            </button>
          )}
          <button
            className={cn(
              'rounded p-1',
              starred
                ? 'text-yellow-500'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title={starred ? 'Unstar' : 'Star'}
            onClick={toggleStar}
          >
            {starred ? (
              <Icons.starFilled className='size-4' />
            ) : (
              <Icons.star className='size-4' />
            )}
          </button>
        </div>

        {loading ? (
          <span className='text-muted-foreground text-xs'>(loading…)</span>
        ) : saving ? (
          <span className='text-muted-foreground text-xs'>(saving…)</span>
        ) : docKey ? (
          <span className='text-muted-foreground text-xs'>(saved)</span>
        ) : null}

        <div className='ml-auto flex items-center gap-2'>
          <input
            ref={importFileRef}
            type='file'
            className='hidden'
            accept='.docx,.md,.xlsx,.xls,.csv,.html'
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImportFile(f);
              if (importFileRef.current) importFileRef.current.value = '';
            }}
          />
          <Button size='sm' variant='outline' onClick={() => onChooseImport()}>
            <Icons.download className='mr-1 size-3.5' /> Import
          </Button>
          <Button size='sm' variant='outline' onClick={() => void exportDocx()}>
            <Icons.download className='mr-1 size-3.5 rotate-180' /> Export
          </Button>
        </div>
      </div>

      <SimpleEditor
        ref={editorRef}
        initialHtml={initialHtml}
        onChange={onEditorChange}
        onImageUpload={handleImageUpload}
      />
    </div>
  );
}

function aoaToHtmlTable(aoa: any[]): string {
  const rows = (aoa || [])
    .map((row) => {
      const cells = (row || [])
        .map((cell: any) => `<td>${escapeHtml(String(cell ?? ''))}</td>`)
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');
  return `<table><tbody>${rows}</tbody></table>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function mdToHtml(md: string): string {
  // Minimal markdown -> HTML (headings, bold, italic, code, links, lists). For richer support, integrate remark/marked later.
  let html = md;
  html = html.replace(/^######\s+(.*)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.*)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.*)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.*)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.*)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.*)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');
  // Lists
  html = html.replace(/^(?:\*|-)\s+(.*)$/gm, '<ul><li>$1</li></ul>');
  html = html.replace(/^\d+\.\s+(.*)$/gm, '<ol><li>$1</li></ol>');
  // Paragraphs: wrap lines not already in tags
  html = html
    .split(/\n{2,}/)
    .map((block) =>
      /^\s*<\/?(h\d|ul|ol|li|p|pre|code|blockquote|table|img|a)/i.test(
        block.trim()
      )
        ? block
        : `<p>${block.replace(/\n/g, '<br/>')}</p>`
    )
    .join('\n');
  return html;
}
