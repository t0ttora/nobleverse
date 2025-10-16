'use client';
import React from 'react';
import { useTabs } from './tabs-context';
import { cn } from '@/lib/utils';
import { Icons, type Icon } from '@/components/icons';

export default function TabContentHost({
  className,
  activeId
}: {
  className?: string;
  activeId?: string | null;
}) {
  const { tabs, activeTabId } = useTabs();
  const id = activeId ?? activeTabId;
  const active = tabs.find((t) => t.id === id);

  if (!active) return null;

  const IconCmp: Icon | undefined = active.icon || Icons.file;
  const colorClass =
    active.kind === 'cells'
      ? 'text-emerald-600 dark:text-emerald-400'
      : active.kind === 'docs'
        ? 'text-indigo-600 dark:text-indigo-400'
        : 'text-foreground/80';

  return (
    <div
      className={cn(
        'animate-in fade-in-0 zoom-in-95 flex h-full min-h-0 flex-col overflow-auto',
        className
      )}
    >
      <div className='mx-auto my-auto max-w-[720px] p-6 text-center'>
        <div
          className={cn(
            'mb-3 inline-flex items-center justify-center',
            colorClass
          )}
        >
          <IconCmp className='size-8' />
        </div>
        <h2 className='text-xl font-semibold'>{active.title}</h2>
        <p className='text-muted-foreground mt-2'>
          This is a placeholder for the tab content. Split view, routing, and
          live content will be wired here next.
        </p>
      </div>
    </div>
  );
}
