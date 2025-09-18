import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient as createSupabaseServerClient } from '@/../utils/supabase/server';

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const {
    data: { session }
  } = await supabase.auth.getSession();
  if (!session) redirect('/auth/sign-in');
  return children;
}
