'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { EmojiPicker as Frimousse } from 'frimousse';

type EmojiPickerProps = {
  onPick: (emoji: string) => void;
  className?: string;
  columns?: number;
  skinTone?:
    | 'none'
    | 'light'
    | 'medium-light'
    | 'medium'
    | 'medium-dark'
    | 'dark';
  locale?: string;
};

// A thin wrapper to keep our existing API stable while using Frimousse under the hood
export default function EmojiPicker({
  onPick,
  className,
  columns = 10,
  skinTone = 'none',
  locale = 'en'
}: EmojiPickerProps) {
  return (
    <Frimousse.Root
      className={cn(
        'bg-popover text-popover-foreground isolate flex h-[342px] w-fit flex-col',
        className
      )}
      onEmojiSelect={({ emoji }) => onPick(emoji)}
      columns={columns}
      skinTone={skinTone}
      locale={locale as any}
    >
      <Frimousse.Search className='z-10 mx-2 mt-2 appearance-none rounded-md bg-neutral-100 px-2.5 py-2 text-sm dark:bg-neutral-800' />
      <Frimousse.Viewport className='relative flex-1 outline-hidden'>
        <Frimousse.Loading className='absolute inset-0 flex items-center justify-center text-sm text-neutral-400 dark:text-neutral-500'>
          Loading…
        </Frimousse.Loading>
        <Frimousse.Empty className='absolute inset-0 flex items-center justify-center text-sm text-neutral-400 dark:text-neutral-500'>
          No emoji found.
        </Frimousse.Empty>
        <Frimousse.List
          className='pb-1.5 select-none'
          components={{
            CategoryHeader: ({ category, ...props }) => (
              <div
                className='bg-popover px-3 pt-3 pb-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400'
                {...props}
              >
                {category.label}
              </div>
            ),
            Row: ({ children, ...props }) => (
              <div className='scroll-my-1.5 px-1.5' {...props}>
                {children}
              </div>
            ),
            Emoji: ({ emoji, ...props }) => (
              <button
                className='flex size-8 cursor-pointer items-center justify-center rounded-md text-lg data-[active]:bg-neutral-100 dark:data-[active]:bg-neutral-800'
                {...props}
              >
                {emoji.emoji}
              </button>
            )
          }}
        />
      </Frimousse.Viewport>
    </Frimousse.Root>
  );
}

// Named parts export if needed elsewhere (optional)
export const EmojiPickerSearch = Frimousse.Search;
export const EmojiPickerContent = (
  props: React.ComponentProps<typeof Frimousse.List>
) => (
  <Frimousse.Viewport className='relative flex-1 outline-hidden'>
    <Frimousse.Loading className='absolute inset-0 flex items-center justify-center text-sm text-neutral-400 dark:text-neutral-500'>
      Loading…
    </Frimousse.Loading>
    <Frimousse.Empty className='absolute inset-0 flex items-center justify-center text-sm text-neutral-400 dark:text-neutral-500'>
      No emoji found.
    </Frimousse.Empty>
    <Frimousse.List
      className='pb-1.5 select-none'
      components={{
        CategoryHeader: ({ category, ...props }) => (
          <div
            className='bg-popover px-3 pt-3 pb-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400'
            {...props}
          >
            {category.label}
          </div>
        ),
        Row: ({ children, ...props }) => (
          <div className='scroll-my-1.5 px-1.5' {...props}>
            {children}
          </div>
        ),
        Emoji: ({ emoji, ...props }) => (
          <button
            className='flex size-8 items-center justify-center rounded-md text-lg data-[active]:bg-neutral-100 dark:data-[active]:bg-neutral-800'
            {...props}
          >
            {emoji.emoji}
          </button>
        )
      }}
      {...props}
    />
  </Frimousse.Viewport>
);
