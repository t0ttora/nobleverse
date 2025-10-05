import React from 'react';
import ReactDOM from 'react-dom';
import { cn } from '@/lib/utils';

interface SidePanelProps {
  open: boolean;
  title?: React.ReactNode;
  onClose: () => void;
  children?: React.ReactNode;
  zIndexBase?: number; // base z-index for overlay; panel uses base+10
  footer?: React.ReactNode; // persistent footer actions / buttons
  footerClassName?: string; // custom classnames for footer container
}

export const SidePanel: React.FC<SidePanelProps> = ({
  open,
  title,
  onClose,
  children,
  // Much higher base z-index so panel stack is above FAB and other overlays
  zIndexBase = 200,
  footer,
  footerClassName
}) => {
  if (!open) return null;

  // Guard for SSR – only portal on client
  if (typeof window === 'undefined') {
    return null;
  }

  const panelContent = (
    <>
      {/* Overlay */}
      <div
        className='fixed inset-0 bg-black/40 transition-opacity duration-300 dark:bg-neutral-900/70'
        style={{ zIndex: zIndexBase }}
        onClick={(_e) => {
          // Emit custom event to allow intermediate UIs (offer details) to intercept
          const ev = new CustomEvent('noble:sidepanel:overlay-click', {
            cancelable: true
          });
          const cancelled = !window.dispatchEvent(ev);
          if (!cancelled) onClose();
        }}
        aria-label='Paneli kapatmak için tıkla'
      />
      {/* Panel */}
      <div
        data-nv-sidepanel='true'
        className='animate-slidein fixed top-2 right-2 bottom-2 left-auto flex w-[95vw] max-w-none min-w-[320px] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 shadow-2xl transition-transform duration-300 sm:w-[80vw] lg:w-[60vw] dark:border-neutral-800 dark:bg-neutral-900'
        style={{
          zIndex: zIndexBase + 10,
          ['--side-panel-width' as any]: '60vw',
          ['--side-panel-gap' as any]: '12px'
        }}
        role='dialog'
        aria-modal='true'
        ref={(el) => {
          if (!el) return;
          // Observe width changes to broadcast custom event for split views
          try {
            const ro = new (window as any).ResizeObserver((entries: any) => {
              for (const entry of entries) {
                const w = entry.contentRect?.width;
                if (typeof w === 'number') {
                  window.dispatchEvent(
                    new CustomEvent('noble:sidepanel:resize', {
                      detail: { width: w }
                    })
                  );
                }
              }
            });
            ro.observe(el);
            // Store on element for potential cleanup
            (el as any).__ro = ro;
          } catch {}
        }}
      >
        {/* Header */}
        <div className='flex items-center justify-between border-b border-neutral-200 p-4 dark:border-neutral-800'>
          <span className='text-lg font-semibold text-neutral-900 capitalize dark:text-neutral-100'>
            {title}
          </span>
          <button
            onClick={onClose}
            className='text-2xl font-bold text-neutral-500 hover:text-neutral-900 focus:outline-none dark:hover:text-neutral-100'
            aria-label='Close panel'
          >
            &times;
          </button>
        </div>
        {/* Content + Footer layout */}
        <div className='flex flex-1 flex-col overflow-hidden'>
          <div className='flex-1 overflow-y-auto p-6 pb-8'>{children}</div>
          <div
            className={cn(
              'relative z-10 border-t border-neutral-200/80 bg-neutral-50/90 backdrop-blur supports-[backdrop-filter]:bg-neutral-50/70 dark:border-neutral-800/70 dark:bg-neutral-900/90 dark:supports-[backdrop-filter]:bg-neutral-900/70',
              'flex h-16 shrink-0 items-center justify-end gap-2 px-5',
              footerClassName
            )}
            role='contentinfo'
          >
            {footer ? (
              footer
            ) : (
              // Backward compatibility: expose old portal mount point if footer not provided
              // TODO: Deprecate and remove 'sidepanel-footer-slot' after all usages migrate to footer prop.
              <div
                id='sidepanel-footer-slot'
                className='flex w-full justify-end gap-2'
              />
            )}
          </div>
        </div>
      </div>
      {/* Slide animasyonu için Tailwind keyframes */}
      <style jsx global>{`
        @keyframes slidein {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slidein {
          animation: slidein 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
    </>
  );

  return ReactDOM.createPortal(panelContent, document.body);
};
