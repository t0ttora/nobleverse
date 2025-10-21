'use client';
import React from 'react';
import SuiteHeader from '@/components/suite/suite-header';

export default function NobleCellsPage() {
  const [title, setTitle] = React.useState('Untitled Cells');
  return (
    <div className='flex h-full min-h-[calc(100vh-3.5rem)] flex-col'>
      <SuiteHeader title={title} onTitleChange={setTitle} />
      <div className='mx-auto w-full max-w-5xl flex-1 px-3 py-6 sm:px-4'>
        <div className='text-muted-foreground rounded-md border p-6'>
          Cells editor placeholder. Integration coming soon.
        </div>
      </div>
    </div>
  );
}
