import * as React from 'react';

export default function EmptyState({
  icon,
  title,
  subtitle,
  action
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className='px-4 py-8 text-center text-sm'>
      <div className='mb-2 flex items-center justify-center'>
        {icon ?? (
          <span className='text-muted-foreground inline-flex h-8 w-8 items-center justify-center rounded-full border text-[11px]'>
            i
          </span>
        )}
      </div>
      <div className='font-medium'>{title}</div>
      {subtitle && (
        <div className='text-muted-foreground mt-1 text-xs'>{subtitle}</div>
      )}
      {action && <div className='mt-3'>{action}</div>}
    </div>
  );
}
