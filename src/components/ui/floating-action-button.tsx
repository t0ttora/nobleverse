'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import {
  CalendarRange,
  ClipboardList,
  ShoppingBag,
  Wand2,
  Bot,
  Rocket,
  Target
} from 'lucide-react';
import MiniCalendarPopover from '@/components/calendar/mini-calendar-popover';
import ExpandedCalendar from '@/components/calendar/expanded-calendar';
import { SidePanel } from '@/components/ui/side-panel';
import SidepanelCalendar from '@/components/calendar/sidepanel-calendar';
import { useMediaQuery } from '@/hooks/use-media-query';
import MiniTasksPopover from '@/components/tasks/mini-tasks-popover';
import MiniAIPopover from '@/components/ai/mini-ai-popover';

// A tiny, reusable icon button for the launcher with minimal, modern styling + native title
function IconButton({
  label,
  className,
  children
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant='ghost'
      size='icon'
      aria-label={label}
      title={label}
      className={cn(
        'text-foreground/80 h-9 w-9 rounded-full border border-white/15 bg-white/60 shadow-sm',
        'dark:border-white/10 dark:bg-white/5',
        'transition-colors hover:bg-white/70 dark:hover:bg-white/10',
        className
      )}
    >
      {children}
    </Button>
  );
}

export interface FabProps {
  className?: string;
}

export default function FloatingActionButton({ className }: FabProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [calExpanded, setCalExpanded] = useState(false);
  const [calSide, setCalSide] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const { isOpen: isMobile } = useMediaQuery();

  // If mobile, ensure expanded/sidepanel are closed and disabled
  React.useEffect(() => {
    if (isMobile) {
      if (calExpanded) setCalExpanded(false);
      if (calSide) setCalSide(false);
    }
  }, [isMobile]);

  // Close FAB menu on outside click or Esc
  React.useEffect(() => {
    function onDocPointerDown(e: MouseEvent) {
      if (!open) return;
      const target = e.target as Node;
      if (ref.current?.contains(target)) return; // clicking the toggle
      if (menuRef.current?.contains(target)) return; // clicking inside the menu
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={cn('fixed right-5 bottom-5 z-40', className)}>
      <div className='relative'>
        {/* FAB toggle */}
        <button
          ref={ref}
          type='button'
          title='Quick Launcher'
          aria-label='Quick Launcher'
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'bg-primary text-primary-foreground ring-offset-background focus-visible:ring-ring inline-flex size-[44px] items-center justify-center rounded-full shadow-lg outline-none hover:shadow-xl focus-visible:ring-2 focus-visible:ring-offset-2'
          )}
        >
          <Image
            src='/logomark.svg'
            width={20}
            height={20}
            alt='NobleVerse'
            className='brightness-0 invert'
          />
        </button>

        {/* Minimal adjacent launcher (vertical stack, opens upward; centered to FAB) */}
        <div
          className={cn(
            'absolute left-1/2 z-40 -translate-x-1/2 transform-gpu transition-all duration-200 ease-out motion-reduce:transform-none motion-reduce:transition-none',
            open
              ? 'pointer-events-auto opacity-100'
              : 'pointer-events-none opacity-0'
          )}
          style={{ bottom: '56px' }}
          aria-hidden={!open}
          ref={menuRef}
        >
          <div className='bg-background/80 supports-[backdrop-filter]:bg-background/60 supports-[backdrop-filter]:dark:bg-background/50 flex flex-col items-center gap-1.5 rounded-xl border border-white/10 p-2 shadow-xl backdrop-blur dark:border-white/10'>
            {/* Marketplace (neutralized accent) */}
            <IconButton label='Marketplace' className='hover:bg-white/10'>
              <ShoppingBag
                className='text-foreground/80 size-5'
                strokeWidth={1.5}
              />
            </IconButton>

            <div className='h-px w-6 bg-white/15 dark:bg-white/10' />

            {/* Calendar */}
            <div className='relative'>
              <MiniCalendarPopover
                open={calOpen}
                onOpenChange={setCalOpen}
                onExpand={
                  isMobile
                    ? () => {}
                    : () => {
                        setCalExpanded(true);
                        setCalOpen(false);
                      }
                }
                onSidePanel={
                  isMobile
                    ? () => {}
                    : () => {
                        setCalSide(true);
                        setCalOpen(false);
                      }
                }
                isMobile={isMobile}
                side='left'
                align='center'
                sideOffset={12}
                active={calOpen}
              />
            </div>

            {/* Tasks */}
            <div className='relative'>
              <MiniTasksPopover
                open={tasksOpen}
                onOpenChange={setTasksOpen}
                isMobile={isMobile}
                side='left'
                align='center'
                sideOffset={12}
                active={tasksOpen}
              />
            </div>

            {/* AI */}
            <div className='relative'>
              <MiniAIPopover
                open={aiOpen}
                onOpenChange={setAiOpen}
                side='left'
                align='center'
                sideOffset={12}
                active={aiOpen}
              />
            </div>

            {/* Actions (neutral style) */}
            <IconButton label='Actions' className='hover:bg-white/10'>
              <Rocket className='text-foreground/80 size-5' strokeWidth={1.5} />
            </IconButton>
          </div>
        </div>
      </div>

      {/* Expanded calendar overlay */}
      {!isMobile && calExpanded && (
        <ExpandedCalendar onClose={() => setCalExpanded(false)} />
      )}
      {/* Side panel calendar (mini embedded) */}
      {!isMobile && (
        <SidePanel
          open={calSide}
          onClose={() => setCalSide(false)}
          title={<span className='font-semibold'>Calendar</span>}
          footer={
            <>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => setCalSide(false)}
              >
                Cancel
              </Button>
              <Button
                variant='default'
                size='sm'
                onClick={() => {
                  // Example save action placeholder
                  setCalSide(false);
                }}
              >
                Save
              </Button>
            </>
          }
        >
          <div className='max-w-full'>
            <div className='text-muted-foreground mb-2 text-sm'>
              Quick add and browse your events.
            </div>
            <SidepanelCalendar />
          </div>
        </SidePanel>
      )}
    </div>
  );
}
