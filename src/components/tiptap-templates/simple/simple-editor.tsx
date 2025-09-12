'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Heading from '@tiptap/extension-heading';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import FontFamily from '@tiptap/extension-font-family';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import {
  IconBold,
  IconItalic,
  IconUnderline,
  IconStrikethrough,
  IconBlockquote,
  IconCode,
  IconList,
  IconListNumbers,
  IconChecklist,
  IconLink,
  IconPhoto,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconAlignLeft,
  IconAlignCenter,
  IconAlignRight,
  IconAlignJustified,
  IconHighlight,
  IconPilcrow,
  IconPrinter,
  IconEraser,
  IconBrush,
  IconSearch,
  IconIndentIncrease,
  IconIndentDecrease,
  IconChevronDown,
  IconDots
} from '@tabler/icons-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type Props = {
  value?: string;
  onChange?: (html: string) => void;
  className?: string;
  zoom?: number;
  onZoomChange?: (z: number) => void;
  toolbarPortal?: HTMLElement | null;
  editable?: boolean;
  onOutlineUpdate?: (
    items: { id: string; text: string; level: number }[]
  ) => void;
};

function ToolbarButton({
  onClick,
  active,
  children,
  title
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type='button'
      title={title}
      onClick={onClick}
      className={cn(
        'hover:bg-accent inline-flex h-8 min-w-8 items-center justify-center rounded px-2 text-sm',
        active && 'bg-accent'
      )}
    >
      {children}
    </button>
  );
}

export function SimpleEditor({
  value,
  onChange,
  className,
  zoom,
  onZoomChange,
  toolbarPortal,
  editable = true,
  onOutlineUpdate
}: Props) {
  const [fontSize, setFontSize] = useState<number>(11);
  const [showMarks, setShowMarks] = useState(false);
  const [paintActive, setPaintActive] = useState(false);
  const [paintMarks, setPaintMarks] = useState<Record<string, any> | null>(
    null
  );
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [tableMenu, setTableMenu] = useState<{
    x: number;
    y: number;
    visible: boolean;
  } | null>(null);
  const hoveredTableRef = useRef<HTMLTableElement | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const [tableMenuOpen, setTableMenuOpen] = useState(false);
  // Extend Table to support a dataWidth attribute that renders width style
  const TableEx = useMemo(
    () =>
      Table.extend({
        addAttributes() {
          return {
            dataWidth: {
              default: null,
              parseHTML: (element: HTMLElement) =>
                element.getAttribute('data-width'),
              renderHTML: (attributes: any) => {
                const attrs: Record<string, any> = {};
                if (attributes.dataWidth) {
                  attrs['data-width'] = attributes.dataWidth;
                  if (attributes.dataWidth !== 'auto') {
                    attrs.style = `width: ${attributes.dataWidth}`;
                  }
                }
                return attrs;
              }
            },
            'data-borders': {
              default: 'vertical',
              parseHTML: (element: HTMLElement) =>
                element.getAttribute('data-borders') || 'vertical',
              renderHTML: (attributes: any) => ({
                'data-borders': attributes['data-borders'] || 'vertical'
              })
            }
          };
        }
      }),
    []
  );
  const ImageEx = useMemo(
    () =>
      Image.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            dataWidth: {
              default: null,
              parseHTML: (element: HTMLElement) =>
                element.getAttribute('data-width'),
              renderHTML: (attributes: any) => {
                const attrs: Record<string, any> = {};
                if (attributes.dataWidth)
                  attrs['data-width'] = attributes.dataWidth;
                return attrs;
              }
            }
          };
        }
      }),
    []
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      Heading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
      Underline,
      Link.configure({ openOnClick: true, autolink: true }),
      ImageEx,
      TextStyle,
      FontFamily.configure({ types: ['textStyle'] }),
      Color,
      Highlight,
      Superscript,
      Subscript,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TableEx.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: 'Write something…' })
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-neutral dark:prose-invert max-w-none focus:outline-none',
          showMarks && 'nv-show-paragraph-marks'
        )
      }
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
      // outline (headings)
      const json = editor.getJSON();
      const items: { id: string; text: string; level: number }[] = [];
      const walk = (node: any) => {
        if (!node) return;
        if (Array.isArray(node)) {
          node.forEach(walk);
          return;
        }
        if (node.type === 'heading') {
          const text = (node.content || [])
            .map((c: any) => c.text || '')
            .join('');
          items.push({
            id: '' + items.length,
            text: text || 'Heading',
            level: node.attrs?.level || 1
          });
        }
        if (node.content) walk(node.content);
      };
      walk(json?.content || []);
      onOutlineUpdate?.(items);
    },
    immediatelyRender: false
  });

  useEffect(() => {
    if (value != null && editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  // derive and keep font size from selection
  useEffect(() => {
    if (!editor) return;
    const update = () => {
      const size = parseInt(
        (editor.getAttributes('textStyle')?.fontSize as string) || '11',
        10
      );
      setFontSize(Number.isFinite(size) ? size : 11);
    };
    editor.on('selectionUpdate', update);
    editor.on('transaction', update);
    update();
    return () => {
      editor.off('selectionUpdate', update);
      editor.off('transaction', update);
    };
  }, [editor]);

  // apply editable mode from prop
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!!editable);
  }, [editor, editable]);

  // Table hover menu positioning
  useEffect(() => {
    const el = editor?.view.dom as HTMLElement | undefined;
    const wrap = wrapperRef.current as HTMLElement | null;
    if (!editor || !el || !wrap) return;
    const onMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const table = target?.closest('table') as HTMLTableElement | null;
      const onTrigger = !!target?.closest('[data-nv-table-trigger]');
      if (!table && !onTrigger) {
        if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = window.setTimeout(() => {
          if (tableMenuOpen) return; // do not hide while menu open
          setTableMenu((m) => (m ? { ...m, visible: false } : null));
          hoveredTableRef.current = null;
        }, 180);
        return;
      }
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      const activeTable = table || hoveredTableRef.current;
      if (!activeTable) return;
      hoveredTableRef.current = activeTable as HTMLTableElement;
      const rect = activeTable.getBoundingClientRect();
      const base = wrap.getBoundingClientRect();
      setTableMenu({
        x: rect.left - base.left + 4,
        y: rect.top - base.top + 4,
        visible: true
      });
    };
    wrap.addEventListener('mousemove', onMove);
    const onLeave = () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = window.setTimeout(() => {
        if (tableMenuOpen) return;
        setTableMenu((m) => (m ? { ...m, visible: false } : null));
      }, 180);
    };
    wrap.addEventListener('mouseleave', onLeave);
    return () => {
      wrap.removeEventListener('mousemove', onMove);
      wrap.removeEventListener('mouseleave', onLeave);
    };
  }, [editor, tableMenu?.visible]);

  // format painter behavior
  useEffect(() => {
    if (!editor) return;
    if (!paintActive) return;
    const apply = () => {
      if (!paintMarks) return;
      const chain = editor.chain().focus();
      Object.entries(paintMarks).forEach(([mark, attrs]) => {
        if (attrs) chain.setMark(mark as any, attrs as any);
        else chain.setMark(mark as any);
      });
      chain.run();
      setPaintActive(false);
    };
    editor.on('selectionUpdate', apply);
    return () => {
      editor.off('selectionUpdate', apply);
    };
  }, [editor, paintActive, paintMarks]);

  const toolbarContent = (
    <div
      className={cn(
        'flex flex-wrap items-center gap-1 px-2 py-1',
        toolbarPortal
          ? 'rounded-none border-0 bg-transparent shadow-none'
          : 'bg-background rounded-md border shadow-sm'
      )}
    >
      {/* Menus search pill */}
      <button
        type='button'
        className='bg-muted/50 text-muted-foreground hover:bg-muted flex items-center gap-2 rounded-full px-3 py-1 text-sm'
        title='Search menus'
      >
        <IconSearch className='h-4 w-4' />
        Menus
      </button>

      <ToolbarButton
        title='Bold'
        active={editor?.isActive('bold')}
        onClick={() => editor?.chain().focus().toggleBold().run()}
      >
        <IconBold className='h-4 w-4' />
      </ToolbarButton>
      <ToolbarButton
        title='Italic'
        active={editor?.isActive('italic')}
        onClick={() => editor?.chain().focus().toggleItalic().run()}
      >
        <IconItalic className='h-4 w-4' />
      </ToolbarButton>
      <ToolbarButton
        title='Underline'
        active={editor?.isActive('underline')}
        onClick={() => editor?.chain().focus().toggleUnderline().run()}
      >
        <IconUnderline className='h-4 w-4' />
      </ToolbarButton>
      <ToolbarButton
        title='Strikethrough'
        active={editor?.isActive('strike')}
        onClick={() => editor?.chain().focus().toggleStrike().run()}
      >
        <IconStrikethrough className='h-4 w-4' />
      </ToolbarButton>
      <ToolbarButton
        title='Superscript'
        active={editor?.isActive('superscript')}
        onClick={() => editor?.chain().focus().toggleSuperscript().run()}
      >
        <sup className='text-[10px] font-semibold'>x</sup>
      </ToolbarButton>
      <ToolbarButton
        title='Subscript'
        active={editor?.isActive('subscript')}
        onClick={() => editor?.chain().focus().toggleSubscript().run()}
      >
        <sub className='text-[10px] font-semibold'>x</sub>
      </ToolbarButton>

      <div className='bg-border mx-1 h-6 w-px' />

      <ToolbarButton
        title='Bulleted list'
        active={editor?.isActive('bulletList')}
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
      >
        <IconList className='h-4 w-4' />
      </ToolbarButton>
      <ToolbarButton
        title='Numbered list'
        active={editor?.isActive('orderedList')}
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
      >
        <IconListNumbers className='h-4 w-4' />
      </ToolbarButton>
      <ToolbarButton
        title='Checklist'
        active={editor?.isActive('taskList')}
        onClick={() => editor?.chain().focus().toggleTaskList().run()}
      >
        <IconChecklist className='h-4 w-4' />
      </ToolbarButton>
      <ToolbarButton
        title='Increase indent'
        onClick={() => editor?.chain().focus().sinkListItem('listItem').run()}
      >
        <IconIndentIncrease className='h-4 w-4' />
      </ToolbarButton>
      <ToolbarButton
        title='Decrease indent'
        onClick={() => editor?.chain().focus().liftListItem('listItem').run()}
      >
        <IconIndentDecrease className='h-4 w-4' />
      </ToolbarButton>

      <div className='bg-border mx-1 h-6 w-px' />

      <ToolbarButton
        title='Align left'
        active={editor?.isActive({ textAlign: 'left' })}
        onClick={() => editor?.chain().focus().setTextAlign('left').run()}
      >
        <IconAlignLeft className='h-4 w-4' />
      </ToolbarButton>
      <ToolbarButton
        title='Align center'
        active={editor?.isActive({ textAlign: 'center' })}
        onClick={() => editor?.chain().focus().setTextAlign('center').run()}
      >
        <IconAlignCenter className='h-4 w-4' />
      </ToolbarButton>
      <ToolbarButton
        title='Align right'
        active={editor?.isActive({ textAlign: 'right' })}
        onClick={() => editor?.chain().focus().setTextAlign('right').run()}
      >
        <IconAlignRight className='h-4 w-4' />
      </ToolbarButton>
      <ToolbarButton
        title='Justify'
        active={editor?.isActive({ textAlign: 'justify' })}
        onClick={() => editor?.chain().focus().setTextAlign('justify').run()}
      >
        <IconAlignJustified className='h-4 w-4' />
      </ToolbarButton>

      <div className='bg-border mx-1 h-6 w-px' />

      <ToolbarButton
        title='Blockquote'
        active={editor?.isActive('blockquote')}
        onClick={() => editor?.chain().focus().toggleBlockquote().run()}
      >
        <IconBlockquote className='h-4 w-4' />
      </ToolbarButton>
      <ToolbarButton
        title='Inline code'
        active={editor?.isActive('code')}
        onClick={() => editor?.chain().focus().toggleCode().run()}
      >
        <IconCode className='h-4 w-4' />
      </ToolbarButton>
      <ToolbarButton
        title='Code block'
        active={editor?.isActive('codeBlock')}
        onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
      >
        <IconCode className='h-4 w-4' />
      </ToolbarButton>
      <ToolbarButton
        title='Horizontal rule'
        onClick={() => editor?.chain().focus().setHorizontalRule().run()}
      >
        <hr className='bg-foreground h-[2px] w-4 border-0' />
      </ToolbarButton>

      <div className='bg-border mx-1 h-6 w-px' />

      <select
        title='Font family'
        className='rounded px-2 py-1 text-sm'
        onChange={(e) =>
          editor?.chain().focus().setFontFamily(e.target.value).run()
        }
        value={(editor?.getAttributes('textStyle')?.fontFamily as string) || ''}
      >
        <option value=''>Default</option>
        <option value='Arial'>Arial</option>
        <option value='Georgia'>Georgia</option>
        <option value='Times New Roman'>Times New Roman</option>
        <option value='Inter'>Inter</option>
        <option value='Courier New'>Courier New</option>
      </select>
      <div className='flex items-center rounded border px-1'>
        <input
          type='number'
          min={8}
          max={72}
          step={1}
          value={fontSize}
          onChange={(e) => {
            const v = Math.min(
              72,
              Math.max(8, parseInt(e.target.value || '11', 10))
            );
            setFontSize(v);
            editor
              ?.chain()
              .focus()
              .setMark('textStyle', { fontSize: `${v}pt` })
              .run();
          }}
          className='w-12 bg-transparent p-1 text-sm outline-none'
          title='Font size'
        />
      </div>
      <select
        title='Line height'
        className='rounded px-2 py-1 text-sm'
        onChange={(e) =>
          editor
            ?.chain()
            .focus()
            .setMark('textStyle', { lineHeight: e.target.value })
            .run()
        }
        defaultValue='1.15'
      >
        {['1.0', '1.15', '1.5', '2.0'].map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
      <input
        type='color'
        title='Text color'
        className='h-8 w-8 rounded'
        onChange={(e) => editor?.chain().focus().setColor(e.target.value).run()}
      />
      <ToolbarButton
        title='Highlight'
        active={editor?.isActive('highlight')}
        onClick={() => editor?.chain().focus().toggleHighlight().run()}
      >
        <IconHighlight className='h-4 w-4' />
      </ToolbarButton>
      <ToolbarButton
        title='Clear formatting'
        onClick={() =>
          editor?.chain().focus().unsetAllMarks().clearNodes().run()
        }
      >
        <IconEraser className='h-4 w-4' />
      </ToolbarButton>

      <div className='bg-border mx-1 h-6 w-px' />

      <ToolbarButton
        title='Undo'
        onClick={() => editor?.chain().focus().undo().run()}
      >
        <IconArrowBackUp className='h-4 w-4' />
      </ToolbarButton>
      <ToolbarButton
        title='Redo'
        onClick={() => editor?.chain().focus().redo().run()}
      >
        <IconArrowForwardUp className='h-4 w-4' />
      </ToolbarButton>
      <ToolbarButton
        title={paintActive ? 'Paste format (active)' : 'Format painter'}
        active={paintActive}
        onClick={() => {
          if (!editor) return;
          if (!paintActive) {
            // capture current marks
            const marks =
              editor.state.storedMarks || editor.state.selection.$from.marks();
            const dict: Record<string, any> = {};
            marks?.forEach((m: any) => {
              dict[m.type.name] =
                m.attrs && Object.keys(m.attrs).length ? m.attrs : null;
            });
            setPaintMarks(dict);
            setPaintActive(true);
          } else {
            setPaintActive(false);
          }
        }}
      >
        <IconBrush className='h-4 w-4' />
      </ToolbarButton>
      <ToolbarButton title='Print' onClick={() => window.print()}>
        <IconPrinter className='h-4 w-4' />
      </ToolbarButton>

      <div className='bg-border mx-1 h-6 w-px' />

      <ToolbarButton
        title='Insert link'
        onClick={() => {
          const url = prompt('Link URL');
          if (url) editor?.chain().focus().setLink({ href: url }).run();
        }}
      >
        <IconLink className='h-4 w-4' />
      </ToolbarButton>
      <ToolbarButton
        title='Insert image'
        onClick={() => {
          const url = prompt('Image URL');
          if (url) editor?.chain().focus().setImage({ src: url }).run();
        }}
      >
        <IconPhoto className='h-4 w-4' />
      </ToolbarButton>
      <input
        type='file'
        accept='image/*'
        title='Upload image'
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            const src = String(reader.result || '');
            editor?.chain().focus().setImage({ src }).run();
          };
          reader.readAsDataURL(file);
          e.currentTarget.value = '';
        }}
      />

      {typeof zoom === 'number' && onZoomChange && (
        <select
          className='ml-1 rounded px-2 py-1 text-sm'
          value={String(Math.round(zoom * 100))}
          onChange={(e) => onZoomChange(parseInt(e.target.value, 10) / 100)}
          title='Zoom'
        >
          {[50, 75, 90, 100, 110, 125, 150, 200].map((z) => (
            <option key={z} value={z}>
              {z}%
            </option>
          ))}
        </select>
      )}

      <ToolbarButton
        title='Show paragraph marks'
        active={showMarks}
        onClick={() => setShowMarks((v) => !v)}
      >
        <IconPilcrow className='h-4 w-4' />
      </ToolbarButton>

      {/* Image tools (visible when image is selected) */}
      {editor?.isActive('image') && (
        <div className='bg-background ml-2 flex items-center gap-1 rounded-md border px-2 py-1'>
          <span className='text-muted-foreground mr-1 text-xs'>Image:</span>
          <select
            className='rounded px-1 py-0.5 text-xs'
            title='Image width'
            value={String(
              editor?.getAttributes('image')?.['dataWidth'] || 'auto'
            )}
            onChange={(e) => {
              const v = e.target.value;
              const style = v === 'auto' ? '' : `width:${v}`;
              editor
                ?.chain()
                .focus()
                .updateAttributes('image', { ['dataWidth']: v, style })
                .run();
            }}
          >
            <option value='auto'>Auto</option>
            <option value='25%'>25%</option>
            <option value='50%'>50%</option>
            <option value='75%'>75%</option>
            <option value='100%'>100%</option>
          </select>
          <div className='bg-border mx-1 h-4 w-px' />
          <ToolbarButton
            title='Align left'
            onClick={() =>
              editor
                ?.chain()
                .focus()
                .updateAttributes('image', {
                  style: 'display:block;margin:0;float:left;margin-right:8px'
                })
                .run()
            }
          >
            <IconAlignLeft className='h-4 w-4' />
          </ToolbarButton>
          <ToolbarButton
            title='Center'
            onClick={() =>
              editor
                ?.chain()
                .focus()
                .updateAttributes('image', {
                  style: 'display:block;margin:0 auto;float:none'
                })
                .run()
            }
          >
            <IconAlignCenter className='h-4 w-4' />
          </ToolbarButton>
          <ToolbarButton
            title='Align right'
            onClick={() =>
              editor
                ?.chain()
                .focus()
                .updateAttributes('image', {
                  style: 'display:block;margin:0;float:right;margin-left:8px'
                })
                .run()
            }
          >
            <IconAlignRight className='h-4 w-4' />
          </ToolbarButton>
        </div>
      )}
    </div>
  );

  return (
    <div ref={wrapperRef} className={cn('relative w-full', className)}>
      {/* Toolbar either portaled into header or shown sticky below */}
      {toolbarPortal ? (
        typeof window !== 'undefined' && toolbarPortal ? (
          createPortal(toolbarContent, toolbarPortal)
        ) : null
      ) : (
        <div className='sticky top-[92px] z-30 mb-3'>{toolbarContent}</div>
      )}

      <EditorContent editor={editor} className='min-h-[400px]' />

      {/* Table hover menu trigger */}
      {tableMenu?.visible && (
        <div
          style={{
            position: 'absolute',
            left: tableMenu.x,
            top: tableMenu.y,
            zIndex: 40
          }}
          data-nv-table-trigger
        >
          <DropdownMenu open={tableMenuOpen} onOpenChange={setTableMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                className='bg-background/95 ring-border hover:bg-accent inline-flex h-6 w-6 items-center justify-center rounded shadow ring-1'
                aria-label='Table options'
                data-nv-table-trigger
              >
                <IconDots className='h-4 w-4' />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='start' className='w-56'>
              <DropdownMenuLabel>Table</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Width</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {['auto', '50%', '75%', '100%'].map((v) => (
                    <DropdownMenuItem
                      key={v}
                      onClick={() =>
                        editor
                          ?.chain()
                          .focus()
                          .updateAttributes('table', { dataWidth: v })
                          .run()
                      }
                    >
                      {v}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Borders</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {['vertical', 'all', 'none'].map((v) => (
                    <DropdownMenuItem
                      key={v}
                      onClick={() =>
                        editor
                          ?.chain()
                          .focus()
                          .updateAttributes('table', { ['data-borders']: v })
                          .run()
                      }
                    >
                      {v}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => editor?.chain().focus().addRowBefore().run()}
              >
                Insert row above
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => editor?.chain().focus().addRowAfter().run()}
              >
                Insert row below
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => editor?.chain().focus().deleteRow().run()}
              >
                Delete row
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => editor?.chain().focus().addColumnBefore().run()}
              >
                Insert column left
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => editor?.chain().focus().addColumnAfter().run()}
              >
                Insert column right
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => editor?.chain().focus().deleteColumn().run()}
              >
                Delete column
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => editor?.chain().focus().toggleHeaderRow().run()}
              >
                Toggle header row
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => editor?.chain().focus().mergeCells().run()}
              >
                Merge cells
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => editor?.chain().focus().splitCell().run()}
              >
                Split cell
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className='text-red-600'
                onClick={() => editor?.chain().focus().deleteTable().run()}
              >
                Delete table
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
