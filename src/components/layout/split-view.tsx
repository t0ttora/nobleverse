'use client';
import React from 'react';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/icons';

type Props = {
  left: React.ReactNode;
  right: React.ReactNode;
  ratio: number; // 0..1 for left width
  onRatioChange?: (r: number) => void;
  className?: string;
  onCloseLeft?: () => void;
  onCloseRight?: () => void;
  onSwap?: () => void;
  rightIsHome?: boolean;
  leftIsHome?: boolean;
  onFocusPane?: (side: 'left' | 'right') => void;
};

export default function SplitView({
  left,
  right,
  ratio,
  onRatioChange,
  className,
  onCloseLeft,
  onCloseRight,
  onSwap,
  rightIsHome,
  leftIsHome,
  onFocusPane
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
    // Responsive limits: enforce min width per pane (e.g., 280px) and cap extremes
    const minPane = 280; // px
    const minRatio = Math.max(minPane / rect.width, 0.1);
    const maxRatio = 1 - minRatio;
    const raw = x / rect.width;
    const next = Math.min(maxRatio, Math.max(minRatio, raw));
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
      className={cn(
        'relative flex h-full min-h-0 w-full select-none',
        className
      )}
    >
      {/* Left pane */}
      <div
        className='relative flex h-full min-h-0 min-w-0 flex-col p-0 pr-[2px]'
        style={{ width: `${ratio * 100}%` }}
        onClick={() => {
          onFocusPane?.('left');
        }}
      >
        <div className='bg-background ring-border/50 flex min-h-0 w-full flex-1 overflow-hidden rounded-tl-none rounded-tr-2xl rounded-br-none rounded-bl-none shadow-sm ring-1'>
          {left}
        </div>
        {/* Top hover area -> toolbar (left) */}
        {!leftIsHome && (
          <div className='group/topbar pointer-events-auto absolute top-0 right-0 left-0 z-10 h-8'>
            <div className='pointer-events-none flex h-full items-center gap-1 pl-2 opacity-0 transition-opacity group-hover/topbar:opacity-100'>
              <ToolbarButton
                title='Maximize left'
                onClick={() => onRatioChange && onRatioChange(0.8)}
              >
                <Icons.chevronLeft className='size-4' />
              </ToolbarButton>
              <ToolbarButton
                title='Equal split'
                onClick={() => onRatioChange && onRatioChange(0.5)}
              >
                <Icons.grid className='size-4' />
              </ToolbarButton>
              <ToolbarButton
                title='Maximize right'
                onClick={() => onRatioChange && onRatioChange(0.2)}
              >
                <Icons.chevronRight className='size-4' />
              </ToolbarButton>
              {onSwap && (
                <ToolbarButton title='Swap panes' onClick={() => onSwap?.()}>
                  <Icons.arrowRight className='size-4 rotate-180' />
                </ToolbarButton>
              )}
              {onCloseLeft && (
                <ToolbarButton
                  title='Close split (keep left)'
                  onClick={onCloseLeft}
                >
                  <Icons.close className='size-4' />
                </ToolbarButton>
              )}
            </div>
          </div>
        )}
      </div>
      {/* Tiny resize handle */}
      <div
        className='relative z-10 flex w-2 cursor-col-resize items-center justify-center'
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        role='separator'
        aria-orientation='vertical'
        aria-label='Resize'
      >
        <div className='bg-border/60 h-8 w-[2px] rounded-full' />
      </div>
      {/* Right pane */}
      <div
        className='relative flex h-full min-h-0 min-w-0 flex-1 flex-col p-0 pl-[2px]'
        onClick={() => {
          onFocusPane?.('right');
        }}
      >
        <div className='bg-background ring-border/50 flex min-h-0 w-full flex-1 overflow-hidden rounded-tl-2xl rounded-tr-none rounded-br-none rounded-bl-none shadow-sm ring-1'>
          {right}
        </div>
        {/* Top hover area -> toolbar (right) */}
        {!rightIsHome && (
          <div className='group/topbar pointer-events-auto absolute top-0 right-0 left-0 z-10 h-8'>
            <div className='pointer-events-none flex h-full items-center justify-end gap-1 pr-2 opacity-0 transition-opacity group-hover/topbar:opacity-100'>
              <ToolbarButton
                title='Maximize left'
                onClick={() => onRatioChange && onRatioChange(0.8)}
              >
                <Icons.chevronLeft className='size-4' />
              </ToolbarButton>
              <ToolbarButton
                title='Equal split'
                onClick={() => onRatioChange && onRatioChange(0.5)}
              >
                <Icons.grid className='size-4' />
              </ToolbarButton>
              <ToolbarButton
                title='Maximize right'
                onClick={() => onRatioChange && onRatioChange(0.8)}
              >
                <Icons.chevronRight className='size-4' />
              </ToolbarButton>
              {onSwap && (
                <ToolbarButton title='Swap panes' onClick={() => onSwap?.()}>
                  <Icons.arrowRight className='size-4' />
                </ToolbarButton>
              )}
              {onCloseRight && (
                <ToolbarButton
                  title='Close split (keep right)'
                  onClick={onCloseRight}
                >
                  <Icons.close className='size-4' />
                </ToolbarButton>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolbarButton({
  title,
  onClick,
  children
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type='button'
      className='bg-background/80 text-foreground ring-border hover:bg-background pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-md shadow-sm ring-1 backdrop-blur transition'
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
