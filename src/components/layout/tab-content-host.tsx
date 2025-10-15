'use client';
import React from 'react';
import { useTabs } from './tabs-context';
import { cn } from '@/lib/utils';
import { Icons, type Icon } from '@/components/icons';

export default function TabContentHost({ className }: { className?: string }) {
  const { tabs, activeTabId } = useTabs();
  const active = tabs.find((t) => t.id === activeTabId);

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
        'animate-in fade-in-0 zoom-in-95 flex h-full flex-col items-center justify-center p-6',
        className
      )}
    >
      <div className='mx-auto max-w-[720px] text-center'>
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
