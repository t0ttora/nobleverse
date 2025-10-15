'use client';
import React from 'react';
import { cn } from '@/lib/utils';

type Props = {
  left: React.ReactNode;
  right: React.ReactNode;
  ratio: number; // 0..1 for left width
  onRatioChange?: (r: number) => void;
  className?: string;
};

export default function SplitView({
  left,
  right,
  ratio,
  onRatioChange,
  className
}: Props) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = React.useState(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || !containerRef.current || !onRatioChange) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const next = Math.min(0.8, Math.max(0.2, x / rect.width));
    onRatioChange(Number(next.toFixed(3)));
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    setDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  return (
    <div
      ref={containerRef}
      className={cn('relative flex h-full w-full select-none', className)}
    >
      {/* Left pane */}
      <div
        className='flex h-full min-w-0 flex-col p-3 pt-2'
        style={{ width: `${ratio * 100}%` }}
      >
        <div className='bg-background ring-border/50 h-full w-full rounded-md shadow-sm ring-1'>
          {left}
        </div>
      </div>
      {/* Divider (header-colored gap) */}
      <div
        className={cn(
          'bg-sidebar-foreground/10 hover:bg-sidebar-foreground/20 active:bg-sidebar-foreground/25 relative z-10 w-1 cursor-col-resize'
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        role='separator'
        aria-orientation='vertical'
        aria-label='Resize'
      />
      {/* Right pane */}
      <div className='flex h-full min-w-0 flex-1 flex-col p-3 pt-2'>
        <div className='bg-background ring-border/50 h-full w-full rounded-md shadow-sm ring-1'>
          {right}
        </div>
      </div>
    </div>
  );
}
