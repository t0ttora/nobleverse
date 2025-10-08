'use client';
import { Icons } from '@/components/icons';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

export default function NobleSuiteLayout({
  children
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const tabs = [
    {
      href: '/noblesuite/files',
      label: 'Files',
      icon: <Icons.file className='size-3.5' />
    },
    {
      href: '/noblesuite/cells',
      label: 'Cells',
      icon: <Icons.grid className='size-3.5' />
    },
    {
      href: '/noblesuite/notes',
      label: 'Notes',
      icon: <Icons.fileDescription className='size-3.5' />
    }
  ];
  return (
    <div className='flex h-full flex-col'>
      <div className='from-background/60 to-background/95 supports-[backdrop-filter]:bg-background/70 border-b bg-gradient-to-b backdrop-blur'>
        <div className='flex flex-col gap-1 px-6 pt-4 pb-2'>
          <div className='flex items-center justify-between'>
            <h1 className='flex items-center gap-2 text-lg font-semibold tracking-tight sm:text-xl'>
              <Icons.grid className='text-primary size-5' />
              <span>NobleSuite</span>
              <span className='text-muted-foreground rounded border px-1 py-0.5 text-[10px] font-medium tracking-wide uppercase'>
                Beta
              </span>
            </h1>
          </div>
          <p className='text-muted-foreground text-[11px]'>
            Files, cells & notes in one unified workspace.
          </p>
          <div className='relative mt-3 -mb-1 flex flex-wrap gap-1.5'>
            {tabs.map((t) => {
              const active = pathname?.startsWith(t.href);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={cn(
                    'focus-visible:ring-primary/40 relative inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium transition focus-visible:ring-2 focus-visible:outline-none',
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-card/70 border-border hover:border-primary/40 hover:bg-card border'
                  )}
                >
                  <span
                    className={cn(
                      'flex items-center justify-center',
                      active
                        ? 'opacity-100'
                        : 'opacity-70 group-hover:opacity-100'
                    )}
                  >
                    {t.icon}
                  </span>
                  {t.label}
                  {active && (
                    <span className='from-primary/60 via-primary to-primary/60 absolute right-0 -bottom-px left-0 h-[2px] rounded-b-sm bg-gradient-to-r' />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
      <div className='min-h-0 flex-1 overflow-auto px-2 pb-4 sm:px-4'>
        {children}
      </div>
    </div>
  );
}
