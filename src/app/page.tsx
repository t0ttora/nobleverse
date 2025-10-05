import { Header1 } from '@/components/landing/navbar';
import { Hero3 } from '@/components/landing/hero';

export default async function HomePage() {
  // Landing page for unauthenticated users
  return (
    <main className='h-max-screen relative w-full px-4 pb-4 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8'>
      <Header1 />
      <Hero3 />
    </main>
  );
}

// Formerly: <Case2 /><Feature6 /><Feature1 /><FAQ2 /><CTA1 /><Footer1 />
