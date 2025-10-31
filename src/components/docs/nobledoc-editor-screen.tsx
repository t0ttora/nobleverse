'use client';
import React from 'react';
import SuiteHeader from '@/components/suite/suite-header';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  SimpleEditor,
  type SimpleEditorHandle
} from '@/components/tiptap-templates/simple/simple-editor';
import { updateDocClient } from '@/../utils/supabase/docs';
import { supabase } from '@/lib/supabaseClient';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription
} from '@/components/ui/drawer';
import PagesView from '@/components/docs/pages-view';
import {
  PAGE_FORMATS,
  type PageFormat
} from '@/components/tiptap-extensions/pages';
import { toast } from 'sonner';

type DocEventEntry = {
  id: string;
  doc_id: string;
  actor_id: string | null;
  event_type:
    | 'content_saved'
    | 'title_updated'
    | 'version_restored'
    | 'version_created';
  detail: Record<string, any> | null;
  version_id: string | null;
  created_at: string;
  version_number: number | null;
  version_title: string | null;
  version_content_html: string | null;
  version_created_by: string | null;
  version_created_at: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

const VERSION_LOG_THROTTLE_MS = 15_000;

function htmlToPlainSnippet(html: string, limit = 160) {
  if (!html) return '';
  if (typeof document === 'undefined')
    return html.replace(/<[^>]+>/g, ' ').slice(0, limit);
  const container = document.createElement('div');
  container.innerHTML = html;
  const text = container.textContent || container.innerText || '';
  return text.replace(/\s+/g, ' ').trim().slice(0, limit);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes <= 0) return 'just now';
  if (diffMinutes < 60)
    return `${diffMinutes} min${diffMinutes === 1 ? '' : 's'} ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24)
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  const diffWeeks = Math.round(diffDays / 7);
  if (diffWeeks < 4)
    return `${diffWeeks} week${diffWeeks === 1 ? '' : 's'} ago`;
  const diffMonths = Math.round(diffDays / 30);
  if (diffMonths < 12)
    return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;
  const diffYears = Math.round(diffDays / 365);
  return `${diffYears} year${diffYears === 1 ? '' : 's'} ago`;
}

type Props = {
  docId: string;
  initialTitle: string;
  initialHtml: string;
  initialCreatedAt: string;
};

export function NobleDocEditorScreen({
  docId,
  initialTitle,
  initialHtml,
  initialCreatedAt
}: Props) {
  const [title, setTitle] = React.useState(initialTitle);
  const [html, setHtml] = React.useState(initialHtml);
  const [saveState, setSaveState] = React.useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');
  const [starred, setStarred] = React.useState(false);
  const editorRef = React.useRef<SimpleEditorHandle | null>(null);
  const [logOpen, setLogOpen] = React.useState(false);
  const [activity, setActivity] = React.useState<DocEventEntry[]>([]);
  const [activityLoading, setActivityLoading] = React.useState(false);
  const [activityError, setActivityError] = React.useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const lastSnapshotHtmlRef = React.useRef<string>(initialHtml);
  const lastVersionLoggedAtRef = React.useRef<number>(0);
  const previousTitleRef = React.useRef<string>(initialTitle);
  // Header/Footer state and Page Format (user controls via UI, not editor commands)
  const [pageFormat, setPageFormat] = React.useState<PageFormat>(
    PAGE_FORMATS.A4
  );
  const [hdr, setHdr] = React.useState<string>('');
  const [ftr, setFtr] = React.useState<string>('{page} of {total}');

  React.useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        console.error('Unable to fetch current user', error);
        setCurrentUserId(null);
        return;
      }
      setCurrentUserId(data?.user?.id ?? null);
    });
    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    lastSnapshotHtmlRef.current = initialHtml;
    previousTitleRef.current = initialTitle;
  }, [docId, initialHtml, initialTitle]);

  const loadActivity = React.useCallback(async () => {
    try {
      setActivityLoading(true);
      const { data, error } = await supabase
        .from('nv_doc_event_entries')
        .select('*')
        .eq('doc_id', docId)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Failed to load doc activity', error);
        setActivityError(error.message);
        setActivity([]);
        return;
      }
      setActivity((data as DocEventEntry[]) || []);
      setActivityError(null);
    } finally {
      setActivityLoading(false);
    }
  }, [docId]);

  const recordEvent = React.useCallback(
    async ({
      type,
      detail,
      snapshot,
      versionId
    }: {
      type:
        | 'content_saved'
        | 'title_updated'
        | 'version_restored'
        | 'version_created';
      detail?: Record<string, any>;
      snapshot?: { title: string; html: string };
      versionId?: string | null;
    }) => {
      try {
        let resolvedVersionId = versionId ?? null;
        if (!resolvedVersionId && snapshot) {
          const { data: versionData, error: versionError } = await supabase
            .from('nv_doc_versions')
            .insert({
              doc_id: docId,
              title: snapshot.title || 'Untitled',
              content_html: snapshot.html,
              created_by: currentUserId ?? undefined
            })
            .select('id')
            .single();
          if (versionError) throw versionError;
          resolvedVersionId = versionData?.id ?? null;
        }

        const { error: eventError } = await supabase
          .from('nv_doc_events')
          .insert({
            doc_id: docId,
            actor_id: currentUserId ?? undefined,
            event_type: type,
            detail: detail ?? {},
            version_id: resolvedVersionId
          });
        if (eventError) throw eventError;
        await loadActivity();
      } catch (error) {
        console.error('Failed to record doc event', error);
      }
    },
    [currentUserId, docId, loadActivity]
  );

  React.useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  React.useEffect(() => {
    const channel = supabase
      .channel(`nv-doc-events-${docId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'nv_doc_events',
          filter: `doc_id=eq.${docId}`
        },
        () => {
          void loadActivity();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [docId, loadActivity]);

  const participants = React.useMemo(() => {
    const map = new Map<
      string,
      { id: string; display_name?: string | null; avatar_url?: string | null }
    >();
    for (const entry of activity) {
      if (!entry.actor_id) continue;
      if (map.has(entry.actor_id)) continue;
      map.set(entry.actor_id, {
        id: entry.actor_id,
        display_name: entry.display_name,
        avatar_url: entry.avatar_url
      });
    }
    return Array.from(map.values());
  }, [activity]);

  const setFormatState = React.useCallback((fmt: PageFormat) => {
    setPageFormat((prev) => (prev.id === fmt.id ? prev : fmt));
  }, []);

  const handleFormatSelect = React.useCallback(
    (fmt: PageFormat) => {
      setFormatState(fmt);
    },
    [setFormatState]
  );

  const describeEvent = React.useCallback((entry: DocEventEntry) => {
    const detail = entry.detail || {};
    switch (entry.event_type) {
      case 'content_saved':
        if (detail.snippet) {
          const snippet = String(detail.snippet);
          const shortened =
            snippet.length > 100 ? `${snippet.slice(0, 100)}…` : snippet;
          return `Content updated · “${shortened}”`;
        }
        return 'Content updated';
      case 'title_updated':
        return detail.title
          ? `Title changed to “${String(detail.title)}”`
          : 'Title changed';
      case 'version_created':
        return detail.reason === 'manual'
          ? 'Manual snapshot saved'
          : 'Snapshot saved';
      case 'version_restored':
        return entry.version_number
          ? `Restored version ${entry.version_number}`
          : 'Version restored';
      default:
        return 'Updated';
    }
  }, []);

  const handleLoadVersion = React.useCallback(
    async (entry: DocEventEntry) => {
      if (!entry.version_id) return;
      try {
        let htmlContent = entry.version_content_html ?? '';
        if (!htmlContent) {
          const { data: fetched, error: fetchError } = await supabase
            .from('nv_doc_versions')
            .select('content_html')
            .eq('id', entry.version_id)
            .single();
          if (fetchError) throw fetchError;
          htmlContent = fetched?.content_html ?? '';
        }
        const nextTitle = entry.version_title || title;
        editorRef.current?.setContent(htmlContent);
        setHtml(htmlContent);
        setTitle(nextTitle);
        lastSnapshotHtmlRef.current = htmlContent;
        lastVersionLoggedAtRef.current = Date.now();
        previousTitleRef.current = nextTitle;
        await recordEvent({
          type: 'version_restored',
          detail: {
            restoredFromEvent: entry.id,
            versionNumber: entry.version_number ?? null
          },
          versionId: entry.version_id
        });
        toast.success('Version restored');
      } catch (error) {
        console.error('Failed to load version', error);
        toast.error('Could not load that version');
      }
    },
    [recordEvent, title]
  );

  const handleManualSnapshot = React.useCallback(async () => {
    try {
      await recordEvent({
        type: 'version_created',
        detail: { reason: 'manual' },
        snapshot: { title, html }
      });
      lastSnapshotHtmlRef.current = html;
      lastVersionLoggedAtRef.current = Date.now();
      toast.success('Snapshot saved');
    } catch (error) {
      console.error('Failed to save snapshot', error);
      toast.error('Could not save snapshot');
    }
  }, [html, recordEvent, title]);

  const handleReloadLatest = React.useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('nv_docs')
        .select('content_html,title')
        .eq('id', docId)
        .single();
      if (error) throw error;
      const latestHtml = data?.content_html ?? '';
      const latestTitle = data?.title ?? title;
      editorRef.current?.setContent(latestHtml);
      setHtml(latestHtml);
      setTitle(latestTitle);
      lastSnapshotHtmlRef.current = latestHtml;
      lastVersionLoggedAtRef.current = Date.now();
      previousTitleRef.current = latestTitle;
      toast.success('Reloaded latest version');
    } catch (error) {
      console.error('Failed to reload latest doc', error);
      toast.error('Could not reload latest version');
    }
  }, [docId, title]);

  React.useEffect(() => {
    if (!docId) return;
    setSaveState('saving');
    const timer = setTimeout(async () => {
      try {
        await updateDocClient(docId, { content_html: html });
        setSaveState('saved');
        const now = Date.now();
        const hasChanged = html !== lastSnapshotHtmlRef.current;
        const elapsed = now - lastVersionLoggedAtRef.current;
        if (hasChanged && elapsed >= VERSION_LOG_THROTTLE_MS) {
          await recordEvent({
            type: 'content_saved',
            detail: {
              snippet: htmlToPlainSnippet(html),
              title
            },
            snapshot: { title, html }
          });
          lastSnapshotHtmlRef.current = html;
          lastVersionLoggedAtRef.current = now;
        }
        setTimeout(() => setSaveState('idle'), 900);
      } catch (e) {
        console.error(e);
        setSaveState('error');
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [docId, html, recordEvent, title]);

  React.useEffect(() => {
    if (!docId) return;
    const nextTitle = title;
    if (nextTitle === previousTitleRef.current) return;
    const timer = setTimeout(async () => {
      try {
        await updateDocClient(docId, { title: nextTitle });
        const lastTitle = previousTitleRef.current;
        previousTitleRef.current = nextTitle;
        await recordEvent({
          type: 'title_updated',
          detail: { previousTitle: lastTitle, title: nextTitle },
          snapshot: { title: nextTitle, html }
        });
      } catch (e) {
        console.error(e);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [docId, html, recordEvent, title]);

  const rightSlot = (
    <div className='text-muted-foreground text-xs'>
      {saveState === 'saving' && 'Saving…'}
      {saveState === 'saved' && 'Saved'}
      {saveState === 'error' && 'Error saving'}
    </div>
  );

  const handleImageUpload = React.useCallback(
    async (file: File) => {
      const BUCKET = process.env.NEXT_PUBLIC_FILES_BUCKET || 'noblefiles';
      const ext = file.name.split('.').pop() || 'png';
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const path = `docs-assets/${docId}/${fileName}`;
      try {
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type, upsert: true });
        if (error) throw error;
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        return data.publicUrl;
      } catch (err: any) {
        // Fallback: embed as data URL if bucket is missing or access denied
        const dataUrl: string = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error('FILE_READ_ERROR'));
          reader.onload = () => resolve(String(reader.result || ''));
          reader.readAsDataURL(file);
        });
        return dataUrl;
      }
    },
    [docId]
  );

  return (
    <div className='flex min-h-screen flex-col bg-[#f7f7f7]'>
      <SuiteHeader
        title={title}
        onTitleChange={setTitle}
        rightSlot={rightSlot}
        app='docs'
        onActivityClick={() => setLogOpen(true)}
        showStar
        starred={starred}
        onToggleStar={() => setStarred((s) => !s)}
        participants={participants}
        showImport
        importAccept='.html,.txt,.md'
        onImport={async (file) => {
          const lower = file.name.toLowerCase();
          const text = await file.text();
          let nextHtml = text;
          if (lower.endsWith('.txt')) {
            nextHtml = `<pre>${escapeHtml(text)}</pre>`;
          } else if (lower.endsWith('.md')) {
            nextHtml = text
              .split(/\n\n+/)
              .map((p) => `<p>${escapeHtml(p).replaceAll('\n', '<br/>')}</p>`)
              .join('\n');
          }
          editorRef.current?.setContent(nextHtml);
          setHtml(nextHtml);
        }}
        shareProps={{
          async onSearchContacts() {
            return [];
          },
          currentShares: [],
          async onShare(ids) {
            try {
              const url =
                typeof window !== 'undefined' ? window.location.href : '';
              await navigator.clipboard.writeText(url);
              toast.success('Link copied to clipboard');
            } catch {
              toast.error('Copy failed');
            }
          },
          async onSendInbox(ids) {
            try {
              const url =
                typeof window !== 'undefined' ? window.location.href : '';
              const shareTitle = `Shared document: ${title || 'Untitled'}`;
              if ((navigator as any).share) {
                await (navigator as any).share({ title: shareTitle, url });
                return;
              }
              await navigator.clipboard.writeText(`${shareTitle}\n${url}`);
              toast.success('Copied share to clipboard');
            } catch {
              toast.error('Share failed');
            }
          },
          async onRoleChange() {
            toast('Roles will be available soon');
          }
        }}
      />
      <div className='w-full flex-1 px-0 pt-0 pb-4 sm:px-0 sm:pt-0 sm:pb-6'>
        <PagesView
          editorRef={editorRef}
          format={pageFormat}
          availableFormats={Object.values(PAGE_FORMATS)}
          onFormatChange={handleFormatSelect}
          headerTemplate={hdr}
          footerTemplate={ftr}
          onUpdateHeader={setHdr}
          onUpdateFooter={setFtr}
        >
          <SimpleEditor
            ref={editorRef}
            initialHtml={html}
            onChange={setHtml}
            placeholder='Write something great…'
            onImageUpload={handleImageUpload}
            contentMaxWidthClass='max-w-none'
            pageFormat={pageFormat}
            onPageFormatChange={setFormatState}
          />
        </PagesView>
      </div>
      {/* Activity Log Drawer */}
      <Drawer direction='right' open={logOpen} onOpenChange={setLogOpen}>
        <DrawerContent className='sm:max-w-lg'>
          <DrawerHeader className='border-b pb-3'>
            <DrawerTitle>History</DrawerTitle>
            <DrawerDescription className='text-muted-foreground text-xs'>
              Track edits, snapshots, and restores for this doc.
            </DrawerDescription>
          </DrawerHeader>
          <div className='flex h-full flex-col'>
            <div className='border-b px-5 py-4'>
              <div className='text-sm font-semibold'>
                {title || 'Untitled doc'}
              </div>
              <div className='text-muted-foreground text-xs'>
                Created {formatDateTime(initialCreatedAt)}
              </div>
              <div className='mt-3 flex flex-wrap gap-2'>
                <Button size='sm' onClick={handleManualSnapshot}>
                  Save snapshot
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={handleReloadLatest}
                >
                  Reload latest
                </Button>
              </div>
            </div>
            <div className='flex-1 overflow-y-auto px-5 py-4'>
              {activityLoading ? (
                <div className='text-muted-foreground text-sm'>
                  Loading history…
                </div>
              ) : activityError ? (
                <div className='text-destructive text-sm'>
                  Unable to load history: {activityError}
                </div>
              ) : activity.length === 0 ? (
                <div className='text-muted-foreground text-sm'>
                  No history yet. Edits and snapshots will appear here
                  automatically.
                </div>
              ) : (
                <ul className='space-y-3'>
                  {activity.map((entry) => (
                    <li key={entry.id}>
                      <button
                        type='button'
                        onClick={() => handleLoadVersion(entry)}
                        disabled={!entry.version_id}
                        className='hover:border-border hover:bg-muted focus-visible:ring-ring w-full rounded-lg border border-transparent px-3 py-2 text-left transition focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60'
                      >
                        <div className='flex items-start gap-3'>
                          <Avatar className='mt-0.5 size-8'>
                            {entry.avatar_url ? (
                              <AvatarImage
                                src={entry.avatar_url}
                                alt={entry.display_name || ''}
                              />
                            ) : (
                              <AvatarFallback className='text-xs'>
                                {(entry.display_name || '??')
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div className='flex-1'>
                            <div className='flex items-center justify-between gap-2'>
                              <span className='text-sm font-medium'>
                                {entry.display_name || 'Unknown user'}
                              </span>
                              <span className='text-muted-foreground text-xs'>
                                {formatRelativeTime(entry.created_at)}
                              </span>
                            </div>
                            <div className='text-muted-foreground text-xs'>
                              {describeEvent(entry)}
                            </div>
                            {entry.version_number ? (
                              <div className='text-muted-foreground mt-1 text-[11px] font-medium tracking-wide uppercase'>
                                Version {entry.version_number}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

export default NobleDocEditorScreen;

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
