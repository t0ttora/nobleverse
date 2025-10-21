'use client';
import Image from '@tiptap/extension-image';
import React from 'react';
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps
} from '@tiptap/react';

type Size = { width?: number | null; height?: number | null };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function ResizableImageView({
  node,
  selected,
  updateAttributes
}: NodeViewProps) {
  const { src, alt, title } = node.attrs as {
    src: string;
    alt?: string;
    title?: string;
  } & Size;
  const width = (node.attrs.width ?? null) as number | null;
  const imgRef = React.useRef<HTMLImageElement | null>(null);
  const start = React.useRef<{ x: number; w: number } | null>(null);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = imgRef.current?.getBoundingClientRect();
    const w = rect?.width ? Math.round(rect.width) : width || 320;
    start.current = { x: e.clientX, w };
    const onMove = (ev: MouseEvent) => {
      if (!start.current) return;
      const delta = ev.clientX - start.current.x;
      const next = clamp(start.current.w + delta, 80, 1600);
      updateAttributes({ width: Math.round(next) });
    };
    const onUp = () => {
      start.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <NodeViewWrapper className='resizable-image-wrapper' as='span'>
      <span className='relative inline-block'>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt={alt || ''}
          title={title}
          style={{ width: width ? `${width}px` : undefined }}
          className='align-middle'
          draggable={false}
        />
        {selected && (
          <span
            role='button'
            aria-label='Resize image'
            onMouseDown={onMouseDown}
            className='border-border bg-background/80 absolute right-1 bottom-1 z-10 inline-flex h-3 w-3 cursor-se-resize items-center justify-center rounded-sm border shadow'
          />
        )}
      </span>
    </NodeViewWrapper>
  );
}

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        renderHTML: (attrs: any) => ({
          width: attrs.width ?? undefined
        })
      },
      height: {
        default: null,
        renderHTML: (attrs: any) => ({
          height: attrs.height ?? undefined
        })
      }
    } as any;
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  }
});

export default ResizableImage;
