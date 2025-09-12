import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const Feature1 = () => (
  <div className='w-full py-20 lg:py-40'>
    <div className='container mx-auto'>
      <div className='container grid grid-cols-1 items-center gap-8 rounded-lg border py-8 lg:grid-cols-2'>
        <div className='flex flex-col gap-10'>
          <div className='flex flex-col gap-4'>
            <div>
              <Badge variant='outline'>Platform</Badge>
            </div>
            <div className='flex flex-col gap-2'>
              <h2 className='font-regular max-w-xl text-left text-3xl tracking-tighter lg:text-5xl'>
                Something new!
              </h2>
              <p className='text-muted-foreground max-w-xl text-left text-lg leading-relaxed tracking-tight'>
                Managing a small business today is already tough.
              </p>
            </div>
          </div>
          <div className='grid grid-cols-1 items-start gap-6 sm:grid-cols-3 lg:grid-cols-1 lg:pl-6'>
            <div className='flex flex-row items-start gap-6'>
              <Check className='text-primary mt-2 h-4 w-4' />
              <div className='flex flex-col gap-1'>
                <p>Easy to use</p>
                <p className='text-muted-foreground text-sm'>
                  We&apos;ve made it easy to use and understand.
                </p>
              </div>
            </div>
            <div className='flex flex-row items-start gap-6'>
              <Check className='text-primary mt-2 h-4 w-4' />
              <div className='flex flex-col gap-1'>
                <p>Fast and reliable</p>
                <p className='text-muted-foreground text-sm'>
                  We&apos;ve made it fast and reliable.
                </p>
              </div>
            </div>
            <div className='flex flex-row items-start gap-6'>
              <Check className='text-primary mt-2 h-4 w-4' />
              <div className='flex flex-col gap-1'>
                <p>Beautiful and modern</p>
                <p className='text-muted-foreground text-sm'>
                  We&apos;ve made it beautiful and modern.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className='bg-muted aspect-square rounded-md'></div>
      </div>
    </div>
  </div>
);
