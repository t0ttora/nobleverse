import { MoveRight, PhoneCall } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Component as HeroBackground } from '@/components/landing/hero_bg';

export const Hero3 = () => (
  <div
    className='relative min-h-[calc(100dvh-var(--lv-header-h,80px))] w-full pb-0'
    style={{ marginTop: 'var(--lv-header-h, 80px)' }}
  >
    {/* Background with rounded mask and inset gap */}
    <div
      className='pointer-events-none absolute inset-x-3 bottom-3 z-0 mt-4 sm:inset-x-6 sm:bottom-6 sm:mt-6 lg:inset-x-8 lg:bottom-8'
      style={{ top: 0 }}
    >
      <div className='relative h-full w-full overflow-hidden rounded-2xl border border-black/[0.06] sm:rounded-3xl dark:border-white/10'>
        <HeroBackground base='background' />
      </div>
    </div>
    <div
      className='absolute inset-x-3 bottom-3 z-10 mt-4 overflow-hidden rounded-2xl sm:inset-x-6 sm:bottom-6 sm:mt-6 sm:rounded-3xl lg:inset-x-8 lg:bottom-8'
      style={{ top: 0 }}
    >
      <div
        className='h-full w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10'
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className='container mx-auto flex h-full items-center justify-center text-white'>
          <div className='grid w-full grid-cols-1 items-center gap-10 lg:gap-12'>
            <div className='flex flex-col items-center gap-4 text-center lg:items-center lg:text-center'>
              <div className='flex w-full justify-center lg:justify-center'>
                <Badge variant='outline' className='border-white/30 text-white'>
                  We&apos;re on Beta!
                </Badge>
              </div>
              <div className='flex flex-col gap-4'>
                <h1 className='font-regular max-w-2xl text-center text-4xl tracking-tighter sm:text-5xl md:text-6xl lg:text-center lg:text-7xl'>
                  The backbone of{' '}
                  <em>
                    <strong>
                      <br />
                      Modern Logistics.
                    </strong>
                  </em>
                </h1>
                <p className='max-w-2xl text-center text-base leading-relaxed tracking-tight text-white/80 sm:text-lg md:text-xl lg:text-center'>
                  Unifying every player in the supply chain into a single,
                  connected ecosystem. <br />
                  Smarter, faster, and built for{' '}
                  <strong>the future of logistics</strong>.
                </p>
              </div>
              <div className='dark flex flex-row flex-wrap justify-center gap-3 sm:gap-4 lg:justify-center'>
                <Button
                  size='lg'
                  className='gap-4 border-white/30 text-white hover:bg-white/10 hover:text-white'
                  variant='outline'
                >
                  Jump on a call <PhoneCall className='h-4 w-4' />
                </Button>
                <Button
                  size='lg'
                  className='gap-4 border-white/30 text-white hover:bg-white/10 hover:text-white'
                  variant='outline'
                >
                  Sign up here <MoveRight className='h-4 w-4' />
                </Button>
              </div>
            </div>
            <div className='relative mt-8 hidden aspect-[16/9] w-full overflow-hidden rounded-xl sm:mt-10 lg:mt-0'></div>
          </div>
        </div>
      </div>
    </div>
  </div>
);
