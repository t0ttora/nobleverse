'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface OfferCountProps extends React.HTMLAttributes<HTMLSpanElement> {
  count: number;
  labeled?: boolean; // whether to show the word 'offers'
  size?: 'sm' | 'md';
}

export function OfferCount({
  count,
  labeled = false,
  size = 'sm',
  className,
  ...rest
}: OfferCountProps) {
  if (!count || count <= 0) return null;
  const base =
    'inline-flex items-center justify-center rounded-full border text-foreground/80 bg-muted/60 dark:bg-muted/30 border-muted/40 dark:border-neutral-700';
  const sizing =
    size === 'sm'
      ? 'text-[10px] h-5 min-w-[18px] px-1.5 py-0'
      : 'text-xs h-6 min-w-[22px] px-2 py-0';
  return (
    <span className={cn(base, sizing, className)} {...rest}>
      {count}
      {labeled ? <span className='ml-1'>offers</span> : null}
    </span>
  );
}
