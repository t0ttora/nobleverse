'use client';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/icons';

export type DocsCellsHeaderProps = {
  title: string;
  onTitleChange?: (value: string) => void;
  onBackHref?: string;
  rightSlot?: React.ReactNode;
};

export function DocsCellsHeader({
  title,
  onTitleChange,
  onBackHref = '/noblesuite',
  rightSlot
}: DocsCellsHeaderProps) {
  const router = useRouter();
  return (
    <div className='bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30 w-full border-b backdrop-blur'>
      <div className='mx-auto flex h-12 max-w-screen-2xl items-center gap-2 px-3 sm:h-14 sm:px-4'>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='h-8 w-8'
          aria-label='Back'
          onClick={() => (onBackHref ? router.push(onBackHref) : router.back())}
        >
          <Icons.chevronLeft size={16} />
        </Button>
        <div className='bg-border mx-1 hidden h-6 w-px sm:block' />
        <Input
          value={title}
          onChange={(e) => onTitleChange?.(e.target.value)}
          className='focus:border-input h-8 max-w-[60%] truncate border-transparent px-2 text-base font-medium focus-visible:ring-0 sm:text-lg'
        />
        <div className='ml-auto flex items-center gap-2'>{rightSlot}</div>
      </div>
    </div>
  );
}

export default DocsCellsHeader;
