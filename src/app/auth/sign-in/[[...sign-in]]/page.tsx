import { Metadata } from 'next';
import SignInViewPage from '@/features/auth/components/sign-in-view';
import { getUserSession } from '../../../../../utils/supabase/server';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Authentication | Sign In',
  description: 'Sign In page for authentication.'
};

import { createClient } from '../../../../../utils/supabase/server';

export default async function Page(_props: any) {
  const user = await getUserSession();
  if (user) {
    redirect('/dashboard');
  }
  return <SignInViewPage stars={0} />;
}
