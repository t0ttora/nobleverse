'use client';

import { Button } from '@/components/ui/button';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger
} from '@/components/ui/navigation-menu';
import { Menu, MoveRight, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export const Header1 = () => {
  const headerRef = useRef<HTMLElement | null>(null);
  // Expose header height to CSS so content can start right after it
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const setVar = () => {
      const h = el.getBoundingClientRect().height || 80;
      document.documentElement.style.setProperty('--lv-header-h', `${h}px`);
    };
    setVar();
    const ro = new ResizeObserver(() => setVar());
    ro.observe(el);
    window.addEventListener('resize', setVar);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', setVar);
    };
  }, []);
  const router = useRouter();
  const navigationItems = [
    {
      title: 'Home',
      href: '/',
      description: ''
    },
    {
      title: 'Product',
      description:
        'Discover how NobleVerse helps you manage logistics smarter.',
      items: [
        {
          title: 'Features',
          href: '/product/features'
        },
        {
          title: 'Use Cases',
          href: '/product/use-cases'
        },
        {
          title: 'Integrations',
          href: '/product/integrations'
        },
        {
          title: 'Security',
          href: '/product/security'
        }
      ]
    },
    {
      title: 'Company',
      description: 'Learn more about who we are and our mission.',
      items: [
        {
          title: 'About us',
          href: '/about'
        },
        {
          title: 'Careers',
          href: '/careers'
        },
        {
          title: 'Investors',
          href: '/investors'
        },
        {
          title: 'Contact us',
          href: '/contact'
        }
      ]
    },
    {
      title: 'Resources',
      description: 'Guides and insights to get the most out of NobleVerse.',
      items: [
        {
          title: 'Blog',
          href: '/blog'
        },
        {
          title: 'Help Center',
          href: '/help'
        },
        {
          title: 'Case Studies',
          href: '/case-studies'
        },
        {
          title: 'Docs',
          href: '/docs'
        }
      ]
    }
  ];

  const [isOpen, setOpen] = useState(false);
  return (
    <header
      ref={headerRef}
      className='bg-background fixed top-0 left-0 z-50 w-full'
    >
      <div className='relative container mx-auto flex min-h-20 flex-row items-center gap-4 px-4 sm:px-6 lg:grid lg:grid-cols-3'>
        <div className='hidden flex-row items-center justify-start gap-4 lg:flex'>
          <NavigationMenu className='flex items-start justify-start'>
            <NavigationMenuList className='flex flex-row justify-start gap-4'>
              {navigationItems.map((item) => (
                <NavigationMenuItem key={item.title}>
                  {item.href ? (
                    <>
                      <NavigationMenuLink>
                        <Button variant='ghost'>{item.title}</Button>
                      </NavigationMenuLink>
                    </>
                  ) : (
                    <>
                      <NavigationMenuTrigger className='text-sm font-medium'>
                        {item.title}
                      </NavigationMenuTrigger>
                      <NavigationMenuContent className='z-50 !w-[450px] p-4'>
                        <div className='flex grid-cols-2 flex-col gap-4 lg:grid'>
                          <div className='flex h-full flex-col justify-between'>
                            <div className='flex flex-col'>
                              <p className='text-base'>{item.title}</p>
                              <p className='text-muted-foreground text-sm'>
                                {item.description}
                              </p>
                            </div>
                            <Button size='sm' className='mt-10'>
                              Learn more
                            </Button>
                          </div>
                          <div className='flex h-full flex-col justify-end text-sm'>
                            {item.items?.map((subItem) => (
                              <NavigationMenuLink
                                href={subItem.href}
                                key={subItem.title}
                                className='hover:bg-muted flex flex-row items-center justify-between rounded px-4 py-2'
                              >
                                <span>{subItem.title}</span>
                                <MoveRight className='text-muted-foreground h-4 w-4' />
                              </NavigationMenuLink>
                            ))}
                          </div>
                        </div>
                      </NavigationMenuContent>
                    </>
                  )}
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>
        </div>
        <div className='flex lg:justify-center'>
          <Link
            href='/'
            aria-label='NobleVerse home'
            className='inline-flex items-center'
          >
            <Image
              src='/logomark.svg'
              alt='NobleVerse logo'
              width={28}
              height={28}
              priority
              className='h-7 w-7 md:h-8 md:w-8 dark:invert'
            />
          </Link>
        </div>
        <div className='flex w-full justify-end gap-4'>
          <Button
            variant='outline'
            onClick={() => {
              void router.push('/auth/sign-in');
            }}
          >
            Sign in
          </Button>
          <Button
            onClick={() => {
              void router.push('/auth/sign-up');
            }}
          >
            Get started
          </Button>
        </div>
        <div className='flex w-12 shrink-0 items-end justify-end lg:hidden'>
          <Button
            variant='ghost'
            aria-label='Toggle menu'
            aria-expanded={isOpen}
            aria-controls='mobile-menu'
            onClick={() => setOpen(!isOpen)}
          >
            {isOpen ? <X className='h-5 w-5' /> : <Menu className='h-5 w-5' />}
          </Button>
          {isOpen && (
            <div
              id='mobile-menu'
              className='bg-background absolute right-0 left-0 z-50 flex w-full flex-col gap-6 overflow-y-auto border-t px-4 py-4 shadow-lg sm:px-6'
              style={{
                top: 'var(--lv-header-h)',
                maxHeight: 'calc(100dvh - var(--lv-header-h))'
              }}
            >
              {navigationItems.map((item) => (
                <div key={item.title}>
                  <div className='flex flex-col gap-2'>
                    {item.href ? (
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className='flex items-center justify-between'
                      >
                        <span className='text-lg'>{item.title}</span>
                        <MoveRight className='text-muted-foreground h-4 w-4 stroke-1' />
                      </Link>
                    ) : (
                      <p className='text-lg'>{item.title}</p>
                    )}
                    {item.items?.map((subItem) => (
                      <Link
                        key={subItem.title}
                        href={subItem.href}
                        onClick={() => setOpen(false)}
                        className='flex items-center justify-between'
                      >
                        <span className='text-muted-foreground'>
                          {subItem.title}
                        </span>
                        <MoveRight className='h-4 w-4 stroke-1' />
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              {null}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
