'use client';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import SupabaseSignUpForm from './supabase-signup-form';
import { Metadata } from 'next';
import Link from 'next/link';
import dynamic from 'next/dynamic';
const DarkVeil = dynamic(() => import('./darkveil'), {
  ssr: false,
  // Render nothing until client mounts to avoid layout thrash
  loading: () => null
});

export const metadata: Metadata = {
  title: 'Authentication',
  description: 'Authentication forms built using the components.'
};

export default function SignUpViewPage({ _stars }: { _stars: number }) {
  return (
    <div className='relative h-screen flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0'>
      <Link
        href='/examples/authentication'
        className={cn(
          buttonVariants({ variant: 'ghost' }),
          'absolute top-4 right-4 hidden md:top-8 md:right-8'
        )}
      >
        Sign Up
      </Link>
      <div className='bg-muted relative hidden h-full flex-col p-10 text-white lg:flex dark:border-r'>
        {/* DarkVeil as background */}
        <div className='absolute inset-0 z-0'>
          <DarkVeil />
        </div>
        {/* Make overlay semi-transparent */}
        <div className='absolute inset-0 z-10' />
        <div className='relative z-20 flex items-center text-lg font-medium'>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
            className='mr-2 h-6 w-6'
          >
            <path d='M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3' />
          </svg>
          NobleVerse
        </div>
        <div className='relative z-20 mt-auto'>
          <blockquote className='space-y-2'>
            <p className='text-lg'>
              &ldquo;NobleVerse streamlined our logistics operations into one
              platform. What used to take days of coordination now happens in
              hours—with full visibility and control.&rdquo;
            </p>
            <footer className='text-sm'>Global Freight Manager</footer>
          </blockquote>
        </div>
      </div>
      <div className='flex h-full items-center justify-center p-4 lg:p-8'>
        <div className='flex w-full max-w-md flex-col items-center justify-center space-y-6'>
          <SupabaseSignUpForm />
          <p className='text-muted-foreground px-8 text-center text-sm'>
            By clicking continue, you agree to our{' '}
            <Link
              href='/terms'
              className='hover:text-primary underline underline-offset-4'
            >
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link
              href='/privacy'
              className='hover:text-primary underline underline-offset-4'
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
