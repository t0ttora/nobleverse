import { Metadata } from 'next';
import SignUpViewPage from '@/features/auth/components/sign-up-view';
import {
  getUserSession,
  createClient
} from '../../../../../utils/supabase/server';
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
  return <SignUpViewPage stars={0} />;
}
