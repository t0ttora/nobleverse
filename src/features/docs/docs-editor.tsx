'use client';
import React from 'react';
import { cn } from '@/lib/utils';
import {
  SimpleEditor,
  type SimpleEditorHandle
} from '@/components/tiptap-templates/simple/simple-editor';
import SuiteHeader from '@/components/suite/suite-header';
import { toast } from 'sonner';

type DocsEditorProps = {
  tabId?: string;
  docId?: string | null;
  title?: string;
  fileName?: string;
  importUrl?: string; // preserved for API compatibility
};

export default function DocsEditor({ title, importUrl }: DocsEditorProps) {
  const editorRef = React.useRef<SimpleEditorHandle | null>(null);
  const [html, setHtml] = React.useState<string>('');
  const [starred, setStarred] = React.useState<boolean>(false);
  const [docTitle, setDocTitle] = React.useState<string>(
    title || 'Untitled Document'
  );

  // If an import URL is provided (e.g., from files), load it as HTML/text
  React.useEffect(() => {
    let cancelled = false;
    if (!importUrl) return;
    (async () => {
      try {
        const res = await fetch(importUrl);
        const text = await res.text();
        if (!cancelled) editorRef.current?.setContent(text || '');
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [importUrl]);

  return (
    <div className={cn('flex h-full min-h-0 flex-col overflow-auto')}>
      <SuiteHeader
        title={docTitle}
        onTitleChange={setDocTitle}
        onTitleSubmit={(v) => setDocTitle(v)}
        app='docs'
        showStar
        starred={starred}
        onToggleStar={() => setStarred((s) => !s)}
        shareProps={{
          async onSearchContacts() {
            // TODO: wire to contacts API
            return [];
          },
          currentShares: [],
          async onShare() {
            toast.success('Shared');
          },
          async onSendInbox() {
            toast.success('Sent');
          }
        }}
      />
      <div className='w-full px-0 pt-0 pb-4'>
        <SimpleEditor
          ref={editorRef}
          initialHtml={html}
          onChange={setHtml}
          placeholder={
            title ? `Editing “${title}” …` : 'Write something great…'
          }
          contentMaxWidthClass='max-w-[820px]'
        />
      </div>
    </div>
  );
}
