import PrivacySettings from './PrivacySettings';
import { cookies } from 'next/headers';
import { createClient as createSupabaseServerClient } from '@/../utils/supabase/server';

// Next.js server component örneği
export default async function SettingsPage(_props: unknown) {
  // Kullanıcı kimliğini alın (örnek: session veya params)
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const { data } = await supabase.auth.getUser();
  const userId = data?.user?.id ?? '';
  const { data: prof } = await supabase
    .from('profiles')
    .select('details')
    .eq('id', userId)
    .maybeSingle();
  type Details = { visibility?: 'public' | 'private' } | null;
  const details = (prof?.details ?? null) as Details;
  const initialVisibility = details?.visibility ?? 'public';

  return (
    <main className='mx-auto max-w-2xl py-8'>
      <h1 className='mb-6 text-2xl font-bold'>Profile Settings</h1>
      <PrivacySettings userId={userId} initialVisibility={initialVisibility} />
    </main>
  );
}
