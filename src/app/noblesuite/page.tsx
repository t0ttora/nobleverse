import Link from 'next/link';

export default function NobleSuiteIndex() {
  return (
    <div className='p-6'>
      <h1 className='mb-3 text-xl font-semibold'>NobleSuite</h1>
      <div className='text-muted-foreground mb-4 text-sm'>
        Choose a product:
      </div>
      <div className='flex gap-3'>
        <Link
          href='/nobleautomate'
          className='hover:bg-muted rounded-md border px-3 py-2'
        >
          NobleAutomate
        </Link>
      </div>
    </div>
  );
}
