'use client';
import WorkbookList from '@/features/cells/components/workbook-list';

export default function NobleSuiteCellsPage() {
  return (
    <div className='flex flex-col gap-4 p-6'>
      <div className='flex items-center justify-between'>
        <h2 className='text-base font-semibold'>Cells</h2>
        <span className='text-muted-foreground text-[10px] tracking-wide uppercase'>
          Realtime Enabled
        </span>
      </div>
      <p className='text-muted-foreground max-w-prose text-xs'>
        Create a workbook and start editing sheets collaboratively. Formulas and
        CSV are coming in stages.
      </p>
      <WorkbookList />
    </div>
  );
}
