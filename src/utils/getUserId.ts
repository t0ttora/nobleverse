import { supabase } from '../../utils/supabase/client';

export async function getUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? '';
}
