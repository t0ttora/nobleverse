'use client';
import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTabs } from './tabs-context';
import { cn } from '@/lib/utils';
import { Icons, type Icon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';

// A simple scrollable tab bar for the dashboard header.
export default function TabsBar({ className }: { className?: string }) {
  const {
    tabs,
    activeTabId,
    focusedPane,
    rightActiveTabId,
    activateTab,
    closeTab,
    togglePin,
    reorderTab,
    collapseMode,
    collapseBar,
    collapseNone,
    collapseOthers,
    split,
    setSplit,
    activateRightTab
  } = useTabs();
  const router = useRouter();
  const pathname = usePathname();
  const [justAddedIds, setJustAddedIds] = React.useState<string[]>([]);
  // Memoized splits to avoid recomputation and to keep hooks order stable
  const pinnedTabs = React.useMemo(() => tabs.filter((t) => t.pinned), [tabs]);
  const regularTabs = React.useMemo(
    () => tabs.filter((t) => !t.pinned),
    [tabs]
  );

  // Mark last-added tab for a small popup animation
  const prevLenRef = React.useRef(0);
  React.useEffect(() => {
    const prev = prevLenRef.current;
    if (tabs.length > prev) {
      const last = tabs[tabs.length - 1];
      if (last) {
        setJustAddedIds((arr) => [...arr, last.id]);
        setTimeout(() => {
          setJustAddedIds((arr) => arr.filter((id) => id !== last.id));
        }, 400);
      }
    }
    prevLenRef.current = tabs.length;
  }, [tabs.length]);

  if (tabs.length === 0) return null;

  // If whole bar is collapsed, show only the overflow trigger so tabs remain accessible
  if (collapseMode === 'bar') {
    return (
      <div
        className={cn(
          'relative ml-1 flex h-8 items-center overflow-hidden rounded-md px-1',
          className
        )}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              aria-label='Tabs menu'
              className='text-muted-foreground hover:text-foreground h-7 w-7 rounded-sm'
            >
              <Icons.ellipsis className='size-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-48'>
            <div className='flex items-center justify-center gap-2 p-2 pt-2'>
              <button
                type='button'
                aria-label='Expand all'
                className='text-muted-foreground hover:text-foreground inline-flex h-7 w-7 items-center justify-center rounded'
                onClick={collapseNone}
              >
                <Icons.grid className='size-4' />
              </button>
            </div>
            <DropdownMenuSeparator />
            {pinnedTabs.length > 0 && (
              <>
                <DropdownMenuLabel className='text-muted-foreground text-xs font-medium'>
                  Pinned
                </DropdownMenuLabel>
                {pinnedTabs.map((t) => (
                  <DropdownMenuItem
                    key={`om-p-${t.id}`}
                    onClick={() => activateTab(t.id)}
                    className='flex items-center gap-2'
                  >
                    <ColoredIcon
                      icon={t.icon}
                      kind={t.kind}
                      className='size-4'
                    />
                    <span className='truncate'>{t.title}</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuLabel className='text-muted-foreground text-xs font-medium'>
              All tabs
            </DropdownMenuLabel>
            {regularTabs.map((t) => (
              <DropdownMenuItem
                key={`om-${t.id}`}
                onClick={() => activateTab(t.id)}
                className='flex items-center gap-2'
              >
                <ColoredIcon icon={t.icon} kind={t.kind} className='size-4' />
                <span className='truncate'>{t.title}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'bg-muted/50 ring-border/50 relative ml-1 flex h-8 max-w-[56vw] items-center gap-1 overflow-hidden rounded-md px-1 shadow-sm ring-1',
        className
      )}
      role='tablist'
      aria-label='Open tabs'
    >
      {/* Pinned on the left */}
      <div className='flex items-center gap-1 pl-0.5'>
        {pinnedTabs.map((t) => (
          <TabItem
            key={t.id}
            id={t.id}
            title={t.title}
            icon={t.icon}
            kind={t.kind}
            pinned
            active={t.id === activeTabId}
            justAdded={justAddedIds.includes(t.id)}
            onActivate={() => activateTab(t.id)}
            onClose={() => closeTab(t.id)}
            onTogglePin={() => togglePin(t.id)}
            onDragStartId={t.id}
          />
        ))}
      </div>
      {/* Divider between pinned and regular if any pinned */}
      {tabs.some((t) => t.pinned) && (
        <div className='bg-border/60 mx-0.5 h-5 w-px' />
      )}
      {/* Scrollable regular tabs */}
      <div className='scrollbar-thin scrollbar-thumb-border/60 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-0.5'>
        {regularTabs.map((t) => (
          <TabItem
            key={t.id}
            id={t.id}
            title={t.title}
            icon={t.icon}
            kind={t.kind}
            active={t.id === activeTabId}
            justAdded={justAddedIds.includes(t.id)}
            onActivate={() => activateTab(t.id)}
            onClose={() => closeTab(t.id)}
            onTogglePin={() => togglePin(t.id)}
            onDragStartId={t.id}
          />
        ))}
      </div>
      {/* Overflow / Controls menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            aria-label='Tabs menu'
            className='text-muted-foreground hover:text-foreground h-7 w-7 rounded-sm'
          >
            <Icons.ellipsis className='size-4' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-48'>
          <div className='flex items-center justify-center gap-2 p-2 pt-2'>
            {/* 1. Collapse whole bar to single icon */}
            <button
              type='button'
              aria-label='Collapse bar'
              className='text-muted-foreground hover:text-foreground inline-flex h-7 w-7 items-center justify-center rounded'
              onClick={collapseBar}
            >
              <Icons.chevronLeft className='size-4' />
            </button>
            {/* Removed split view toggle */}
            <div className='bg-border/70 h-4 w-px' />
            {/* 2. Collapse others (only active expanded) */}
            <button
              type='button'
              aria-label='Collapse others'
              className='text-muted-foreground hover:text-foreground inline-flex h-7 w-7 items-center justify-center rounded'
              onClick={collapseOthers}
            >
              <Icons.grid className='size-4' />
            </button>
            <div className='bg-border/70 h-4 w-px' />
            {/* 3. Expand all (reset) */}
            <button
              type='button'
              aria-label='Expand all'
              className='text-muted-foreground hover:text-foreground inline-flex h-7 w-7 items-center justify-center rounded'
              onClick={collapseNone}
            >
              <Icons.grid className='size-4' />
            </button>
          </div>
          <DropdownMenuSeparator />
          {pinnedTabs.length > 0 && (
            <>
              <DropdownMenuLabel className='text-muted-foreground text-xs font-medium'>
                Pinned
              </DropdownMenuLabel>
              {pinnedTabs.map((t) => (
                <DropdownMenuItem
                  key={`om-p-${t.id}`}
                  onClick={() => activateTab(t.id)}
                  className='flex items-center gap-2'
                >
                  <ColoredIcon icon={t.icon} kind={t.kind} className='size-4' />
                  <span className='truncate'>{t.title}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuLabel className='text-muted-foreground text-xs font-medium'>
            All tabs
          </DropdownMenuLabel>
          {regularTabs.map((t) => (
            <DropdownMenuItem
              key={`om-${t.id}`}
              onClick={() => activateTab(t.id)}
              className='flex items-center gap-2'
            >
              <ColoredIcon icon={t.icon} kind={t.kind} className='size-4' />
              <span className='truncate'>{t.title}</span>
              {split && (
                <button
                  type='button'
                  className='hover:bg-muted ml-auto inline-flex h-5 w-5 items-center justify-center rounded'
                  title='Open on right'
                  onClick={(e) => {
                    e.stopPropagation();
                    activateRightTab(t.id);
                  }}
                >
                  <Icons.layoutSplit className='size-3.5 opacity-80' />
                </button>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

const TabItem = React.memo(function TabItem({
  id,
  title,
  icon: IconCmp,
  kind,
  pinned,
  active,
  justAdded,
  onActivate,
  onClose,
  onTogglePin,
  onDragStartId
}: {
  id: string;
  title: string;
  icon?: Icon;
  kind?: string;
  pinned?: boolean;
  active?: boolean;
  justAdded?: boolean;
  onActivate: () => void;
  onClose: () => void;
  onTogglePin: () => void;
  onDragStartId?: string;
}) {
  const { reorderTab, collapseMode, activeTabId } = useTabs();
  const collapsed = collapseMode === 'others' && activeTabId !== id;
  return (
    <div
      className={cn(
        'group/tab text-muted-foreground hover:text-foreground hover:bg-background/60 flex min-w-0 cursor-pointer items-center gap-1 rounded px-1.5 py-1.5 text-xs',
        active && 'bg-background text-foreground -ml-0.5 shadow-sm',
        justAdded && 'animate-in fade-in-0 zoom-in-95'
      )}
      role='tab'
      aria-selected={!!active}
      tabIndex={0}
      onClick={onActivate}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/tab-id', onDragStartId || id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(e) => {
        e.preventDefault();
        const dragId = e.dataTransfer.getData('text/tab-id');
        if (dragId) reorderTab(dragId, id);
      }}
    >
      <span
        className={cn(
          'inline-flex items-center justify-center',
          collapsed ? 'mr-0' : 'mr-0.5'
        )}
      >
        {/* Default icon (hidden on hover) */}
        <span className='inline-flex group-hover/tab:hidden'>
          <ColoredIcon
            icon={IconCmp}
            kind={kind}
            className='size-3.5 opacity-90'
          />
        </span>
        {/* Hover star icon (pin toggle) */}
        <button
          type='button'
          className='hidden group-hover/tab:inline-flex'
          title={pinned ? 'Unpin' : 'Pin'}
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin();
          }}
        >
          {pinned ? (
            <Icons.starFilled className='size-3.5 opacity-90' />
          ) : (
            <Icons.star className='size-3.5 opacity-90' />
          )}
        </button>
      </span>
      {!collapsed && <span className='truncate'>{title}</span>}
      {/* Removed inline pin button to avoid duplicate star controls on hover */}
      <button
        className={cn(
          'hover:bg-muted inline-flex h-4 w-4 items-center justify-center rounded',
          collapsed ? 'ml-0' : 'ml-0.5'
        )}
        aria-label={`Close ${title}`}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <Icons.close className='size-3.5' />
      </button>
    </div>
  );
});

export function ColoredIcon({
  icon: IconCmp,
  kind,
  className
}: {
  icon?: Icon;
  kind?: string;
  className?: string;
}) {
  if (!IconCmp) IconCmp = Icons.file;
  const colorClass =
    kind === 'cells'
      ? 'text-emerald-600 dark:text-emerald-400'
      : kind === 'docs'
        ? 'text-indigo-600 dark:text-indigo-400'
        : 'text-foreground/80';
  return <IconCmp className={cn(className, colorClass)} />;
}
