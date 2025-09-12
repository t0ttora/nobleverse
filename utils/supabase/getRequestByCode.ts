import { createClient } from '@supabase/supabase-js';

// Sunucu tarafı Supabase client'ı
function getServerSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function getRequestByCode(code: string) {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('requests')
    .select('*')
    .eq('code', code)
    .maybeSingle();
  if (error) throw error;
  return data;
}
