'use client';
import React from 'react';
import SuiteHeader from '@/components/suite/suite-header';
import { SimpleEditorHandle } from '@/components/tiptap-templates/simple/simple-editor';
import { SimpleEditor } from '@/components/tiptap-templates/simple/simple-editor';
import { updateDocClient } from '@/../utils/supabase/docs';
import { supabase } from '@/lib/supabaseClient';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer';
import PagesView from '@/components/docs/pages-view';
import {
  PAGE_FORMATS,
  type PageFormat
} from '@/components/tiptap-extensions/pages';
import { toast } from 'sonner';

type Props = {
  docId: string;
  initialTitle: string;
  initialHtml: string;
};

export function NobleDocEditorScreen({
  docId,
  initialTitle,
  initialHtml
}: Props) {
  const [title, setTitle] = React.useState(initialTitle);
  const [html, setHtml] = React.useState(initialHtml);
  const [saveState, setSaveState] = React.useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');
  const [starred, setStarred] = React.useState(false);
  const editorRef = React.useRef<SimpleEditorHandle | null>(null);
  const [logOpen, setLogOpen] = React.useState(false);
  const [events, setEvents] = React.useState<
    Array<{ t: number; kind: string; detail?: string }>
  >([]);
  // Header/Footer state and Page Format (user controls via UI, not editor commands)
  const [pageFormat, setPageFormat] = React.useState<PageFormat>(
    PAGE_FORMATS.A4
  );
  const [hdr, setHdr] = React.useState<string>('');
  const [ftr, setFtr] = React.useState<string>('{page} of {total}');

  // Debounced autosave for content
  React.useEffect(() => {
    if (!docId) return;
    setSaveState('saving');
    const t = setTimeout(async () => {
      try {
        await updateDocClient(docId, { content_html: html });
        setSaveState('saved');
        setEvents((prev) =>
          [{ t: Date.now(), kind: 'content_saved' }, ...prev].slice(0, 50)
        );
        setTimeout(() => setSaveState('idle'), 1000);
      } catch (e) {
        console.error(e);
        setSaveState('error');
      }
    }, 500);
    return () => clearTimeout(t);
  }, [docId, html]);

  // Save title quickly on change (debounced)
  React.useEffect(() => {
    if (!docId) return;
    const t = setTimeout(async () => {
      try {
        await updateDocClient(docId, { title });
        setEvents((prev) =>
          [
            { t: Date.now(), kind: 'title_updated', detail: title },
            ...prev
          ].slice(0, 50)
        );
      } catch (e) {
        console.error(e);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [docId, title]);

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
          onFormatChange={setPageFormat}
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
          />
        </PagesView>
      </div>
      {/* Activity Log Drawer */}
      <Drawer direction='right' open={logOpen} onOpenChange={setLogOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Activity Log</DrawerTitle>
          </DrawerHeader>
          <div className='px-4 pb-4'>
            {events.length === 0 ? (
              <div className='text-muted-foreground text-sm'>
                No activity yet.
              </div>
            ) : (
              <ul className='space-y-2'>
                {events.map((e, idx) => (
                  <li key={idx} className='border-b pb-2 last:border-b-0'>
                    <div className='text-sm font-medium'>
                      {e.kind === 'content_saved' && 'Content saved'}
                      {e.kind === 'title_updated' && 'Title updated'}
                    </div>
                    <div className='text-muted-foreground text-xs'>
                      {new Date(e.t).toLocaleString()}
                      {e.detail ? ` · ${e.detail}` : ''}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

export default NobleDocEditorScreen;
