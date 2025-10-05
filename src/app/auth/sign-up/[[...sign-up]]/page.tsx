// touch: ensure tsc reads latest source
import { Metadata } from 'next';
import SignUpViewPage from '@/features/auth/components/sign-up-view';
import { getUserSession } from '../../../../../utils/supabase/server';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Authentication | Sign Up',
  description: 'Sign Up page for authentication.'
};

export default async function Page(_props: any) {
  const user = await getUserSession();
  if (user) {
    redirect('/dashboard');
  }
  // Pass the internal demo prop with underscore to satisfy typing (ts refresh)
  return <SignUpViewPage _stars={0} />;
}
