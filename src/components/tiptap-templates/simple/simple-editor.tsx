'use client';
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef
} from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  IconBold,
  IconItalic,
  IconUnderline,
  IconStrikethrough,
  IconList,
  IconListNumbers,
  IconListCheck,
  IconQuote,
  IconAlignLeft,
  IconAlignCenter,
  IconAlignRight,
  IconLetterT,
  IconPhoto,
  IconLink,
  IconUnlink,
  IconHistory,
  IconHistoryToggle
} from '@tabler/icons-react';

export type SimpleEditorHandle = {
  setContent: (html: string) => void;
  insertHTML: (html: string) => void;
  getHTML: () => string;
  getText: () => string;
  getEditor: () => Editor | null;
};

export type SimpleEditorProps = {
  className?: string;
  initialHtml?: string;
  placeholder?: string;
  onChange?: (html: string) => void;
  onImageUpload?: (file: File) => Promise<string> | string; // returns URL
};

const headings = [
  {
    label: 'Paragraph',
    action: (e: Editor) => e.chain().focus().setParagraph().run(),
    isActive: (e: Editor) => e.isActive('paragraph')
  },
  {
    label: 'Heading 1',
    action: (e: Editor) => e.chain().focus().toggleHeading({ level: 1 }).run(),
    isActive: (e: Editor) => e.isActive('heading', { level: 1 })
  },
  {
    label: 'Heading 2',
    action: (e: Editor) => e.chain().focus().toggleHeading({ level: 2 }).run(),
    isActive: (e: Editor) => e.isActive('heading', { level: 2 })
  },
  {
    label: 'Heading 3',
    action: (e: Editor) => e.chain().focus().toggleHeading({ level: 3 }).run(),
    isActive: (e: Editor) => e.isActive('heading', { level: 3 })
  }
];

export const SimpleEditor = forwardRef<SimpleEditorHandle, SimpleEditorProps>(
  function SimpleEditor(
    {
      className,
      initialHtml,
      placeholder = 'Start typing…',
      onChange,
      onImageUpload
    }: SimpleEditorProps,
    ref
  ) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const editor = useEditor(
      {
        extensions: [
          Color.configure({ types: ['textStyle'] }),
          TextStyle,
          StarterKit.configure({
            heading: { levels: [1, 2, 3] }
          }),
          Underline,
          Link.configure({
            openOnClick: true,
            autolink: true,
            linkOnPaste: true
          }),
          Image.configure({ allowBase64: true }),
          TextAlign.configure({ types: ['heading', 'paragraph'] }),
          Highlight,
          TaskList,
          TaskItem.configure({ nested: true }),
          Table.configure({ resizable: true }),
          TableRow,
          TableHeader,
          TableCell,
          Placeholder.configure({ placeholder })
        ],
        content: initialHtml || '<p></p>',
        editorProps: {
          attributes: {
            class: 'min-h-[640px] outline-none prose dark:prose-invert'
          }
        },
        onUpdate: ({ editor }) => {
          onChange?.(editor.getHTML());
        },
        immediatelyRender: false
      },
      [initialHtml, placeholder]
    );

    useImperativeHandle(
      ref,
      (): SimpleEditorHandle => ({
        setContent: (html: string) =>
          editor?.commands.setContent(html || '<p></p>') ?? undefined,
        insertHTML: (html: string) =>
          editor?.commands.insertContent(html) ?? undefined,
        getHTML: () => editor?.getHTML() || '',
        getText: () => editor?.getText() || '',
        getEditor: () => editor ?? null
      }),
      [editor]
    );

    const insertImage = useCallback(
      async (file: File) => {
        try {
          const res = onImageUpload ? await onImageUpload(file) : '';
          const url = typeof res === 'string' ? res : '';
          if (url)
            editor
              ?.chain()
              .focus()
              .setImage({ src: url, alt: file.name })
              .run();
        } catch {}
      },
      [editor, onImageUpload]
    );

    const onChooseImage = () => fileInputRef.current?.click();

    if (!editor) return null;

    return (
      <div className={cn('flex h-full min-h-0 flex-col', className)}>
        <div className='flex flex-wrap items-center gap-1 border-b px-3 py-2 text-sm'>
          {/* Undo / Redo */}
          <Button
            size='sm'
            variant='ghost'
            onClick={() => editor.chain().focus().undo().run()}
            title='Undo'
          >
            <IconHistory className='size-4' />
          </Button>
          <Button
            size='sm'
            variant='ghost'
            onClick={() => editor.chain().focus().redo().run()}
            title='Redo'
          >
            <IconHistoryToggle className='size-4' />
          </Button>

          <div className='bg-border mx-1 h-6 w-px' />

          {/* Headings */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size='sm' variant='outline'>
                <IconLetterT className='mr-1 size-4' /> Headings
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='start'>
              {headings.map((h) => (
                <DropdownMenuItem
                  key={h.label}
                  onClick={() => h.action(editor)}
                  className={cn(
                    h.isActive(editor) && 'text-primary font-medium'
                  )}
                >
                  {h.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className='bg-border mx-1 h-6 w-px' />

          {/* Marks */}
          <Button
            size='sm'
            variant='ghost'
            onClick={() => editor.chain().focus().toggleBold().run()}
            aria-pressed={editor.isActive('bold')}
            title='Bold'
          >
            <IconBold className='size-4' />
          </Button>
          <Button
            size='sm'
            variant='ghost'
            onClick={() => editor.chain().focus().toggleItalic().run()}
            aria-pressed={editor.isActive('italic')}
            title='Italic'
          >
            <IconItalic className='size-4' />
          </Button>
          <Button
            size='sm'
            variant='ghost'
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            aria-pressed={editor.isActive('underline')}
            title='Underline'
          >
            <IconUnderline className='size-4' />
          </Button>
          <Button
            size='sm'
            variant='ghost'
            onClick={() => editor.chain().focus().toggleStrike().run()}
            aria-pressed={editor.isActive('strike')}
            title='Strikethrough'
          >
            <IconStrikethrough className='size-4' />
          </Button>

          <div className='bg-border mx-1 h-6 w-px' />

          {/* Lists */}
          <Button
            size='sm'
            variant='ghost'
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            aria-pressed={editor.isActive('bulletList')}
            title='Bullet list'
          >
            <IconList className='size-4' />
          </Button>
          <Button
            size='sm'
            variant='ghost'
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            aria-pressed={editor.isActive('orderedList')}
            title='Ordered list'
          >
            <IconListNumbers className='size-4' />
          </Button>
          <Button
            size='sm'
            variant='ghost'
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            aria-pressed={editor.isActive('taskList')}
            title='Task list'
          >
            <IconListCheck className='size-4' />
          </Button>

          <div className='bg-border mx-1 h-6 w-px' />

          {/* Alignment */}
          <Button
            size='sm'
            variant='ghost'
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            aria-pressed={editor.isActive({ textAlign: 'left' })}
            title='Align left'
          >
            <IconAlignLeft className='size-4' />
          </Button>
          <Button
            size='sm'
            variant='ghost'
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            aria-pressed={editor.isActive({ textAlign: 'center' })}
            title='Align center'
          >
            <IconAlignCenter className='size-4' />
          </Button>
          <Button
            size='sm'
            variant='ghost'
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            aria-pressed={editor.isActive({ textAlign: 'right' })}
            title='Align right'
          >
            <IconAlignRight className='size-4' />
          </Button>

          <div className='bg-border mx-1 h-6 w-px' />

          {/* Quote */}
          <Button
            size='sm'
            variant='ghost'
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            aria-pressed={editor.isActive('blockquote')}
            title='Blockquote'
          >
            <IconQuote className='size-4' />
          </Button>

          <div className='bg-border mx-1 h-6 w-px' />

          {/* Link */}
          <Button
            size='sm'
            variant='ghost'
            onClick={() => {
              const prev = editor.getAttributes('link').href as
                | string
                | undefined;
              const url = window.prompt('Enter URL', prev || 'https://');
              if (url === null) return;
              if (url === '') return editor.chain().focus().unsetLink().run();
              editor
                .chain()
                .focus()
                .setLink({ href: url, target: '_blank' })
                .run();
            }}
            aria-pressed={editor.isActive('link')}
            title='Link'
          >
            <IconLink className='size-4' />
          </Button>
          <Button
            size='sm'
            variant='ghost'
            onClick={() => editor.chain().focus().unsetLink().run()}
            title='Remove link'
          >
            <IconUnlink className='size-4' />
          </Button>

          <div className='bg-border mx-1 h-6 w-px' />

          {/* Image */}
          <input
            ref={fileInputRef}
            type='file'
            className='hidden'
            accept='image/*'
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void insertImage(f);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
          />
          <Button
            size='sm'
            variant='ghost'
            onClick={onChooseImage}
            title='Insert image'
          >
            <IconPhoto className='size-4' />
          </Button>
        </div>

        <div className='min-h-0 flex-1 overflow-auto'>
          <div className='mx-auto max-w-[820px] px-4 py-4'>
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
    );
  }
);

export default SimpleEditor;
