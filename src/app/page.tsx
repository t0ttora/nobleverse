import { redirect } from 'next/navigation';
import { getUserSession } from '@/../utils/supabase/server';
import { Header1 } from '@/components/landing/navbar';
import { Hero3 } from '@/components/landing/hero';
import { Case2 } from '@/components/landing/integrations';
import { Feature6 } from '@/components/landing/features';
import { Feature1 } from '@/components/landing/flow';
import { FAQ2 } from '@/components/landing/faq';
import { CTA1 } from '@/components/landing/cta';
import { Footer1 } from '@/components/landing/footer';

export default async function HomePage() {
  const user = await getUserSession();

  if (user) {
    redirect('/dashboard');
  }

  // Landing page for unauthenticated users
  return (
    <main className='h-max-screen relative w-full px-4 pb-4 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8'>
      <Header1 />
      <Hero3 />
    </main>
  );
}

//<Case2 /><Feature6 /><Feature1 /><FAQ2 /><CTA1 /><Footer1 />
