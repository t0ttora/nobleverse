import React from 'react';

interface SidePanelProps {
  open: boolean;
  title?: React.ReactNode;
  onClose: () => void;
  children?: React.ReactNode;
}

export const SidePanel: React.FC<SidePanelProps> = ({
  open,
  title,
  onClose,
  children
}) => {
  if (!open) return null;
  return (
    <>
      {/* Overlay */}
      <div
        className='fixed inset-0 z-[70] bg-black/40 transition-opacity duration-300 dark:bg-neutral-900/70'
        onClick={onClose}
        aria-label='Paneli kapatmak için tıkla'
      />
      {/* Panel */}
      <div
        className='animate-slidein fixed inset-y-0 right-0 left-0 z-[80] flex h-full w-screen translate-x-0 flex-col border-l border-neutral-200 bg-neutral-50 transition-transform duration-300 sm:left-auto sm:w-[60vw] sm:max-w-none sm:min-w-[320px] dark:border-neutral-800 dark:bg-neutral-900'
        role='dialog'
        aria-modal='true'
      >
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
        <div className='flex flex-1 flex-col overflow-y-auto p-6'>
          {children}
        </div>
        {/* Sticky footer slot */}
        <div
          id='sidepanel-footer-slot'
          className='sticky bottom-0 left-0 z-50 w-full'
        />
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
};
