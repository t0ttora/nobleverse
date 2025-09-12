import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient as createSupabaseServerClient } from '@/../utils/supabase/server';
import { ensureProfileServer } from '@/lib/profile';

export default async function DashboardServerGuard({
  children
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const {
    data: { session }
  } = await supabase.auth.getSession();
  if (!session) {
    redirect('/auth/sign-in');
  }
  // Ensure user has a profile
  await ensureProfileServer();
  return children;
}
