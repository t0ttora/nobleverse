import Link from 'next/link';

export const Footer1 = () => {
  const navigationItems = [
    {
      title: 'Home',
      href: '/',
      description: ''
    },
    {
      title: 'Product',
      description: 'Managing a small business today is already tough.',
      items: [
        {
          title: 'Reports',
          href: '/reports'
        },
        {
          title: 'Statistics',
          href: '/statistics'
        },
        {
          title: 'Dashboards',
          href: '/dashboards'
        },
        {
          title: 'Recordings',
          href: '/recordings'
        }
      ]
    },
    {
      title: 'Company',
      description: 'Managing a small business today is already tough.',
      items: [
        {
          title: 'About us',
          href: '/about'
        },
        {
          title: 'Fundraising',
          href: '/fundraising'
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
    }
  ];

  return (
    <div className='bg-foreground text-background w-full py-20 lg:py-40'>
      <div className='container mx-auto'>
        <div className='grid items-center gap-10 lg:grid-cols-2'>
          <div className='flex flex-col items-start gap-8'>
            <div className='flex flex-col gap-2'>
              <h2 className='font-regular max-w-xl text-left text-3xl tracking-tighter md:text-5xl'>
                TWBlocks™
              </h2>
              <p className='text-background/75 max-w-lg text-left text-lg leading-relaxed tracking-tight'>
                Managing a small business today is already tough.
              </p>
            </div>
            <div className='flex flex-row gap-20'>
              <div className='text-background/75 flex max-w-lg flex-col text-left text-sm leading-relaxed tracking-tight'>
                <p>1 Tailwind Way</p>
                <p>Menlo Park</p>
                <p>CA 94025</p>
              </div>
              <div className='text-background/75 flex max-w-lg flex-col text-left text-sm leading-relaxed tracking-tight'>
                <Link href='/'>Terms of service</Link>
                <Link href='/'>Privacy Policy</Link>
              </div>
            </div>
          </div>
          <div className='grid items-start gap-10 lg:grid-cols-3'>
            {navigationItems.map((item) => (
              <div
                key={item.title}
                className='flex flex-col items-start gap-1 text-base'
              >
                <div className='flex flex-col gap-2'>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className='flex items-center justify-between'
                    >
                      <span className='text-xl'>{item.title}</span>
                    </Link>
                  ) : (
                    <p className='text-xl'>{item.title}</p>
                  )}
                  {item.items?.map((subItem) => (
                    <Link
                      key={subItem.title}
                      href={subItem.href}
                      className='flex items-center justify-between'
                    >
                      <span className='text-background/75'>
                        {subItem.title}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
