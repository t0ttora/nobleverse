'use client';
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useEffect
} from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import Heading from '@tiptap/extension-heading';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { ResizableImage } from './extensions/resizable-image';
import {
  Pages,
  PAGE_FORMATS,
  type PageFormat
} from '@/components/tiptap-extensions/pages';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code as CodeIcon,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
  Table as TableIcon
} from 'lucide-react';

export type SimpleEditorHandle = {
  setContent: (html: string) => void;
  insertHTML: (html: string) => void;
  getHTML: () => string;
  getText: () => string;
  getEditor: () => ReturnType<typeof useEditor> | null;
  setPageFormat: (format: string | PageFormat) => void;
};

export type SimpleEditorProps = {
  className?: string;
  initialHtml?: string;
  placeholder?: string;
  onChange?: (html: string) => void;
  onImageUpload?: (file: File) => Promise<string> | string;
  contentMaxWidthClass?: string; // tailwind max-w-* class to constrain content; toolbar remains full width
  pageFormat?: string | PageFormat;
  onPageFormatChange?: (format: PageFormat) => void;
};

const DEFAULT_PLACEHOLDER = 'Start typing, use the toolbar for formatting…';

function resolvePageFormat(format?: string | PageFormat): PageFormat {
  if (!format) return PAGE_FORMATS.A4;
  if (typeof format === 'string')
    return PAGE_FORMATS[format] || PAGE_FORMATS.A4;
  return format;
}

export const SimpleEditor = forwardRef<SimpleEditorHandle, SimpleEditorProps>(
  function SimpleEditor(props, ref) {
    const {
      className,
      initialHtml,
      placeholder = DEFAULT_PLACEHOLDER,
      onChange,
      onImageUpload,
      contentMaxWidthClass = 'max-w-none',
      pageFormat = PAGE_FORMATS.A4,
      onPageFormatChange
    } = props;

    const [linkOpen, setLinkOpen] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [_, setForceFlag] = useState(0);
    const pageFormatChangeRef = useRef<typeof onPageFormatChange | null>(
      onPageFormatChange || null
    );
    const [internalFormat, setInternalFormat] = useState<PageFormat>(() =>
      resolvePageFormat(pageFormat)
    );

    useEffect(() => {
      pageFormatChangeRef.current = onPageFormatChange || null;
    }, [onPageFormatChange]);

    useEffect(() => {
      const next = resolvePageFormat(pageFormat);
      setInternalFormat(next);
    }, [pageFormat]);

    const editor = useEditor({
      extensions: [
        Pages.configure({
          pageFormat: internalFormat,
          onPageFormatChange: (format: PageFormat) => {
            setInternalFormat(format);
            pageFormatChangeRef.current?.(format);
          }
        }),
        Heading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
        StarterKit.configure({
          heading: false
        }),
        Underline,
        Link.configure({
          openOnClick: false,
          autolink: true,
          linkOnPaste: true,
          protocols: ['http', 'https', 'mailto']
        }),
        // Use resizable image node view (falls back if NodeView not available)
        (ResizableImage || Image).configure({ inline: false }),
        TaskList,
        TaskItem.configure({ nested: true }),
        Table.configure({
          resizable: true,
          lastColumnResizable: true,
          allowTableNodeSelection: true
        }),
        TableRow,
        TableHeader,
        TableCell,
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Placeholder.configure({ placeholder })
      ],
      content: initialHtml || '<p></p>',
      // Prevent SSR/hydration mismatches per Tiptap guidance in SSR frameworks
      immediatelyRender: false,
      autofocus: 'start',
      editorProps: {
        attributes: {
          // Keep editor content in light mode even when app is dark
          class:
            'prose prose-sm sm:prose-base focus:outline-none max-w-none text-black'
        }
      },
      onUpdate({ editor }) {
        onChange?.(editor.getHTML());
      }
    });

    // Force re-render on editor updates/transactions so toolbar active states update immediately
    useEffect(() => {
      if (!editor) return;
      const rerender = () => setForceFlag((v) => v + 1);
      editor.on('selectionUpdate', rerender);
      editor.on('transaction', rerender);
      editor.on('update', rerender);
      return () => {
        editor.off('selectionUpdate', rerender);
        editor.off('transaction', rerender);
        editor.off('update', rerender);
      };
    }, [editor, setForceFlag]);

    useImperativeHandle(
      ref,
      (): SimpleEditorHandle => ({
        setContent: (html: string) => editor?.commands.setContent(html ?? ''),
        insertHTML: (html: string) =>
          editor?.commands.insertContent(html ?? ''),
        getHTML: () => editor?.getHTML() ?? '',
        getText: () => editor?.getText() ?? '',
        getEditor: () => editor,
        setPageFormat: (format) => {
          const next = resolvePageFormat(format as string | PageFormat);
          setInternalFormat(next);
          (editor as any)?.commands?.setPageFormat?.(next);
        }
      }),
      [editor]
    );

    useEffect(() => {
      if (!editor) return;
      (editor as any)?.commands?.setPageFormat?.(internalFormat);
    }, [editor, internalFormat]);

    const setLink = useCallback(() => {
      if (!editor) return;
      // Empty -> unset link
      if (!linkUrl) {
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
        setLinkOpen(false);
        return;
      }
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: linkUrl, target: '_blank' })
        .run();
      setLinkOpen(false);
    }, [editor, linkUrl]);

    const triggerImageSelect = useCallback(() => {
      fileInputRef.current?.click();
    }, []);

    const handleFileChange = useCallback(
      async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !editor) return;
        try {
          let url: string;
          if (onImageUpload) {
            const res = await onImageUpload(file);
            url = typeof res === 'string' ? res : String(res);
          } else {
            // Default: upload to Supabase Storage 'noblefiles' (or env files bucket)
            const FILES_BUCKET =
              process.env.NEXT_PUBLIC_FILES_BUCKET || 'noblefiles';
            const ext = file.name.split('.').pop() || 'png';
            const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
            const path = `docs-assets/public/${fileName}`;
            const { error: upErr } = await supabase.storage
              .from(FILES_BUCKET)
              .upload(path, file, { contentType: file.type, upsert: true });
            if (upErr) {
              // Fallback: inline Data URL to avoid bucket errors
              url = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onerror = () => reject(upErr);
                reader.onload = () => resolve(String(reader.result || ''));
                reader.readAsDataURL(file);
              });
            } else {
              const { data } = supabase.storage
                .from(FILES_BUCKET)
                .getPublicUrl(path);
              url = data.publicUrl;
            }
          }
          editor.chain().focus().setImage({ src: url, alt: '' }).run();
        } catch (err) {
          console.error('Image upload failed:', err);
        } finally {
          // Reset input so onChange triggers for the same file name
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      [editor, onImageUpload]
    );

    const isActive = useCallback(
      (name: string, attrs?: any) =>
        editor?.isActive(name as any, attrs) ?? false,
      [editor]
    );

    const printCSS = useMemo(
      () =>
        `@media print { @page { size: ${internalFormat.width}px ${internalFormat.height}px; margin: 0; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .nv-simple-editor-stage { background: transparent !important; padding: 0 !important; } .nv-simple-editor-paper { box-shadow: none !important; border: none !important; } }`,
      [internalFormat.height, internalFormat.width]
    );

    return (
      <div className={cn('nv-simple-editor flex w-full flex-col', className)}>
        <style>{printCSS}</style>
        {/* Toolbar - fixed (sticky) below the SuiteHeader; page body scrolls only */}
        <div className='nv-simple-editor-toolbar sticky top-12 z-20 flex w-full flex-wrap items-center gap-1 border-b border-[#d4d4d4] bg-[#fafafc] p-1 shadow-none sm:top-14'>
          {/* Undo / Redo */}
          <Button
            size='icon'
            variant='ghost'
            className='h-8 w-8 text-[#525c6f] hover:text-[#525c6f]'
            onClick={() => editor?.chain().focus().undo().run()}
            disabled={!(editor?.can().chain().focus().undo().run() ?? false)}
            aria-label='Undo'
          >
            <Undo2 className='size-4' />
          </Button>
          <Button
            size='icon'
            variant='ghost'
            className='h-8 w-8 text-[#525c6f] hover:text-[#525c6f]'
            onClick={() => editor?.chain().focus().redo().run()}
            disabled={!(editor?.can().chain().focus().redo().run() ?? false)}
            aria-label='Redo'
          >
            <Redo2 className='size-4' />
          </Button>

          <Separator orientation='vertical' className='mx-1 h-6' />

          {/* Headings */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size='icon'
                variant={
                  [1, 2, 3].some((lvl) => isActive('heading', { level: lvl }))
                    ? 'secondary'
                    : 'ghost'
                }
                className='h-8 w-8 text-[#525c6f] hover:text-[#525c6f]'
                aria-label='Heading'
              >
                <Heading1 className='size-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='start'>
              <DropdownMenuItem
                onSelect={() => editor?.chain().focus().setParagraph().run()}
              >
                Paragraph
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  editor?.chain().focus().toggleHeading({ level: 1 }).run()
                }
                className={cn(isActive('heading', { level: 1 }) && 'bg-accent')}
              >
                H1
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  editor?.chain().focus().toggleHeading({ level: 2 }).run()
                }
                className={cn(isActive('heading', { level: 2 }) && 'bg-accent')}
              >
                H2
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  editor?.chain().focus().toggleHeading({ level: 3 }).run()
                }
                className={cn(isActive('heading', { level: 3 }) && 'bg-accent')}
              >
                H3
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Marks */}
          <Toggle
            size='sm'
            className='data-[state=on]:text-foreground text-[#525c6f]'
            pressed={isActive('bold')}
            onPressedChange={() => editor?.chain().focus().toggleBold().run()}
            aria-label='Bold'
          >
            <Bold className='size-4' />
          </Toggle>
          <Toggle
            size='sm'
            className='data-[state=on]:text-foreground text-[#525c6f]'
            pressed={isActive('italic')}
            onPressedChange={() => editor?.chain().focus().toggleItalic().run()}
            aria-label='Italic'
          >
            <Italic className='size-4' />
          </Toggle>
          <Toggle
            size='sm'
            className='data-[state=on]:text-foreground text-[#525c6f]'
            pressed={isActive('underline')}
            onPressedChange={() =>
              editor?.chain().focus().toggleUnderline().run()
            }
            aria-label='Underline'
          >
            <UnderlineIcon className='size-4' />
          </Toggle>
          <Toggle
            size='sm'
            className='data-[state=on]:text-foreground text-[#525c6f]'
            pressed={isActive('strike')}
            onPressedChange={() => editor?.chain().focus().toggleStrike().run()}
            aria-label='Strikethrough'
          >
            <Strikethrough className='size-4' />
          </Toggle>
          <Toggle
            size='sm'
            className='data-[state=on]:text-foreground text-[#525c6f]'
            pressed={isActive('code')}
            onPressedChange={() => editor?.chain().focus().toggleCode().run()}
            aria-label='Code'
          >
            <CodeIcon className='size-4' />
          </Toggle>

          <Separator orientation='vertical' className='mx-1 h-6' />

          {/* Lists */}
          <Button
            size='icon'
            variant={isActive('bulletList') ? 'secondary' : 'ghost'}
            className='h-8 w-8 text-[#525c6f] hover:text-[#525c6f]'
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            aria-label='Bullet list'
          >
            <List className='size-4' />
          </Button>
          <Button
            size='icon'
            variant={isActive('orderedList') ? 'secondary' : 'ghost'}
            className='h-8 w-8 text-[#525c6f] hover:text-[#525c6f]'
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            aria-label='Ordered list'
          >
            <ListOrdered className='size-4' />
          </Button>
          <Button
            size='icon'
            variant={isActive('taskList') ? 'secondary' : 'ghost'}
            className='h-8 w-8 text-[#525c6f] hover:text-[#525c6f]'
            onClick={() => editor?.chain().focus().toggleTaskList().run()}
            aria-label='Task list'
          >
            <ListChecks className='size-4' />
          </Button>

          <Separator orientation='vertical' className='mx-1 h-6' />

          {/* Alignment */}
          <Button
            size='icon'
            variant={
              isActive({ textAlign: 'left' } as any) ? 'secondary' : 'ghost'
            }
            className='h-8 w-8 text-[#525c6f] hover:text-[#525c6f]'
            onClick={() => editor?.chain().focus().setTextAlign('left').run()}
            aria-label='Align left'
          >
            <AlignLeft className='size-4' />
          </Button>
          <Button
            size='icon'
            variant={
              isActive({ textAlign: 'center' } as any) ? 'secondary' : 'ghost'
            }
            className='h-8 w-8 text-[#525c6f] hover:text-[#525c6f]'
            onClick={() => editor?.chain().focus().setTextAlign('center').run()}
            aria-label='Align center'
          >
            <AlignCenter className='size-4' />
          </Button>
          <Button
            size='icon'
            variant={
              isActive({ textAlign: 'right' } as any) ? 'secondary' : 'ghost'
            }
            className='h-8 w-8 text-[#525c6f] hover:text-[#525c6f]'
            onClick={() => editor?.chain().focus().setTextAlign('right').run()}
            aria-label='Align right'
          >
            <AlignRight className='size-4' />
          </Button>
          <Button
            size='icon'
            variant={
              isActive({ textAlign: 'justify' } as any) ? 'secondary' : 'ghost'
            }
            className='h-8 w-8 text-[#525c6f] hover:text-[#525c6f]'
            onClick={() =>
              editor?.chain().focus().setTextAlign('justify').run()
            }
            aria-label='Justify'
          >
            <AlignJustify className='size-4' />
          </Button>

          <Separator orientation='vertical' className='mx-1 h-6' />

          {/* Blocks */}
          <Button
            size='icon'
            variant={isActive('blockquote') ? 'secondary' : 'ghost'}
            className='h-8 w-8 text-[#525c6f] hover:text-[#525c6f]'
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            aria-label='Blockquote'
          >
            <Quote className='size-4' />
          </Button>
          <Button
            size='icon'
            variant={isActive('codeBlock') ? 'secondary' : 'ghost'}
            className='h-8 w-8 text-[#525c6f] hover:text-[#525c6f]'
            onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
            aria-label='Code block'
          >
            <CodeIcon className='size-4' />
          </Button>

          <Separator orientation='vertical' className='mx-1 h-6' />

          {/* Link */}
          <Popover open={linkOpen} onOpenChange={setLinkOpen}>
            <PopoverTrigger asChild>
              <Button
                size='icon'
                variant={isActive('link') ? 'secondary' : 'ghost'}
                className='h-8 w-8 text-[#525c6f] hover:text-[#525c6f]'
                aria-label='Link'
                onClick={() => {
                  setLinkUrl(editor?.getAttributes('link')?.href ?? '');
                }}
              >
                <LinkIcon className='size-4' />
              </Button>
            </PopoverTrigger>
            <PopoverContent className='w-80' align='start'>
              <div className='flex items-center gap-2'>
                <Input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder='https://example.com'
                />
                <Button size='sm' onClick={setLink}>
                  Apply
                </Button>
                <Button
                  size='sm'
                  variant='secondary'
                  onClick={() => {
                    editor?.chain().focus().unsetLink().run();
                    setLinkOpen(false);
                  }}
                >
                  Remove
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Image */}
          <Button
            size='icon'
            variant='ghost'
            className='h-8 w-8 text-[#525c6f] hover:text-[#525c6f]'
            onClick={triggerImageSelect}
            aria-label='Insert image'
          >
            <ImageIcon className='size-4' />
          </Button>
          <input
            ref={fileInputRef}
            type='file'
            accept='image/*'
            className='hidden'
            onChange={handleFileChange}
          />

          <Separator orientation='vertical' className='mx-1 h-6' />

          {/* Table */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size='icon'
                variant={isActive('table') ? 'secondary' : 'ghost'}
                className='h-8 w-8 text-[#525c6f] hover:text-[#525c6f]'
                aria-label='Table'
              >
                <TableIcon className='size-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='start'>
              <DropdownMenuItem
                onSelect={() =>
                  editor
                    ?.chain()
                    .focus()
                    .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                    .run()
                }
              >
                Insert 3×3
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => editor?.chain().focus().addRowBefore().run()}
              >
                Add row before
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => editor?.chain().focus().addRowAfter().run()}
              >
                Add row after
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => editor?.chain().focus().addColumnBefore().run()}
              >
                Add column before
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => editor?.chain().focus().addColumnAfter().run()}
              >
                Add column after
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => editor?.chain().focus().toggleHeaderRow().run()}
              >
                Toggle header row
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  editor?.chain().focus().toggleHeaderColumn().run()
                }
              >
                Toggle header column
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => editor?.chain().focus().mergeOrSplit().run()}
              >
                Merge or split
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => editor?.chain().focus().deleteRow().run()}
              >
                Delete row
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => editor?.chain().focus().deleteColumn().run()}
              >
                Delete column
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => editor?.chain().focus().deleteTable().run()}
              >
                Delete table
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* trailing spacer keeps layout consistent */}
          <div className='ml-auto' />
        </div>

        {/* Editor */}
        <div className='nv-simple-editor-stage flex-1 overflow-auto bg-[#f4f5f9] px-4 py-6 sm:px-8 sm:py-8'>
          <div
            className={cn(
              'mx-auto flex w-full justify-center',
              contentMaxWidthClass
            )}
          >
            <div
              className='nv-simple-editor-paper relative mx-auto rounded-lg border border-[#d9dbe0] bg-white shadow-[0_10px_32px_rgba(15,23,42,0.12)]'
              style={{
                width: `${internalFormat.width}px`,
                minHeight: `${internalFormat.height}px`
              }}
            >
              <div
                className='nv-simple-editor-body text-black'
                style={{
                  paddingTop: `${internalFormat.margins.top}px`,
                  paddingRight: `${internalFormat.margins.right}px`,
                  paddingBottom: `${internalFormat.margins.bottom}px`,
                  paddingLeft: `${internalFormat.margins.left}px`
                }}
              >
                <EditorContent
                  editor={editor}
                  // Keyboard shortcuts
                  onKeyDown={(e) => {
                    if (
                      (e.ctrlKey || e.metaKey) &&
                      e.key.toLowerCase() === 'k'
                    ) {
                      e.preventDefault();
                      setLinkUrl(editor?.getAttributes('link')?.href ?? '');
                      setLinkOpen(true);
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

export default SimpleEditor;
